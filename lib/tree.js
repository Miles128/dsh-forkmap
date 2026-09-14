/** Build a conversation-map forest from DSH session list rows. */

const NODE_W = 220;
const NODE_H = 56;
const PAD = 24;
const GAP_X = 28;
const STEP_Y = 84;
const TREE_GAP_Y = 36;

/**
 * @typedef {object} SessionRow
 * @property {string} id
 * @property {string} [displayTitle]
 * @property {string} [parentId]
 * @property {'subagent'} [origin]
 * @property {boolean} [blank]
 * @property {boolean} [running]
 * @property {boolean} [completed]
 * @property {string} [pendingInteraction]
 * @property {number} [updatedAt]
 */

/**
 * @param {readonly SessionRow[]} sessions
 * @param {{ currentId?: string }} [opts]
 */
export function buildMapForest(sessions, opts = {}) {
  const currentId = opts.currentId ?? "";
  const visible = [];
  for (const raw of sessions) {
    if (!raw || typeof raw.id !== "string" || !raw.id) continue;
    if (raw.origin === "subagent") continue;
    if (raw.blank && raw.id !== currentId) continue;
    visible.push(raw);
  }

  const byId = new Map(visible.map((s) => [s.id, s]));
  /** @type {Map<string, string[]>} */
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

/**
 * @param {string} childId
 * @param {string} parentId
 * @param {Map<string, string[]>} childMap
 */
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

/**
 * @param {{ nodes: { id: string, childIds: string[] }[], roots: string[] }} forest
 */
export function computeForestLayout(forest) {
  const byId = new Map(forest.nodes.map((n) => [n.id, n]));
  /** @type {Record<string, { x: number, y: number }>} */
  const positions = {};
  let cursorY = PAD;
  let maxRight = PAD;

  for (const rootId of forest.roots) {
    if (!byId.has(rootId)) continue;
    const subtreeW = measure(rootId, byId);
    place(rootId, 0, PAD, cursorY, byId, positions);
    const bottom = maxBottom(rootId, byId, positions);
    cursorY = bottom + TREE_GAP_Y;
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
  positions[id] = {
    x: left + (width - NODE_W) / 2,
    y: originY + depth * STEP_Y,
  };
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
