// Core boolean regions and generated planar-graph structure. Canvas computes
// bounded, deterministic guides for authoring; native Preview remains the
// authority for robust boolean outlines and large arrangements.

import { argName, argNumber, num } from "../args.js";
import { defFor, preferReference, registerEntity, type Box, type GeometryContext } from "../registry.js";
import type {
  BooleanCtor, BooleanOperation, BooleanRegionEntity, DualEntity, RegionsEntity,
  SceneDoc, SceneEntity, SpanTreeEntity,
} from "../types.js";
import { baseEntity } from "./base.js";
import { areaPoints, graphSamples, tangentGeometry } from "./calculus.js";
import { derivedPathPoints, supportGeometry } from "./core.js";
import { bracePoints, linkGeometry } from "./dependent.js";
import { circle2Geometry, rightAnglePoints, segmentGeometry } from "./geometry.js";
import { lsystemGeometry } from "./patterns.js";

export interface TopologyPoint { x: number; y: number; }
export interface TopologySegment { from: TopologyPoint; to: TopologyPoint; }
export interface BooleanGeometry { a: TopologyPoint[][]; b: TopologyPoint[][]; bounds: Box; issue: string | null; }
export interface RegionsGeometry { faces: TopologyPoint[][]; totalFaces: number; segments: TopologySegment[]; bounds: Box; issue: string | null; }
export interface SpanTreeGeometry { tree: TopologySegment[]; cotree: TopologySegment[]; bounds: Box; issue: string | null; }
export interface DualGeometry { faces: TopologyPoint[][]; nodes: TopologyPoint[]; edges: TopologySegment[]; outer: TopologyPoint | null; bounds: Box; issue: string | null; }

export const TOPOLOGY_CANVAS_SEGMENT_CAP = 800;
export const TOPOLOGY_CANVAS_FACE_CAP = 300;

const BOOLEAN_CTORS = ["union", "intersect", "intersection", "difference", "subtract", "exclusion", "xor"] as const;
const BOOLEAN_FILL_KINDS = ["circle", "rect", "dot", "polygon", "ellipse", "circle2", "framebox", "safezone"] as const;
const BOOLEAN_FILL_SET = new Set<string>(BOOLEAN_FILL_KINDS);
const BOUNDARY_KINDS = BOOLEAN_FILL_KINDS;
const BOUNDARY_SET = new Set<string>(BOUNDARY_KINDS);
const EDGE_KINDS = [
  "line", "arrow", "link", "support", "brace", "bracelabel", "bracetext",
  "segment", "vector", "ellipse", "circle2", "rightangle", "plot", "deriv",
  "accum", "tangent", "area", "lsystem", "invertpath", "reflectpath",
  "regions", "spantree", "dual",
] as const;
const EDGE_SET = new Set<string>(EDGE_KINDS);

export function booleanOperation(spelling: BooleanCtor): BooleanOperation {
  if (spelling === "intersect" || spelling === "intersection") return "intersection";
  if (spelling === "difference" || spelling === "subtract") return "difference";
  if (spelling === "exclusion" || spelling === "xor") return "xor";
  return "union";
}

function rotate(point: TopologyPoint, center: TopologyPoint, degrees: number): TopologyPoint {
  if (!degrees) return { ...point };
  const radians = degrees * Math.PI / 180, sin = Math.sin(radians), cos = Math.cos(radians);
  const dx = point.x - center.x, dy = point.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

function ringSegments(points: readonly TopologyPoint[]): TopologySegment[] {
  return points.length < 2 ? [] : points.map((from, index) => ({ from, to: points[(index + 1) % points.length] }));
}

function openSegments(points: readonly TopologyPoint[]): TopologySegment[] {
  return points.slice(1).map((to, index) => ({ from: points[index], to }));
}

function boxOfPoints(points: readonly TopologyPoint[], fallback: Box = { x: 0, y: 0, width: 1, height: 1 }): Box {
  if (points.length === 0) return fallback;
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
}

function boxOfSegments(segments: readonly TopologySegment[], fallback?: Box): Box {
  return boxOfPoints(segments.flatMap((segment) => [segment.from, segment.to]), fallback);
}

function unionBoxes(boxes: readonly Box[]): Box {
  if (boxes.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
  const x = Math.min(...boxes.map((box) => box.x)), y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width)), bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}

function ellipseRing(x: number, y: number, rx: number, ry: number, degrees: number, count: number): TopologyPoint[] {
  const center = { x, y };
  return Array.from({ length: count }, (_unused, index) => rotate({ x: x + rx * Math.cos(Math.PI * 2 * index / count), y: y + ry * Math.sin(Math.PI * 2 * index / count) }, center, degrees));
}

