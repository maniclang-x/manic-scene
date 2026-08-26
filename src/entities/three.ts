// 3-D authoring vocabulary. The Canvas projects the initial camera pose into a
// deterministic 2-D design sketch; orbit/roll/morph playback remains native.

import { argName, argNumber, argPoint, argPoint3, argString, escapeString, num, pt, pt3 } from "../args.js";
import { evalExpr, parseExpr, type ExprNode } from "../expr.js";
import { registerEntity, type Box, type FieldSpec, type GeometryContext, type StoryTargetSpec } from "../registry.js";
import { lexTokens, type CallStatement } from "../script.js";
import type {
  Assembly3Entity, Axes3Entity, Box3Entity, Camera3Entity, Collection3Entity,
  CollectionChild3Entity, CollectionLinks3Entity, CollectionPath3Entity, Cross3Entity, Curve3Entity,
  DomainSurface3Entity, Extrude3Entity, Finish3Key, Finish3Spec, Frame3Entity, Grid3Entity, GridEntity,
  Heightmap3Entity, Hilbert3Entity, HistoryPlot3Entity, HistoryPlotEntity, Implicit3Entity,
  Link3Entity, LSystem3Entity, MatrixMap3Entity, Midpoint3Entity,
  Model3Entity, ParamSurface3Entity, Point3, Point3Entity, PolySolid3Entity, Project3Entity,
  ProjectPath3Entity, Revolve3Entity, SceneDoc, SceneEntity, Sphere3Entity, Stroke3Entity,
  Pieces3Entity, RandomWalk3Entity, Slice3Entity, Surface3Entity, SurfaceDependent3Entity,
  Trajectory3Entity, Tree3Entity, Tube3Entity, VectorField3Entity, VirtualChildStyle, WatermarkEntity,
} from "../types.js";
import { baseEntity } from "./base.js";
import { gridBaseExtras, gridExtraLines, gridModifiers } from "./grid-kit.js";

export interface Projected3 { x: number; y: number; depth: number; scale: number; }

function cameraFor(doc?: SceneDoc): Camera3Entity | null {
  return doc?.entities.find((entity): entity is Camera3Entity => entity.kind === "camera3") ?? null;
}

function sub(a: Point3, b: Point3): Point3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function dot(a: Point3, b: Point3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a: Point3, b: Point3): Point3 { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function length(a: Point3): number { return Math.hypot(a.x, a.y, a.z); }
function unit(a: Point3, fallback: Point3): Point3 { const n = length(a); return n > 1e-8 ? { x: a.x / n, y: a.y / n, z: a.z / n } : fallback; }

export function projectPoint3(point: Point3, doc?: SceneDoc): Projected3 {
  const size = doc?.size ?? (doc?.format === "square" ? { width: 720, height: 720 } : doc?.format === "portrait" ? { width: 720, height: 1280 } : { width: 1280, height: 720 });
  const camera = cameraFor(doc);
  const eye = camera?.eye ?? { x: 7, y: -7, z: 6 };
  const target = camera?.target ?? { x: 0, y: 0, z: 0 };
  const panel = camera && camera.panelX !== null && camera.panelY !== null && camera.panelWidth !== null && camera.panelHeight !== null
    ? { x: camera!.panelX!, y: camera!.panelY!, width: camera!.panelWidth!, height: camera!.panelHeight! }
    : { x: size.width / 2, y: size.height / 2, width: size.width, height: size.height };
  const forward = unit(sub(target, eye), { x: 0, y: 0, z: -1 });
  let right = unit(cross(forward, { x: 0, y: 0, z: 1 }), { x: 1, y: 0, z: 0 });
  // Direct overhead is a pole: preserve Manic's +X right / +Y screen-up convention.
  if (Math.hypot(forward.x, forward.y) < 1e-7) right = { x: forward.z < 0 ? 1 : -1, y: 0, z: 0 };
  const up = unit(cross(right, forward), { x: 0, y: 1, z: 0 });
  const relative = sub(point, target);
  const viewX = dot(relative, right), viewY = dot(relative, up);
  const depth = dot(sub(point, eye), forward);
  const fov = Math.max(.01, camera?.fov ?? 8);
  const scale = camera?.projection === "perspective"
    ? panel.height / (2 * Math.tan(fov * Math.PI / 360)) / Math.max(.05, depth)
    : panel.height / fov;
  return { x: panel.x + viewX * scale, y: panel.y - viewY * scale, depth, scale };
}

function pointBox(points: { x: number; y: number }[], pad = 4): Box {
  if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, width: Math.max(1, Math.max(...xs) - Math.min(...xs) + pad * 2), height: Math.max(1, Math.max(...ys) - Math.min(...ys) + pad * 2) };
}

const THREE_POINT_KINDS = ["grid3", "line3", "arrow3", "curve3", "point3", "cube3", "sphere3", "prism3", "pyramid3", "midpoint3", "link3", "model3", "molecule3", "extrude3", "revolve3", "tube3", "project3", "projectpath3", "surface3", "domainsurface", "param3", "implicit3", "heightmap3", "contour3", "slice3", "tangentplane3", "gradient3", "vectorfield3", "trajectory3", "descend3", "linmap3", "collection3", "collection3data", "child3", "links3", "links3data", "ring3", "trail3", "historyplot3", "randomwalk3", "lsystem3", "hilbert3"] as const;
const THREE_CHILD_OWNERS = ["axes3", "cross3", "assembly3", "volume3", "slice3", "descend3", "linmap3", "eigen3", "pieces3", "tree3"] as const;
const THREE_FIELD_KINDS = [...THREE_POINT_KINDS, ...THREE_CHILD_OWNERS] as const;

function axes3References(entity: Axes3Entity): string[] {
  const count = entity.step > 0 ? Math.max(0, Math.min(512, Math.floor((entity.length + 1e-3) / entity.step))) : 0;
  return ["x", "y", "z"].flatMap((axis) => [`${entity.id}.${axis}`, ...Array.from({ length: count }, (_unused, index) => `${entity.id}.tick.${axis}.${index + 1}`), ...Array.from({ length: count }, (_unused, index) => `${entity.id}.num.${axis}.${index + 1}`)]);
}

const cross3References = (entity: Cross3Entity) => ["v", "w", "p", "e1", "e2"].map((suffix) => `${entity.id}.${suffix}`);
const KNOWN_ASSEMBLY_PARTS: Readonly<Record<string, readonly string[]>> = {
  "asset:models/manic-console.obj": ["base", "screen", "key"],
};
function assembly3References(entity: Assembly3Entity): string[] { return entity.parts.map((part) => `${entity.id}.${part}`); }
function surfaceFamilyReferences(entity: SurfaceDependent3Entity | Slice3Entity | MatrixMap3Entity): string[] {
  if (entity.kind === "volume3") return Array.from({ length: Math.max(2, Math.min(24, Math.round(entity.resolution ?? 7))) ** 2 }, (_unused, index) => `${entity.id}${index}`);
  if (entity.kind === "slice3") return entity.at === null ? [] : [`${entity.id}.slope`];
  if (entity.kind === "descend3") return [`${entity.id}.ball`];
  if (entity.kind === "linmap3") return [entity.id, `${entity.id}.ref`, `${entity.id}.i`, `${entity.id}.j`, `${entity.id}.k`, `${entity.id}.li`, `${entity.id}.lj`, `${entity.id}.lk`, `${entity.id}.val`];
  if (entity.kind === "eigen3") return [`${entity.id}.axis0`, `${entity.id}.axis1`, `${entity.id}.axis2`, `${entity.id}.l0`, `${entity.id}.l1`, `${entity.id}.l2`, `${entity.id}.note`];
  return [];
}
function proceduralFamilyReferences(entity: Pieces3Entity | Tree3Entity): string[] {
  if (entity.kind === "tree3") return [...Array.from({ length: Math.max(1, Math.min(12, Math.round(entity.depth))) }, (_unused, index) => `${entity.id}.d${index}`), `${entity.id}.leaves`];
  return [
    `${entity.id}.pieces`,
    ...Array.from({ length: entity.rows }, (_unused, row) => `${entity.id}.row${row}`),
    ...Array.from({ length: entity.cols }, (_unused, col) => `${entity.id}.col${col}`),
    ...Array.from({ length: entity.rows }, (_unused, row) => Array.from({ length: entity.cols }, (_v, col) => `${entity.id}.r${row}c${col}`)).flat(),
  ];
}

export function threePointReferences(doc?: SceneDoc): string[] {
  return doc?.entities.flatMap((entity) => {
    if ((THREE_POINT_KINDS as readonly string[]).includes(entity.kind)) return [entity.id];
    if (entity.kind === "axes3") return axes3References(entity).filter((ref) => /\.(x|y|z)$/u.test(ref));
    if (entity.kind === "cross3") return cross3References(entity);
    if (entity.kind === "assembly3") return assembly3References(entity);
    if (entity.kind === "volume3" || entity.kind === "slice3" || entity.kind === "descend3" || entity.kind === "linmap3" || entity.kind === "eigen3") return surfaceFamilyReferences(entity).filter((ref) => !/\.(?:l[ijk0-2]|val|note)$/u.test(ref));
    if (entity.kind === "pieces3" || entity.kind === "tree3") return proceduralFamilyReferences(entity).filter((ref) => !ref.endsWith(".pieces") && !/\.(?:row|col)\d+$/u.test(ref));
    return [];
  }) ?? [];
}

function threePointField(key: string, label: string): FieldSpec {
  return { key, label, input: "entity", entityKinds: THREE_FIELD_KINDS, includeChildren: true, childrenOnlyKinds: THREE_CHILD_OWNERS, referencesEarlierOnly: true, hint: "This world-space relationship follows the referenced 3D entity." };
}

function threePair(doc?: SceneDoc, selectedId?: string): [string, string] {
  const refs = threePointReferences(doc), selected = selectedId && refs.includes(selectedId) ? selectedId : refs.at(-1), other = [...refs].reverse().find((ref) => ref !== selected);
  return [selected ?? "A", other ?? "B"];
}

function add3(a: Point3, b: Point3): Point3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function mul3(a: Point3, amount: number): Point3 { return { x: a.x * amount, y: a.y * amount, z: a.z * amount }; }

export function worldAnchor3(ref: string, ctx?: GeometryContext, visiting = new Set<string>()): Point3 | null {
  if (!ctx || visiting.has(ref)) return null;
  visiting.add(ref);
  let entity = ctx.entity(ref);
  if (!entity) entity = ctx.doc.entities.find((candidate) => candidate.kind === "axes3" && axes3References(candidate).includes(ref) || candidate.kind === "cross3" && cross3References(candidate).includes(ref) || (candidate.kind === "pieces3" || candidate.kind === "tree3") && proceduralFamilyReferences(candidate).includes(ref));
  if (!entity) { visiting.delete(ref); return null; }
  let point: Point3 | null = null;
  switch (entity.kind) {
    case "grid3": case "cube3": case "sphere3": case "prism3": case "pyramid3": case "frame3": point = entity.center; break;
    case "model3": case "molecule3": case "extrude3": case "revolve3": point = entity.center; break;
    case "point3": point = entity.at; break;
    case "line3": case "arrow3": point = entity.from; break;
    case "curve3": point = { x: 0, y: 0, z: 0 }; break;
    case "midpoint3": { const a = worldAnchor3(entity.a, ctx, visiting), b = worldAnchor3(entity.b, ctx, visiting); if (a && b) point = mul3(add3(a, b), .5); break; }
    case "link3": point = link3WorldGeometry(entity, ctx).from; break;
    case "tube3": point = path3WorldPoints(entity.path, ctx, visiting)[0] ?? null; break;
    case "projectpath3": { const source = path3WorldPoints(entity.source, ctx, visiting)[0]; point = source ? projectToPlane(source, entity.plane) : null; break; }
    case "project3": point = project3WorldPoint(entity, ctx, visiting); break;
    case "axes3": {
      point = entity.worldOrigin;
      const match = ref.match(/\.tick\.(x|y|z)\.(\d+)$/u) ?? ref.match(/\.num\.(x|y|z)\.(\d+)$/u);
      if (match) { const axis = match[1] as keyof Point3, value = Number(match[2]) * entity.step; point = { ...entity.worldOrigin, [axis]: entity.worldOrigin[axis] + value }; }
      break;
    }
    case "cross3": {
      point = ref.endsWith(".e1") ? add3(entity.worldOrigin, entity.v) : ref.endsWith(".e2") ? add3(entity.worldOrigin, entity.w) : entity.worldOrigin;
      break;
    }
    case "assembly3": point = entity.center; break;
    case "surface3": point = { x: (entity.x0 + entity.x1) / 2, y: (entity.y0 + entity.y1) / 2, z: surface3Value(entity, (entity.x0 + entity.x1) / 2, (entity.y0 + entity.y1) / 2) }; break;
    case "domainsurface": point = { x: (entity.x0 + entity.x1) / 2, y: (entity.y0 + entity.y1) / 2, z: 0 }; break;
    case "param3": point = param3Value(entity, (entity.u0 + entity.u1) / 2, (entity.v0 + entity.v1) / 2); break;
    case "implicit3": point = { x: (entity.x0 + entity.x1) / 2, y: (entity.y0 + entity.y1) / 2, z: (entity.z0 + entity.z1) / 2 }; break;
    case "heightmap3": case "vectorfield3": case "trajectory3": point = entity.kind === "vectorfield3" ? entity.center : { x: 0, y: 0, z: 0 }; break;
    case "contour3": case "gradient3": case "tangentplane3": case "descend3": point = surfaceDependent3Points(entity, ctx)[0] ?? { x: 0, y: 0, z: 0 }; break;
    case "slice3": point = slice3WorldPoints(entity, ctx)[0] ?? { x: 0, y: 0, z: 0 }; break;
    case "linmap3": case "eigen3": point = entity.center; break;
    case "collection3": case "collection3data": point = entity.center; break;
    case "child3": point = collectionChild3Point(entity, ctx, visiting); break;
    case "links3": case "links3data": case "ring3": case "trail3": { const source = ctx.entity(entity.collection); point = source && (source.kind === "collection3" || source.kind === "collection3data") ? source.center : { x: 0, y: 0, z: 0 }; break; }
    case "historyplot3": point = entity.origin3; break;
    case "randomwalk3": case "hilbert3": point = entity.center; break;
    case "lsystem3": point = entity.origin3; break;
    case "pieces3": { const match=ref.match(/\.r(\d+)c(\d+)$/u),quads=pieces3Quads(entity,ctx),quad=match?quads[Number(match[1])*entity.cols+Number(match[2])]:null;point=quad?mul3(quad.reduce((sum,value)=>add3(sum,value),{x:0,y:0,z:0}),.25):worldAnchor3(entity.source,ctx,visiting);break; }
    case "tree3": point = entity.root; break;
  }
  visiting.delete(ref);
  return point;
}

export function link3WorldGeometry(entity: Link3Entity, ctx?: GeometryContext): { from: Point3; to: Point3 } {
  const a = worldAnchor3(entity.from, ctx) ?? { x: 0, y: 0, z: 0 }, b = worldAnchor3(entity.to, ctx) ?? { x: 1, y: 0, z: 0 }, delta = sub(b, a), distance = length(delta), trim = Math.min(Math.max(0, entity.trim), distance / 2), direction = unit(delta, { x: 1, y: 0, z: 0 });
  return { from: add3(a, mul3(direction, trim)), to: add3(b, mul3(direction, -trim)) };
}

function childStyle(entity: { childStyles: Record<string, VirtualChildStyle> }, ref: string): VirtualChildStyle { return entity.childStyles[ref] ?? (entity.childStyles[ref] = {}); }
function replaceChildStyleReference(entity: { childStyles: Record<string, VirtualChildStyle> }, from: string, to: string): void { if (!entity.childStyles[from]) return; entity.childStyles[to] = entity.childStyles[from]; delete entity.childStyles[from]; }

export const DEFAULT_FINISH3: Finish3Spec = { shading: "flat", material: "matte", texture: "solid", textureScale: 4, mesh: 0, wire: 0, depth: 0, shadow: 0, keys: [] };

export function parseFinish3Spec(raw: string): Finish3Spec | null {
  const value: Finish3Spec = { ...DEFAULT_FINISH3, keys: [] };
  for (const token of raw.split(/\s+/u).filter(Boolean)) {
    const [key, body, extra] = token.split("=");
    if (!body || extra !== undefined || !(["shading", "material", "texture", "scale", "mesh", "wire", "depth", "shadow"] as string[]).includes(key)) return null;
    if (key === "shading") { if (body !== "flat" && body !== "smooth") return null; value.shading = body; }
    else if (key === "material") { if (body !== "matte" && body !== "metal" && body !== "glass") return null; value.material = body; }
    else if (key === "texture") { if (body !== "solid" && body !== "checker" && body !== "stripes") return null; value.texture = body; }
    else { const amount = Number(body); if (!Number.isFinite(amount)) return null; if (key === "scale") value.textureScale = Math.max(.25, Math.min(32, amount)); else { const clamped = Math.max(0, Math.min(1, amount)); if (key === "mesh") value.mesh = clamped; else if (key === "wire") value.wire = clamped; else if (key === "depth") value.depth = clamped; else if (key === "shadow") value.shadow = clamped; } }
    if (!value.keys.includes(key as Finish3Key)) value.keys.push(key as Finish3Key);
  }
  return value;
}

export function finish3SpecText(value: Finish3Spec): string {
  const keys = value.keys.length ? value.keys : ["shading"] as Finish3Key[];
  return keys.map((key) => `${key}=${key === "scale" ? num(value.textureScale) : numOrName(value[key])}`).join(" ");
}
function numOrName(value: string | number): string { return typeof value === "number" ? num(value) : value; }

function applyChildStyle(entity: { childStyles: Record<string, VirtualChildStyle> }, ref: string, stmt: CallStatement): boolean {
  const style = childStyle(entity, ref);
  if (stmt.name === "color") { const value = argName(stmt.args, 1); if (!value) return false; style.color = value; return true; }
  if (stmt.name === "opacity") { const value = argNumber(stmt.args, 1); if (value === null) return false; style.opacity = value; return true; }
  if (stmt.name === "glow") { const value = argNumber(stmt.args, 1); if (value === null) return false; style.glow = value; return true; }
  if (stmt.name === "hidden") { style.reveal = argName(stmt.args, 1) === "center" ? "grow" : "fade"; return true; }
  if (stmt.name === "untraced") { style.untraced = true; return true; }
  if (stmt.name === "finish3") { const raw = argString(stmt.args, 1); if (raw === null) return false; const finish = parseFinish3Spec(raw); if (!finish) return false; style.finish3 = finish; return true; }
  return false;
}
function childStyleLines(styles: Record<string, VirtualChildStyle>): string[] { return Object.entries(styles).flatMap(([ref, style]) => [...(style.color ? [`color(${ref}, ${style.color});`] : []), ...(style.opacity !== undefined ? [`opacity(${ref}, ${num(style.opacity)});`] : []), ...(style.glow !== undefined ? [`glow(${ref}, ${num(style.glow)});`] : []), ...(style.reveal ? [`hidden(${ref}${style.reveal === "grow" ? ", center" : ""});`] : []), ...(style.untraced ? [`untraced(${ref});`] : []), ...(style.finish3 ? [`finish3(${ref}, "${finish3SpecText(style.finish3)}");`] : [])]); }
const storyTargets = (refs: readonly string[], kind: StoryTargetSpec["kind"]): StoryTargetSpec[] => refs.map((id) => ({ id, label: id, kind }));

export function cube3WorldVertices(entity: Box3Entity): Point3[] {
  const half = mul3(entity.size, .5);
  return [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => add3(entity.center, { x: half.x * x, y: half.y * y, z: half.z * z }))));
}

