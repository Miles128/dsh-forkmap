import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildMapForest, computeForestLayout } from "../lib/tree.js";

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

describe("buildMapForest", () => {
  it("hides subagent sessions and treats their children as roots", () => {
    const forest = buildMapForest([
      session("root"),
      session("worker", { parentId: "root", origin: "subagent" }),
      session("fork", { parentId: "worker" }),
    ]);

    assert.deepEqual(
      forest.nodes.map((n) => n.id).sort(),
      ["fork", "root"],
    );
    assert.equal(forest.nodes.find((n) => n.id === "fork").parentId, "");
    assert.deepEqual(forest.roots, ["root", "fork"]);
  });

  it("links ordinary forks under their parent and keeps sibling order by updatedAt", () => {
    const forest = buildMapForest([
      session("root"),
      session("old", { parentId: "root", updatedAt: 10 }),
      session("new", { parentId: "root", updatedAt: 20 }),
    ]);

    const root = forest.nodes.find((n) => n.id === "root");
    assert.deepEqual(root.childIds, ["old", "new"]);
    assert.equal(forest.nodes.find((n) => n.id === "new").parentId, "root");
    assert.deepEqual(forest.roots, ["root"]);
  });

  it("hides blank sessions except the current one", () => {
    const forest = buildMapForest(
      [session("live"), session("draft", { blank: true }), session("open-blank", { blank: true })],
      { currentId: "open-blank" },
    );

    assert.deepEqual(
      forest.nodes.map((n) => n.id).sort(),
      ["live", "open-blank"],
    );
  });

  it("breaks parent cycles by promoting one node to a root", () => {
    const forest = buildMapForest([
      session("a", { parentId: "b" }),
      session("b", { parentId: "a" }),
    ]);

    assert.equal(forest.nodes.length, 2);
    assert.ok(forest.roots.length >= 1);
    const byId = Object.fromEntries(forest.nodes.map((n) => [n.id, n]));
    for (const id of forest.roots) {
      assert.equal(byId[id].parentId, "");
    }
  });

  it("marks the current session active", () => {
    const forest = buildMapForest([session("a"), session("b")], { currentId: "b" });
    assert.equal(forest.nodes.find((n) => n.id === "b").active, true);
    assert.equal(forest.nodes.find((n) => n.id === "a").active, false);
  });

  it("treats self-parents and dangling parents as roots", () => {
    const forest = buildMapForest([
      session("self", { parentId: "self" }),
      session("dangling", { parentId: "ghost" }),
    ]);

    assert.deepEqual(forest.roots.sort(), ["dangling", "self"]);
    for (const n of forest.nodes) assert.equal(n.parentId, "");
  });

  it("breaks deterministic tie-breaks by id when updatedAt is equal", () => {
    const forest = buildMapForest([
      session("root"),
      session("zz", { parentId: "root", updatedAt: 5 }),
      session("aa", { parentId: "root", updatedAt: 5 }),
    ]);

    assert.deepEqual(forest.nodes.find((n) => n.id === "root").childIds, ["aa", "zz"]);
  });

  it("keeps every visible node reachable from some root", () => {
    const sessions = [
      session("r1"),
      session("r2"),
      session("c1", { parentId: "r1" }),
      session("c2", { parentId: "c1" }),
      session("sub", { parentId: "r2", origin: "subagent" }),
      session("blank-hidden", { blank: true }),
    ];
    const forest = buildMapForest(sessions, { currentId: "" });

    const seen = new Set();
    const walk = (id) => {
      if (seen.has(id)) return;
      seen.add(id);
      for (const k of forest.nodes.find((n) => n.id === id)?.childIds ?? []) walk(k);
    };
    for (const r of forest.roots) walk(r);
    assert.equal(seen.size, forest.nodes.length);
  });
});

describe("computeForestLayout", () => {
  it("places a parent above its children and siblings side by side", () => {
    const forest = buildMapForest([
      session("root"),
      session("left", { parentId: "root", updatedAt: 1 }),
      session("right", { parentId: "root", updatedAt: 2 }),
    ]);
    const layout = computeForestLayout(forest);

    assert.ok(layout.positions.root.y < layout.positions.left.y);
    assert.equal(layout.positions.left.y, layout.positions.right.y);
    assert.ok(layout.positions.left.x < layout.positions.right.x);
    assert.ok(layout.width > 0);
    assert.ok(layout.height > 0);
  });

  it("keeps parent y strictly above child y along a deep chain", () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      session(`n${i}`, { parentId: i === 0 ? undefined : `n${i - 1}` }),
    );
    const layout = computeForestLayout(buildMapForest(sessions));

    for (let i = 1; i < 10; i++) {
      assert.ok(layout.positions[`n${i - 1}`].y < layout.positions[`n${i}`].y);
    }
  });

  it("stacks separate trees vertically without overlap", () => {
    const layout = computeForestLayout(
      buildMapForest([session("a1"), session("a2", { parentId: "a1" }), session("b1"), session("b2", { parentId: "b1" })]),
    );

    assert.ok(layout.positions.a2.y < layout.positions.b1.y);
    assert.ok(layout.height >= layout.positions.b2.y + layout.nodeHeight);
  });
});