/** Closed Canvas-known outlines accepted by native fill/arrangement constructors. */
export function topologyRings(entity: SceneEntity, ctx: GeometryContext): TopologyPoint[][] {
  if (entity.kind === "circle" || entity.kind === "dot") return [ellipseRing(entity.x, entity.y, entity.r, entity.r, 0, entity.kind === "circle" ? 128 : 28)];
  if (entity.kind === "circle2") { const circle = circle2Geometry(entity, ctx); return [ellipseRing(circle.center.x, circle.center.y, circle.radius, circle.radius, 0, 128)]; }
  if (entity.kind === "ellipse") return [ellipseRing(entity.x, entity.y, entity.rx, entity.ry, entity.angle + entity.rotation, 96)];
  if (entity.kind === "polygon") {
    const center = entity.points.reduce((sum, point) => ({ x: sum.x + point.x / entity.points.length, y: sum.y + point.y / entity.points.length }), { x: 0, y: 0 });
    return [entity.points.map((point) => rotate(point, center, entity.rotation))];
  }
  if (entity.kind === "rect") {
    const center = { x: entity.x, y: entity.y }, hw = entity.width / 2, hh = entity.height / 2;
    return [[{ x: entity.x - hw, y: entity.y - hh }, { x: entity.x + hw, y: entity.y - hh }, { x: entity.x + hw, y: entity.y + hh }, { x: entity.x - hw, y: entity.y + hh }].map((point) => rotate(point, center, entity.rotation))];
  }
  if (entity.kind === "framebox" || entity.kind === "safezone") {
    const box = defFor(entity).bounds(entity, ctx), center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    return [[{ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y }, { x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y + box.height }].map((point) => rotate(point, center, entity.rotation))];
  }
  return [];
}

/** Native `shape_segments` deliberately reads constructor geometry without
 * applying later `rot` modifiers; boolean conversion, above, does apply them. */
function arrangementRings(entity: SceneEntity, ctx: GeometryContext): TopologyPoint[][] {
  if (entity.kind === "polygon") return [[...entity.points]];
  if (entity.kind === "ellipse") return [ellipseRing(entity.x, entity.y, entity.rx, entity.ry, entity.angle, 96)];
  if (entity.kind === "rect") {
    const hw = entity.width / 2, hh = entity.height / 2;
    return [[{ x: entity.x - hw, y: entity.y - hh }, { x: entity.x + hw, y: entity.y - hh }, { x: entity.x + hw, y: entity.y + hh }, { x: entity.x - hw, y: entity.y + hh }]];
  }
  if (entity.kind === "framebox" || entity.kind === "safezone") {
    const box = defFor(entity).bounds(entity, ctx);
    return [[{ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y }, { x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y + box.height }]];
  }
  return topologyRings(entity, ctx);
}

function segmentsForEntity(entity: SceneEntity, ctx: GeometryContext, seen: Set<string>): TopologySegment[] {
  const rings = arrangementRings(entity, ctx);
  if (rings.length) return rings.flatMap(ringSegments);
  if (entity.kind === "line" || entity.kind === "arrow") return [{ from: { x: entity.x1, y: entity.y1 }, to: { x: entity.x2, y: entity.y2 } }];
  if (entity.kind === "segment") { const line = segmentGeometry(entity, ctx); return [{ from: line.from, to: line.to }]; }
  if (entity.kind === "vector") return [{ from: { x: entity.x, y: entity.y }, to: { x: entity.x + entity.dx, y: entity.y - entity.dy } }];
  if (entity.kind === "tangent") { const line = tangentGeometry(entity, ctx); return [{ from: line.from, to: line.to }]; }
  if (entity.kind === "link") { const line = linkGeometry(entity, ctx); return [{ from: line.from, to: line.to }]; }
  if (entity.kind === "rightangle") return openSegments(rightAnglePoints(entity, ctx));
  if (entity.kind === "brace" || entity.kind === "bracelabel" || entity.kind === "bracetext") return openSegments(bracePoints(entity.x1, entity.y1, entity.x2, entity.y2, entity.depth, entity.kind === "brace" ? entity.direction : null).points);
  if (entity.kind === "plot" || entity.kind === "deriv" || entity.kind === "accum") return openSegments(graphSamples(entity, ctx, 240));
  if (entity.kind === "area") return ringSegments(areaPoints(entity, ctx));
  if (entity.kind === "lsystem") return entity.boundary === "open" ? openSegments(lsystemGeometry(entity).points) : ringSegments(lsystemGeometry(entity).points);
  if (entity.kind === "invertpath" || entity.kind === "reflectpath") return openSegments(derivedPathPoints(entity, ctx));
  if (entity.kind === "support") { const geometry = supportGeometry(entity); return [{ from: geometry.from, to: geometry.to }, ...geometry.ticks]; }
  if (entity.kind === "regions") return regionsGeometry(entity, ctx, seen).faces.flatMap(ringSegments);
  if (entity.kind === "spantree") return spanTreeGeometry(entity, ctx, seen).tree;
  if (entity.kind === "dual") return dualGeometry(entity, ctx, seen).edges;
  return [];
}