export function polySolid3WorldGeometry(entity: PolySolid3Entity): { points: Point3[]; edges: [number, number][] } {
  const sides = Math.max(3, Math.min(256, Math.round(entity.sides))), h = entity.height / 2;
  const ring = (z: number) => Array.from({ length: sides }, (_unused, index) => add3(entity.center, { x: entity.radius * Math.cos(Math.PI * 2 * index / sides), y: entity.radius * Math.sin(Math.PI * 2 * index / sides), z }));
  if (entity.kind === "pyramid3") { const points = [...ring(-h), add3(entity.center, { x: 0, y: 0, z: h })], apex = sides; return { points, edges: Array.from({ length: sides }, (_unused, index) => [[index, (index + 1) % sides] as [number, number], [index, apex] as [number, number]]).flat() }; }
  const points = [...ring(-h), ...ring(h)];
  return { points, edges: Array.from({ length: sides }, (_unused, index) => [[index, (index + 1) % sides], [sides + index, sides + (index + 1) % sides], [index, sides + index]] as [number, number][]).flat() };
}

export function cross3WorldGeometry(entity: Cross3Entity): { v: [Point3, Point3]; w: [Point3, Point3]; p: [Point3, Point3]; e1: [Point3, Point3]; e2: [Point3, Point3] } {
  const p = cross(entity.v, entity.w), ov = add3(entity.worldOrigin, entity.v), ow = add3(entity.worldOrigin, entity.w), far = add3(ov, entity.w);
  return { v: [entity.worldOrigin, ov], w: [entity.worldOrigin, ow], p: [entity.worldOrigin, add3(entity.worldOrigin, p)], e1: [ov, far], e2: [ow, far] };
}

function projectToPlane(point: Point3, plane: "xy" | "xz" | "yz"): Point3 {
  return plane === "xy" ? { x: point.x, y: point.y, z: 0 } : plane === "xz" ? { x: point.x, y: 0, z: point.z } : { x: 0, y: point.y, z: point.z };
}

export function project3WorldPoint(entity: Project3Entity, ctx?: GeometryContext, visiting = new Set<string>()): Point3 | null {
  const source = worldAnchor3(entity.source, ctx, visiting);
  return source ? projectToPlane(source, entity.plane) : null;
}

export function path3WorldPoints(ref: string, ctx?: GeometryContext, visiting = new Set<string>()): Point3[] {
  if (!ctx || visiting.has(ref)) return [];
  const entity = ctx.entity(ref);
  if (!entity) return [];
  visiting.add(ref);
  let points: Point3[] = [];
  if (entity.kind === "line3" || entity.kind === "arrow3") points = [entity.from, entity.to];
  else if (entity.kind === "curve3") points = curve3WorldPoints(entity);
  else if (entity.kind === "projectpath3") points = path3WorldPoints(entity.source, ctx, visiting).map((point) => projectToPlane(point, entity.plane));
  else if (entity.kind === "tube3") points = path3WorldPoints(entity.path, ctx, visiting);
  visiting.delete(ref);
  return points;
}

export function revolve3WorldGeometry(entity: Revolve3Entity, axial = 48): { points: Point3[]; edges: [number, number][] } {
  const profile = formula(entity.profile), sides = Math.max(3, Math.min(256, Math.round(entity.sides))), rows = Math.max(4, Math.min(96, axial)), points: Point3[] = [], edges: [number, number][] = [];
  if (!profile) return { points, edges };
  const mid = (entity.t0 + entity.t1) / 2;
  for (let row = 0; row <= rows; row += 1) {
    const t = entity.t0 + (entity.t1 - entity.t0) * row / rows;
    let radius = 0;
    try { radius = evalExpr(profile, new Map([["t", t], ["x", t]])); } catch { radius = 0; }
    if (!Number.isFinite(radius)) radius = 0;
    for (let side = 0; side <= sides; side += 1) {
      const angle = Math.PI * 2 * side / sides;
      points.push(add3(entity.center, { x: radius * Math.cos(angle), y: radius * Math.sin(angle), z: t - mid }));
      const index = row * (sides + 1) + side;
      if (side > 0) edges.push([index - 1, index]);
      if (row > 0) edges.push([index - (sides + 1), index]);
    }
  }
  return { points, edges };
}

export function extrude3WorldVertices(entity: Extrude3Entity, ctx?: GeometryContext): Point3[] {
  const source = ctx?.bounds(entity.source), width = Math.max(.2, source?.width ?? 2), depth = Math.max(.2, source?.height ?? 2), half = { x: width / 2, y: depth / 2, z: entity.height / 2 };
  return [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => add3(entity.center, { x: half.x * x, y: half.y * y, z: half.z * z }))));
}

function projectedBox(points: Point3[], ctx?: GeometryContext, pad = 6): Box { return pointBox(points.map((point) => projectPoint3(point, ctx?.doc)), pad); }

function formula(source: string): ExprNode | null { try { return parseExpr(lexTokens(source)); } catch { return null; } }

function safeEval(node: ExprNode | null, env: Map<string, number>, fallback = 0): number {
  if (!node) return fallback;
  try { const value = evalExpr(node, env); return Number.isFinite(value) ? value : fallback; } catch { return fallback; }
}

export function surface3Value(entity: Surface3Entity, x: number, y: number): number {
  return safeEval(formula(entity.formula), new Map([["x", x], ["y", y]]));
}

export function surface3Grid(entity: Surface3Entity, cap = 16): { points: Point3[]; edges: [number, number][] } {
  const res = Math.max(2, Math.min(cap, Math.round(entity.resolution))), n = res + 1, points: Point3[] = [], edges: [number, number][] = [];
  for (let row = 0; row < n; row += 1) for (let col = 0; col < n; col += 1) {
    const x = entity.x0 + (entity.x1 - entity.x0) * col / res, y = entity.y0 + (entity.y1 - entity.y0) * row / res;
    points.push({ x, y, z: surface3Value(entity, x, y) });
    const index = row * n + col;
    if (col) edges.push([index - 1, index]);
    if (row) edges.push([index - n, index]);
  }
  return { points, edges };
}

export function param3Value(entity: ParamSurface3Entity, u: number, v: number): Point3 {
  const env = new Map([["u", u], ["v", v], ["x", u], ["y", v]]);
  return { x: safeEval(formula(entity.fx), env), y: safeEval(formula(entity.fy), env), z: safeEval(formula(entity.fz), env) };
}

export function param3Grid(entity: ParamSurface3Entity, cap = 16): { points: Point3[]; edges: [number, number][] } {
  const res = Math.max(2, Math.min(cap, Math.round(entity.resolution))), n = res + 1, points: Point3[] = [], edges: [number, number][] = [];
  for (let row = 0; row < n; row += 1) for (let col = 0; col < n; col += 1) {
    points.push(param3Value(entity, entity.u0 + (entity.u1 - entity.u0) * col / res, entity.v0 + (entity.v1 - entity.v0) * row / res));
    const index = row * n + col;
    if (col) edges.push([index - 1, index]);
    if (row) edges.push([index - n, index]);
  }
  return { points, edges };
}

function sourceSurface(entity: { surface: string }, ctx?: GeometryContext): Surface3Entity | null {
  const source = ctx?.entity(entity.surface);
  return source?.kind === "surface3" ? source : null;
}

export function slice3WorldPoints(entity: Slice3Entity, ctx?: GeometryContext, count = 80): Point3[] {
  const source = sourceSurface(entity, ctx); if (!source) return [];
  return Array.from({ length: count + 1 }, (_unused, index) => { const t = (entity.axis === "x" ? source.y0 : source.x0) + ((entity.axis === "x" ? source.y1 : source.x1) - (entity.axis === "x" ? source.y0 : source.x0)) * index / count; const x = entity.axis === "x" ? entity.value : t, y = entity.axis === "x" ? t : entity.value; return { x, y, z: surface3Value(source, x, y) }; });
}

export function surfaceDependent3Points(entity: SurfaceDependent3Entity, ctx?: GeometryContext): Point3[] {
  const source = sourceSurface(entity, ctx); if (!source) return [];
  const dx = Math.max(1e-4, Math.abs(source.x1 - source.x0) * 1e-3), dy = Math.max(1e-4, Math.abs(source.y1 - source.y0) * 1e-3);
  const derivative = (x: number, y: number) => ({ x: (surface3Value(source, x + dx, y) - surface3Value(source, x - dx, y)) / (2 * dx), y: (surface3Value(source, x, y + dy) - surface3Value(source, x, y - dy)) / (2 * dy) });
  if (entity.kind === "gradient3") { const x = entity.x ?? 0, y = entity.y ?? 0, g = derivative(x, y), start = { x, y, z: surface3Value(source, x, y) }, scale = Math.min(2.5, Math.max(.3, Math.hypot(g.x, g.y))); return [start, add3(start, mul3({ x: g.x, y: g.y, z: g.x * g.x + g.y * g.y }, scale / Math.max(1e-6, Math.hypot(g.x, g.y, g.x * g.x + g.y * g.y))))]; }
  if (entity.kind === "tangentplane3") { const x = entity.x ?? 0, y = entity.y ?? 0, g = derivative(x, y), z = surface3Value(source, x, y), half = Math.min(Math.abs(source.x1 - source.x0), Math.abs(source.y1 - source.y0)) * .075; return [-1, 1].flatMap((ix) => [-1, 1].map((iy) => ({ x: x + ix * half, y: y + iy * half, z: z + g.x * ix * half + g.y * iy * half }))); }
  if (entity.kind === "descend3") { let x = entity.x ?? 0, y = entity.y ?? 0; const points: Point3[] = [], steps = Math.max(2, Math.min(160, Math.round(entity.steps ?? 40))), rate = entity.rate ?? .15; for (let index = 0; index <= steps; index += 1) { points.push({ x, y, z: surface3Value(source, x, y) }); const g = derivative(x, y); x = Math.max(source.x0, Math.min(source.x1, x - rate * g.x)); y = Math.max(source.y0, Math.min(source.y1, y - rate * g.y)); } return points; }
  if (entity.kind === "contour3") { const level = entity.level ?? 0, points: Point3[] = [], res = 28; for (let row = 0; row <= res; row += 1) { const y = source.y0 + (source.y1 - source.y0) * row / res; let previous: Point3 | null = null, previousValue = 0; for (let col = 0; col <= res; col += 1) { const x = source.x0 + (source.x1 - source.x0) * col / res, value = surface3Value(source, x, y) - level; if (previous && (value < 0) !== (previousValue < 0)) points.push(previous, { x, y, z: level }); previous = { x, y, z: level }; previousValue = value; } } return points; }
  return surface3Grid(source, 8).points;
}

export function vectorField3Segments(entity: VectorField3Entity): [Point3, Point3][] {
  const density = Math.max(2, Math.min(7, Math.round(entity.density))), nodes = [formula(entity.u), formula(entity.v), formula(entity.w)], result: [Point3, Point3][] = [];
  for (let ix = 0; ix < density; ix += 1) for (let iy = 0; iy < density; iy += 1) for (let iz = 0; iz < density; iz += 1) { const at = { x: entity.center.x - entity.half.x + 2 * entity.half.x * ix / (density - 1), y: entity.center.y - entity.half.y + 2 * entity.half.y * iy / (density - 1), z: entity.center.z - entity.half.z + 2 * entity.half.z * iz / (density - 1) }, env = new Map([["x", at.x], ["y", at.y], ["z", at.z], ["p", 0]]), v = { x: safeEval(nodes[0], env), y: safeEval(nodes[1], env), z: safeEval(nodes[2], env) }, magnitude = Math.hypot(v.x, v.y, v.z), scale = Math.min(entity.half.x, entity.half.y, entity.half.z) * .55 / Math.max(magnitude, 1e-6); result.push([at, add3(at, mul3(v, scale))]); }
  return result;
}

export function trajectory3WorldPoints(entity: Trajectory3Entity): Point3[] {
  const nodes = [formula(entity.dx), formula(entity.dy), formula(entity.dz)], count = Math.max(2, Math.min(1200, Math.round(entity.steps))), stride = Math.max(1, Math.ceil(count / 480)); let p = { ...entity.start }; const raw: Point3[] = [];
  for (let index = 0; index <= count; index += 1) { if (index % stride === 0) raw.push({ ...p }); const env = new Map([["x", p.x], ["y", p.y], ["z", p.z], ["p", 0]]), d = { x: safeEval(nodes[0], env), y: safeEval(nodes[1], env), z: safeEval(nodes[2], env) }; p = add3(p, mul3(d, entity.dt)); if (!Number.isFinite(p.x + p.y + p.z)) break; }
  if (raw.length < 2) return raw; const xs = raw.map((v) => v.x), ys = raw.map((v) => v.y), zs = raw.map((v) => v.z), mid = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }, extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), Math.max(...zs) - Math.min(...zs), 1e-4); return raw.map((v) => mul3(sub(v, mid), 6 / extent));
}

export function linmap3WorldGeometry(entity: MatrixMap3Entity): { points: Point3[]; edges: [number, number][] } {
  const c1 = { x: entity.a, y: entity.d, z: entity.g }, c2 = { x: entity.b, y: entity.e, z: entity.h }, c3 = { x: entity.c, y: entity.f, z: entity.i }, points = [entity.center, add3(entity.center, c1), add3(entity.center, c2), add3(entity.center, add3(c1, c2)), add3(entity.center, c3), add3(entity.center, add3(c1, c3)), add3(entity.center, add3(c2, c3)), add3(entity.center, add3(add3(c1, c2), c3))];
  return { points, edges: [[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]] };
}

function stableUnit3(seed: number, index: number, lane: number): number {
  const mask=(1n<<64n)-1n; let value=(BigInt(Math.round(seed)) ^ (BigInt(index)*0x9e3779b97f4a7c15n) ^ (BigInt(lane)*0xbf58476d1ce4e5b9n))&mask;
  value^=value>>30n; value=(value*0xbf58476d1ce4e5b9n)&mask; value^=value>>27n; value=(value*0x94d049bb133111ebn)&mask; value^=value>>31n;
  return Number(value>>40n)/((1<<24)-1);
}

function parsePointTriples(raw:string):Point3[]{return raw.split(";").map(item=>item.trim()).filter(Boolean).flatMap(item=>{const v=item.split(/[\s,]+/u).map(Number);return v.length===3&&v.every(Number.isFinite)?[{x:v[0],y:v[1],z:v[2]}]:[];});}
function strictPointTriples(raw:string):Point3[]|null{const entries=raw.split(";").map(item=>item.trim()).filter(Boolean),points=parsePointTriples(raw);return entries.length>0&&entries.length<=20000&&points.length===entries.length?points:null;}

export function collection3Points(entity:Collection3Entity,cap=600):Point3[]{
  const local=entity.kind==="collection3data"?parsePointTriples(entity.pointsData):Array.from({length:Math.min(entity.count,cap)},(_u,index)=>({x:(stableUnit3(entity.seed,index,11)*2-1)*entity.spread.x,y:(stableUnit3(entity.seed,index,17)*2-1)*entity.spread.y,z:(stableUnit3(entity.seed,index,23)*2-1)*entity.spread.z}));
  return local.slice(0,cap).map(point=>add3(entity.center,point));
}

export function collectionChild3Point(entity:CollectionChild3Entity,ctx?:GeometryContext,_visiting?:Set<string>):Point3|null{const source=ctx?.entity(entity.collection);if(!source||(source.kind!=="collection3"&&source.kind!=="collection3data"))return null;return collection3Points(source,Math.max(600,entity.index+1))[entity.index]??null;}

function parseEdgePairs(raw:string):[number,number][]{const seen=new Set<string>(),out:[number,number][]=[];for(const item of raw.split(";").map(x=>x.trim()).filter(Boolean)){const p=item.split(/[\s,]+/u).map(Number);if(p.length!==2||p.some(v=>!Number.isInteger(v)||v<0)||p[0]===p[1])continue;const a=Math.min(p[0],p[1]),b=Math.max(p[0],p[1]),key=`${a}:${b}`;if(!seen.has(key)){seen.add(key);out.push([a,b]);}}return out;}
function strictEdgePairs(raw:string):[number,number][]|null{const entries=raw.split(";").map(item=>item.trim()).filter(Boolean);if(entries.some(item=>{const pair=item.split(/[\s,]+/u).map(Number);return pair.length!==2||pair.some(value=>!Number.isInteger(value)||value<0);}))return null;const edges=parseEdgePairs(raw);return edges.length>0?edges:null;}

export function collectionLinks3Geometry(entity:CollectionLinks3Entity,ctx?:GeometryContext):{points:Point3[];edges:[number,number][]}{const source=ctx?.entity(entity.collection);if(!source||(source.kind!=="collection3"&&source.kind!=="collection3data"))return{points:[],edges:[]};const points=collection3Points(source,entity.mode==="all"?96:600);if(entity.kind==="links3data")return{points,edges:parseEdgePairs(entity.edgesData).filter(([a,b])=>a<points.length&&b<points.length)};const edges:[number,number][]=[];if(entity.mode==="chain"){for(let i=1;i<points.length;i++)edges.push([i-1,i]);}else if(entity.mode==="all"){for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++)edges.push([a,b]);}else{const seen=new Set<string>();for(let a=0;a<points.length;a++){const nearest=points.map((point,b)=>({b,d:b===a?Infinity:(point.x-points[a].x)**2+(point.y-points[a].y)**2+(point.z-points[a].z)**2})).sort((x,y)=>x.d-y.d||x.b-y.b).slice(0,entity.neighbors);for(const {b} of nearest){const lo=Math.min(a,b),hi=Math.max(a,b),key=`${lo}:${hi}`;if(!seen.has(key)){seen.add(key);edges.push([lo,hi]);}}}}return{points,edges};}

export function collectionPath3Points(entity:CollectionPath3Entity,ctx?:GeometryContext):Point3[]{const source=ctx?.entity(entity.collection);if(!source||(source.kind!=="collection3"&&source.kind!=="collection3data"))return[];const points=collection3Points(source,Math.max(600,entity.child+1));if(entity.kind==="trail3")return[points[entity.child]??source.center];const child=points[entity.child];if(!child)return[];const center=entity.child===0?source.center:points[entity.child-1],radius=length(sub(child,center)),segments=Math.max(16,Math.min(256,Math.round(entity.segments)));return Array.from({length:segments+1},(_u,index)=>add3(center,{x:Math.cos(Math.PI*2*index/segments)*radius,y:Math.sin(Math.PI*2*index/segments)*radius,z:0}));}

export function pieces3Quads(entity:Pieces3Entity,ctx?:GeometryContext):Point3[][]{const source=ctx?.entity(entity.source);if(!source||(source.kind!=="surface3"&&source.kind!=="param3"))return[];const u0=source.kind==="surface3"?source.x0:source.u0,u1=source.kind==="surface3"?source.x1:source.u1,v0=source.kind==="surface3"?source.y0:source.v0,v1=source.kind==="surface3"?source.y1:source.v1,point=(u:number,v:number)=>source.kind==="surface3"?{x:u,y:v,z:surface3Value(source,u,v)}:param3Value(source,u,v);const du=(u1-u0)/entity.cols,dv=(v1-v0)/entity.rows,s=entity.inset*.5;return Array.from({length:entity.rows},(_u,row)=>Array.from({length:entity.cols},(_v,col)=>{const a=u0+(col+s)*du,b=u0+(col+1-s)*du,c=v0+(row+s)*dv,d=v0+(row+1-s)*dv;return[point(a,c),point(b,c),point(a,d),point(b,d)];})).flat();}

