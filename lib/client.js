window.__ModuleLoader__.load({
  id: "lumina-dsh-map",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const h = React.createElement;

    const NS = "lumina-map";
    const STYLE_ID = "lumina-dsh-map/client.css";
    const DICTS = {
      zh: {
        "view.map": "地图",
        "empty": "还没有可显示的会话。Fork 一条对话后会出现分支。",
        "fork": "分叉",
        "open": "打开",
        "status.current": "当前",
        "status.running": "进行中",
        "status.pending": "待确认",
        "status.done": "完成",
      },
      en: {
        "view.map": "Map",
        "empty": "No sessions to show. Fork a chat to grow a branch.",
        "fork": "Fork",
        "open": "Open",
        "status.current": "Current",
        "status.running": "Running",
        "status.pending": "Waiting",
        "status.done": "Done",
      },
    };

    const CSS = String.raw`
.lumina-map {
  height: 100%;
  overflow: auto;
  padding: 16px 20px 32px;
  box-sizing: border-box;
  color: var(--ds-text, #171a1f);
}
.lumina-map-empty {
  margin: 48px auto;
  max-width: 28em;
  text-align: center;
  color: var(--ds-text-muted, #7b818c);
  line-height: 1.5;
}
.lumina-map-canvas { display: block; min-width: 100%; }
.lumina-map-edge { fill: none; stroke: var(--ds-border, rgba(27, 31, 36, 0.18)); stroke-width: 1.5; }
.lumina-map-node {
  cursor: pointer;
}
.lumina-map-node rect {
  fill: var(--ds-bg-soft, #f5f6f8);
  stroke: var(--ds-border, rgba(27, 31, 36, 0.14));
  stroke-width: 1;
}
.lumina-map-node.is-active rect {
  fill: var(--ds-bg, #fff);
  stroke: var(--ds-accent, #4d6bfe);
  stroke-width: 2;
}
.lumina-map-node.is-running rect { stroke: #3b82f6; }
.lumina-map-node.is-pending rect { stroke: #d97706; }
.lumina-map-title {
  font: 600 12px/1.3 ui-sans-serif, system-ui, sans-serif;
  fill: var(--ds-text, #171a1f);
}
.lumina-map-meta {
  font: 11px/1.3 ui-sans-serif, system-ui, sans-serif;
  fill: var(--ds-text-muted, #7b818c);
}
.lumina-map-fork {
  cursor: pointer;
}
.lumina-map-fork rect { fill: transparent; }
.lumina-map-fork text {
  font: 600 10px/1 ui-sans-serif, system-ui, sans-serif;
  fill: var(--ds-accent, #4d6bfe);
}
body[data-ds-dark-theme] .lumina-map-node rect { fill: #232324; stroke: rgba(255,255,255,0.12); }
body[data-ds-dark-theme] .lumina-map-node.is-active rect { fill: #2c2c2e; }
body[data-ds-dark-theme] .lumina-map-title { fill: #f3f4f6; }
body[data-ds-dark-theme] .lumina-map-edge { stroke: rgba(255,255,255,0.16); }
`;

    const NODE_W = 220;
    const NODE_H = 56;
    const PAD = 24;
    const GAP_X = 28;
    const STEP_Y = 84;
    const TREE_GAP_Y = 36;

    function buildMapForest(sessions, opts = {}) {
      const currentId = opts.currentId ?? "";
      const visible = [];
      for (const raw of sessions) {
        if (!raw || typeof raw.id !== "string" || !raw.id) continue;
        if (raw.origin === "subagent") continue;
        if (raw.blank && raw.id !== currentId) continue;
        visible.push(raw);
      }
      const byId = new Map(visible.map((s) => [s.id, s]));
      const childMap = new Map();
      for (const s of visible) childMap.set(s.id, []);
      const attached = new Set();
      for (const s of visible) {
        const pid = typeof s.parentId === "string" ? s.parentId : "";
        if (!pid || pid === s.id || !byId.has(pid)) continue;
        if (createsCycle(s.id, pid, childMap)) continue;
        childMap.get(pid).push(s.id);
        attached.add(s.id);
      }
      for (const kids of childMap.values()) {
        kids.sort((a, b) => {
          const da = byId.get(a)?.updatedAt ?? 0;
          const db = byId.get(b)?.updatedAt ?? 0;
          if (da !== db) return da - db;
          return a < b ? -1 : a > b ? 1 : 0;
        });
      }
      const roots = visible.filter((s) => !attached.has(s.id)).map((s) => s.id);
      const nodes = visible.map((s) => ({
        id: s.id,
        parentId: attached.has(s.id) ? String(s.parentId) : "",
        childIds: childMap.get(s.id) ?? [],
        title: s.displayTitle || s.id,
        running: Boolean(s.running),
        completed: Boolean(s.completed),
        pending: Boolean(s.pendingInteraction),
        active: s.id === currentId,
        updatedAt: s.updatedAt ?? 0,
      }));
      return { nodes, roots };
    }

    function createsCycle(childId, parentId, childMap) {
      const stack = [childId];
      const seen = new Set();
      while (stack.length) {
        const id = stack.pop();
        if (id === parentId) return true;
        if (seen.has(id)) continue;
        seen.add(id);
        const kids = childMap.get(id);
        if (kids) stack.push(...kids);
      }
      return false;
    }

    function computeForestLayout(forest) {
      const byId = new Map(forest.nodes.map((n) => [n.id, n]));
      const positions = {};
      let cursorY = PAD;
      let maxRight = PAD;
      for (const rootId of forest.roots) {
        if (!byId.has(rootId)) continue;
        const subtreeW = measure(rootId, byId);
        place(rootId, 0, PAD, cursorY, byId, positions);
        cursorY = maxBottom(rootId, byId, positions) + TREE_GAP_Y;
        maxRight = Math.max(maxRight, PAD + subtreeW);
      }
      return {
        positions,
        width: Math.max(maxRight + PAD, NODE_W + PAD * 2),
        height: Math.max(cursorY + PAD - TREE_GAP_Y, NODE_H + PAD * 2),
        nodeWidth: NODE_W,
        nodeHeight: NODE_H,
      };
    }

    function measure(id, byId) {
      const kids = (byId.get(id)?.childIds ?? []).filter((k) => byId.has(k));
      if (!kids.length) return NODE_W;
      let total = 0;
      for (const k of kids) total += measure(k, byId);
      total += GAP_X * (kids.length - 1);
      return Math.max(NODE_W, total);
    }

    function place(id, depth, left, originY, byId, positions) {
      if (!byId.has(id) || positions[id]) return;
      const kids = (byId.get(id)?.childIds ?? []).filter((k) => byId.has(k));
      const width = measure(id, byId);
      positions[id] = { x: left + (width - NODE_W) / 2, y: originY + depth * STEP_Y };
      let childLeft = left;
      for (const k of kids) {
        const w = measure(k, byId);
        place(k, depth + 1, childLeft, originY, byId, positions);
        childLeft += w + GAP_X;
      }
    }

    function maxBottom(id, byId, positions) {
      let bottom = (positions[id]?.y ?? 0) + NODE_H;
      for (const k of byId.get(id)?.childIds ?? []) {
        if (byId.has(k)) bottom = Math.max(bottom, maxBottom(k, byId, positions));
      }
      return bottom;
    }

    function ensureStyle() {
      if (typeof document === "undefined") return;
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    function statusLabel(node, t) {
      if (node.active) return t("status.current");
      if (node.pending) return t("status.pending");
      if (node.running) return t("status.running");
      if (node.completed) return t("status.done");
      return "";
    }

    function edgePath(from, to) {
      const x1 = from.x + NODE_W / 2;
      const y1 = from.y + NODE_H;
      const x2 = to.x + NODE_W / 2;
      const y2 = to.y;
      const mid = (y1 + y2) / 2;
      return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
    }

    function MapView(props) {
      ensureStyle();
      const useSessions = props.useSessions;
      const list = useSessions((s) => s);
      const sessions = (list.ids ?? []).map((id) => list.byId[id]).filter(Boolean);
      const forest = buildMapForest(sessions, { currentId: list.current ?? props.sessionId ?? "" });
      const layout = computeForestLayout(forest);
      const byId = Object.fromEntries(forest.nodes.map((n) => [n.id, n]));
      const t = (key) => {
        const bound = props.t;
        if (typeof bound === "function") {
          const value = bound(key);
          if (value && value !== key) return value;
        }
        return DICTS.zh[key] ?? DICTS.en[key] ?? key;
      };

      if (!forest.nodes.length) {
        return h("div", { className: "lumina-map" }, h("p", { className: "lumina-map-empty" }, t("empty")));
      }

      const edges = [];
      for (const node of forest.nodes) {
        const parent = byId[node.parentId];
        if (!parent) continue;
        const a = layout.positions[parent.id];
        const b = layout.positions[node.id];
        if (!a || !b) continue;
        edges.push(h("path", { key: `${parent.id}->${node.id}`, className: "lumina-map-edge", d: edgePath(a, b) }));
      }

      const cards = forest.nodes.map((node) => {
        const pos = layout.positions[node.id];
        if (!pos) return null;
        const cls = [
          "lumina-map-node",
          node.active ? "is-active" : "",
          node.running ? "is-running" : "",
          node.pending ? "is-pending" : "",
        ].filter(Boolean).join(" ");
        const title = node.title.length > 28 ? `${node.title.slice(0, 27)}…` : node.title;
        const meta = statusLabel(node, t);
        return h(
          "g",
          {
            key: node.id,
            className: cls,
            transform: `translate(${pos.x} ${pos.y})`,
            onClick: (event) => {
              event.stopPropagation();
              props.openSession?.(node.id);
            },
          },
          h("rect", { width: NODE_W, height: NODE_H, rx: 10, ry: 10 }),
          h("text", { className: "lumina-map-title", x: 12, y: 22 }, title),
          meta ? h("text", { className: "lumina-map-meta", x: 12, y: 40 }, meta) : null,
          h(
            "g",
            {
              className: "lumina-map-fork",
              onClick: (event) => {
                event.stopPropagation();
                props.forkSession?.(node.id);
              },
            },
            h("rect", { x: NODE_W - 52, y: 8, width: 44, height: 18, rx: 4 }),
            h("text", { x: NODE_W - 30, y: 21, textAnchor: "middle" }, t("fork")),
          ),
        );
      });

      return h(
        "div",
        { className: "lumina-map" },
        h(
          "svg",
          {
            className: "lumina-map-canvas",
            width: layout.width,
            height: layout.height,
            viewBox: `0 0 ${layout.width} ${layout.height}`,
          },
          edges,
          cards,
        ),
      );
    }

    const inject = ["slots", "sessions", "locale"];

    function apply(ctx) {
      if (ctx.locale?.register) {
        ctx.effect(() => ctx.locale.register(NS, DICTS), "lumina-map: dictionaries");
      }
      const t = ctx.locale?.bind ? ctx.locale.bind(NS) : (key) => DICTS.zh[key] ?? key;
      ctx.slots.inject("conversation.view", () =>
        ctx.slots.register(
          {
            name: "conversation.view",
            id: "map",
            order: 20,
            locale: NS,
            label: () => t("view.map"),
            inject: () => ({
              openSession: (id) => ctx.sessions.open(id),
              forkSession: (id) => {
                Promise.resolve(ctx.sessions.fork({ sessionId: id, increaseTitle: true }))
                  .then((childId) => { ctx.sessions.open(childId); })
                  .catch(() => {});
              },
            }),
          },
          MapView,
        ));
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.__testing = { buildMapForest, computeForestLayout };
    return module.exports;
  },
});