/** Resolve one native entity-or-tag argument to its Canvas-known segments. */
export function topologySegments(ref: string, ctx: GeometryContext, seen = new Set<string>()): TopologySegment[] {
  if (seen.has(ref)) return [];
  const nextSeen = new Set(seen).add(ref), exact = ctx.entity(ref);
  if (exact) return segmentsForEntity(exact, ctx, nextSeen);
  return ctx.doc.entities.filter((entity) => entity.tags?.includes(ref)).flatMap((entity) => segmentsForEntity(entity, ctx, nextSeen));
}

function boundedSegments(refs: readonly string[], ctx: GeometryContext, seen: Set<string>): { segments: TopologySegment[]; issue: string | null } {
  if (refs.length === 0) return { segments: [], issue: null };
  const all = refs.flatMap((ref) => topologySegments(ref, ctx, seen));
  if (all.length === 0) return { segments: [], issue: "No Canvas-known segments resolve from the selected entity/tag references." };
  if (all.length > TOPOLOGY_CANVAS_SEGMENT_CAP) return { segments: all.slice(0, TOPOLOGY_CANVAS_SEGMENT_CAP), issue: `Canvas limits this arrangement to ${TOPOLOGY_CANVAS_SEGMENT_CAP.toLocaleString()} source segments; Preview uses all ${all.length.toLocaleString()}.` };
  return { segments: all, issue: null };
}

export function booleanGeometry(entity: BooleanRegionEntity, ctx?: GeometryContext): BooleanGeometry {
  if (!ctx) return { a: [], b: [], bounds: { x: 0, y: 0, width: 1, height: 1 }, issue: "Boolean operands are unavailable." };
  const aEntity = ctx.entity(entity.a), bEntity = ctx.entity(entity.b);
  const a = aEntity ? topologyRings(aEntity, ctx) : [], b = bEntity ? topologyRings(bEntity, ctx) : [];
  const boxes = [ctx.bounds(entity.a), ctx.bounds(entity.b)].filter((box): box is Box => Boolean(box));
  const issue = !a.length || !b.length ? "Canvas cannot resolve both fillable operand silhouettes; Preview remains authoritative." : null;
  return { a, b, bounds: unionBoxes(boxes), issue };
}

const SNAP = .08, T_EPS = 1e-4;
function segmentIntersection(a: TopologyPoint, b: TopologyPoint, c: TopologyPoint, d: TopologyPoint): TopologyPoint | null {
  const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y };
  const cross = (u: TopologyPoint, v: TopologyPoint) => u.x * v.y - u.y * v.x;
  const denominator = cross(r, s);
  if (Math.abs(denominator) < 1e-9) return null;
  const ac = { x: c.x - a.x, y: c.y - a.y }, t = cross(ac, s) / denominator, u = cross(ac, r) / denominator;
  return t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6 ? { x: a.x + r.x * t, y: a.y + r.y * t } : null;
}

function splitSegments(segments: readonly TopologySegment[]): TopologySegment[] {
  const edges: TopologySegment[] = [];
  segments.forEach((segment, index) => {
    const dx = segment.to.x - segment.from.x, dy = segment.to.y - segment.from.y, length2 = dx * dx + dy * dy;
    if (length2 < SNAP * SNAP) return;
    const ts = [0, 1];
    segments.forEach((other, otherIndex) => {
      if (index === otherIndex) return;
      const hit = segmentIntersection(segment.from, segment.to, other.from, other.to);
      if (!hit) return;
      const t = ((hit.x - segment.from.x) * dx + (hit.y - segment.from.y) * dy) / length2;
      if (t > T_EPS && t < 1 - T_EPS) ts.push(t);
    });
    ts.sort((a, b) => a - b);
    const unique = ts.filter((value, at) => at === 0 || Math.abs(value - ts[at - 1]) >= 1e-4);
    for (let at = 0; at + 1 < unique.length; at += 1) {
      const from = { x: segment.from.x + dx * unique[at], y: segment.from.y + dy * unique[at] };
      const to = { x: segment.from.x + dx * unique[at + 1], y: segment.from.y + dy * unique[at + 1] };
      if (Math.hypot(to.x - from.x, to.y - from.y) > SNAP) edges.push({ from, to });
    }
  });
  return edges;
}