function walkOptions(raw:string){const values=Object.fromEntries(raw.split(/\s+/u).filter(Boolean).map(token=>token.split("=")).filter(pair=>pair.length===2));return{mode:values.mode==="turtle"?"turtle":"axis",distribution:values.distribution==="gaussian"?"gaussian":"uniform",angle:Number.isFinite(Number(values.angle))?Number(values.angle):90,scale:Math.max(.001,Number(values.scale)||1)} as const;}
function rotateAround3(value:Point3,axis:Point3,degrees:number):Point3{const radians=degrees*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians),u=unit(axis,{x:0,y:0,z:1}),crossed=cross(u,value),parallel=dot(u,value)*(1-c);return{x:value.x*c+crossed.x*s+u.x*parallel,y:value.y*c+crossed.y*s+u.y*parallel,z:value.z*c+crossed.z*s+u.z*parallel};}
export function randomWalk3Points(entity:RandomWalk3Entity,cap=4000):Point3[]{const options=walkOptions(entity.options),steps=Math.min(entity.steps,cap),points=[{...entity.center}];let p={...entity.center},heading={x:0,y:0,z:1},right={x:1,y:0,z:0},up={x:0,y:1,z:0};for(let index=0;index<steps;index++){let choice;if(options.distribution==="gaussian"){const u1=Math.max(1e-7,stableUnit3(entity.seed,index,103)),u2=stableUnit3(entity.seed,index,107),normal=Math.sqrt(-2*Math.log(u1))*Math.cos(Math.PI*2*u2);choice=((Math.round(normal)%6)+6)%6;}else choice=Math.min(5,Math.floor(stableUnit3(entity.seed,index,101)*6));const dirs=[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:-1,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}];if(options.mode==="axis")p=add3(p,mul3(dirs[choice],options.scale));else{p=add3(p,mul3(heading,options.scale));const axis=choice<2?up:choice<4?right:heading,degrees=choice===0?-options.angle:choice===1?options.angle:choice===2?options.angle:choice===3?-options.angle:choice===4?180:0;if(degrees!==0){heading=unit(rotateAround3(heading,axis,degrees),heading);right=unit(rotateAround3(right,axis,degrees),right);up=unit(rotateAround3(up,axis,degrees),up);}}points.push({...p});}return points;}

export function lsystem3Geometry(entity:LSystem3Entity,cap=12000):{points:Point3[];edges:[number,number][]}{const limit=Math.min(cap,entity.maxSymbols),rules=new Map(entity.rules.split(";").map(rule=>rule.trim()).filter(Boolean).map(rule=>{const at=rule.indexOf("=");return[rule.slice(0,at).trim(),rule.slice(at+1).trim()];}));let word=entity.axiom;for(let i=0;i<entity.iterations;i++){word=[...word].map(ch=>rules.get(ch)??ch).join("");if(word.length>limit){word=word.slice(0,limit);break;}}let pos={...entity.origin3},heading={x:1,y:0,z:0},right={x:0,y:1,z:0},up={x:0,y:0,z:1};const points:Point3[]=[],edges:[number,number][]=[],stack:{pos:Point3;heading:Point3;right:Point3;up:Point3}[]=[];for(const ch of word){if(ch==="F"||ch==="G"){const next=add3(pos,mul3(heading,entity.stepSize)),base=points.length;points.push(pos,next);edges.push([base,base+1]);pos=next;}else if(ch==="f")pos=add3(pos,mul3(heading,entity.stepSize));else if(ch==="[")stack.push({pos:{...pos},heading:{...heading},right:{...right},up:{...up}});else if(ch==="]"){const state=stack.pop();if(state)({pos,heading,right,up}=state);}else{const axis=ch==="+"||ch==="-"?{x:0,y:0,z:1}:ch==="^"||ch==="&"?{x:0,y:1,z:0}:{x:1,y:0,z:0},deg=["-","&",">"].includes(ch)?-entity.angle:entity.angle;if("+-^&<>".includes(ch)){heading=rotateAround3(heading,axis,deg);right=rotateAround3(right,axis,deg);up=rotateAround3(up,axis,deg);}}}return{points,edges};}

export function tree3Geometry(entity:Tree3Entity):{layers:{points:Point3[];edges:[number,number][]}[];leaves:Point3[]}{let current=[{from:entity.root,dir:{x:0,y:0,z:1},len:entity.length,index:0}],leaves:Point3[]=[];const layers=[];for(let level=0;level<entity.depth;level++){const points:Point3[]=[],edges:[number,number][]=[],next:typeof current=[];for(const branch of current){const to=add3(branch.from,mul3(branch.dir,branch.len)),base=points.length;points.push(branch.from,to);edges.push([base,base+1]);if(level+1===entity.depth){leaves.push(to);continue;}const reference=Math.abs(branch.dir.z)<.9?{x:0,y:0,z:1}:{x:0,y:1,z:0},sideAxis=unit(cross(branch.dir,reference),{x:1,y:0,z:0}),across=unit(cross(sideAxis,branch.dir),{x:0,y:1,z:0});for(let child=0;child<2;child++){const sign=child===0?-1:1,twist=(stableUnit3(entity.seed,branch.index*2+child,level+71)-.5)*.65,radial=mul3(add3(mul3(sideAxis,Math.cos(twist)),mul3(across,Math.sin(twist))),sign),angle=entity.angle*Math.PI/180,dir=unit(add3(mul3(branch.dir,Math.cos(angle)),mul3(radial,Math.sin(angle))),branch.dir);next.push({from:to,dir,len:branch.len*entity.shrink,index:branch.index*2+child+1});}}layers.push({points,edges});current=next;}return{layers,leaves};}

function hilbertPoint3(distance:number,order:number):[number,number,number]{const point=[0,0,0];for(let axis=0;axis<3;axis++)for(let bit=0;bit<order;bit++)point[axis]|=((distance>>(bit*3+(2-axis)))&1)<<bit;let t=point[2]>>1;for(let axis=2;axis>=1;axis--)point[axis]^=point[axis-1];point[0]^=t;for(let q=2,limit=1<<order;q!==limit;q<<=1){const p=q-1;for(let axis=2;axis>=0;axis--){if(point[axis]&q)point[0]^=p;else{t=(point[0]^point[axis])&p;point[0]^=t;point[axis]^=t;}}}return point as [number,number,number];}
export function hilbert3Points(entity:Hilbert3Entity):Point3[]{const order=Math.max(1,Math.min(5,Math.round(entity.order3))),den=(1<<order)-1,count=1<<(3*order),stride=Math.max(1,Math.ceil(count/5000));const points=[];for(let d=0;d<count;d+=stride){const p=hilbertPoint3(d,order);points.push(add3(entity.center,{x:(p[0]/den-.5)*entity.size,y:(p[1]/den-.5)*entity.size,z:(p[2]/den-.5)*entity.size}));}return points;}

type FrameValues = Omit<Frame3Entity, keyof ReturnType<typeof baseEntity> | "kind" | "id" | "center" | "size" | "childStyles">;
const FRAME_DEFAULTS: FrameValues = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -5, zMax: 5, xScale: "linear", yScale: "linear", zScale: "linear", xMajor: 1, yMajor: 1, zMajor: 1, xMinor: null, yMinor: null, zMinor: null, planes: "xy:min", mode: "textbook" };

function parseFrameOptions(raw: string): FrameValues | null {
  const value: FrameValues = { ...FRAME_DEFAULTS };
  for (const token of raw.split(/\s+/u).filter(Boolean)) {
    const split = token.indexOf("="); if (split < 1) return null;
    const key = token.slice(0, split), body = token.slice(split + 1);
    if (["x", "y", "z"].includes(key)) { const [loRaw, hiRaw, extra] = body.split(".."); const lo = Number(loRaw), hi = Number(hiRaw); if (extra !== undefined || !Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return null; (value as unknown as Record<string, unknown>)[`${key}Min`] = lo; (value as unknown as Record<string, unknown>)[`${key}Max`] = hi; continue; }
    if (key === "scale" || ["xscale", "yscale", "zscale"].includes(key)) { if (body !== "linear" && body !== "log") return null; const axes = key === "scale" ? ["x", "y", "z"] : [key[0]]; for (const axis of axes) (value as unknown as Record<string, unknown>)[`${axis}Scale`] = body; continue; }
    if (key === "major" || key === "minor" || /^[xyz](major|minor)$/u.test(key)) { const amount = Number(body); if (!Number.isFinite(amount) || amount <= 0) return null; const axes = key === "major" || key === "minor" ? ["x", "y", "z"] : [key[0]], suffix = key.includes("minor") ? "Minor" : "Major"; for (const axis of axes) (value as unknown as Record<string, unknown>)[`${axis}${suffix}`] = amount; continue; }
    if (key === "planes") { if (!body || body.split(",").some((plane) => !/^(xy|xz|yz):(min|max|origin|-?\d+(?:\.\d+)?)(?:@[A-Za-z0-9#_-]+)?$/u.test(plane))) return null; value.planes = body; continue; }
    if (key === "mode") { if (body !== "textbook" && body !== "spatial") return null; value.mode = body; continue; }
    return null;
  }
  if ((value.xScale === "log" && value.xMin <= 0) || (value.yScale === "log" && value.yMin <= 0) || (value.zScale === "log" && value.zMin <= 0)) return null;
  return value;
}

function frameOptions(entity: Frame3Entity): string {
  const parts = [`x=${num(entity.xMin)}..${num(entity.xMax)}`, `y=${num(entity.yMin)}..${num(entity.yMax)}`, `z=${num(entity.zMin)}..${num(entity.zMax)}`];
  if (entity.xScale === entity.yScale && entity.yScale === entity.zScale) { if (entity.xScale !== "linear") parts.push(`scale=${entity.xScale}`); }
  else { if (entity.xScale !== "linear") parts.push(`xscale=${entity.xScale}`); if (entity.yScale !== "linear") parts.push(`yscale=${entity.yScale}`); if (entity.zScale !== "linear") parts.push(`zscale=${entity.zScale}`); }
  if (entity.xMajor === entity.yMajor && entity.yMajor === entity.zMajor) parts.push(`major=${num(entity.xMajor)}`); else parts.push(`xmajor=${num(entity.xMajor)}`, `ymajor=${num(entity.yMajor)}`, `zmajor=${num(entity.zMajor)}`);
  if (entity.xMinor !== null || entity.yMinor !== null || entity.zMinor !== null) { if (entity.xMinor !== null && entity.xMinor === entity.yMinor && entity.yMinor === entity.zMinor) parts.push(`minor=${num(entity.xMinor)}`); else { if (entity.xMinor !== null) parts.push(`xminor=${num(entity.xMinor)}`); if (entity.yMinor !== null) parts.push(`yminor=${num(entity.yMinor)}`); if (entity.zMinor !== null) parts.push(`zminor=${num(entity.zMinor)}`); } }
  parts.push(`planes=${entity.planes}`, `mode=${entity.mode}`);
  return parts.join(" ");
}

function mapFrameAxis(entity: Frame3Entity, axis: keyof Point3, value: number): number | null {
  const lo = entity[`${axis}Min` as "xMin"], hi = entity[`${axis}Max` as "xMax"], scale = entity[`${axis}Scale` as "xScale"];
  const fraction = scale === "log" ? value <= 0 ? null : (Math.log10(value) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) : (value - lo) / (hi - lo);
  return fraction === null ? null : entity.center[axis] + (fraction - .5) * entity.size[axis];
}

export function frame3Map(entity: Frame3Entity, point: Point3): Point3 | null {
  const x = mapFrameAxis(entity, "x", point.x), y = mapFrameAxis(entity, "y", point.y), z = mapFrameAxis(entity, "z", point.z);
  return x === null || y === null || z === null ? null : { x, y, z };
}

export function curve3WorldPoints(entity: Curve3Entity, count = 240): Point3[] {
  const fx = formula(entity.fx), fy = formula(entity.fy), fz = formula(entity.fz);
  if (!fx || !fy || !fz) return [];
  const points: Point3[] = [];
  for (let index = 0; index <= count; index += 1) {
    const t = entity.t0 + (entity.t1 - entity.t0) * index / count;
    const env = new Map([["t", t], ["x", t]]);
    try {
      const point = { x: evalExpr(fx, env), y: evalExpr(fy, env), z: evalExpr(fz, env) };
      if (Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)) points.push(point);
    } catch { /* leave unsupported formula sections out of the design sketch */ }
  }
  return points;
}

export function curve3ScreenPoints(entity: Curve3Entity, doc?: SceneDoc) { return curve3WorldPoints(entity).map((point) => projectPoint3(point, doc)); }

registerEntity<Camera3Entity>({
  kind: "camera3", ctor: "camera3", group: "3D", label: "3D Camera", icon: "◉3", order: 60,
  hint: "The initial native 3-D camera; Canvas uses it only to project a stable design sketch", colorInCtor: true, movable: false, renameable: false,
  canCreate: (doc) => !doc.entities.some((entity) => entity.kind === "camera3"),
  createBlockedReason: "This scene already has its one initial 3D Camera. Select it in the Inspector to edit the pose.",
  create: () => ({ ...baseEntity("__camera3", "void"), kind: "camera3", eye: { x: 7, y: -7, z: 6 }, target: { x: 0, y: 0, z: 0 }, fov: 45, projection: "perspective", panelX: null, panelY: null, panelWidth: null, panelHeight: null }),
  parseArgs(stmt) {
    const eye = argPoint3(stmt.args, 0), target = argPoint3(stmt.args, 1);
    if (!eye || !target) return null;
    const fovArg = argNumber(stmt.args, 2);
    if (stmt.args.length > 2 && fovArg === null) return null;
    const projection = argName(stmt.args, 3);
    if ((stmt.args.length > 3 && !projection) || (projection && !["perspective", "persp", "orthographic", "ortho"].includes(projection))) return null;
    const panel = argPoint(stmt.args, 4);
    const panelWidth = panel ? argNumber(stmt.args, 5) : null;
    const panelHeight = panel ? argNumber(stmt.args, 6) : null;
    if (stmt.args.length > (panel ? 7 : 4) || (panel && (panelWidth === null || panelHeight === null || panelWidth <= 0 || panelHeight <= 0))) return null;
    return { ...baseEntity("__camera3", "void"), kind: "camera3", eye, target, fov: fovArg ?? 45, projection: projection === "orthographic" || projection === "ortho" ? "orthographic" : "perspective", panelX: panel?.x ?? null, panelY: panel?.y ?? null, panelWidth, panelHeight };
  },
  ctorLine(entity) { const panel = entity.panelX !== null && entity.panelY !== null && entity.panelWidth !== null && entity.panelHeight !== null ? `, ${pt(entity.panelX, entity.panelY)}, ${num(entity.panelWidth)}, ${num(entity.panelHeight)}` : ""; return `camera3(${pt3(entity.eye.x, entity.eye.y, entity.eye.z)}, ${pt3(entity.target.x, entity.target.y, entity.target.z)}, ${num(entity.fov)}, ${entity.projection}${panel});`; },
  extraLines: () => [], modifiers: {}, anchor: () => ({ x: 120, y: 44 }), translate() {}, bounds: () => ({ x: 18, y: 18, width: 204, height: 52 }), handles: () => [], dragHandle() {},
  fields: [{ key: "eye", label: "Eye", input: "point3" }, { key: "target", label: "Looks at", input: "point3" }, { key: "fov", label: "FOV / ortho span", input: "number", min: .01 }, { key: "projection", label: "Projection", input: "select", options: ["perspective", "orthographic"] }],
});

registerEntity<Grid3Entity>({
  kind: "grid3", ctor: "grid3", group: "3D", label: "3D Grid", icon: "#3", order: 61, hint: "An XY world grid projected through the initial camera", movable: false,
  create: (id) => ({ ...baseEntity(id, "dim"), kind: "grid3", center: { x: 0, y: 0, z: 0 }, half: 4, spacing: 1 }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), center = argPoint3(stmt.args, 1), rawHalf = argNumber(stmt.args, 2), half = rawHalf === null ? null : Math.trunc(rawHalf), spacing = argNumber(stmt.args, 3); return id && center && half !== null && half >= 1 && !(stmt.args.length > 3 && spacing === null) ? { ...baseEntity(id, "cyan"), kind: "grid3", center, half, spacing: spacing ?? 1 } : null; },
  ctorLine: (entity) => `grid3(${entity.id}, ${pt3(entity.center.x, entity.center.y, entity.center.z)}, ${num(entity.half)}, ${num(entity.spacing)});`, extraLines: () => [], modifiers: {},
  anchor: (entity, ctx) => projectPoint3(entity.center, ctx?.doc), translate() {},
  bounds(entity, ctx) { const p = (x: number, y: number) => projectPoint3({ x: entity.center.x + x, y: entity.center.y + y, z: entity.center.z }, ctx?.doc); return pointBox([p(-entity.half, -entity.half), p(entity.half, -entity.half), p(-entity.half, entity.half), p(entity.half, entity.half)]); },
  handles: () => [], dragHandle() {}, fields: [{ key: "center", label: "World center", input: "point3" }, { key: "half", label: "Half count", input: "number", min: 1, step: 1 }, { key: "spacing", label: "Spacing", input: "number", min: .01 }],
});

function registerStroke3(kind: "line3" | "arrow3", order: number) {
  registerEntity<Stroke3Entity>({
    kind, ctor: kind, group: "3D", label: kind === "arrow3" ? "3D Arrow" : "3D Line", icon: kind === "arrow3" ? "→3" : "—3", order, hint: "A world-space stroke projected through the initial camera", movable: false,
    create: (id) => ({ ...baseEntity(id, "cyan"), kind, from: { x: -1, y: 0, z: 0 }, to: { x: 1, y: 0, z: 0 }, thickness3: 0 }),
    parseArgs(stmt) { const id = argName(stmt.args, 0), from = argPoint3(stmt.args, 1), to = argPoint3(stmt.args, 2); return id && from && to ? { ...baseEntity(id, "cyan"), kind, from, to, thickness3: 0 } : null; },
    ctorLine: (entity) => `${kind}(${entity.id}, ${pt3(entity.from.x, entity.from.y, entity.from.z)}, ${pt3(entity.to.x, entity.to.y, entity.to.z)});`, extraLines: () => [], modifiers: {},
    anchor(entity, ctx) { const a = projectPoint3(entity.from, ctx?.doc), b = projectPoint3(entity.to, ctx?.doc); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }, translate() {},
    bounds(entity, ctx) { return pointBox([projectPoint3(entity.from, ctx?.doc), projectPoint3(entity.to, ctx?.doc)], 8); }, handles: () => [], dragHandle() {},
    fields: [{ key: "from", label: "World start", input: "point3" }, { key: "to", label: "World end", input: "point3" }],
  });
}
registerStroke3("line3", 62);
registerStroke3("arrow3", 63);

registerEntity<Curve3Entity>({
  kind: "curve3", ctor: "curve3", group: "3D", label: "3D Curve", icon: "∿3", order: 64, hint: "A sampled parametric x(t), y(t), z(t) curve", movable: false,
  create: (id) => ({ ...baseEntity(id, "cyan"), kind: "curve3", fx: "t", fy: "sin(t)", fz: "0", t0: 0, t1: Math.PI * 2, thickness3: 0 }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), fx = argString(stmt.args, 1), fy = argString(stmt.args, 2), fz = argString(stmt.args, 3), domain = argPoint(stmt.args, 4); return id && fx !== null && fy !== null && fz !== null && !(stmt.args.length > 4 && !domain) ? { ...baseEntity(id, "cyan"), kind: "curve3", fx, fy, fz, t0: domain?.x ?? 0, t1: domain?.y ?? Math.PI * 2, thickness3: 0 } : null; },
  ctorLine: (entity) => `curve3(${entity.id}, "${escapeString(entity.fx)}", "${escapeString(entity.fy)}", "${escapeString(entity.fz)}", ${pt(entity.t0, entity.t1)});`, extraLines: () => [], modifiers: {},
  anchor(entity, ctx) { const box = pointBox(curve3ScreenPoints(entity, ctx?.doc)); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, translate() {},
  bounds: (entity, ctx) => pointBox(curve3ScreenPoints(entity, ctx?.doc)), handles: () => [], dragHandle() {},
  fields: [{ key: "fx", label: "x(t)", input: "text" }, { key: "fy", label: "y(t)", input: "text" }, { key: "fz", label: "z(t)", input: "text" }, { key: "t0", label: "Domain start", input: "number" }, { key: "t1", label: "Domain end", input: "number" }],
});

registerEntity<Point3Entity>({
  kind: "point3", ctor: "point3", group: "3D", label: "3D Point", icon: "•3", order: 65, hint: "A world-space point projected through the initial camera", movable: false,
  create: (id) => ({ ...baseEntity(id, "cyan"), kind: "point3", at: { x: 0, y: 0, z: 0 }, radius: .08 }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), at = argPoint3(stmt.args, 1), radius = argNumber(stmt.args, 2); return id && at && !(stmt.args.length > 2 && radius === null) ? { ...baseEntity(id, "cyan"), kind: "point3", at, radius: radius ?? .08 } : null; },
  ctorLine: (entity) => `point3(${entity.id}, ${pt3(entity.at.x, entity.at.y, entity.at.z)}, ${num(entity.radius)});`, extraLines: () => [], modifiers: {},
  anchor: (entity, ctx) => projectPoint3(entity.at, ctx?.doc), translate() {}, bounds(entity, ctx) { const point = projectPoint3(entity.at, ctx?.doc), r = Math.max(4, entity.radius * point.scale); return { x: point.x - r, y: point.y - r, width: r * 2, height: r * 2 }; }, handles: () => [], dragHandle() {},
  fields: [{ key: "at", label: "World position", input: "point3" }, { key: "radius", label: "World radius", input: "number", min: .001, step: .01 }],
});

registerEntity<Axes3Entity>({
  kind: "axes3", ctor: "axes3", group: "3D", label: "3D Axes", icon: "XYZ", order: 65.1, fidelity: "semantic", hint: "Three native colored axes with addressable ticks and pinned numeric labels", movable: false,
  create: (id) => ({ ...baseEntity(id, "fg"), nativePaint: true, kind: "axes3", worldOrigin: { x: 0, y: 0, z: 0 }, length: 3, step: 1, childStyles: {} }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), worldOrigin = argPoint3(stmt.args, 1), length = argNumber(stmt.args, 2), step = argNumber(stmt.args, 3); return id && worldOrigin && length !== null && stmt.args.length >= 3 && stmt.args.length <= 4 && (stmt.args.length === 3 || step !== null) ? { ...baseEntity(id, "fg"), nativePaint: true, kind: "axes3", worldOrigin, length, step: step ?? 1, childStyles: {} } : null; },
  ctorLine: (entity) => `axes3(${entity.id}, ${pt3(entity.worldOrigin.x, entity.worldOrigin.y, entity.worldOrigin.z)}, ${num(entity.length)}, ${num(entity.step)});`, extraLines: (entity) => childStyleLines(entity.childStyles), modifiers: {},
  referenceIds: axes3References, storyTargets: (entity) => axes3References(entity).map((id) => ({ id, label: id, kind: id.includes(".num.") ? "text" : id.includes(".tick.") ? "line3" : "arrow3" })), applyReferenceModifier: applyChildStyle, replaceReference: replaceChildStyleReference,
  anchor: (entity, ctx) => projectPoint3(entity.worldOrigin, ctx?.doc), translate() {}, bounds(entity, ctx) { return projectedBox([entity.worldOrigin, add3(entity.worldOrigin, { x: entity.length, y: 0, z: 0 }), add3(entity.worldOrigin, { x: 0, y: entity.length, z: 0 }), add3(entity.worldOrigin, { x: 0, y: 0, z: entity.length })], ctx, 24); }, handles: () => [], dragHandle() {},
  fields: [{ key: "worldOrigin", label: "World origin", input: "point3" }, { key: "length", label: "Axis length", input: "number", min: .01, step: .1 }, { key: "step", label: "Tick step", input: "number", step: .1, hint: "Use 0 for plain arrows without ticks or numbers." }],
});

registerEntity<Frame3Entity>({
  kind: "frame3", ctor: "frame3", group: "3D", label: "Scientific 3D frame", icon: "▦3", order: 65.2, fidelity: "semantic", hint: "A bounded data-to-world frame with editable ranges, scales, grid planes, ticks, and presentation", movable: false,
  create: (id) => ({ ...baseEntity(id, "fg"), nativePaint: true, kind: "frame3", center: { x: 0, y: 0, z: 0 }, size: { x: 8, y: 8, z: 6 }, ...FRAME_DEFAULTS, xMin: -2, xMax: 2, yMin: -2, yMax: 2, zMin: -1, zMax: 2, childStyles: {} }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), center = argPoint3(stmt.args, 1), size = argPoint3(stmt.args, 2), raw = argString(stmt.args, 3); if (!id || !center || !size || size.x <= 0 || size.y <= 0 || size.z <= 0 || stmt.args.length > 4 || (stmt.args.length === 4 && raw === null)) return null; const options = parseFrameOptions(raw ?? ""); return options ? { ...baseEntity(id, "fg"), nativePaint: true, kind: "frame3", center, size, ...options, childStyles: {} } : null; },
  ctorLine: (entity) => `frame3(${entity.id}, ${pt3(entity.center.x, entity.center.y, entity.center.z)}, ${pt3(entity.size.x, entity.size.y, entity.size.z)}, "${escapeString(frameOptions(entity))}");`, extraLines: (entity) => childStyleLines(entity.childStyles), modifiers: {},
  referenceIds: (entity) => [`${entity.id}.axes`, `${entity.id}.grids`, `${entity.id}.ticks`, `${entity.id}.labels`, ...["x", "y", "z"].flatMap((axis) => [`${entity.id}.axis.${axis}`, `${entity.id}.axis.${axis}.line`, `${entity.id}.label.${axis}`])], storyTargets(entity) { return this.referenceIds!(entity).map((id) => ({ id, label: id, kind: id.includes("label") ? "text" : "line3" })); }, applyReferenceModifier: applyChildStyle, replaceReference: replaceChildStyleReference,
  anchor: (entity, ctx) => projectPoint3(entity.center, ctx?.doc), translate() {}, bounds(entity, ctx) { const half = mul3(entity.size, .5); return projectedBox([-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => add3(entity.center, { x: half.x * x, y: half.y * y, z: half.z * z })))), ctx, 24); }, handles: () => [], dragHandle() {},
  fields: [
    { key: "center", label: "World center", input: "point3" }, { key: "size", label: "World size", input: "point3" },
    { key: "xMin", label: "x minimum", input: "number" }, { key: "xMax", label: "x maximum", input: "number" }, { key: "xScale", label: "x scale", input: "select", options: ["linear", "log"] }, { key: "xMajor", label: "x major step", input: "number", min: .0001 }, { key: "xMinor", label: "x minor step", input: "number", nullable: true, min: .0001 },
    { key: "yMin", label: "y minimum", input: "number" }, { key: "yMax", label: "y maximum", input: "number" }, { key: "yScale", label: "y scale", input: "select", options: ["linear", "log"] }, { key: "yMajor", label: "y major step", input: "number", min: .0001 }, { key: "yMinor", label: "y minor step", input: "number", nullable: true, min: .0001 },
    { key: "zMin", label: "z minimum", input: "number" }, { key: "zMax", label: "z maximum", input: "number" }, { key: "zScale", label: "z scale", input: "select", options: ["linear", "log"] }, { key: "zMajor", label: "z major step", input: "number", min: .0001 }, { key: "zMinor", label: "z minor step", input: "number", nullable: true, min: .0001 },
    { key: "planes", label: "Grid planes", input: "text", hint: "Comma-separated native planes, for example xy:min,xz:origin,yz:max. Optional @color remains supported." }, { key: "mode", label: "Presentation", input: "select", options: ["textbook", "spatial"] },
  ],
});

