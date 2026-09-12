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
      ["register", "conversation.view", "map", 20],
    ]);
  });
});