function signedArea(poly: readonly TopologyPoint[]): number {
  return poly.reduce((sum, point, index) => { const next = poly[(index + 1) % poly.length]; return sum + point.x * next.y - next.x * point.y; }, 0) * .5;
}

/** TypeScript port of the native snapped half-edge face walk. */
export function topologyFaces(segments: readonly TopologySegment[]): TopologyPoint[][] {
  const edges = splitSegments(segments), vertices: TopologyPoint[] = [], cells = new Map<string, number>();
  const intern = (point: TopologyPoint) => {
    const kx = Math.round(point.x / SNAP), ky = Math.round(point.y / SNAP);
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
      const found = cells.get(`${kx + dx},${ky + dy}`);
      if (found !== undefined && Math.hypot(vertices[found].x - point.x, vertices[found].y - point.y) <= SNAP) return found;
    }
    vertices.push(point); const id = vertices.length - 1; cells.set(`${kx},${ky}`, id); return id;
  };
  const halfEdges: [number, number][] = [], seen = new Set<string>();
  for (const edge of edges) {
    const u = intern(edge.from), v = intern(edge.to); if (u === v) continue;
    const key = `${Math.min(u, v)},${Math.max(u, v)}`; if (seen.has(key)) continue; seen.add(key);
    halfEdges.push([u, v], [v, u]);
  }
  if (!halfEdges.length) return [];
  const outgoing = Array.from({ length: vertices.length }, () => [] as number[]);
  halfEdges.forEach(([from], index) => outgoing[from].push(index));
  outgoing.forEach((list) => list.sort((a, b) => {
    const [af, at] = halfEdges[a], [bf, bt] = halfEdges[b];
    return Math.atan2(vertices[at].y - vertices[af].y, vertices[at].x - vertices[af].x) - Math.atan2(vertices[bt].y - vertices[bf].y, vertices[bt].x - vertices[bf].x);
  }));
  const positions = new Array<number>(halfEdges.length).fill(0);
  outgoing.forEach((list) => list.forEach((edge, index) => { positions[edge] = index; }));
  const next = (edge: number) => { const vertex = halfEdges[edge][1], ring = outgoing[vertex], position = positions[edge ^ 1]; return ring[(position + ring.length - 1) % ring.length]; };
  const visited = new Array<boolean>(halfEdges.length).fill(false), faces: TopologyPoint[][] = [];
  for (let start = 0; start < halfEdges.length; start += 1) {
    if (visited[start]) continue;
    const face: TopologyPoint[] = []; let edge = start, guard = 0;
    do { visited[edge] = true; face.push(vertices[halfEdges[edge][0]]); edge = next(edge); guard += 1; } while (edge !== start && guard <= halfEdges.length + 4);
    if (face.length >= 3) faces.push(face);
  }
  if (!faces.length) return [];
  const outer = faces.reduce((best, face, index) => Math.abs(signedArea(face)) > Math.abs(signedArea(faces[best])) ? index : best, 0);
  faces.splice(outer, 1);
  return faces.filter((face) => Math.abs(signedArea(face)) > 1).map((face) => signedArea(face) < 0 ? [...face].reverse() : face);
}

export function regionsGeometry(entity: RegionsEntity, ctx?: GeometryContext, seen = new Set<string>()): RegionsGeometry {
  const fallback = ctx?.bounds(entity.boundary) ?? { x: 0, y: 0, width: 1, height: 1 };
  if (!ctx) return { faces: [], totalFaces: 0, segments: [], bounds: fallback, issue: "Region dependencies are unavailable." };
  const boundary = topologySegments(entity.boundary, ctx, seen), collected = boundedSegments(entity.dividers, ctx, seen);
  const combined = [...boundary, ...collected.segments], segments = combined.slice(0, TOPOLOGY_CANVAS_SEGMENT_CAP);
  if (boundary.length < 3) return { faces: [], totalFaces: 0, segments, bounds: fallback, issue: "Regions needs a Canvas-known closed boundary." };
  const allFaces = topologyFaces(segments), capped = allFaces.slice(0, TOPOLOGY_CANVAS_FACE_CAP);
  const capIssue = combined.length > segments.length ? `Canvas limits this arrangement to ${segments.length.toLocaleString()} of ${combined.length.toLocaleString()} source segments; Preview uses all.` : allFaces.length > capped.length ? `Canvas shows ${capped.length.toLocaleString()} of ${allFaces.length.toLocaleString()} faces; Preview draws all.` : null;
  return { faces: capped, totalFaces: allFaces.length, segments, bounds: boxOfPoints(capped.flat(), fallback), issue: collected.issue ?? capIssue };
}