registerEntity<Box3Entity>({
  kind: "cube3", ctor: "cube3", group: "3D", label: "3D Box", icon: "□3", order: 65.3, fidelity: "semantic", hint: "A native box projected as its depth-aware wireframe", movable: false,
  create: (id) => ({ ...baseEntity(id, "cyan"), nativePaint: true, kind: "cube3", center: { x: 0, y: 0, z: 1 }, size: { x: 2, y: 2, z: 2 } }), parseArgs(stmt) { const id = argName(stmt.args, 0), center = argPoint3(stmt.args, 1), size = argPoint3(stmt.args, 2); return id && center && size && stmt.args.length === 3 ? { ...baseEntity(id, "cyan"), nativePaint: true, kind: "cube3", center, size } : null; }, ctorLine: (entity) => `cube3(${entity.id}, ${pt3(entity.center.x, entity.center.y, entity.center.z)}, ${pt3(entity.size.x, entity.size.y, entity.size.z)});`, extraLines: () => [], modifiers: {}, anchor: (entity, ctx) => projectPoint3(entity.center, ctx?.doc), translate() {}, bounds: (entity, ctx) => projectedBox(cube3WorldVertices(entity), ctx), handles: () => [], dragHandle() {}, fields: [{ key: "center", label: "World center", input: "point3" }, { key: "size", label: "Dimensions", input: "point3" }],
});

registerEntity<Sphere3Entity>({
  kind: "sphere3", ctor: "sphere3", group: "3D", label: "3D Sphere", icon: "○3", order: 65.4, fidelity: "semantic", hint: "A native sphere shown with projected great circles", movable: false,
  create: (id) => ({ ...baseEntity(id, "cyan"), nativePaint: true, kind: "sphere3", center: { x: 0, y: 0, z: 1 }, radius: 1 }), parseArgs(stmt) { const id = argName(stmt.args, 0), center = argPoint3(stmt.args, 1), radius = argNumber(stmt.args, 2); return id && center && radius !== null && stmt.args.length === 3 ? { ...baseEntity(id, "cyan"), nativePaint: true, kind: "sphere3", center, radius } : null; }, ctorLine: (entity) => `sphere3(${entity.id}, ${pt3(entity.center.x, entity.center.y, entity.center.z)}, ${num(entity.radius)});`, extraLines: () => [], modifiers: {}, anchor: (entity, ctx) => projectPoint3(entity.center, ctx?.doc), translate() {}, bounds(entity, ctx) { const p = projectPoint3(entity.center, ctx?.doc), r = Math.max(2, Math.abs(entity.radius) * p.scale); return { x: p.x - r, y: p.y - r, width: r * 2, height: r * 2 }; }, handles: () => [], dragHandle() {}, fields: [{ key: "center", label: "World center", input: "point3" }, { key: "radius", label: "World radius", input: "number", min: .001, step: .1 }],
});

for (const [kind, label, color, order] of [["prism3", "Regular prism", "cyan", 65.5], ["pyramid3", "Regular pyramid", "lime", 65.6]] as const) registerEntity<PolySolid3Entity>({
  kind, ctor: kind, group: "3D", label, icon: kind === "prism3" ? "⬡3" : "△3", order, fidelity: "semantic", hint: "An editable regular solid; Preview owns filled-face depth ordering", movable: false,
  create: (id) => ({ ...baseEntity(id, color), nativePaint: true, kind, center: { x: 0, y: 0, z: 1 }, sides: kind === "prism3" ? 6 : 5, radius: 1, height: 2 }), parseArgs(stmt) { const id = argName(stmt.args, 0), center = argPoint3(stmt.args, 1), sides = argNumber(stmt.args, 2), radius = argNumber(stmt.args, 3), height = argNumber(stmt.args, 4); return id && center && sides !== null && sides >= 3 && radius !== null && height !== null && stmt.args.length === 5 ? { ...baseEntity(id, color), nativePaint: true, kind, center, sides: Math.min(256, Math.round(sides)), radius, height } : null; }, ctorLine: (entity) => `${kind}(${entity.id}, ${pt3(entity.center.x, entity.center.y, entity.center.z)}, ${num(Math.round(entity.sides))}, ${num(entity.radius)}, ${num(entity.height)});`, extraLines: () => [], modifiers: {}, anchor: (entity, ctx) => projectPoint3(entity.center, ctx?.doc), translate() {}, bounds(entity, ctx) { return projectedBox(polySolid3WorldGeometry(entity).points, ctx); }, handles: () => [], dragHandle() {}, fields: [{ key: "center", label: "World center", input: "point3" }, { key: "sides", label: "Sides", input: "number", min: 3, max: 256, step: 1 }, { key: "radius", label: "Radius", input: "number", min: .001, step: .1 }, { key: "height", label: "Height", input: "number", min: .001, step: .1 }],
});

registerEntity<Midpoint3Entity>({
  kind: "midpoint3", ctor: "midpoint3", group: "3D", label: "3D Midpoint", icon: "·3", order: 65.7, fidelity: "semantic", hint: "A live native point halfway between two earlier 3D entities", movable: false,
  canCreate: (doc) => threePointReferences(doc).length >= 2, createBlockedReason: "3D Midpoint needs two earlier 3D entities or addressable 3D children.", create(id, _x, _y, doc, selectedId) { const [a, b] = threePair(doc, selectedId); return { ...baseEntity(id, "fg"), nativePaint: true, kind: "midpoint3", a, b, radius: .12 }; }, parseArgs(stmt) { const id = argName(stmt.args, 0), a = argName(stmt.args, 1), b = argName(stmt.args, 2); return id && a && b && stmt.args.length === 3 ? { ...baseEntity(id, "fg"), nativePaint: true, kind: "midpoint3", a, b, radius: .12 } : null; }, ctorLine: (entity) => `midpoint3(${entity.id}, ${entity.a}, ${entity.b});`, extraLines: () => [], modifiers: {}, references: (entity) => [entity.a, entity.b], replaceReference(entity, from, to) { if (entity.a === from) entity.a = to; if (entity.b === from) entity.b = to; }, anchor(entity, ctx) { return projectPoint3(worldAnchor3(entity.id, ctx) ?? { x: 0, y: 0, z: 0 }, ctx?.doc); }, translate() {}, bounds(entity, ctx) { const p = projectPoint3(worldAnchor3(entity.id, ctx) ?? { x: 0, y: 0, z: 0 }, ctx?.doc), r = Math.max(4, entity.radius * p.scale); return { x: p.x - r, y: p.y - r, width: r * 2, height: r * 2 }; }, handles: () => [], dragHandle() {}, fields: [threePointField("a", "Endpoint A"), threePointField("b", "Endpoint B")],
});

registerEntity<Cross3Entity>({
  kind: "cross3", ctor: "cross3", group: "3D", label: "3D Cross product", icon: "×3", order: 65.8, fidelity: "semantic", hint: "Vectors v and w, their parallelogram, and the perpendicular area vector v × w", movable: false,
  create: (id) => ({ ...baseEntity(id, "gold"), nativePaint: true, kind: "cross3", worldOrigin: { x: 0, y: 0, z: 0 }, v: { x: 2, y: 1, z: 0 }, w: { x: -1, y: 2, z: 0 }, crossColor: "gold", childStyles: {} }), parseArgs(stmt) { const id = argName(stmt.args, 0), worldOrigin = argPoint3(stmt.args, 1), v = argPoint3(stmt.args, 2), w = argPoint3(stmt.args, 3), color = argName(stmt.args, 4); return id && worldOrigin && v && w && stmt.args.length >= 4 && stmt.args.length <= 5 && (stmt.args.length === 4 || color) ? { ...baseEntity(id, "gold"), nativePaint: true, kind: "cross3", worldOrigin, v, w, crossColor: color ?? "gold", childStyles: {} } : null; }, ctorLine: (entity) => `cross3(${entity.id}, ${pt3(entity.worldOrigin.x, entity.worldOrigin.y, entity.worldOrigin.z)}, ${pt3(entity.v.x, entity.v.y, entity.v.z)}, ${pt3(entity.w.x, entity.w.y, entity.w.z)}${entity.crossColor === "gold" ? "" : `, ${entity.crossColor}`});`, extraLines: (entity) => childStyleLines(entity.childStyles), modifiers: {}, referenceIds: cross3References, storyTargets: (entity) => storyTargets(cross3References(entity), "arrow3"), applyReferenceModifier: applyChildStyle, replaceReference: replaceChildStyleReference, anchor: (entity, ctx) => projectPoint3(entity.worldOrigin, ctx?.doc), translate() {}, bounds(entity, ctx) { return projectedBox(Object.values(cross3WorldGeometry(entity)).flat(), ctx, 10); }, handles: () => [], dragHandle() {}, fields: [{ key: "worldOrigin", label: "World origin", input: "point3" }, { key: "v", label: "Vector v", input: "point3" }, { key: "w", label: "Vector w", input: "point3" }, { key: "crossColor", label: "v × w color", input: "color" }],
});

registerEntity<Link3Entity>({
  kind: "link3", ctor: "link3", group: "3D", label: "Live 3D Link", icon: "⌁3", order: 65.9, fidelity: "semantic", hint: "A live trimmed edge between two earlier 3D entities", movable: false,
  canCreate: (doc) => threePointReferences(doc).length >= 2, createBlockedReason: "3D Link needs two earlier 3D entities or addressable 3D children.", create(id, _x, _y, doc, selectedId) { const [from, to] = threePair(doc, selectedId); return { ...baseEntity(id, "fg"), nativePaint: true, kind: "link3", from, to, trim: 0 }; }, parseArgs(stmt) { const id = argName(stmt.args, 0), from = argName(stmt.args, 1), to = argName(stmt.args, 2), trim = argNumber(stmt.args, 3); return id && from && to && stmt.args.length >= 3 && stmt.args.length <= 4 && (stmt.args.length === 3 || trim !== null) ? { ...baseEntity(id, "fg"), nativePaint: true, kind: "link3", from, to, trim: Math.max(0, trim ?? 0) } : null; }, ctorLine: (entity) => `link3(${entity.id}, ${entity.from}, ${entity.to}${entity.trim === 0 ? "" : `, ${num(entity.trim)}`});`, extraLines: () => [], modifiers: {}, references: (entity) => [entity.from, entity.to], replaceReference(entity, from, to) { if (entity.from === from) entity.from = to; if (entity.to === from) entity.to = to; }, anchor(entity, ctx) { const geometry = link3WorldGeometry(entity, ctx), a = projectPoint3(geometry.from, ctx?.doc), b = projectPoint3(geometry.to, ctx?.doc); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }, translate() {}, bounds(entity, ctx) { const geometry = link3WorldGeometry(entity, ctx); return projectedBox([geometry.from, geometry.to], ctx, 8); }, handles: () => [], dragHandle() {}, fields: [threePointField("from", "From"), threePointField("to", "To"), { key: "trim", label: "Trim each end", input: "number", min: 0, step: .01 }],
});

function proxyBox(center: Point3, extent: number): Point3[] {
  const half = Math.max(.1, Math.abs(extent)) / 2;
  return [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => add3(center, { x: x * half, y: y * half, z: z * half }))));
}

export function assembly3PartCenter(entity: Assembly3Entity, index: number): Point3 {
  const count = Math.max(1, entity.parts.length), span = Math.max(.8, entity.scaleFactor * 1.5);
  return add3(entity.center, { x: count === 1 ? 0 : (index / (count - 1) - .5) * span, y: 0, z: (index % 2) * span * .18 });
}

const FILLABLE_2D = ["rect", "circle", "polygon", "sector", "annulus", "boolean"] as const;
const PATH3_SOURCE_KINDS = ["line3", "arrow3", "curve3", "projectpath3"] as const;

