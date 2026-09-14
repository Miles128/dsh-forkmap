import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(new URL("../lib/client.js", import.meta.url)));
const source = readFileSync(join(root, "client.js"), "utf8");

describe("client module", () => {
  it("registers a conversation.view tab named map", () => {
    let loaded;
    const ctx = createContext({
      window: {
        __ModuleLoader__: {
          load(entry) {
            loaded = entry.factory(() => ({
              createElement: () => null,
            }));
          },
        },
      },
    });
    runInContext(source, ctx);

    assert.deepEqual([...loaded.inject], ["slots", "sessions", "locale"]);
    const recorded = [];
    loaded.apply({
      locale: {
        register: () => () => {},
        bind: () => (key) => key,
      },
      effect: (fn) => fn(),
      slots: {
        inject: (name, factory) => {
          recorded.push(["inject", name]);
          factory();
        },
        register: (options) => {
          recorded.push(["register", options.name, options.id, options.order]);
        },
      },
      sessions: { open() {}, fork: async () => "child" },
    });
    assert.deepEqual(recorded, [
      ["inject", "conversation.view"],
      ["register", "conversation.view", "forkmap", 20],
    ]);
  });

  it("exposes timeAgo with sane unit boundaries", () => {
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
    const { timeAgo } = loaded.__testing;
    const now = Date.now();

    assert.equal(timeAgo(0), "");
    assert.equal(timeAgo("x"), "");
    assert.equal(timeAgo(-5), "");
    assert.equal(timeAgo(now + 1000), ""); // future timestamps stay blank
    assert.equal(timeAgo(now - 59_000), "<1m");
    assert.equal(timeAgo(now - 90_000), "1m");
    assert.equal(timeAgo(now - 5 * 60_000), "5m");
    assert.equal(timeAgo(now - 3 * 3600_000), "3h");
    assert.equal(timeAgo(now - 2 * 86400_000), "2d");
    assert.equal(timeAgo(Math.floor((now - 90_000) / 1000)), "1m"); // seconds input
  });
});