function snappedNode(point: TopologyPoint, nodes: TopologyPoint[]): number {
  const found = nodes.findIndex((node) => Math.hypot(node.x - point.x, node.y - point.y) <= .5);
  if (found >= 0) return found; nodes.push(point); return nodes.length - 1;
}

export function spanTreeGeometry(entity: SpanTreeEntity, ctx?: GeometryContext, seen = new Set<string>()): SpanTreeGeometry {
  if (!ctx) return { tree: [], cotree: [], bounds: { x: 0, y: 0, width: 1, height: 1 }, issue: "Edge dependencies are unavailable." };
  const collected = boundedSegments(entity.edges, ctx, seen), nodes: TopologyPoint[] = [];
  const pairs = collected.segments.map((segment) => [snappedNode(segment.from, nodes), snappedNode(segment.to, nodes)] as const);
  const parent = nodes.map((_node, index) => index), find = (start: number) => { let root = start; while (parent[root] !== root) root = parent[root]; let current = start; while (parent[current] !== current) { const next = parent[current]; parent[current] = root; current = next; } return root; };
  const tree: TopologySegment[] = [], cotree: TopologySegment[] = [];
  pairs.forEach(([a, b], index) => { const ra = find(a), rb = find(b); if (ra !== rb) { parent[ra] = rb; tree.push(collected.segments[index]); } else cotree.push(collected.segments[index]); });
  return { tree, cotree, bounds: boxOfSegments(collected.segments), issue: collected.issue };
}

function pointOnBoundary(face: readonly TopologyPoint[], point: TopologyPoint, tolerance: number): boolean {
  return face.some((from, index) => {
    const to = face[(index + 1) % face.length], dx = to.x - from.x, dy = to.y - from.y, length2 = dx * dx + dy * dy;
    if (length2 < 1e-6) return false;
    const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / length2));
    return Math.hypot(from.x + dx * t - point.x, from.y + dy * t - point.y) <= tolerance;
  });
}

export function dualGeometry(entity: DualEntity, ctx?: GeometryContext, seen = new Set<string>()): DualGeometry {
  const fallback = ctx?.bounds(entity.boundary) ?? { x: 0, y: 0, width: 1, height: 1 };
  if (!ctx) return { faces: [], nodes: [], edges: [], outer: null, bounds: fallback, issue: "Dual dependencies are unavailable." };
  const boundary = topologySegments(entity.boundary, ctx, seen), collected = boundedSegments(entity.dividers, ctx, seen), combined = [...boundary, ...collected.segments], source = combined.slice(0, TOPOLOGY_CANVAS_SEGMENT_CAP);
  if (boundary.length < 3) return { faces: [], nodes: [], edges: [], outer: null, bounds: fallback, issue: "Dual needs a Canvas-known closed boundary." };
  const allFaces = topologyFaces(source), faces = allFaces.slice(0, TOPOLOGY_CANVAS_FACE_CAP);
  if (!faces.length) return { faces, nodes: [], edges: [], outer: null, bounds: fallback, issue: "The Canvas arrangement contains no enclosed face." };
  const centers = faces.map((face) => face.reduce((sum, point) => ({ x: sum.x + point.x / face.length, y: sum.y + point.y / face.length }), { x: 0, y: 0 }));
  const faceBox = boxOfPoints(faces.flat(), fallback), outer = { x: faceBox.x + faceBox.width / 2, y: faceBox.y - 70 };
  const edges: TopologySegment[] = [];
  for (const sourceEdge of source) {
    const midpoint = { x: (sourceEdge.from.x + sourceEdge.to.x) / 2, y: (sourceEdge.from.y + sourceEdge.to.y) / 2 };
    const touching = faces.map((_face, index) => index).filter((index) => pointOnBoundary(faces[index], midpoint, 2.5));
    if (touching.length === 2) edges.push({ from: centers[touching[0]], to: centers[touching[1]] });
    else if (touching.length === 1) edges.push({ from: centers[touching[0]], to: outer });
  }
  const nodes = [...centers, outer], bounds = unionBoxes([boxOfPoints(nodes), boxOfSegments(edges)]);
  const issue = collected.issue ?? (combined.length > source.length ? `Canvas limits the dual to ${source.length.toLocaleString()} of ${combined.length.toLocaleString()} source segments; Preview uses all.` : allFaces.length > faces.length ? `Canvas shows ${faces.length.toLocaleString()} of ${allFaces.length.toLocaleString()} dual faces; Preview uses all.` : null);
  return { faces, nodes, edges, outer, bounds, issue };
}