registerEntity<Model3Entity>({
  kind: "model3", ctor: "model3", group: "3D", label: "3D model asset", icon: "OBJ", order: 66, fidelity: "semantic", hint: "A safety-limited geometry-only OBJ; Canvas shows its placement and asset identity", movable: false,
  create: (id) => ({ ...baseEntity(id, "fg"), nativePaint: true, kind: "model3", path: "asset:models/manic-pyramid.obj", center: { x: 0, y: 0, z: 0 }, scaleFactor: 1 }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), path = argString(stmt.args, 1), center = argPoint3(stmt.args, 2), scale = argNumber(stmt.args, 3); return id && path !== null && center && stmt.args.length >= 3 && stmt.args.length <= 4 && (stmt.args.length === 3 || scale !== null) ? { ...baseEntity(id, "fg"), nativePaint: true, kind: "model3", path, center, scaleFactor: scale ?? 1 } : null; },
  ctorLine: (entity) => `model3(${entity.id}, "${escapeString(entity.path)}", ${pt3(entity.center.x, entity.center.y, entity.center.z)}${entity.scaleFactor === 1 ? "" : `, ${num(entity.scaleFactor)}`});`, extraLines: () => [], modifiers: {},
  anchor: (entity, ctx) => projectPoint3(entity.center, ctx?.doc), translate() {}, bounds: (entity, ctx) => projectedBox(proxyBox(entity.center, entity.scaleFactor * 2), ctx, 16), handles: () => [], dragHandle() {},
  fields: [{ key: "path", label: "OBJ asset URI or path", input: "text", hint: "Use Assets to choose a portable asset:models/… URI. Canvas uses a placement proxy; Preview loads the actual mesh." }, { key: "center", label: "World center", input: "point3" }, { key: "scaleFactor", label: "Model scale", input: "number", step: .1 }],
});

registerEntity<Assembly3Entity>({
  kind: "assembly3", ctor: "assembly3", group: "3D", label: "Grouped 3D assembly", icon: "▦3", order: 66.1, fidelity: "semantic", hint: "A grouped OBJ whose named parts remain addressable as id.part", movable: false,
  create: (id) => ({ ...baseEntity(id, "fg"), nativePaint: true, kind: "assembly3", path: "asset:models/manic-console.obj", center: { x: 0, y: 0, z: 0 }, scaleFactor: 1, parts: [...(KNOWN_ASSEMBLY_PARTS["asset:models/manic-console.obj"] ?? [])], childStyles: {} }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), path = argString(stmt.args, 1), center = argPoint3(stmt.args, 2), scale = argNumber(stmt.args, 3); return id && path !== null && center && stmt.args.length >= 3 && stmt.args.length <= 4 && (stmt.args.length === 3 || scale !== null) ? { ...baseEntity(id, "fg"), nativePaint: true, kind: "assembly3", path, center, scaleFactor: scale ?? 1, parts: [...(KNOWN_ASSEMBLY_PARTS[path] ?? [])], childStyles: {} } : null; },
  ctorLine: (entity) => `assembly3(${entity.id}, "${escapeString(entity.path)}", ${pt3(entity.center.x, entity.center.y, entity.center.z)}${entity.scaleFactor === 1 ? "" : `, ${num(entity.scaleFactor)}`});`, extraLines: (entity) => childStyleLines(entity.childStyles), modifiers: {},
  referenceIds: assembly3References, storyTargets: (entity) => storyTargets(assembly3References(entity), "model3"), applyReferenceModifier: applyChildStyle, replaceReference: replaceChildStyleReference,
  referenceBounds(entity, ref, ctx) { const index = assembly3References(entity).indexOf(ref); return index < 0 ? null : projectedBox(proxyBox(assembly3PartCenter(entity, index), entity.scaleFactor * .75), ctx, 10); },
  anchor: (entity, ctx) => projectPoint3(entity.center, ctx?.doc), translate() {}, bounds(entity, ctx) { const points = entity.parts.length ? entity.parts.flatMap((_part, index) => proxyBox(assembly3PartCenter(entity, index), entity.scaleFactor * .75)) : proxyBox(entity.center, entity.scaleFactor * 2); return projectedBox(points, ctx, 16); }, handles: () => [], dragHandle() {},
  fields: [{ key: "path", label: "Grouped OBJ asset", input: "text", hint: "OBJ o/g names become addressable id.part children. Known catalogue parts appear in Story and Inspector." }, { key: "center", label: "World center", input: "point3" }, { key: "scaleFactor", label: "Assembly scale", input: "number", step: .1 }],
});

registerEntity<Extrude3Entity>({
  kind: "extrude3", ctor: "extrude3", group: "3D", label: "Extruded 2D region", icon: "▱3", order: 66.2, fidelity: "semantic", hint: "A 2D shape or Boolean region swept into a solid; native Preview consumes and hides the source", movable: false,
  canCreate: (doc) => doc.entities.some((entity) => (FILLABLE_2D as readonly string[]).includes(entity.kind)), createBlockedReason: "Extrude needs an earlier fillable circle, rectangle, polygon, circular region, or Boolean region.",
  create(id, _x, _y, doc, selectedId) { const source = doc?.entities.find((entity) => entity.id === selectedId && (FILLABLE_2D as readonly string[]).includes(entity.kind)) ?? [...(doc?.entities ?? [])].reverse().find((entity) => (FILLABLE_2D as readonly string[]).includes(entity.kind)); return { ...baseEntity(id, "fg"), nativePaint: true, kind: "extrude3", source: source?.id ?? "shape", height: 1, center: { x: 0, y: 0, z: .5 } }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1), height = argNumber(stmt.args, 2), center = argPoint3(stmt.args, 3); return id && source && height !== null && height > 0 && stmt.args.length >= 3 && stmt.args.length <= 4 && (stmt.args.length === 3 || center) ? { ...baseEntity(id, "fg"), nativePaint: true, kind: "extrude3", source, height, center: center ?? { x: 0, y: 0, z: 0 } } : null; },
  ctorLine: (entity) => `extrude3(${entity.id}, ${entity.source}, ${num(entity.height)}${entity.center.x === 0 && entity.center.y === 0 && entity.center.z === 0 ? "" : `, ${pt3(entity.center.x, entity.center.y, entity.center.z)}`});`, extraLines: () => [], modifiers: {}, references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; },
  anchor: (entity, ctx) => projectPoint3(entity.center, ctx?.doc), translate() {}, bounds: (entity, ctx) => projectedBox(extrude3WorldVertices(entity, ctx), ctx, 10), handles: () => [], dragHandle() {}, fields: [{ key: "source", label: "2D cross-section", input: "entity", entityKinds: FILLABLE_2D, referencesEarlierOnly: true, hint: "Native Preview hides this 2D recipe after constructing the solid." }, { key: "height", label: "Extrusion height", input: "number", min: .001, step: .1 }, { key: "center", label: "World center", input: "point3" }],
});

registerEntity<Revolve3Entity>({
  kind: "revolve3", ctor: "revolve3", group: "3D", label: "Solid of revolution", icon: "↻3", order: 66.3, fidelity: "semantic", hint: "A radius profile r(t) swept about the vertical axis", movable: false,
  create: (id) => ({ ...baseEntity(id, "cyan"), nativePaint: true, kind: "revolve3", center: { x: 0, y: 0, z: 1 }, profile: "1", t0: 0, t1: 2, sides: 32 }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), center = argPoint3(stmt.args, 1), profile = argString(stmt.args, 2), domain = argPoint(stmt.args, 3), sides = argNumber(stmt.args, 4); return id && center && profile !== null && domain && stmt.args.length >= 4 && stmt.args.length <= 5 && (stmt.args.length === 4 || sides !== null) ? { ...baseEntity(id, "cyan"), nativePaint: true, kind: "revolve3", center, profile, t0: domain.x, t1: domain.y, sides: Math.max(3, Math.min(256, Math.round(sides ?? 32))) } : null; },
  ctorLine: (entity) => `revolve3(${entity.id}, ${pt3(entity.center.x, entity.center.y, entity.center.z)}, "${escapeString(entity.profile)}", ${pt(entity.t0, entity.t1)}${entity.sides === 32 ? "" : `, ${num(Math.round(entity.sides))}`});`, extraLines: () => [], modifiers: {},
  anchor: (entity, ctx) => projectPoint3(entity.center, ctx?.doc), translate() {}, bounds(entity, ctx) { return projectedBox(revolve3WorldGeometry(entity, 24).points, ctx, 10); }, handles: () => [], dragHandle() {}, fields: [{ key: "center", label: "World center", input: "point3" }, { key: "profile", label: "Radius r(t)", input: "text" }, { key: "t0", label: "Height domain start", input: "number" }, { key: "t1", label: "Height domain end", input: "number" }, { key: "sides", label: "Angular sides", input: "number", min: 3, max: 256, step: 1 }],
});

registerEntity<Tube3Entity>({
  kind: "tube3", ctor: "tube3", group: "3D", label: "Tube along 3D path", icon: "◉3", order: 66.4, fidelity: "semantic", hint: "A variable-radius tube derived from an earlier 3D path", movable: false,
  canCreate: (doc) => doc.entities.some((entity) => (PATH3_SOURCE_KINDS as readonly string[]).includes(entity.kind)), createBlockedReason: "Tube needs an earlier line3, arrow3, curve3, or projected 3D path.",
  create(id, _x, _y, doc, selectedId) { const path = doc?.entities.find((entity) => entity.id === selectedId && (PATH3_SOURCE_KINDS as readonly string[]).includes(entity.kind)) ?? [...(doc?.entities ?? [])].reverse().find((entity) => (PATH3_SOURCE_KINDS as readonly string[]).includes(entity.kind)); return { ...baseEntity(id, "cyan"), nativePaint: true, kind: "tube3", path: path?.id ?? "path", radiusProfile: ".08", sides: 12 }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), path = argName(stmt.args, 1), radiusProfile = argString(stmt.args, 2), sides = argNumber(stmt.args, 3); return id && path && radiusProfile !== null && stmt.args.length >= 3 && stmt.args.length <= 4 && (stmt.args.length === 3 || sides !== null) ? { ...baseEntity(id, "cyan"), nativePaint: true, kind: "tube3", path, radiusProfile, sides: Math.max(3, Math.min(64, Math.round(sides ?? 12))) } : null; },
  ctorLine: (entity) => `tube3(${entity.id}, ${entity.path}, "${escapeString(entity.radiusProfile)}"${entity.sides === 12 ? "" : `, ${num(Math.round(entity.sides))}`});`, extraLines: () => [], modifiers: {}, references: (entity) => [entity.path], replaceReference(entity, from, to) { if (entity.path === from) entity.path = to; },
  anchor(entity, ctx) { const points = path3WorldPoints(entity.path, ctx); return projectPoint3(points[Math.floor(points.length / 2)] ?? { x: 0, y: 0, z: 0 }, ctx?.doc); }, translate() {}, bounds(entity, ctx) { return projectedBox(path3WorldPoints(entity.path, ctx), ctx, 18); }, handles: () => [], dragHandle() {}, fields: [{ key: "path", label: "3D spine", input: "entity", entityKinds: PATH3_SOURCE_KINDS, referencesEarlierOnly: true }, { key: "radiusProfile", label: "Radius r(t)", input: "text", hint: "t runs from 0 to 1 along the path." }, { key: "sides", label: "Tube sides", input: "number", min: 3, max: 64, step: 1 }],
});

registerEntity<Project3Entity>({
  kind: "project3", ctor: "project3", group: "3D", label: "Projected 3D point", icon: "⊥3", order: 66.5, fidelity: "semantic", hint: "A live orthogonal shadow of one 3D entity on a principal plane", movable: false,
  canCreate: (doc) => threePointReferences(doc).length > 0, createBlockedReason: "Project 3D point needs an earlier 3D entity or addressable child.", create(id, _x, _y, doc, selectedId) { const refs = threePointReferences(doc); return { ...baseEntity(id, "cyan"), nativePaint: true, kind: "project3", source: selectedId && refs.includes(selectedId) ? selectedId : refs.at(-1) ?? "point", plane: "xy", radius: .1 }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1), plane = argString(stmt.args, 2); return id && source && (plane === "xy" || plane === "xz" || plane === "yz") && stmt.args.length === 3 ? { ...baseEntity(id, "cyan"), nativePaint: true, kind: "project3", source, plane, radius: .1 } : null; },
  ctorLine: (entity) => `project3(${entity.id}, ${entity.source}, "${entity.plane}");`, extraLines: () => [], modifiers: {}, references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; }, anchor(entity, ctx) { return projectPoint3(project3WorldPoint(entity, ctx) ?? { x: 0, y: 0, z: 0 }, ctx?.doc); }, translate() {}, bounds(entity, ctx) { const point = projectPoint3(project3WorldPoint(entity, ctx) ?? { x: 0, y: 0, z: 0 }, ctx?.doc), r = Math.max(4, entity.radius * point.scale); return { x: point.x - r, y: point.y - r, width: r * 2, height: r * 2 }; }, handles: () => [], dragHandle() {}, fields: [threePointField("source", "3D source"), { key: "plane", label: "Projection plane", input: "select", options: ["xy", "xz", "yz"] }],
});

registerEntity<ProjectPath3Entity>({
  kind: "projectpath3", ctor: "projectpath3", group: "3D", label: "Projected 3D path", icon: "⌁⊥", order: 66.6, fidelity: "semantic", hint: "A complete live 3D path projected onto a principal plane", movable: false,
  canCreate: (doc) => doc.entities.some((entity) => (PATH3_SOURCE_KINDS as readonly string[]).includes(entity.kind)), createBlockedReason: "Projected path needs an earlier line3, arrow3, curve3, or projected path.", create(id, _x, _y, doc, selectedId) { const path = doc?.entities.find((entity) => entity.id === selectedId && (PATH3_SOURCE_KINDS as readonly string[]).includes(entity.kind)) ?? [...(doc?.entities ?? [])].reverse().find((entity) => (PATH3_SOURCE_KINDS as readonly string[]).includes(entity.kind)); return { ...baseEntity(id, "dim"), nativePaint: true, kind: "projectpath3", source: path?.id ?? "path", plane: "xy" }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1), plane = argName(stmt.args, 2); return id && source && (plane === "xy" || plane === "xz" || plane === "yz") && stmt.args.length === 3 ? { ...baseEntity(id, "dim"), nativePaint: true, kind: "projectpath3", source, plane } : null; },
  ctorLine: (entity) => `projectpath3(${entity.id}, ${entity.source}, ${entity.plane});`, extraLines: () => [], modifiers: {}, references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; }, anchor(entity, ctx) { const points = path3WorldPoints(entity.id, ctx); return projectPoint3(points[Math.floor(points.length / 2)] ?? { x: 0, y: 0, z: 0 }, ctx?.doc); }, translate() {}, bounds(entity, ctx) { return projectedBox(path3WorldPoints(entity.id, ctx), ctx, 8); }, handles: () => [], dragHandle() {}, fields: [{ key: "source", label: "3D path", input: "entity", entityKinds: PATH3_SOURCE_KINDS, referencesEarlierOnly: true }, { key: "plane", label: "Projection plane", input: "select", options: ["xy", "xz", "yz"] }],
});

registerEntity<GridEntity>({
  kind:"grid",ctor:"grid",group:"Data",label:"Cell grid",icon:"▦",order:24.8,fidelity:"semantic",hint:"A bounded 2D cell grid and source for grid simulations and heightmap3",movable:true,
  create:(id,x,y)=>({...baseEntity(id,"dim"),nativePaint:true,kind:"grid",x,y,cols:8,rows:6,cellSize:48,seed:null,...gridBaseExtras()}),
  parseArgs(stmt){const id=argName(stmt.args,0),seed=argString(stmt.args,1),center=argPoint(stmt.args,seed===null?1:2),cols=argNumber(stmt.args,seed===null?2:3),rows=argNumber(stmt.args,seed===null?3:4),cell=argNumber(stmt.args,seed===null?4:5),minimum=seed===null?4:5,maximum=seed===null?5:6;return id&&center&&cols!==null&&rows!==null&&stmt.args.length>=minimum&&stmt.args.length<=maximum&&(stmt.args.length<maximum||cell!==null)?{...baseEntity(id,"dim"),nativePaint:true,kind:"grid",x:center.x,y:center.y,cols:Math.max(1,Math.min(40,Math.round(cols))),rows:Math.max(1,Math.min(40,Math.round(rows))),cellSize:Math.max(1,cell??48),seed,...gridBaseExtras()}:null;},
  ctorLine:e=>`grid(${e.id}, ${e.seed===null?"":`"${escapeString(e.seed)}", `}${pt(e.x,e.y)}, ${num(e.cols)}, ${num(e.rows)}${e.cellSize===48?"":`, ${num(e.cellSize)}`});`,extraLines:gridExtraLines,modifiers:gridModifiers,anchor:e=>({x:e.x,y:e.y}),translate(e,dx,dy){e.x+=dx;e.y+=dy;},bounds:e=>({x:e.x-e.cols*e.cellSize/2,y:e.y-e.rows*e.cellSize/2,width:e.cols*e.cellSize,height:e.rows*e.cellSize}),handles:()=>[],dragHandle(){},fields:[{key:"seed",label:"ASCII seed",input:"text",nullable:true,hint:"Rows use semicolons; # wall, . open, @ start, * goal."},{key:"x",label:"Center X",input:"number"},{key:"y",label:"Center Y",input:"number"},{key:"cols",label:"Columns",input:"number",min:1,max:40,step:1},{key:"rows",label:"Rows",input:"number",min:1,max:40,step:1},{key:"cellSize",label:"Cell size",input:"number",min:1}],referenceIds:e=>[`${e.id}.cells`,`${e.id}.lines`,`${e.id}.path`,`${e.id}.frontier`,`${e.id}.visited`,...Array.from({length:e.rows},(_v,r)=>Array.from({length:e.cols},(_u,c)=>`${e.id}.r${r}c${c}`)).flat()],storyTargets(e){return this.referenceIds!(e).map(id=>({id,label:id,kind:id.includes("r")&&id.includes("c")?"rect":id.endsWith("frontier")||id.endsWith("visited")?"text":"line"}));},
});

const surfaceSourceField: FieldSpec = { key: "surface", label: "Height-field surface", input: "entity", entityKinds: ["surface3"], referencesEarlierOnly: true, hint: "Linked to an earlier surface3; Preview recomputes the native geometry." };
const no3Handles = { translate() {}, handles: () => [], dragHandle() {} };

registerEntity<Surface3Entity>({
  kind: "surface3", ctor: "surface3", group: "3D", label: "Height-field surface", icon: "z3", order: 67, fidelity: "semantic", hint: "A bounded z=f(x,y) mesh; Canvas caps its authoring sample", movable: false,
  create: (id) => ({ ...baseEntity(id, "cyan"), kind: "surface3", formula: "sin(x)*cos(y)", x0: -3, x1: 3, y0: -3, y1: 3, resolution: 20 }),
  parseArgs(stmt) { const id=argName(stmt.args,0), src=argString(stmt.args,1), xd=argPoint(stmt.args,2), yd=argPoint(stmt.args,3), res=argNumber(stmt.args,4); return id&&src!==null&&xd&&yd&&stmt.args.length>=4&&stmt.args.length<=5&&(stmt.args.length===4||res!==null)?{...baseEntity(id,"cyan"),kind:"surface3",formula:src,x0:xd.x,x1:xd.y,y0:yd.x,y1:yd.y,resolution:Math.max(2,Math.min(120,Math.round(res??20)))}:null; },
  ctorLine:e=>`surface3(${e.id}, "${escapeString(e.formula)}", ${pt(e.x0,e.x1)}, ${pt(e.y0,e.y1)}${e.resolution===20?"":`, ${num(e.resolution)}`});`, extraLines:()=>[], modifiers:{},
  anchor(e,ctx){const b=projectedBox(surface3Grid(e).points,ctx);return{x:b.x+b.width/2,y:b.y+b.height/2};}, bounds:(e,ctx)=>projectedBox(surface3Grid(e).points,ctx,10), ...no3Handles,
  fields:[{key:"formula",label:"Height z(x,y)",input:"text",hint:"Canvas samples supported expressions; Preview uses native resolution."},{key:"x0",label:"X start",input:"number"},{key:"x1",label:"X end",input:"number"},{key:"y0",label:"Y start",input:"number"},{key:"y1",label:"Y end",input:"number"},{key:"resolution",label:"Native resolution",input:"number",min:2,max:120,step:1}],
});

