import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildMapForest, computeForestLayout } from "../lib/tree.js";

const libRoot = dirname(fileURLToPath(new URL("../lib/client.js", import.meta.url)));
const source = readFileSync(join(libRoot, "client.js"), "utf8");

/** Load lib/client.js in a mocked ModuleLoader context and grab its __testing exports. */
function loadClientTesting() {
  let loaded;
  const ctx = createContext({
    window: {
      __ModuleLoader__: {
        load(entry) {
          loaded = entry.factory(() => ({ createElement: () => null }));
        },
      },
    },
  });
  runInContext(source, ctx);
  assert.ok(loaded?.__testing, "client.js must export __testing");
  return loaded.__testing;
}

// Objects from the vm realm carry a different Object prototype, so deepEqual
// (strict) would reject them; normalize through JSON before comparing.
const same = (a, b, msg) =>
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), msg);

function session(id, extras = {}) {
  return {
    id,
    displayTitle: extras.displayTitle ?? id,
    parentId: extras.parentId,
    origin: extras.origin,
    blank: extras.blank ?? false,
    running: extras.running ?? false,
    completed: extras.completed ?? false,
    pendingInteraction: extras.pendingInteraction,
    updatedAt: extras.updatedAt ?? 0,
  };
}

const FIXTURES = [
  { name: "single root", sessions: [session("a")], currentId: "" },
  {
    name: "fork tree",
    sessions: [
      session("root"),
      session("old", { parentId: "root", updatedAt: 10 }),
      session("new", { parentId: "root", updatedAt: 20 }),
      session("leaf", { parentId: "old", updatedAt: 30 }),
    ],
    currentId: "new",
  },
  {
    name: "subagent excluded",
    sessions: [
      session("root"),
      session("worker", { parentId: "root", origin: "subagent" }),
      session("orphan", { parentId: "worker" }),
    ],
    currentId: "root",
  },
  {
    name: "blank hidden except current",
    sessions: [session("live"), session("draft", { blank: true }), session("open", { blank: true })],
    currentId: "open",
  },
  {
    name: "cycle",
    sessions: [session("a", { parentId: "b" }), session("b", { parentId: "a" })],
    currentId: "a",
  },
  {
    name: "self parent and dangling parent",
    sessions: [session("self", { parentId: "self" }), session("dangling", { parentId: "ghost" })],
    currentId: "",
  },
  {
    name: "deep chain",
    sessions: Array.from({ length: 12 }, (_, i) =>
      session(`n${i}`, { parentId: i === 0 ? undefined : `n${i - 1}`, updatedAt: i * 5 }),
    ),
    currentId: "n11",
  },
  {
    name: "wide fanout with ties",
    sessions: [
      session("root"),
      ...Array.from({ length: 8 }, (_, i) => session(`k${i}`, { parentId: "root", updatedAt: 0 })),
    ],
    currentId: "k3",
  },
];

describe("client/tree consistency (inline copy must match lib/tree.js)", () => {
  const client = loadClientTesting();

  for (const fx of FIXTURES) {
    it(`${fx.name}: buildMapForest matches`, () => {
      const fromLib = buildMapForest(fx.sessions, { currentId: fx.currentId });
      const fromClient = client.buildMapForest(fx.sessions, { currentId: fx.currentId });
      same(fromClient, fromLib);
    });

    it(`${fx.name}: computeForestLayout matches`, () => {
      const forest = buildMapForest(fx.sessions, { currentId: fx.currentId });
      same(client.computeForestLayout(forest), computeForestLayout(forest));
    });
  }

  it("random forests match across 200 seeded cases", () => {
    let seed = 20260915;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let round = 0; round < 200; round++) {
      const count = 1 + Math.floor(rand() * 30);
      const sessions = Array.from({ length: count }, (_, i) =>
        session(`s${i}`, {
          parentId: i > 0 && rand() < 0.8 ? `s${Math.floor(rand() * i)}` : undefined,
          origin: rand() < 0.15 ? "subagent" : undefined,
          blank: rand() < 0.1,
          updatedAt: Math.floor(rand() * 1000),
        }),
      );
      const currentId = rand() < 0.7 ? sessions[Math.floor(rand() * count)].id : "";
      const fromLib = buildMapForest(sessions, { currentId });
      const fromClient = client.buildMapForest(sessions, { currentId });
      same(fromClient, fromLib);
      same(client.computeForestLayout(fromLib), computeForestLayout(fromLib));
    }
  });
});