function candidates(doc: SceneDoc | undefined, kinds: Set<string>): SceneEntity[] {
  return doc?.entities.filter((entity) => kinds.has(entity.kind) && entity.origin !== "generated") ?? [];
}

function candidateRefs(doc: SceneDoc | undefined, kinds: Set<string>): string[] {
  const entities = candidates(doc, kinds);
  return [...new Set(entities.flatMap((entity) => [entity.id, ...(entity.tags ?? [])]))];
}

function replaceList(items: string[], from: string, to: string) { for (let index = 0; index < items.length; index += 1) if (items[index] === from) items[index] = to; }
function groupLines(entity: RegionsEntity | SpanTreeEntity | DualEntity, defaultColor: string): string[] {
  return [
    ...(entity.color === defaultColor ? [] : [`color(${entity.id}, ${entity.color});`]),
    ...(entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`]),
  ];
}
function hiddenLine(id: string, reveal: "none" | "fade" | "grow"): string[] { return reveal === "none" ? [] : [`hidden(${id}${reveal === "grow" ? ", center" : ""});`]; }
registerEntity<BooleanRegionEntity>({
  kind: "boolean", ctor: "union", aliases: ["intersect", "intersection", "difference", "subtract", "exclusion", "xor"],
  group: "Shapes", label: "Boolean region", icon: "∪", order: 30, fidelity: "semantic", colorInCtor: true, movable: false,
  hint: "Union, intersection, difference, or exclusion of two earlier filled shapes",
  canCreate: (doc) => candidates(doc, BOOLEAN_FILL_SET).length >= 2,
  createBlockedReason: "Boolean region needs two earlier Canvas-known filled shapes.",
  create(id, _x, _y, doc, selectedId) {
    const pool = candidates(doc, BOOLEAN_FILL_SET), a = preferReference(doc, selectedId, (entity) => BOOLEAN_FILL_SET.has(entity.kind)) ?? pool.at(-1), b = [...pool].reverse().find((entity) => entity.id !== a?.id);
    return { ...baseEntity(id, "lime"), kind: "boolean", spelling: "union", a: a?.id ?? "a", b: b?.id ?? "b", paint: "default", strokeWidth: null, outlineColor: null };
  },
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), a = argName(stmt.args, 1), b = argName(stmt.args, 2), color = argName(stmt.args, 3) ?? "lime";
    if (!id || !a || !b || !BOOLEAN_CTORS.includes(stmt.name as BooleanCtor) || stmt.args.length > 4) return null;
    return { ...baseEntity(id, color), kind: "boolean", spelling: stmt.name as BooleanCtor, a, b, paint: "default", strokeWidth: null, outlineColor: null };
  },
  ctorLine: (entity) => `${entity.spelling}(${entity.id}, ${entity.a}, ${entity.b}${entity.color === "lime" ? "" : `, ${entity.color}`});`,
  extraLines(entity) {
    return [
      ...(entity.paint === "default" ? [] : [`${entity.paint}(${entity.id});`]),
      ...(entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`]),
      ...(entity.outlineColor === null ? [] : [`outline(${entity.id}, ${entity.outlineColor});`]),
    ];
  },
  modifiers: {
    outlined(entity) { entity.paint = "outlined"; return true; },
    filled(entity) { entity.paint = "filled"; return true; },
    stroke(entity, stmt) { const width = argNumber(stmt.args, 1); if (width === null) return false; entity.strokeWidth = width; return true; },
    outline(entity, stmt) { const color = argName(stmt.args, 1); if (!color) return false; entity.outlineColor = color; return true; },
  },
  references: (entity) => [entity.a, entity.b],
  replaceReference(entity, from, to) { if (entity.a === from) entity.a = to; if (entity.b === from) entity.b = to; },
  anchor(entity, ctx) { const box = this.bounds(entity, ctx); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, translate() {},
  bounds: (entity, ctx) => booleanGeometry(entity, ctx).bounds, handles: () => [], dragHandle() {},
  fields: [
    { key: "spelling", label: "Boolean operation", input: "select", options: BOOLEAN_CTORS },
    { key: "a", label: "First shape", input: "entity", entityKinds: BOOLEAN_FILL_KINDS, referencesEarlierOnly: true },
    { key: "b", label: "Second shape", input: "entity", entityKinds: BOOLEAN_FILL_KINDS, referencesEarlierOnly: true },
    { key: "paint", label: "Paint", input: "select", options: ["default", "filled", "outlined"] },
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: .5, max: 30, step: .5 },
    { key: "outlineColor", label: "Outline", input: "color", nullable: true },
  ],
});