registerEntity<DomainSurface3Entity>({
  kind:"domainsurface",ctor:"domainsurface",group:"3D",label:"Complex domain surface",icon:"ℂ3",order:67.1,fidelity:"semantic",hint:"Complex modulus height and phase colour; Preview evaluates f(z)",movable:false,
  create:id=>({...baseEntity(id,"cyan"),nativePaint:true,kind:"domainsurface",formula:"1/(z*z+1)",x0:-2,x1:2,y0:-2,y1:2,resolution:48,height:1}),
  parseArgs(stmt){const id=argName(stmt.args,0),src=argString(stmt.args,1),xd=argPoint(stmt.args,2),yd=argPoint(stmt.args,3),res=argNumber(stmt.args,4),height=argNumber(stmt.args,5);return id&&src!==null&&xd&&yd&&stmt.args.length>=4&&stmt.args.length<=6&&(stmt.args.length<5||res!==null)&&(stmt.args.length<6||height!==null)?{...baseEntity(id,"cyan"),nativePaint:true,kind:"domainsurface",formula:src,x0:xd.x,x1:xd.y,y0:yd.x,y1:yd.y,resolution:Math.max(2,Math.min(160,Math.round(res??48))),height:height??1}:null;},
  ctorLine:e=>`domainsurface(${e.id}, "${escapeString(e.formula)}", ${pt(e.x0,e.x1)}, ${pt(e.y0,e.y1)}${e.resolution===48&&e.height===1?"":`, ${num(e.resolution)}${e.height===1?"":`, ${num(e.height)}`}`});`,extraLines:()=>[],modifiers:{},anchor:(e,ctx)=>projectPoint3({x:(e.x0+e.x1)/2,y:(e.y0+e.y1)/2,z:e.height},ctx?.doc),bounds:(e,ctx)=>projectedBox(proxyBox({x:(e.x0+e.x1)/2,y:(e.y0+e.y1)/2,z:e.height/2},Math.max(Math.abs(e.x1-e.x0),Math.abs(e.y1-e.y0),Math.abs(e.height))),ctx,12),...no3Handles,
  fields:[{key:"formula",label:"Complex f(z)",input:"text",hint:"Preview owns poles, modulus height, and phase hue."},{key:"x0",label:"X start",input:"number"},{key:"x1",label:"X end",input:"number"},{key:"y0",label:"Y start",input:"number"},{key:"y1",label:"Y end",input:"number"},{key:"resolution",label:"Native resolution",input:"number",min:2,max:160,step:1},{key:"height",label:"Height scale",input:"number",step:.1}],
});

registerEntity<ParamSurface3Entity>({
  kind:"param3",ctor:"param3",group:"3D",label:"Parametric surface",icon:"uv3",order:67.2,fidelity:"semantic",hint:"A sampled x(u,v), y(u,v), z(u,v) surface",movable:false,
  create:id=>({...baseEntity(id,"cyan"),kind:"param3",fx:"(2+cos(v))*cos(u)",fy:"(2+cos(v))*sin(u)",fz:"sin(v)",u0:0,u1:Math.PI*2,v0:0,v1:Math.PI*2,resolution:24}),
  parseArgs(stmt){const id=argName(stmt.args,0),fx=argString(stmt.args,1),fy=argString(stmt.args,2),fz=argString(stmt.args,3),ud=argPoint(stmt.args,4),vd=argPoint(stmt.args,5),res=argNumber(stmt.args,6);return id&&fx!==null&&fy!==null&&fz!==null&&ud&&vd&&stmt.args.length>=6&&stmt.args.length<=7&&(stmt.args.length===6||res!==null)?{...baseEntity(id,"cyan"),kind:"param3",fx,fy,fz,u0:ud.x,u1:ud.y,v0:vd.x,v1:vd.y,resolution:Math.max(2,Math.min(120,Math.round(res??24)))}:null;},
  ctorLine:e=>`param3(${e.id}, "${escapeString(e.fx)}", "${escapeString(e.fy)}", "${escapeString(e.fz)}", ${pt(e.u0,e.u1)}, ${pt(e.v0,e.v1)}${e.resolution===24?"":`, ${num(e.resolution)}`});`,extraLines:()=>[],modifiers:{},anchor(e,ctx){const b=projectedBox(param3Grid(e).points,ctx);return{x:b.x+b.width/2,y:b.y+b.height/2};},bounds:(e,ctx)=>projectedBox(param3Grid(e).points,ctx,10),...no3Handles,
  fields:[{key:"fx",label:"x(u,v)",input:"text"},{key:"fy",label:"y(u,v)",input:"text"},{key:"fz",label:"z(u,v)",input:"text"},{key:"u0",label:"U start",input:"number"},{key:"u1",label:"U end",input:"number"},{key:"v0",label:"V start",input:"number"},{key:"v1",label:"V end",input:"number"},{key:"resolution",label:"Native resolution",input:"number",min:2,max:120,step:1}],
});

registerEntity<Implicit3Entity>({
  kind:"implicit3",ctor:"implicit3",group:"3D",label:"Implicit isosurface",icon:"F=3",order:67.3,fidelity:"semantic",hint:"A bounded scalar-field isosurface; Preview extracts the mesh",movable:false,
  create:id=>({...baseEntity(id,"cyan"),kind:"implicit3",formula:"x*x+y*y+z*z",x0:-2,x1:2,y0:-2,y1:2,z0:-2,z1:2,level:1,resolution:18}),
  parseArgs(stmt){const id=argName(stmt.args,0),src=argString(stmt.args,1),xd=argPoint(stmt.args,2),yd=argPoint(stmt.args,3),zd=argPoint(stmt.args,4),level=argNumber(stmt.args,5),res=argNumber(stmt.args,6);return id&&src!==null&&xd&&yd&&zd&&stmt.args.length>=5&&stmt.args.length<=7&&(stmt.args.length<6||level!==null)&&(stmt.args.length<7||res!==null)?{...baseEntity(id,"cyan"),kind:"implicit3",formula:src,x0:xd.x,x1:xd.y,y0:yd.x,y1:yd.y,z0:zd.x,z1:zd.y,level:level??0,resolution:Math.max(6,Math.min(48,Math.round(res??18)))}:null;},
  ctorLine:e=>`implicit3(${e.id}, "${escapeString(e.formula)}", ${pt(e.x0,e.x1)}, ${pt(e.y0,e.y1)}, ${pt(e.z0,e.z1)}${e.level===0&&e.resolution===18?"":`, ${num(e.level)}${e.resolution===18?"":`, ${num(e.resolution)}`}`});`,extraLines:()=>[],modifiers:{},anchor:(e,ctx)=>projectPoint3({x:(e.x0+e.x1)/2,y:(e.y0+e.y1)/2,z:(e.z0+e.z1)/2},ctx?.doc),bounds:(e,ctx)=>projectedBox([-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>({x:x<0?e.x0:e.x1,y:y<0?e.y0:e.y1,z:z<0?e.z0:e.z1})))),ctx,10),...no3Handles,
  fields:[{key:"formula",label:"Scalar f(x,y,z)",input:"text",hint:"Preview runs native tetrahedral isosurface extraction."},{key:"x0",label:"X start",input:"number"},{key:"x1",label:"X end",input:"number"},{key:"y0",label:"Y start",input:"number"},{key:"y1",label:"Y end",input:"number"},{key:"z0",label:"Z start",input:"number"},{key:"z1",label:"Z end",input:"number"},{key:"level",label:"Isosurface level",input:"number"},{key:"resolution",label:"Native resolution",input:"number",min:6,max:48,step:1}],
});

registerEntity<Heightmap3Entity>({
  kind:"heightmap3",ctor:"heightmap3",group:"3D",label:"Grid height map",icon:"▥3",order:67.4,fidelity:"semantic",hint:"A semantic bridge from a 2D grid state into 3D terrain",movable:false,
  canCreate:doc=>doc.entities.some(e=>e.kind==="grid"),createBlockedReason:"Height map needs an earlier 2D grid.",create(id,_x,_y,doc,selectedId){const grid=doc?.entities.find(e=>e.id===selectedId&&e.kind==="grid")??[...(doc?.entities??[])].reverse().find(e=>e.kind==="grid");return{...baseEntity(id,"cyan"),kind:"heightmap3",grid:grid?.id??"grid",formula:"h",size:6};},
  parseArgs(stmt){const id=argName(stmt.args,0),grid=argName(stmt.args,1),src=argString(stmt.args,2),size=argNumber(stmt.args,3);return id&&grid&&src!==null&&stmt.args.length>=3&&stmt.args.length<=4&&(stmt.args.length===3||size!==null)?{...baseEntity(id,"cyan"),kind:"heightmap3",grid,formula:src,size:Math.max(.1,size??6)}:null;},ctorLine:e=>`heightmap3(${e.id}, ${e.grid}, "${escapeString(e.formula)}"${e.size===6?"":`, ${num(e.size)}`});`,extraLines:()=>[],modifiers:{},references:e=>[e.grid],replaceReference(e,from,to){if(e.grid===from)e.grid=to;},anchor:(e,ctx)=>projectPoint3({x:0,y:0,z:0},ctx?.doc),bounds:(e,ctx)=>projectedBox(proxyBox({x:0,y:0,z:.5},e.size),ctx,10),...no3Handles,
  fields:[{key:"grid",label:"2D grid source",input:"entity",entityKinds:["grid"],referencesEarlierOnly:true},{key:"formula",label:"Height z(x,y,h)",input:"text",hint:"h is 1 for wall/alive cells and 0 otherwise."},{key:"size",label:"World width",input:"number",min:.1,step:.1}],
});

function surfaceDependentDef(kind: SurfaceDependent3Entity["kind"], order: number, label: string, icon: string) {
  registerEntity<SurfaceDependent3Entity>({
    kind,ctor:kind,group:"3D",label,icon,order,fidelity:"semantic",hint:"A live surface3 dependency; Preview owns exact numerical geometry",movable:false,
    canCreate:doc=>doc.entities.some(e=>e.kind==="surface3"),createBlockedReason:`${label} needs an earlier surface3.`,create(id,_x,_y,doc,selectedId){const source=doc?.entities.find(e=>e.id===selectedId&&e.kind==="surface3")??[...(doc?.entities??[])].reverse().find(e=>e.kind==="surface3");return{...baseEntity(id,kind==="gradient3"?"gold":kind==="tangentplane3"?"magenta":kind==="descend3"?"lime":"cyan"),nativePaint:kind==="volume3",kind,surface:source?.id??"surface",level:kind==="contour3"?0:null,x:["gradient3","tangentplane3","descend3"].includes(kind)?0:null,y:["gradient3","tangentplane3","descend3"].includes(kind)?0:null,resolution:kind==="volume3"?7:null,rate:kind==="descend3"?.15:null,steps:kind==="descend3"?40:null,derivedColor:null,childStyles:{}};},
    parseArgs(stmt){const id=argName(stmt.args,0),surface=argName(stmt.args,1);if(!id||!surface)return null;const base={...baseEntity(id,kind==="gradient3"?"gold":kind==="tangentplane3"?"magenta":kind==="descend3"?"lime":"cyan"),nativePaint:kind==="volume3",kind,surface,level:null,x:null,y:null,resolution:null,rate:null,steps:null,derivedColor:null,childStyles:{}} as SurfaceDependent3Entity;if(kind==="contour3"){const level=argNumber(stmt.args,2);return level!==null&&stmt.args.length===3?{...base,level}:null;}if(kind==="volume3"){const res=argNumber(stmt.args,2),color=argName(stmt.args,3);return stmt.args.length>=2&&stmt.args.length<=4&&(stmt.args.length<3||res!==null)&&(stmt.args.length<4||color)?{...base,resolution:Math.max(2,Math.min(24,Math.round(res??7))),derivedColor:color??null}:null;}const x=argNumber(stmt.args,2),y=argNumber(stmt.args,3);if(x===null||y===null)return null;if(kind==="descend3"){const rate=argNumber(stmt.args,4),steps=argNumber(stmt.args,5),color=argName(stmt.args,6);return stmt.args.length>=4&&stmt.args.length<=7&&(stmt.args.length<5||rate!==null)&&(stmt.args.length<6||steps!==null)&&(stmt.args.length<7||color)?{...base,x,y,rate:rate??.15,steps:Math.max(2,Math.min(400,Math.round(steps??40))),derivedColor:color??null}:null;}const color=argName(stmt.args,4);return stmt.args.length>=4&&stmt.args.length<=5&&(stmt.args.length<5||color)?{...base,x,y,derivedColor:color??null}:null;},
    ctorLine(e){if(kind==="contour3")return`contour3(${e.id}, ${e.surface}, ${num(e.level??0)});`;if(kind==="volume3")return`volume3(${e.id}, ${e.surface}${e.resolution===7&&!e.derivedColor?"":`, ${num(e.resolution??7)}${e.derivedColor?`, ${e.derivedColor}`:""}`});`;if(kind==="descend3")return`descend3(${e.id}, ${e.surface}, ${num(e.x??0)}, ${num(e.y??0)}${e.rate===.15&&e.steps===40&&!e.derivedColor?"":`, ${num(e.rate??.15)}, ${num(e.steps??40)}${e.derivedColor?`, ${e.derivedColor}`:""}`});`;return`${kind}(${e.id}, ${e.surface}, ${num(e.x??0)}, ${num(e.y??0)}${e.derivedColor?`, ${e.derivedColor}`:""});`;},
    extraLines:e=>childStyleLines(e.childStyles),modifiers:{},references:e=>[e.surface],replaceReference(e,from,to){if(e.surface===from)e.surface=to;replaceChildStyleReference(e,from,to);},referenceIds:e=>surfaceFamilyReferences(e),storyTargets:e=>storyTargets(surfaceFamilyReferences(e),kind==="volume3"?"cube3":kind==="descend3"?"sphere3":"line3"),applyReferenceModifier:applyChildStyle,
    anchor(e,ctx){const points=surfaceDependent3Points(e,ctx),b=projectedBox(points,ctx);return{x:b.x+b.width/2,y:b.y+b.height/2};},bounds:(e,ctx)=>projectedBox(surfaceDependent3Points(e,ctx),ctx,10),...no3Handles,
    fields:[surfaceSourceField,...(kind==="contour3"?[{key:"level",label:"Contour level",input:"number"} as FieldSpec]:[]),...(["gradient3","tangentplane3","descend3"].includes(kind)?[{key:"x",label:"Surface X",input:"number"},{key:"y",label:"Surface Y",input:"number"}] as FieldSpec[]:[]),...(kind==="volume3"?[{key:"resolution",label:"Column resolution",input:"number",min:2,max:24,step:1}] as FieldSpec[]:[]),...(kind==="descend3"?[{key:"rate",label:"Descent rate",input:"number",step:.01},{key:"steps",label:"Descent steps",input:"number",min:2,max:400,step:1}] as FieldSpec[]:[]),...(["gradient3","tangentplane3","volume3","descend3"].includes(kind)?[{key:"derivedColor",label:"Native constructor color",input:"color",nullable:true}] as FieldSpec[]:[])],
  });
}
surfaceDependentDef("contour3",67.5,"Surface contour","≋3");
surfaceDependentDef("gradient3",67.7,"Surface gradient","∇3");
surfaceDependentDef("tangentplane3",67.8,"Tangent plane","▱∇");
surfaceDependentDef("volume3",67.9,"Volume under surface","▥∫");
surfaceDependentDef("descend3",68.3,"Gradient descent","↘3");

registerEntity<Slice3Entity>({
  kind:"slice3",ctor:"slice3",group:"3D",label:"Surface slice",icon:"⌁3",order:67.6,fidelity:"semantic",hint:"A cross-section with an optional addressable slope tangent",movable:false,
  canCreate:doc=>doc.entities.some(e=>e.kind==="surface3"),createBlockedReason:"Surface slice needs an earlier surface3.",create(id,_x,_y,doc,selectedId){const source=doc?.entities.find(e=>e.id===selectedId&&e.kind==="surface3")??[...(doc?.entities??[])].reverse().find(e=>e.kind==="surface3");return{...baseEntity(id,"magenta"),kind:"slice3",surface:source?.id??"surface",axis:"x",value:0,at:null,sliceColor:null,childStyles:{}};},
  parseArgs(stmt){const id=argName(stmt.args,0),surface=argName(stmt.args,1),axis=argName(stmt.args,2),value=argNumber(stmt.args,3),at=argNumber(stmt.args,4),color=argName(stmt.args,5);return id&&surface&&(axis==="x"||axis==="y")&&value!==null&&stmt.args.length>=4&&stmt.args.length<=6&&(stmt.args.length<5||at!==null)&&(stmt.args.length<6||color)?{...baseEntity(id,"magenta"),kind:"slice3",surface,axis,value,at:at??null,sliceColor:color??null,childStyles:{}}:null;},
  ctorLine:e=>`slice3(${e.id}, ${e.surface}, ${e.axis}, ${num(e.value)}${e.at===null&&!e.sliceColor?"":`, ${num(e.at??0)}${e.sliceColor?`, ${e.sliceColor}`:""}`});`,extraLines:e=>childStyleLines(e.childStyles),modifiers:{},references:e=>[e.surface],replaceReference(e,from,to){if(e.surface===from)e.surface=to;replaceChildStyleReference(e,from,to);},referenceIds:e=>surfaceFamilyReferences(e),storyTargets:e=>storyTargets(surfaceFamilyReferences(e),"line3"),applyReferenceModifier:applyChildStyle,anchor(e,ctx){const points=slice3WorldPoints(e,ctx),b=projectedBox(points,ctx);return{x:b.x+b.width/2,y:b.y+b.height/2};},bounds:(e,ctx)=>projectedBox(slice3WorldPoints(e,ctx),ctx,10),...no3Handles,
  fields:[surfaceSourceField,{key:"axis",label:"Held coordinate",input:"select",options:["x","y"]},{key:"value",label:"Held value",input:"number"},{key:"at",label:"Slope tangent at",input:"number",nullable:true},{key:"sliceColor",label:"Native constructor color",input:"color",nullable:true}],
});

registerEntity<VectorField3Entity>({
  kind:"vectorfield3",ctor:"vectorfield3",group:"3D",label:"3D vector field",icon:"⇢3",order:68,fidelity:"semantic",hint:"A bounded formula-backed arrow lattice; Canvas caps density",movable:false,
  create:id=>({...baseEntity(id,"dim"),kind:"vectorfield3",center:{x:0,y:0,z:0},half:{x:2,y:2,z:2},u:"-y",v:"x",w:"0",density:5}),
  parseArgs(stmt){const id=argName(stmt.args,0),center=argPoint3(stmt.args,1),half=argPoint3(stmt.args,2),u=argString(stmt.args,3),v=argString(stmt.args,4),w=argString(stmt.args,5),density=argNumber(stmt.args,6);return id&&center&&half&&u!==null&&v!==null&&w!==null&&stmt.args.length>=6&&stmt.args.length<=7&&(stmt.args.length===6||density!==null)?{...baseEntity(id,"dim"),kind:"vectorfield3",center,half,u,v,w,density:Math.max(2,Math.min(13,Math.round(density??5)))}:null;},
  ctorLine:e=>`vectorfield3(${e.id}, ${pt3(e.center.x,e.center.y,e.center.z)}, ${pt3(e.half.x,e.half.y,e.half.z)}, "${escapeString(e.u)}", "${escapeString(e.v)}", "${escapeString(e.w)}"${e.density===5?"":`, ${num(e.density)}`});`,extraLines:()=>[],modifiers:{},anchor:(e,ctx)=>projectPoint3(e.center,ctx?.doc),bounds:(e,ctx)=>projectedBox(proxyBox(e.center,Math.max(e.half.x,e.half.y,e.half.z)*2),ctx,10),...no3Handles,
  fields:[{key:"center",label:"World center",input:"point3"},{key:"half",label:"Half-size",input:"point3"},{key:"u",label:"X component u(x,y,z,p)",input:"text"},{key:"v",label:"Y component v(x,y,z,p)",input:"text"},{key:"w",label:"Z component w(x,y,z,p)",input:"text"},{key:"density",label:"Native density",input:"number",min:2,max:13,step:1}],
});

