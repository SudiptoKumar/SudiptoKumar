// Road graph: 34 named nodes, 37 edges (from the lock). NPC pathfinding uses
// these edges — never straight-line shortcuts (lock §4).
import { ROAD_NODES, ROAD_EDGES, inBounds, dist } from './constants.mjs';

const nodeMap = new Map(ROAD_NODES.map((n) => [n.id, { ...n }]));

/** All nodes in lock order: {id, x, y}. */
export const nodes = () => ROAD_NODES.map((n) => ({ ...n }));
export const nodeById = (id) => (nodeMap.has(id) ? { ...nodeMap.get(id) } : null);

/** All edges in lock order: {id, from, to, via}. */
export const edges = () => ROAD_EDGES.map((e) => ({ id: e.id, from: e.from, to: e.to, via: e.via.map((v) => [...v]) }));

/** Absolute world coords of an edge's full path: from -> via... -> to. */
export function edgePath(edge) {
  const a = nodeMap.get(edge.from); const b = nodeMap.get(edge.to);
  if (!a || !b) throw new Error(`road edge ${edge.id} references unknown node`);
  return [{ x: a.x, y: a.y }, ...edge.via.map(([x, y]) => ({ x, y })), { x: b.x, y: b.y }];
}

// Road hierarchy (lock §4): the castle/market/harbor spine renders as major
// roads; everything else is minor. Shared with the renderer so world
// clearance and road paint agree on class.
const SPINE_NODES = new Set([
  'castle_gate', 'royal_plaza', 'market_square', 'main_bridge', 'harbor_junction',
  'harbor_docks', 'west_gate', 'east_gate', 'builder_yard', 'courier_station',
]);

/** Edge class from its endpoints: major if either end is a spine node. */
export const isMajorEdge = (edge) =>
  SPINE_NODES.has(edge.from) || SPINE_NODES.has(edge.to);

/** Adjacency list (undirected — NPCs travel both ways). */
function adjacency() {
  const adj = new Map([...nodeMap.keys()].map((id) => [id, []]));
  for (const e of ROAD_EDGES) {
    adj.get(e.from).push({ to: e.to, edge: e });
    adj.get(e.to).push({ to: e.from, edge: e });
  }
  return adj;
}

/** Every node reachable from `start` (BFS). Lock invariant: all 34 reachable from castle_gate. */
export function reachableFrom(start = 'castle_gate') {
  const adj = adjacency();
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    for (const { to } of adj.get(cur) ?? []) {
      if (!seen.has(to)) { seen.add(to); queue.push(to); }
    }
  }
  return [...seen];
}

/**
 * Route between two named nodes: shortest edge path (BFS), returned as a flat
 * list of absolute waypoints with consecutive duplicates removed.
 * Returns null when no route exists (callers must handle; tests forbid this
 * for all lock nodes).
 */
export function routeBetween(fromId, toId) {
  if (!nodeMap.has(fromId) || !nodeMap.has(toId)) return null;
  if (fromId === toId) { const n = nodeMap.get(fromId); return [{ x: n.x, y: n.y }]; }
  const adj = adjacency();
  const prev = new Map([[fromId, null]]);
  const queue = [fromId];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === toId) break;
    for (const { to, edge } of adj.get(cur)) {
      if (!prev.has(to)) { prev.set(to, { node: cur, edge }); queue.push(to); }
    }
  }
  if (!prev.has(toId)) return null;
  // rebuild edge chain, then stitch waypoint lists
  const chain = [];
  let cur = toId;
  while (cur !== fromId) {
    const p = prev.get(cur);
    chain.unshift({ from: p.node, to: cur, edge: p.edge });
    cur = p.node;
  }
  const points = [];
  for (const step of chain) {
    const fwd = step.edge.from === step.from; // travel direction along the edge
    let pts = edgePath(step.edge);
    if (!fwd) pts = [...pts].reverse();
    for (const pt of pts) {
      const last = points[points.length - 1];
      if (!last || last.x !== pt.x || last.y !== pt.y) points.push({ ...pt });
    }
  }
  return points;
}

/** Nearest node to a world point (for plot facing + anchor connectivity). */
export function nearestNode(x, y) {
  let best = null; let bestD = Infinity;
  for (const n of ROAD_NODES) {
    const d = dist(x, y, n.x, n.y);
    if (d < bestD) { bestD = d; best = n; }
  }
  return { id: best.id, x: best.x, y: best.y, distance: bestD };
}

/** Minimum distance from a point to any road segment (nodes + via polylines). */
export function distanceToRoad(x, y) {
  return minRoadDist(x, y, () => true);
}

/** Minimum distance from a point to any MAJOR road segment (the castle /
 * market / harbor spine). Major roads render wider, so placement keeps a
 * larger berth from them. */
export function distanceToMajorRoad(x, y) {
  return minRoadDist(x, y, isMajorEdge);
}

function minRoadDist(x, y, keep) {
  let best = Infinity;
  for (const e of ROAD_EDGES) {
    if (!keep(e)) continue;
    const pts = edgePath(e);
    for (let i = 0; i < pts.length - 1; i++) {
      best = Math.min(best, distToSeg(x, y, pts[i], pts[i + 1]));
    }
  }
  return best;
}
function distToSeg(px, py, a, b) {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.min(1, Math.max(0, ((px - a.x) * dx + (py - a.y) * dy) / len2));
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
}

/** Sanity: every node inside the 2048x1536 bounds. */
export function nodesInBounds() {
  return ROAD_NODES.every((n) => inBounds(n.x, n.y));
}