registerEntity<RegionsEntity>({
  kind: "regions", ctor: "regions", group: "Geometry", label: "Planar regions", icon: "▦", order: 60, fidelity: "semantic", colorInCtor: true, movable: false,
  hint: "Count and fill the faces made by dividers inside a closed boundary",
  canCreate: (doc) => candidates(doc, BOUNDARY_SET).length > 0,
  createBlockedReason: "Planar regions needs an earlier closed circle, rectangle, polygon, or equivalent boundary.",
  create(id, _x, _y, doc, selectedId) {
    const boundary = preferReference(doc, selectedId, (entity) => BOUNDARY_SET.has(entity.kind)) ?? candidates(doc, BOUNDARY_SET).at(-1), refs = candidateRefs(doc, EDGE_SET).filter((ref) => ref !== boundary?.id);
    return { ...baseEntity(id, "rainbow"), kind: "regions", boundary: boundary?.id ?? "boundary", dividers: refs.slice(-1), strokeWidth: null };
  },
  parseArgs(stmt) { const id = argName(stmt.args, 0), boundary = argName(stmt.args, 1), dividers = stmt.args.slice(2).map((_arg, index) => argName(stmt.args, index + 2)); if (!id || !boundary || dividers.some((ref) => !ref)) return null; return { ...baseEntity(id, "rainbow"), kind: "regions", boundary, dividers: dividers as string[], strokeWidth: null }; },
  ctorLine: (entity) => `regions(${entity.id}, ${[entity.boundary, ...entity.dividers].join(", ")});`, extraLines: (entity) => groupLines(entity, "rainbow"),
  modifiers: { stroke(entity, stmt) { const width = argNumber(stmt.args, 1); if (width === null) return false; entity.strokeWidth = width; return true; } },
  references: (entity) => [entity.boundary, ...entity.dividers], replaceReference(entity, from, to) { if (entity.boundary === from) entity.boundary = to; replaceList(entity.dividers, from, to); },
  anchor(entity, ctx) { const box = this.bounds(entity, ctx); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, translate() {}, bounds: (entity, ctx) => regionsGeometry(entity, ctx).bounds, handles: () => [], dragHandle() {},
  fields: [
    { key: "boundary", label: "Closed boundary", input: "entity", entityKinds: BOUNDARY_KINDS, referencesEarlierOnly: true },
    { key: "dividers", label: "Dividers / tags", input: "entities", entityKinds: EDGE_KINDS, includeTags: true, referencesEarlierOnly: true, hint: "Order is preserved in generated Manic code." },
    { key: "strokeWidth", label: "Generated stroke", input: "number", nullable: true, min: .5, max: 30, step: .5 },
  ],
});

registerEntity<SpanTreeEntity>({
  kind: "spantree", ctor: "spantree", group: "Geometry", label: "Spanning tree", icon: "♧", order: 61, fidelity: "semantic", colorInCtor: true, movable: false,
  hint: "Greedy tree and co-tree overlays from ordered drawn graph edges",
  canCreate: (doc) => candidateRefs(doc, EDGE_SET).length > 0, createBlockedReason: "Spanning tree needs at least one earlier edge entity or tag.",
  create(id, _x, _y, doc, selectedId) { const preferred = preferReference(doc, selectedId, (entity) => EDGE_SET.has(entity.kind)); const refs = candidateRefs(doc, EDGE_SET); return { ...baseEntity(id, "lime"), kind: "spantree", edges: [preferred?.id ?? refs.at(-1) ?? "edges"], strokeWidth: null, cotreeReveal: "none", cotreeUntraced: false }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), edges = stmt.args.slice(1).map((_arg, index) => argName(stmt.args, index + 1)); if (!id || edges.length < 1 || edges.some((ref) => !ref)) return null; return { ...baseEntity(id, "lime"), kind: "spantree", edges: edges as string[], strokeWidth: null, cotreeReveal: "none", cotreeUntraced: false }; },
  ctorLine: (entity) => `spantree(${entity.id}, ${entity.edges.join(", ")});`, extraLines: (entity) => [...groupLines(entity, "lime"), ...(entity.cotreeUntraced ? [`untraced(${entity.id}.co);`] : []), ...hiddenLine(`${entity.id}.co`, entity.cotreeReveal)],
  modifiers: { stroke(entity, stmt) { const width = argNumber(stmt.args, 1); if (width === null) return false; entity.strokeWidth = width; return true; } },
  references: (entity) => entity.edges, replaceReference(entity, from, to) { replaceList(entity.edges, from, to); }, referenceIds: (entity) => [`${entity.id}.co`],
  applyReferenceModifier(entity, ref, stmt) {
    if (ref !== `${entity.id}.co`) return false;
    if (stmt.name === "untraced") { entity.cotreeUntraced = true; return true; }
    if (stmt.name === "hidden") { entity.cotreeReveal = argName(stmt.args, 1) === "center" ? "grow" : "fade"; return true; }
    return false;
  },
  referenceBounds(entity, ref, ctx) { return ref === `${entity.id}.co` ? boxOfSegments(spanTreeGeometry(entity, ctx).cotree) : null; },
  anchor(entity, ctx) { const box = this.bounds(entity, ctx); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, translate() {}, bounds: (entity, ctx) => spanTreeGeometry(entity, ctx).bounds, handles: () => [], dragHandle() {},
  fields: [
    { key: "edges", label: "Ordered edges / tags", input: "entities", entityKinds: EDGE_KINDS, includeTags: true, referencesEarlierOnly: true, minItems: 1, hint: "Earlier choices win cycles; changing order changes the native tree." },
    { key: "strokeWidth", label: "Tree stroke", input: "number", nullable: true, min: .5, max: 30, step: .5 },
  ],
});

registerEntity<DualEntity>({
  kind: "dual", ctor: "dual", group: "Geometry", label: "Dual graph", icon: "◇", order: 62, fidelity: "semantic", colorInCtor: true, movable: false,
  hint: "One node per planar face plus an outer node and crossing dual edges",
  canCreate: (doc) => candidates(doc, BOUNDARY_SET).length > 0, createBlockedReason: "Dual graph needs an earlier closed boundary.",
  create(id, _x, _y, doc, selectedId) { const boundary = preferReference(doc, selectedId, (entity) => BOUNDARY_SET.has(entity.kind)) ?? candidates(doc, BOUNDARY_SET).at(-1), refs = candidateRefs(doc, EDGE_SET).filter((ref) => ref !== boundary?.id); return { ...baseEntity(id, "violet"), kind: "dual", boundary: boundary?.id ?? "boundary", dividers: refs.slice(-1), strokeWidth: null, nodesReveal: "none" }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), boundary = argName(stmt.args, 1), dividers = stmt.args.slice(2).map((_arg, index) => argName(stmt.args, index + 2)); if (!id || !boundary || dividers.some((ref) => !ref)) return null; return { ...baseEntity(id, "violet"), kind: "dual", boundary, dividers: dividers as string[], strokeWidth: null, nodesReveal: "none" }; },
  ctorLine: (entity) => `dual(${entity.id}, ${[entity.boundary, ...entity.dividers].join(", ")});`, extraLines: (entity) => [...groupLines(entity, "violet"), ...hiddenLine(`${entity.id}.nodes`, entity.nodesReveal)],
  modifiers: { stroke(entity, stmt) { const width = argNumber(stmt.args, 1); if (width === null) return false; entity.strokeWidth = width; return true; } },
  references: (entity) => [entity.boundary, ...entity.dividers], replaceReference(entity, from, to) { if (entity.boundary === from) entity.boundary = to; replaceList(entity.dividers, from, to); }, referenceIds: (entity) => [`${entity.id}.nodes`],
  applyReferenceModifier(entity, ref, stmt) {
    if (ref !== `${entity.id}.nodes` || stmt.name !== "hidden") return false;
    entity.nodesReveal = argName(stmt.args, 1) === "center" ? "grow" : "fade";
    return true;
  },
  referenceBounds(entity, ref, ctx) { return ref === `${entity.id}.nodes` ? boxOfPoints(dualGeometry(entity, ctx).nodes) : null; },
  anchor(entity, ctx) { const box = this.bounds(entity, ctx); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, translate() {}, bounds: (entity, ctx) => dualGeometry(entity, ctx).bounds, handles: () => [], dragHandle() {},
  fields: [
    { key: "boundary", label: "Primal boundary", input: "entity", entityKinds: BOUNDARY_KINDS, referencesEarlierOnly: true },
    { key: "dividers", label: "Interior edges / tags", input: "entities", entityKinds: EDGE_KINDS, includeTags: true, referencesEarlierOnly: true },
    { key: "strokeWidth", label: "Dual edge stroke", input: "number", nullable: true, min: .5, max: 30, step: .5 },
  ],
});