registerEntity<Trajectory3Entity>({
  kind:"trajectory3",ctor:"trajectory3",group:"3D",label:"3D ODE trajectory",icon:"∿3",order:68.1,fidelity:"semantic",hint:"A stateful RK4 path; Canvas uses a bounded authoring sample",movable:false,
  create:id=>({...baseEntity(id,"cyan"),nativePaint:true,kind:"trajectory3",dx:"10*(y-x)",dy:"x*(28-z)-y",dz:"x*y-(8/3)*z",start:{x:.1,y:0,z:0},steps:6000,dt:.008}),
  parseArgs(stmt){const id=argName(stmt.args,0),dx=argString(stmt.args,1),dy=argString(stmt.args,2),dz=argString(stmt.args,3),start=argPoint3(stmt.args,4),steps=argNumber(stmt.args,5),dt=argNumber(stmt.args,6);return id&&dx!==null&&dy!==null&&dz!==null&&start&&stmt.args.length>=5&&stmt.args.length<=7&&(stmt.args.length<6||steps!==null)&&(stmt.args.length<7||dt!==null)?{...baseEntity(id,"cyan"),nativePaint:true,kind:"trajectory3",dx,dy,dz,start,steps:Math.max(2,Math.min(60000,Math.round(steps??6000))),dt:Math.max(1e-6,dt??.008)}:null;},
  ctorLine:e=>`trajectory3(${e.id}, "${escapeString(e.dx)}", "${escapeString(e.dy)}", "${escapeString(e.dz)}", ${pt3(e.start.x,e.start.y,e.start.z)}${e.steps===6000&&e.dt===.008?"":`, ${num(e.steps)}${e.dt===.008?"":`, ${num(e.dt)}`}`});`,extraLines:()=>[],modifiers:{},anchor(e,ctx){const b=projectedBox(trajectory3WorldPoints(e),ctx);return{x:b.x+b.width/2,y:b.y+b.height/2};},bounds:(e,ctx)=>projectedBox(trajectory3WorldPoints(e),ctx,10),...no3Handles,
  fields:[{key:"dx",label:"dx/dt",input:"text"},{key:"dy",label:"dy/dt",input:"text"},{key:"dz",label:"dz/dt",input:"text"},{key:"start",label:"Initial state",input:"point3"},{key:"steps",label:"Native integration steps",input:"number",min:2,max:60000,step:1},{key:"dt",label:"Time step",input:"number",min:1e-6,step:.001}],
});

function matrix3Def(kind: MatrixMap3Entity["kind"],order:number,label:string,icon:string){
  registerEntity<MatrixMap3Entity>({
    kind,ctor:kind,group:"3D",label,icon,order,fidelity:"semantic",hint:kind==="linmap3"?"A 3×3 map with addressable basis and determinant children":"Real invariant directions; Preview computes exact cubic eigenpairs",movable:false,
    create:id=>({...baseEntity(id,kind==="linmap3"?"lime":"cyan"),nativePaint:true,kind,center:{x:0,y:0,z:0},a:1,b:0,c:0,d:0,e:1,f:0,g:0,h:0,i:1,matrixColor:null,childStyles:{}}),
    parseArgs(stmt){const id=argName(stmt.args,0),center=argPoint3(stmt.args,1),v=Array.from({length:9},(_u,index)=>argNumber(stmt.args,index+2)),color=argName(stmt.args,11);return id&&center&&v.every(x=>x!==null)&&stmt.args.length>=11&&stmt.args.length<=12&&(stmt.args.length===11||color)?{...baseEntity(id,kind==="linmap3"?"lime":"cyan"),nativePaint:true,kind,center,a:v[0]!,b:v[1]!,c:v[2]!,d:v[3]!,e:v[4]!,f:v[5]!,g:v[6]!,h:v[7]!,i:v[8]!,matrixColor:color??null,childStyles:{}}:null;},
    ctorLine:e=>`${kind}(${e.id}, ${pt3(e.center.x,e.center.y,e.center.z)}, ${[e.a,e.b,e.c,e.d,e.e,e.f,e.g,e.h,e.i].map(num).join(", ")}${e.matrixColor?`, ${e.matrixColor}`:""});`,extraLines:e=>childStyleLines(e.childStyles),modifiers:{},referenceIds:e=>surfaceFamilyReferences(e),storyTargets:e=>surfaceFamilyReferences(e).map(id=>({id,label:id,kind:/\.(?:l[ijk0-2]|val|note)$/u.test(id)?"text":id.includes(".axis")?"line3":"arrow3"})),applyReferenceModifier:applyChildStyle,replaceReference:replaceChildStyleReference,anchor:(e,ctx)=>projectPoint3(e.center,ctx?.doc),bounds:(e,ctx)=>kind==="linmap3"?projectedBox(linmap3WorldGeometry(e).points,ctx,12):projectedBox(proxyBox(e.center,5),ctx,12),...no3Handles,
    fields:[{key:"center",label:"World center",input:"point3"},...(["a","b","c","d","e","f","g","h","i"] as const).map((key,index)=>({key,label:`Matrix ${Math.floor(index/3)+1},${index%3+1}`,input:"number" as const,step:.1})),{key:"matrixColor",label:"Native constructor color",input:"color",nullable:true}],
  });
}
matrix3Def("linmap3",68.4,"3D linear map","M3");
matrix3Def("eigen3",68.5,"3D eigenvectors","λ3");

const COLLECTION3_KINDS=["collection3","collection3data"] as const;
const collectionField:FieldSpec={key:"collection",label:"3D collection",input:"entity",entityKinds:COLLECTION3_KINDS,referencesEarlierOnly:true,hint:"Stable child indexes remain linked to this collection."};

function collection3Def(kind:Collection3Entity["kind"],order:number,label:string){registerEntity<Collection3Entity>({
  kind,ctor:kind,group:"3D",label,icon:"••3",order,fidelity:"semantic",hint:"A renderer-batched 3D point family with deterministic stable indexes",movable:false,
  create:id=>({...baseEntity(id,"cyan"),kind,center:{x:0,y:0,z:0},count:kind==="collection3"?120:4,spread:{x:2,y:2,z:2},seed:21,pointsData:"-1 0 0; 0 1 0; 1 0 0; 0 -1 0",radius:.07}),
  parseArgs(stmt){const id=argName(stmt.args,0),center=argPoint3(stmt.args,1);if(!id||!center)return null;if(kind==="collection3"){const count=argNumber(stmt.args,2),spread=argPoint3(stmt.args,3),seed=argNumber(stmt.args,4),radius=argNumber(stmt.args,5);return count!==null&&count>=1&&count<=4000&&spread&&spread.x>=0&&spread.y>=0&&spread.z>=0&&seed!==null&&seed>=0&&stmt.args.length>=5&&stmt.args.length<=6&&(stmt.args.length===5||radius!==null)&&(radius===null||(radius>=.005&&radius<=2))?{...baseEntity(id,"cyan"),kind,center,count:Math.round(count),spread,seed:Math.round(seed),pointsData:"",radius:radius??.07}:null;}const data=argString(stmt.args,2),radius=argNumber(stmt.args,3),points=data===null?null:strictPointTriples(data);return data!==null&&points&&stmt.args.length>=3&&stmt.args.length<=4&&(stmt.args.length===3||radius!==null)&&(radius===null||(radius>=.005&&radius<=2))?{...baseEntity(id,"cyan"),kind,center,count:points.length,spread:{x:0,y:0,z:0},seed:0,pointsData:data,radius:radius??.07}:null;},
  ctorLine:e=>kind==="collection3"?`collection3(${e.id}, ${pt3(e.center.x,e.center.y,e.center.z)}, ${num(e.count)}, ${pt3(e.spread.x,e.spread.y,e.spread.z)}, ${num(e.seed)}${e.radius===.07?"":`, ${num(e.radius)}`});`:`collection3data(${e.id}, ${pt3(e.center.x,e.center.y,e.center.z)}, "${escapeString(e.pointsData)}"${e.radius===.07?"":`, ${num(e.radius)}`});`,extraLines:()=>[],modifiers:{},anchor:(e,ctx)=>projectPoint3(e.center,ctx?.doc),bounds:(e,ctx)=>projectedBox(collection3Points(e),ctx,Math.max(6,e.radius*10)),...no3Handles,
  fields:[{key:"center",label:"World center",input:"point3"},...(kind==="collection3"?[{key:"count",label:"Point count",input:"number",min:1,max:4000,step:1},{key:"spread",label:"Half spread",input:"point3"},{key:"seed",label:"Deterministic seed",input:"number",min:0,step:1}] as FieldSpec[]:[{key:"pointsData",label:"Explicit x y z triples",input:"textarea",hint:"Separate triples with semicolons."} as FieldSpec]),{key:"radius",label:"Point radius",input:"number",min:.005,max:2,step:.005}],
});}
collection3Def("collection3",69,"Seeded 3D collection");collection3Def("collection3data",69.1,"Explicit 3D collection");

registerEntity<CollectionChild3Entity>({
  kind:"child3",ctor:"child3",group:"3D",label:"Collection child proxy",icon:"•#",order:69.2,fidelity:"semantic",hint:"Expose one stable collection index as an ordinary 3D point",movable:false,
  canCreate:doc=>doc.entities.some(e=>(COLLECTION3_KINDS as readonly string[]).includes(e.kind)),createBlockedReason:"Collection child needs an earlier collection3 or collection3data.",create(id,_x,_y,doc,selectedId){const source=doc?.entities.find(e=>e.id===selectedId&&(COLLECTION3_KINDS as readonly string[]).includes(e.kind))??[...(doc?.entities??[])].reverse().find(e=>(COLLECTION3_KINDS as readonly string[]).includes(e.kind));return{...baseEntity(id,"gold"),kind:"child3",collection:source?.id??"points",index:0,radius:.11};},
  parseArgs(stmt){const id=argName(stmt.args,0),collection=argName(stmt.args,1),index=argNumber(stmt.args,2),radius=argNumber(stmt.args,3);return id&&collection&&index!==null&&stmt.args.length>=3&&stmt.args.length<=4&&(stmt.args.length===3||radius!==null)?{...baseEntity(id,"gold"),kind:"child3",collection,index:Math.max(0,Math.round(index)),radius:radius??.11}:null;},ctorLine:e=>`child3(${e.id}, ${e.collection}, ${num(e.index)}${e.radius===.11?"":`, ${num(e.radius)}`});`,extraLines:()=>[],modifiers:{},references:e=>[e.collection],replaceReference(e,from,to){if(e.collection===from)e.collection=to;},anchor:(e,ctx)=>projectPoint3(collectionChild3Point(e,ctx)??{x:0,y:0,z:0},ctx?.doc),bounds(e,ctx){const p=projectPoint3(collectionChild3Point(e,ctx)??{x:0,y:0,z:0},ctx?.doc),r=Math.max(4,p.scale*e.radius);return{x:p.x-r,y:p.y-r,width:r*2,height:r*2};},...no3Handles,fields:[collectionField,{key:"index",label:"Stable child index",input:"number",min:0,step:1},{key:"radius",label:"Proxy radius",input:"number",min:.001,step:.01}],
});

function collectionLinksDef(kind:CollectionLinks3Entity["kind"],order:number,label:string){registerEntity<CollectionLinks3Entity>({
  kind,ctor:kind,group:"3D",label,icon:"⌁#",order,fidelity:"semantic",hint:"A live edge mesh following stable collection indexes",movable:false,
  canCreate:doc=>doc.entities.some(e=>(COLLECTION3_KINDS as readonly string[]).includes(e.kind)),createBlockedReason:`${label} needs an earlier 3D collection.`,create(id,_x,_y,doc,selectedId){const source=doc?.entities.find(e=>e.id===selectedId&&(COLLECTION3_KINDS as readonly string[]).includes(e.kind))??[...(doc?.entities??[])].reverse().find(e=>(COLLECTION3_KINDS as readonly string[]).includes(e.kind));return{...baseEntity(id,"dim"),kind,collection:source?.id??"points",mode:"chain",neighbors:2,edgesData:"0 1; 1 2"};},
  parseArgs(stmt){const id=argName(stmt.args,0),collection=argName(stmt.args,1);if(!id||!collection)return null;if(kind==="links3data"){const edgesData=argString(stmt.args,2);return edgesData!==null&&strictEdgePairs(edgesData)&&stmt.args.length===3?{...baseEntity(id,"dim"),kind,collection,mode:"chain",neighbors:2,edgesData}:null;}const mode=argName(stmt.args,2),neighbors=argNumber(stmt.args,3);return(mode==="chain"||mode==="nearest"||mode==="all")&&stmt.args.length>=3&&stmt.args.length<=4&&(stmt.args.length===3||neighbors!==null)&&(mode!=="nearest"||neighbors===null||(neighbors>=1&&neighbors<=8))?{...baseEntity(id,"dim"),kind,collection,mode,neighbors:Math.round(neighbors??2),edgesData:""}:null;},
  ctorLine:e=>kind==="links3data"?`links3data(${e.id}, ${e.collection}, "${escapeString(e.edgesData)}");`:`links3(${e.id}, ${e.collection}, ${e.mode}${e.mode==="nearest"&&e.neighbors!==2?`, ${num(e.neighbors)}`:""});`,extraLines:()=>[],modifiers:{},references:e=>[e.collection],replaceReference(e,from,to){if(e.collection===from)e.collection=to;},anchor(e,ctx){const g=collectionLinks3Geometry(e,ctx),b=projectedBox(g.points,ctx);return{x:b.x+b.width/2,y:b.y+b.height/2};},bounds:(e,ctx)=>projectedBox(collectionLinks3Geometry(e,ctx).points,ctx,8),...no3Handles,
  fields:[collectionField,...(kind==="links3"?[{key:"mode",label:"Connection mode",input:"select",options:["chain","nearest","all"]},{key:"neighbors",label:"Nearest neighbors",input:"number",min:1,max:8,step:1,visibleWhen:{key:"mode",equals:"nearest"}}] as FieldSpec[]:[{key:"edgesData",label:"Explicit index pairs",input:"textarea",hint:"Use from to; from to; …"} as FieldSpec])],
});}
collectionLinksDef("links3",69.3,"Collection relationship mesh");collectionLinksDef("links3data",69.4,"Explicit collection links");

registerEntity<Pieces3Entity>({
  kind:"pieces3",ctor:"pieces3",group:"3D",label:"Surface pieces",icon:"▦3",order:69.5,fidelity:"semantic",hint:"Addressable live tiles cut from a surface3 or param3",movable:false,
  canCreate:doc=>doc.entities.some(e=>e.kind==="surface3"||e.kind==="param3"),createBlockedReason:"Surface pieces need an earlier surface3 or param3.",create(id,_x,_y,doc,selectedId){const source=doc?.entities.find(e=>e.id===selectedId&&(e.kind==="surface3"||e.kind==="param3"))??[...(doc?.entities??[])].reverse().find(e=>e.kind==="surface3"||e.kind==="param3");return{...baseEntity(id,"cyan"),nativePaint:true,kind:"pieces3",source:source?.id??"surface",cols:6,rows:6,inset:.08,childStyles:{}};},
  parseArgs(stmt){const id=argName(stmt.args,0),source=argName(stmt.args,1),colsRaw=argNumber(stmt.args,2),rowsRaw=argNumber(stmt.args,3),insetRaw=argNumber(stmt.args,4);if(!id||!source||colsRaw===null||stmt.args.length<3||stmt.args.length>5||(stmt.args.length>=4&&rowsRaw===null)||(stmt.args.length>=5&&insetRaw===null))return null;const cols=Math.max(1,Math.min(60,Math.trunc(colsRaw))),rows=Math.max(1,Math.min(60,Math.trunc(rowsRaw??cols)));return rows*cols<=1600?{...baseEntity(id,"cyan"),nativePaint:true,kind:"pieces3",source,cols,rows,inset:Math.max(0,Math.min(.9,insetRaw??0)),childStyles:{}}:null;},ctorLine:e=>`pieces3(${e.id}, ${e.source}, ${num(e.cols)}${e.rows===e.cols&&e.inset===0?"":`, ${num(e.rows)}${e.inset===0?"":`, ${num(e.inset)}`}`});`,extraLines:e=>childStyleLines(e.childStyles),modifiers:{},references:e=>[e.source],replaceReference(e,from,to){if(e.source===from)e.source=to;replaceChildStyleReference(e,from,to);},referenceIds:e=>proceduralFamilyReferences(e),storyTargets:e=>storyTargets(proceduralFamilyReferences(e),"surface3"),referenceBounds(e,ref,ctx){const quads=pieces3Quads(e,ctx),cell=ref.match(/\.r(\d+)c(\d+)$/u),row=ref.match(/\.row(\d+)$/u),col=ref.match(/\.col(\d+)$/u),selected=cell?[quads[Number(cell[1])*e.cols+Number(cell[2])]]:row?quads.slice(Number(row[1])*e.cols,(Number(row[1])+1)*e.cols):col?quads.filter((_quad,index)=>index%e.cols===Number(col[1])):ref.endsWith(".pieces")?quads:[];return selected.length?projectedBox(selected.flat(),ctx,6):null;},applyReferenceModifier:applyChildStyle,anchor(e,ctx){const points=pieces3Quads(e,ctx).flat(),b=projectedBox(points,ctx);return{x:b.x+b.width/2,y:b.y+b.height/2};},bounds:(e,ctx)=>projectedBox(pieces3Quads(e,ctx).flat(),ctx,10),...no3Handles,fields:[{key:"source",label:"Surface source",input:"entity",entityKinds:["surface3","param3"],referencesEarlierOnly:true},{key:"cols",label:"Columns",input:"number",min:1,max:60,step:1},{key:"rows",label:"Rows",input:"number",min:1,max:60,step:1},{key:"inset",label:"Seam inset",input:"number",min:0,max:.9,step:.01}],
});

