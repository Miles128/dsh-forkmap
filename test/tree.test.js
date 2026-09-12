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
});