function collectionPath3Def(kind: CollectionPath3Entity["kind"], order: number, label: string) {
  registerEntity<CollectionPath3Entity>({
    kind, ctor: kind, group: "3D", label, icon: kind === "ring3" ? "○3" : "⌁3", order, fidelity: "semantic",
    hint: kind === "ring3" ? "A live ring derived from one stable collection child" : "A live history trail for one stable collection child; Canvas shows its current semantic anchor",
    movable: false, canCreate: (doc) => doc.entities.some((entity) => (COLLECTION3_KINDS as readonly string[]).includes(entity.kind)), createBlockedReason: `${label} needs an earlier 3D collection.`,
    create(id, _x, _y, doc, selectedId) { const source = doc?.entities.find((entity) => entity.id === selectedId && (COLLECTION3_KINDS as readonly string[]).includes(entity.kind)) ?? [...(doc?.entities ?? [])].reverse().find((entity) => (COLLECTION3_KINDS as readonly string[]).includes(entity.kind)); return { ...baseEntity(id, kind === "ring3" ? "cyan" : "gold"), kind, collection: source?.id ?? "points", child: 0, segments: 72, pathThickness: .025 }; },
    parseArgs(stmt) { const id = argName(stmt.args, 0), collection = argName(stmt.args, 1), child = argNumber(stmt.args, 2), tail = argNumber(stmt.args, 3); if (!id || !collection) return null; if (kind === "ring3") return child !== null && child>=0&&Number.isInteger(child)&&stmt.args.length >= 3 && stmt.args.length <= 4 && (stmt.args.length === 3 || tail !== null)&&(tail===null||(tail>=16&&tail<=256)) ? { ...baseEntity(id, "cyan"), kind, collection, child, segments: Math.round(tail ?? 72), pathThickness: .018 } : null; return stmt.args.length >= 2 && stmt.args.length <= 4 && (stmt.args.length < 3 || child !== null) && (stmt.args.length < 4 || tail !== null) ? { ...baseEntity(id, "gold"), kind, collection, child: Math.max(0, Math.round(child ?? 0)), segments: 72, pathThickness: Math.max(0, tail ?? .025) } : null; },
    ctorLine: (entity) => kind === "ring3" ? `ring3(${entity.id}, ${entity.collection}, ${num(entity.child)}${entity.segments === 72 ? "" : `, ${num(entity.segments)}`});` : `trail3(${entity.id}, ${entity.collection}${entity.child === 0 && entity.pathThickness === .025 ? "" : `, ${num(entity.child)}${entity.pathThickness === .025 ? "" : `, ${num(entity.pathThickness)}`}`});`,
    extraLines: () => [], modifiers: {}, references: (entity) => [entity.collection], replaceReference(entity, from, to) { if (entity.collection === from) entity.collection = to; },
    anchor(entity, ctx) { const box = projectedBox(collectionPath3Points(entity, ctx), ctx); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, bounds: (entity, ctx) => projectedBox(collectionPath3Points(entity, ctx), ctx, 8), ...no3Handles,
    fields: [collectionField, { key: "child", label: "Stable child index", input: "number", min: 0, step: 1 }, ...(kind === "ring3" ? [{ key: "segments", label: "Ring segments", input: "number", min: 16, max: 256, step: 1 }] as FieldSpec[] : [{ key: "pathThickness", label: "Trail thickness", input: "number", min: 0, step: .005 }] as FieldSpec[])],
  });
}
collectionPath3Def("ring3", 69.6, "Collection child ring");
collectionPath3Def("trail3", 69.7, "Collection child trail");

registerEntity<HistoryPlotEntity>({
  kind: "historyplot", ctor: "historyplot", anchorArgIndex: 4, group: "3D", label: "Collection history chart", icon: "↝▤", order: 69.8, fidelity: "semantic", hint: "A screen-space live component history chart; Canvas shows its panel and binding", movable: true,
  canCreate: (doc) => doc.entities.some((entity) => (COLLECTION3_KINDS as readonly string[]).includes(entity.kind)), createBlockedReason: "A history plot needs an earlier 3D collection.", create(id, x, y, doc, selectedId) { const source = doc?.entities.find((entity) => entity.id === selectedId && (COLLECTION3_KINDS as readonly string[]).includes(entity.kind)) ?? [...(doc?.entities ?? [])].reverse().find((entity) => (COLLECTION3_KINDS as readonly string[]).includes(entity.kind)); return { ...baseEntity(id, "magenta"), kind: "historyplot", collection: source?.id ?? "points", child: 0, component: "x", x, y, width: 260, height: 120 }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), collection = argName(stmt.args, 1), child = argNumber(stmt.args, 2), component = argName(stmt.args, 3), center = argPoint(stmt.args, 4), size = argPoint(stmt.args, 5); return id && collection && child !== null&&child>=0&&Number.isInteger(child) && (component === "x" || component === "y" || component === "z") && center && size&&size.x>0&&size.y>0 && stmt.args.length === 6 ? { ...baseEntity(id, "magenta"), kind: "historyplot", collection, child, component, x: center.x, y: center.y, width: size.x, height: size.y } : null; },
  ctorLine: (entity) => `historyplot(${entity.id}, ${entity.collection}, ${num(entity.child)}, ${entity.component}, ${pt(entity.x, entity.y)}, ${pt(entity.width, entity.height)});`, extraLines: () => [], modifiers: {}, references: (entity) => [entity.collection], replaceReference(entity, from, to) { if (entity.collection === from) entity.collection = to; },
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; }, bounds: (entity) => ({ x: entity.x - entity.width / 2, y: entity.y - entity.height / 2, width: entity.width, height: entity.height }), handles: () => [], dragHandle() {},
  fields: [collectionField, { key: "child", label: "Stable child index", input: "number", min: 0, step: 1 }, { key: "component", label: "Tracked component", input: "select", options: ["x", "y", "z"] }, { key: "width", label: "Chart width", input: "number", min: 1 }, { key: "height", label: "Chart height", input: "number", min: 1 }],
});

registerEntity<HistoryPlot3Entity>({
  kind: "historyplot3", ctor: "historyplot3", group: "3D", label: "World history chart", icon: "↝▤3", order: 69.9, fidelity: "semantic", hint: "A world-space live component history chart; Preview owns the evolving samples", movable: false,
  canCreate: (doc) => doc.entities.some((entity) => (COLLECTION3_KINDS as readonly string[]).includes(entity.kind)), createBlockedReason: "A world history plot needs an earlier 3D collection.", create(id, _x, _y, doc, selectedId) { const source = doc?.entities.find((entity) => entity.id === selectedId && (COLLECTION3_KINDS as readonly string[]).includes(entity.kind)) ?? [...(doc?.entities ?? [])].reverse().find((entity) => (COLLECTION3_KINDS as readonly string[]).includes(entity.kind)); return { ...baseEntity(id, "gold"), kind: "historyplot3", collection: source?.id ?? "points", child: 0, component: "x", origin3: { x: 0, y: 0, z: 0 }, width: 3, height: 1.5 }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), collection = argName(stmt.args, 1), child = argNumber(stmt.args, 2), component = argName(stmt.args, 3), origin3 = argPoint3(stmt.args, 4), size = argPoint(stmt.args, 5); return id && collection && child !== null&&child>=0&&Number.isInteger(child) && (component === "x" || component === "y" || component === "z") && origin3 && size&&size.x>0&&size.y>0 && stmt.args.length === 6 ? { ...baseEntity(id, "gold"), kind: "historyplot3", collection, child, component, origin3, width: size.x, height: size.y } : null; },
  ctorLine: (entity) => `historyplot3(${entity.id}, ${entity.collection}, ${num(entity.child)}, ${entity.component}, ${pt3(entity.origin3.x, entity.origin3.y, entity.origin3.z)}, ${pt(entity.width, entity.height)});`, extraLines: () => [], modifiers: {}, references: (entity) => [entity.collection], replaceReference(entity, from, to) { if (entity.collection === from) entity.collection = to; }, anchor: (entity, ctx) => projectPoint3(entity.origin3, ctx?.doc), bounds: (entity, ctx) => projectedBox([entity.origin3, add3(entity.origin3, { x: entity.width, y: 0, z: entity.height })], ctx, 10), ...no3Handles,
  fields: [collectionField, { key: "child", label: "Stable child index", input: "number", min: 0, step: 1 }, { key: "component", label: "Tracked component", input: "select", options: ["x", "y", "z"] }, { key: "origin3", label: "World origin", input: "point3" }, { key: "width", label: "World width", input: "number", min: .001 }, { key: "height", label: "World height", input: "number", min: .001 }],
});

registerEntity<RandomWalk3Entity>({
  kind: "randomwalk3", ctor: "randomwalk3", group: "3D", label: "Deterministic 3D walk", icon: "⌁?3", order: 70, fidelity: "semantic", hint: "A seeded procedural path; Canvas caps the authoring sample while Preview uses every requested step", movable: false,
  create: (id) => ({ ...baseEntity(id, "cyan"), nativePaint: true, kind: "randomwalk3", center: { x: 0, y: 0, z: 0 }, steps: 300, seed: 21, options: "mode=axis distribution=uniform scale=0.1" }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), center = argPoint3(stmt.args, 1), steps = argNumber(stmt.args, 2), seed = argNumber(stmt.args, 3), options = argString(stmt.args, 4); return id && center && steps !== null&&steps>=1&&steps<=50000 && stmt.args.length >= 3 && stmt.args.length <= 5 && (stmt.args.length < 4 || seed !== null) && (stmt.args.length < 5 || options !== null) ? { ...baseEntity(id, "cyan"), nativePaint: true, kind: "randomwalk3", center, steps: Math.round(steps), seed: Math.max(0, Math.round(seed ?? 21)), options: options ?? "" } : null; },
  ctorLine: (entity) => `randomwalk3(${entity.id}, ${pt3(entity.center.x, entity.center.y, entity.center.z)}, ${num(entity.steps)}${entity.seed === 21 && entity.options === "" ? "" : `, ${num(entity.seed)}${entity.options === "" ? "" : `, "${escapeString(entity.options)}"`}`});`, extraLines: () => [], modifiers: {}, anchor(entity, ctx) { const box = projectedBox(randomWalk3Points(entity), ctx); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, bounds: (entity, ctx) => projectedBox(randomWalk3Points(entity), ctx, 10), ...no3Handles,
  fields: [{ key: "center", label: "World center", input: "point3" }, { key: "steps", label: "Native steps", input: "number", min: 1, max: 50000, step: 1 }, { key: "seed", label: "Deterministic seed", input: "number", min: 0, step: 1 }, { key: "options", label: "Walk options", input: "textarea", hint: "Native mode, distribution, color, angle, scale, and shade options." }],
});

registerEntity<LSystem3Entity>({
  kind: "lsystem3", ctor: "lsystem3", group: "3D", label: "3D L-system", icon: "L3", order: 70.1, fidelity: "semantic", hint: "A deterministic turtle system; Canvas expands a bounded authoring sample", movable: false,
  create: (id) => ({ ...baseEntity(id, "cyan"), nativePaint: true, kind: "lsystem3", origin3: { x: 0, y: 0, z: 0 }, stepSize: .12, angle: 25, iterations: 4, axiom: "F", rules: "F=F[+F][-F][^F]", maxSymbols: 250000 }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), origin3 = argPoint3(stmt.args, 1), stepSize = argNumber(stmt.args, 2), angle = argNumber(stmt.args, 3), iterations = argNumber(stmt.args, 4), axiom = argString(stmt.args, 5), rules = argString(stmt.args, 6), maxSymbols = argNumber(stmt.args, 7); return id && origin3 && stepSize !== null&&stepSize>0 && angle !== null && iterations !== null&&iterations>=0&&iterations<=12&&Number.isInteger(iterations) && axiom !== null && rules !== null && stmt.args.length >= 7 && stmt.args.length <= 8 && (stmt.args.length === 7 || maxSymbols !== null)&&(maxSymbols===null||(maxSymbols>=1&&maxSymbols<=1000000&&Number.isInteger(maxSymbols))) ? { ...baseEntity(id, "cyan"), nativePaint: true, kind: "lsystem3", origin3, stepSize, angle, iterations, axiom, rules, maxSymbols: maxSymbols??250000 } : null; },
  ctorLine: (entity) => `lsystem3(${entity.id}, ${pt3(entity.origin3.x, entity.origin3.y, entity.origin3.z)}, ${num(entity.stepSize)}, ${num(entity.angle)}, ${num(entity.iterations)}, "${escapeString(entity.axiom)}", "${escapeString(entity.rules)}"${entity.maxSymbols === 250000 ? "" : `, ${num(entity.maxSymbols)}`});`, extraLines: () => [], modifiers: {}, anchor(entity, ctx) { const box = projectedBox(lsystem3Geometry(entity).points, ctx); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, bounds: (entity, ctx) => projectedBox(lsystem3Geometry(entity).points, ctx, 10), ...no3Handles,
  fields: [{ key: "origin3", label: "World origin", input: "point3" }, { key: "stepSize", label: "Turtle step", input: "number", min: .001, step: .01 }, { key: "angle", label: "Turn angle", input: "number", step: 1 }, { key: "iterations", label: "Iterations", input: "number", min: 0, max: 12, step: 1 }, { key: "axiom", label: "Axiom", input: "text" }, { key: "rules", label: "Rules", input: "textarea", hint: "Separate symbol=replacement rules with semicolons." }, { key: "maxSymbols", label: "Native symbol cap", input: "number", min: 1, max: 1000000, step: 1 }],
});

registerEntity<Tree3Entity>({
  kind: "tree3", ctor: "tree3", group: "3D", label: "Procedural 3D tree", icon: "♧3", order: 70.2, fidelity: "semantic", hint: "A deterministic branching family with addressable depth layers and leaves", movable: false,
  create: (id) => ({ ...baseEntity(id, "lime"), nativePaint: true, kind: "tree3", root: { x: 0, y: 0, z: 0 }, length: 2, angle: 28, shrink: .72, depth: 6, seed: 21, childStyles: {} }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), root = argPoint3(stmt.args, 1), branchLength = argNumber(stmt.args, 2), angle = argNumber(stmt.args, 3), shrink = argNumber(stmt.args, 4), depth = argNumber(stmt.args, 5), seed = argNumber(stmt.args, 6); return id && root && branchLength !== null && angle !== null && shrink !== null && depth !== null && seed !== null && stmt.args.length === 7 ? { ...baseEntity(id, "lime"), nativePaint: true, kind: "tree3", root, length: Math.max(.001, branchLength), angle: Math.max(5, Math.min(70, angle)), shrink: Math.max(.45, Math.min(.88, shrink)), depth: Math.max(1, Math.min(12, Math.round(depth))), seed: Math.max(0, Math.round(seed)), childStyles: {} } : null; },
  ctorLine: (entity) => `tree3(${entity.id}, ${pt3(entity.root.x, entity.root.y, entity.root.z)}, ${num(entity.length)}, ${num(entity.angle)}, ${num(entity.shrink)}, ${num(entity.depth)}, ${num(entity.seed)});`, extraLines: (entity) => childStyleLines(entity.childStyles), modifiers: {}, replaceReference: replaceChildStyleReference, referenceIds: (entity) => proceduralFamilyReferences(entity), storyTargets: (entity) => [...proceduralFamilyReferences(entity).slice(0, -1).map((id) => ({ id, label: id, kind: "line3" as const })), { id: `${entity.id}.leaves`, label: `${entity.id}.leaves`, kind: "point3" }], referenceBounds(entity,ref,ctx){const geometry=tree3Geometry(entity),layer=ref.match(/\.d(\d+)$/u),points=layer?geometry.layers[Number(layer[1])]?.points:ref.endsWith(".leaves")?geometry.leaves:[];return points?.length?projectedBox(points,ctx,6):null;}, applyReferenceModifier: applyChildStyle,
  anchor: (entity, ctx) => projectPoint3(entity.root, ctx?.doc), bounds(entity, ctx) { const geometry = tree3Geometry(entity); return projectedBox([...geometry.layers.flatMap((layer) => layer.points), ...geometry.leaves], ctx, 10); }, ...no3Handles,
  fields: [{ key: "root", label: "World root", input: "point3" }, { key: "length", label: "Initial branch length", input: "number", min: .001, step: .1 }, { key: "angle", label: "Branch angle", input: "number", min: 5, max: 70, step: 1 }, { key: "shrink", label: "Length shrink", input: "number", min: .45, max: .88, step: .01 }, { key: "depth", label: "Depth", input: "number", min: 1, max: 12, step: 1 }, { key: "seed", label: "Deterministic seed", input: "number", min: 0, step: 1 }],
});

registerEntity<Hilbert3Entity>({
  kind: "hilbert3", ctor: "hilbert3", group: "3D", label: "3D Hilbert curve", icon: "H3", order: 70.3, fidelity: "semantic", hint: "A bounded preview of the deterministic space-filling path", movable: false,
  create: (id) => ({ ...baseEntity(id, "cyan"), nativePaint: true, kind: "hilbert3", center: { x: 0, y: 0, z: 0 }, size: 5, order3: 3, options: "" }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), center = argPoint3(stmt.args, 1), size = argNumber(stmt.args, 2), order3 = argNumber(stmt.args, 3), options = argString(stmt.args, 4); return id && center && size !== null && order3 !== null && stmt.args.length >= 4 && stmt.args.length <= 5 && (stmt.args.length === 4 || options !== null) ? { ...baseEntity(id, "cyan"), nativePaint: true, kind: "hilbert3", center, size: Math.max(.001, size), order3: Math.max(1, Math.min(5, Math.round(order3))), options: options ?? "" } : null; },
  ctorLine: (entity) => `hilbert3(${entity.id}, ${pt3(entity.center.x, entity.center.y, entity.center.z)}, ${num(entity.size)}, ${num(entity.order3)}${entity.options === "" ? "" : `, "${escapeString(entity.options)}"`});`, extraLines: () => [], modifiers: {}, anchor: (entity, ctx) => projectPoint3(entity.center, ctx?.doc), bounds: (entity, ctx) => projectedBox(hilbert3Points(entity), ctx, 10), ...no3Handles,
  fields: [{ key: "center", label: "World center", input: "point3" }, { key: "size", label: "World size", input: "number", min: .001, step: .1 }, { key: "order3", label: "Hilbert order", input: "number", min: 1, max: 5, step: 1 }, { key: "options", label: "Native options", input: "textarea", hint: "Preserved verbatim for Preview." }],
});

registerEntity<WatermarkEntity>({
  kind: "watermark", ctor: "watermark", anchorArgIndex: 1, group: "Text", label: "Watermark", icon: "wm", order: 3, hint: "A screen-fixed brand mark", movable: true,
  create: (id, x, y) => ({ ...baseEntity(id, "dim"), kind: "watermark", x, y, text: "Made With Manic", size: 20, responsive: false }),
  parseArgs(stmt, doc) {
    const id = argName(stmt.args, 0);
    if (!id || stmt.args.length > 3) return null;
    const at = argPoint(stmt.args, 1);
    const text = argString(stmt.args, 2);
    if ((stmt.args.length > 1 && !at) || (stmt.args.length > 2 && text === null)) return null;
    const value = text ?? "Made With Manic";
    const size = doc?.size ?? (doc?.format === "square" ? { width: 720, height: 720 } : doc?.format === "portrait" ? { width: 720, height: 1280 } : { width: 1280, height: 720 });
    const edge = Math.max(24, Math.min(48, Math.min(size.width, size.height) * .035));
    const halfText = Math.max(36, Math.min(size.width * .30, [...value].length * 6.2));
    return { ...baseEntity(id, "dim"), kind: "watermark", x: at?.x ?? size.width - edge - halfText, y: at?.y ?? size.height - edge, text: value, size: 20, responsive: !at };
  },
  ctorLine: (entity) => entity.responsive && entity.text === "Made With Manic" ? `watermark(${entity.id});` : `watermark(${entity.id}, ${pt(entity.x, entity.y)}, "${escapeString(entity.text)}");`, extraLines: (entity) => entity.size === 20 ? [] : [`size(${entity.id}, ${num(entity.size)});`],
  modifiers: { size(entity, stmt) { const value = argNumber(stmt.args, 1); if (value === null) return false; entity.size = value; return true; } }, anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; entity.responsive = false; },
  bounds: (entity) => ({ x: entity.x - entity.text.length * entity.size * .31, y: entity.y - entity.size * .75, width: Math.max(entity.size * 2, entity.text.length * entity.size * .62), height: entity.size * 1.5 }), handles: () => [], dragHandle() {}, fields: [{ key: "text", label: "Words", input: "text" }, { key: "size", label: "Size", input: "range", min: 12, max: 48 }],
});
