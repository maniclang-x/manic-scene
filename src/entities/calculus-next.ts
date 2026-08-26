// Curve/calculus expansion. These definitions retain native constructor
// semantics and dependencies while drawing bounded deterministic authoring
// samples. Native Preview remains authoritative for numerical sampling,
// generated children, animation, and final pixels.

import { argName, argNumber, argPoint, argString, escapeString, latexLiteral, num, pt } from "../args.js";
import { evalExpr, parseExpr, type ExprNode } from "../expr.js";
import { preferReference, registerEntity, type Box, type GeometryContext } from "../registry.js";
import { lexTokens } from "../script.js";
import type {
  BoxToEntity, CurveDotEntity, GraphLabelEntity, NewtonEntity, NormalEntity,
  ParametricCurveEntity, PlotEntity, DerivedCurveEntity, Point, RiemannEntity,
  RootsEntity, SceneDoc, SceneEntity, SlopeTriangleEntity, SplineEntity,
  TaylorEntity, TrajectoryEntity, VerticalLineEntity,
} from "../types.js";
import { baseEntity, strokeWidthModifier } from "./base.js";
import { graphDomain, graphPoint, graphSlope, graphValue, type GraphEntity, type GraphPoint } from "./calculus.js";

const GRAPH_KINDS = ["plot", "deriv", "accum"] as const;
const DIRECTIONS = ["up", "down", "left", "right", "upright", "upleft", "downright", "downleft"] as const;

function graphCandidates(doc?: SceneDoc): GraphEntity[] {
  return doc?.entities.filter((entity): entity is GraphEntity => GRAPH_KINDS.includes(entity.kind as GraphEntity["kind"]) && entity.origin !== "generated") ?? [];
}

function graphSource(source: string, ctx?: GeometryContext): GraphEntity | null {
  const entity = ctx?.entity(source);
  return entity && GRAPH_KINDS.includes(entity.kind as GraphEntity["kind"]) ? entity as GraphEntity : null;
}

function chosenGraph(doc?: SceneDoc, selectedId?: string): string {
  const curves = graphCandidates(doc);
  return preferReference(doc, selectedId, (entity: SceneEntity) => curves.some((curve) => curve.id === entity.id))?.id ?? curves.at(-1)?.id ?? "curve";
}

function graphSourceField() {
  return { key: "source", label: "Curve", input: "entity" as const, entityKinds: GRAPH_KINDS, referencesEarlierOnly: true };
}

function pointsBox(points: readonly Point[]): Box {
  if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
}

function centerOf(points: readonly Point[]): Point {
  const box = pointsBox(points);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function formula(source: string): ExprNode | null {
  try { return parseExpr(lexTokens(source)); } catch { return null; }
}

function value(node: ExprNode | null, values: Readonly<Record<string, number>>): number {
  if (!node) return Number.NaN;
  try { return evalExpr(node, new Map(Object.entries(values))); } catch { return Number.NaN; }
}

function domainArg(args: Parameters<typeof argPoint>[0], index: number): { t0: number; t1: number; form: ParametricCurveEntity["domainForm"] } | null {
  if (args.length <= index) return { t0: 0, t1: Math.PI * 2, form: "default" };
  const range = argPoint(args, index);
  if (range) return { t0: range.x, t1: range.y, form: "range" };
  const end = argNumber(args, index);
  return end === null ? null : { t0: 0, t1: end, form: "scalar" };
}

export function parametricCurvePoints(entity: ParametricCurveEntity, count = 320): Point[] {
  const first = formula(entity.fx), second = entity.kind === "param" ? formula(entity.fy) : null;
  const points: Point[] = [];
  for (let index = 0; index <= count; index += 1) {
    const t = entity.t0 + (entity.t1 - entity.t0) * index / count;
    const a = value(first, { t, x: t });
    const b = entity.kind === "param" ? value(second, { t, x: t }) : a;
    const x = entity.kind === "param" ? a : a * Math.cos(t);
    const y = entity.kind === "param" ? b : a * Math.sin(t);
    if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x: entity.x + x * entity.sx, y: entity.y - y * entity.sy });
  }
  return points;
}

function registerParametric(kind: "param" | "polar", order: number) {
  registerEntity<ParametricCurveEntity>({
    kind, ctor: kind, anchorArgIndex: 1, group: "Math", label: kind === "param" ? "Parametric curve" : "Polar curve", icon: kind === "param" ? "x(t)" : "rθ", order,
    fidelity: "semantic", hint: kind === "param" ? "A sampled path from editable x(t) and y(t) formulas" : "A sampled polar path from an editable r(t) formula",
    create: (id, x, y) => ({ ...baseEntity(id, "cyan"), kind, x, y, sx: 90, sy: 90, fx: kind === "param" ? "cos(t)" : "2*cos(3*t)", fy: kind === "param" ? "sin(t)" : "", t0: 0, t1: Math.PI * 2, domainForm: "default", strokeWidth: null }),
    parseArgs(stmt) {
      const id = argName(stmt.args, 0), center = argPoint(stmt.args, 1), sx = argNumber(stmt.args, 2), sy = argNumber(stmt.args, 3), fx = argString(stmt.args, 4);
      const fy = kind === "param" ? argString(stmt.args, 5) : "";
      const domain = domainArg(stmt.args, kind === "param" ? 6 : 5);
      const required = kind === "param" ? 6 : 5;
      if (!id || !center || sx === null || sy === null || fx === null || (kind === "param" && fy === null) || !domain || stmt.args.length < required || stmt.args.length > required + 1) return null;
      return { ...baseEntity(id, "cyan"), kind, x: center.x, y: center.y, sx, sy, fx, fy: fy ?? "", t0: domain.t0, t1: domain.t1, domainForm: domain.form, strokeWidth: null };
    },
    ctorLine(entity) {
      const formulas = kind === "param" ? `"${escapeString(entity.fx)}", "${escapeString(entity.fy)}"` : `"${escapeString(entity.fx)}"`;
      const domain = `, ${pt(entity.t0, entity.t1)}`;
      return `${kind}(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.sx)}, ${num(entity.sy)}, ${formulas}${domain});`;
    },
    extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`],
    modifiers: { stroke: strokeWidthModifier }, anchor: (entity) => ({ x: entity.x, y: entity.y }),
    translate(entity, dx, dy) { entity.x += dx; entity.y += dy; }, bounds: (entity) => pointsBox(parametricCurvePoints(entity)), handles: () => [], dragHandle() {},
    fields: kind === "param" ? [
      { key: "fx", label: "x(t)", input: "text" }, { key: "fy", label: "y(t)", input: "text" },
      { key: "sx", label: "Horizontal px/unit", input: "number", min: 1 }, { key: "sy", label: "Vertical px/unit", input: "number", min: 1 },
      { key: "t0", label: "t start", input: "number" }, { key: "t1", label: "t end", input: "number" },
      { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 },
    ] : [
      { key: "fx", label: "r(t)", input: "text" }, { key: "sx", label: "Horizontal px/unit", input: "number", min: 1 },
      { key: "sy", label: "Vertical px/unit", input: "number", min: 1 }, { key: "t0", label: "t start", input: "number" },
      { key: "t1", label: "t end", input: "number" }, { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 },
    ],
  });
}

registerParametric("param", 54);
registerParametric("polar", 55);

export function normalGeometry(entity: NormalEntity, ctx?: GeometryContext) {
  const source = graphSource(entity.source, ctx), touch = source ? graphPoint(source, entity.graphX, ctx) : null, domain = source ? graphDomain(source, ctx) : null;
  if (!source || !touch || !domain) return { touch: { x: 0, y: 0 }, from: { x: 0, y: 0 }, to: { x: 1, y: 0 } };
  const slope = graphSlope(source, entity.graphX, ctx), tx = domain.sx, ty = -slope * domain.sy;
  const length = Math.max(1, Math.hypot(tx, ty)), half = entity.length / 2, dx = -ty / length * half, dy = tx / length * half;
  return { touch, from: { x: touch.x - dx, y: touch.y - dy }, to: { x: touch.x + dx, y: touch.y + dy } };
}

registerEntity<NormalEntity>({
  kind: "normal", ctor: "normal", group: "Math", label: "Normal", icon: "⊥", order: 56, fidelity: "semantic", hint: "A perpendicular line that follows a plotted curve at x", movable: false,
  canCreate: (doc) => graphCandidates(doc).length > 0, createBlockedReason: "Add a Plot before attaching a normal.",
  create: (id, _x, _y, doc, selectedId) => ({ ...baseEntity(id, "magenta"), kind: "normal", source: chosenGraph(doc, selectedId), graphX: 0, length: 120, strokeWidth: null }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1), graphX = argNumber(stmt.args, 2), length = argNumber(stmt.args, 3); return id && source && graphX !== null && stmt.args.length <= 4 && !(stmt.args.length === 4 && length === null) ? { ...baseEntity(id, "magenta"), kind: "normal", source, graphX, length: length ?? 120, strokeWidth: null } : null; },
  ctorLine: (entity) => `normal(${entity.id}, ${entity.source}, ${num(entity.graphX)}, ${num(entity.length)});`, extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`], modifiers: { stroke: strokeWidthModifier },
  references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; }, anchor: (entity, ctx) => normalGeometry(entity, ctx).touch, translate() {},
  bounds(entity, ctx) { const geometry = normalGeometry(entity, ctx); return pointsBox([geometry.from, geometry.to]); }, handles: () => [], dragHandle() {},
  fields: [graphSourceField(), { key: "graphX", label: "Curve x", input: "number", step: .1 }, { key: "length", label: "Line length", input: "range", min: 20, max: 600 }, { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }],
});

export function slopeTriangleGeometry(entity: SlopeTriangleEntity, ctx?: GeometryContext) {
  const source = graphSource(entity.source, ctx), point = source ? graphPoint(source, entity.graphX, ctx) : null, domain = source ? graphDomain(source, ctx) : null;
  if (!source || !point || !domain) return { point: { x: 0, y: 0 }, run: { x: 1, y: 0 }, rise: { x: 1, y: 1 }, slope: Number.NaN };
  const slope = graphSlope(source, entity.graphX, ctx);
  return { point, run: { x: point.x + entity.run * domain.sx, y: point.y }, rise: { x: point.x + entity.run * domain.sx, y: point.y - slope * entity.run * domain.sy }, slope };
}

registerEntity<SlopeTriangleEntity>({
  kind: "slopetri", ctor: "slopetri", group: "Math", label: "Slope triangle", icon: "△m", order: 57, fidelity: "semantic", hint: "Run and rise legs that follow a plotted curve", movable: false,
  canCreate: (doc) => graphCandidates(doc).length > 0, createBlockedReason: "Add a Plot before attaching a slope triangle.",
  create: (id, _x, _y, doc, selectedId) => ({ ...baseEntity(id, "fg"), kind: "slopetri", source: chosenGraph(doc, selectedId), graphX: 0, run: 1 }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1), graphX = argNumber(stmt.args, 2), run = argNumber(stmt.args, 3); return id && source && graphX !== null && stmt.args.length <= 4 && !(stmt.args.length === 4 && run === null) ? { ...baseEntity(id, "fg"), kind: "slopetri", source, graphX, run: run ?? 1 } : null; },
  ctorLine: (entity) => `slopetri(${entity.id}, ${entity.source}, ${num(entity.graphX)}, ${num(entity.run)});`, extraLines: () => [], modifiers: {}, references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; },
  referenceIds: (entity) => [`${entity.id}.run`, `${entity.id}.rise`, `${entity.id}.one`], referenceBounds(entity, ref, ctx) { const g = slopeTriangleGeometry(entity, ctx); if (ref === `${entity.id}.run`) return pointsBox([g.point, g.run]); if (ref === `${entity.id}.rise`) return pointsBox([g.run, g.rise]); return null; },
  anchor: (entity, ctx) => centerOf(Object.values(slopeTriangleGeometry(entity, ctx)).filter((candidate): candidate is Point => typeof candidate === "object")), translate() {}, bounds(entity, ctx) { const g = slopeTriangleGeometry(entity, ctx); return pointsBox([g.point, g.run, g.rise]); }, handles: () => [], dragHandle() {},
  fields: [graphSourceField(), { key: "graphX", label: "Curve x", input: "number", step: .1 }, { key: "run", label: "Run", input: "number", step: .1 }],
});

function graphRootPoints(source: GraphEntity, ctx?: GeometryContext): GraphPoint[] {
  const domain = graphDomain(source, ctx);
  if (!domain) return [];
  const roots: number[] = [], count = 400;
  let previousX = domain.x0, previous = graphValue(source, previousX, ctx);
  for (let index = 1; index <= count; index += 1) {
    const x = domain.x0 + (domain.x1 - domain.x0) * index / count, next = graphValue(source, x, ctx);
    if (Number.isFinite(previous) && Number.isFinite(next) && (previous === 0 || next === 0 || Math.sign(previous) !== Math.sign(next))) {
      let lo = previousX, hi = x;
      for (let refine = 0; refine < 20; refine += 1) { const mid = (lo + hi) / 2; if (Math.sign(graphValue(source, lo, ctx)) === Math.sign(graphValue(source, mid, ctx))) lo = mid; else hi = mid; }
      const root = (lo + hi) / 2;
      if (!roots.some((candidate) => Math.abs(candidate - root) < Math.abs(domain.x1 - domain.x0) / 500)) roots.push(root);
    }
    previousX = x; previous = next;
  }
  return roots.map((x) => graphPoint(source, x, ctx)).filter((point): point is GraphPoint => point !== null);
}

export function rootsPoints(entity: RootsEntity, ctx?: GeometryContext): GraphPoint[] {
  const source = graphSource(entity.source, ctx);
  return source ? graphRootPoints(source, ctx) : [];
}

registerEntity<RootsEntity>({
  kind: "roots", ctor: "roots", group: "Math", label: "Curve roots", icon: "●0", order: 58, fidelity: "semantic", colorInCtor: true, hint: "Zero crossings generated from a plotted curve", movable: false,
  canCreate: (doc) => graphCandidates(doc).length > 0, createBlockedReason: "Add a Plot before finding roots.", create: (id, _x, _y, doc, selectedId) => ({ ...baseEntity(id, "lime"), kind: "roots", source: chosenGraph(doc, selectedId) }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1), color = argName(stmt.args, 2); return id && source && stmt.args.length <= 3 && !(stmt.args.length === 3 && !color) ? { ...baseEntity(id, color ?? "lime"), kind: "roots", source } : null; },
  ctorLine: (entity) => `roots(${entity.id}, ${entity.source}, ${entity.color});`, extraLines: () => [], modifiers: {}, references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; },
  anchor: (entity, ctx) => centerOf(rootsPoints(entity, ctx)), translate() {}, bounds: (entity, ctx) => pointsBox(rootsPoints(entity, ctx)), handles: () => [], dragHandle() {}, fields: [graphSourceField()],
});

export function verticalLineGeometry(entity: VerticalLineEntity, ctx?: GeometryContext) {
  const source = graphSource(entity.source, ctx), point = source ? graphPoint(source, entity.graphX, ctx) : null, domain = source ? graphDomain(source, ctx) : null;
  return { from: domain ? { x: domain.x + entity.graphX * domain.sx, y: domain.y } : { x: 0, y: 0 }, to: point ?? { x: 0, y: 0 } };
}

registerEntity<VerticalLineEntity>({
  kind: "vline", ctor: "vline", group: "Math", label: "Curve guide", icon: "┊", order: 59, fidelity: "semantic", colorInCtor: true, hint: "A styled vertical guide from the x-axis to a curve", movable: false,
  canCreate: (doc) => graphCandidates(doc).length > 0, createBlockedReason: "Add a Plot before attaching a vertical guide.", create: (id, _x, _y, doc, selectedId) => ({ ...baseEntity(id, "fg"), kind: "vline", source: chosenGraph(doc, selectedId), graphX: 0, style: "dotted" }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1), graphX = argNumber(stmt.args, 2), color = argName(stmt.args, 3), style = argName(stmt.args, 4); if (!id || !source || graphX === null || stmt.args.length > 5 || (stmt.args.length >= 4 && !color) || (stmt.args.length === 5 && !["dotted", "dashed", "solid"].includes(style ?? ""))) return null; return { ...baseEntity(id, color ?? "fg"), kind: "vline", source, graphX, style: (style ?? "dotted") as VerticalLineEntity["style"] }; },
  ctorLine: (entity) => `vline(${entity.id}, ${entity.source}, ${num(entity.graphX)}, ${entity.color}, ${entity.style});`, extraLines: () => [], modifiers: {}, references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; }, anchor: (entity, ctx) => verticalLineGeometry(entity, ctx).to, translate() {}, bounds(entity, ctx) { const geometry = verticalLineGeometry(entity, ctx); return pointsBox([geometry.from, geometry.to]); }, handles: () => [], dragHandle() {},
  fields: [graphSourceField(), { key: "graphX", label: "Curve x", input: "number", step: .1 }, { key: "style", label: "Guide style", input: "select", options: ["dotted", "dashed", "solid"] }],
});

export function curveDotPoint(entity: CurveDotEntity, ctx?: GeometryContext): GraphPoint | null {
  const source = graphSource(entity.source, ctx);
  return source ? graphPoint(source, entity.graphX, ctx) : null;
}

registerEntity<CurveDotEntity>({
  kind: "curvedot", ctor: "curvedot", group: "Math", label: "Curve dot", icon: "●ƒ", order: 60, fidelity: "semantic", colorInCtor: true, hint: "A dot pinned to a plotted curve at x", movable: false,
  canCreate: (doc) => graphCandidates(doc).length > 0, createBlockedReason: "Add a Plot before attaching a curve dot.", create: (id, _x, _y, doc, selectedId) => ({ ...baseEntity(id, "fg"), kind: "curvedot", source: chosenGraph(doc, selectedId), graphX: 0 }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1), graphX = argNumber(stmt.args, 2), color = argName(stmt.args, 3); return id && source && graphX !== null && stmt.args.length <= 4 && !(stmt.args.length === 4 && !color) ? { ...baseEntity(id, color ?? "fg"), kind: "curvedot", source, graphX } : null; },
  ctorLine: (entity) => `curvedot(${entity.id}, ${entity.source}, ${num(entity.graphX)}, ${entity.color});`, extraLines: () => [], modifiers: {}, references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; }, anchor: (entity, ctx) => curveDotPoint(entity, ctx) ?? { x: 0, y: 0 }, translate() {}, bounds(entity, ctx) { const point = curveDotPoint(entity, ctx) ?? { x: 0, y: 0 }; return { x: point.x - 8, y: point.y - 8, width: 16, height: 16 }; }, handles: () => [], dragHandle() {}, fields: [graphSourceField(), { key: "graphX", label: "Curve x", input: "number", step: .1 }],
});

export function graphLabelPosition(entity: GraphLabelEntity, ctx?: GeometryContext): Point {
  const source = graphSource(entity.source, ctx), graphX = entity.graphX ?? entity.defaultX, point = source ? graphPoint(source, graphX, ctx) : null;
  const width = Math.max(entity.size * 1.2, entity.latex.length * entity.size * .55), height = entity.size * 1.5, dx = width / 2 + 12, dy = height / 2 + 12;
  const offsets: Record<GraphLabelEntity["direction"], Point> = { up: { x: 0, y: -dy }, down: { x: 0, y: dy }, left: { x: -dx, y: 0 }, right: { x: dx, y: 0 }, upright: { x: dx, y: -dy }, upleft: { x: -dx, y: -dy }, downright: { x: dx, y: dy }, downleft: { x: -dx, y: dy } };
  const offset = offsets[entity.direction]; return { x: (point?.x ?? 0) + offset.x, y: (point?.y ?? 0) + offset.y };
}

registerEntity<GraphLabelEntity>({
  kind: "graphlabel", ctor: "graphlabel", group: "Math", label: "Graph label", icon: "ƒℒ", order: 61, fidelity: "semantic", colorInCtor: true, hint: "A LaTeX label pinned to a plotted curve", movable: false,
  canCreate: (doc) => graphCandidates(doc).length > 0, createBlockedReason: "Add a Plot before attaching a graph label.", create(id, _x, _y, doc, selectedId) { const source = chosenGraph(doc, selectedId), curve = doc?.entities.find((entity) => entity.id === source); return { ...baseEntity(id, curve?.color ?? "fg"), kind: "graphlabel", source, latex: "f(x)", graphX: null, defaultX: graphEnd(doc, source), direction: "up", constructorColor: null, size: 34 }; },
  parseArgs(stmt, doc) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1), latex = argString(stmt.args, 2), graphX = argNumber(stmt.args, 3), direction = argName(stmt.args, 4), color = argName(stmt.args, 5); if (!id || !source || latex === null || stmt.args.length > 6 || (stmt.args.length >= 4 && graphX === null) || (stmt.args.length >= 5 && !DIRECTIONS.includes(direction as typeof DIRECTIONS[number])) || (stmt.args.length === 6 && !color)) return null; const curve = doc?.entities.find((entity) => entity.id === source); return { ...baseEntity(id, color ?? curve?.color ?? "fg"), kind: "graphlabel", source, latex, graphX, defaultX: graphEnd(doc, source), direction: (direction ?? "up") as GraphLabelEntity["direction"], constructorColor: color, size: 34 }; },
  ctorLine(entity) { const x = entity.graphX ?? entity.defaultX; return `graphlabel(${entity.id}, ${entity.source}, ${latexLiteral(entity.latex)}, ${num(x)}, ${entity.direction}, ${entity.color});`; },
  extraLines: (entity) => entity.size === 34 ? [] : [`size(${entity.id}, ${num(entity.size)});`], modifiers: { size(entity, stmt) { const size = argNumber(stmt.args, 1); if (size === null) return false; entity.size = size; return true; } },
  references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; }, anchor: (entity, ctx) => graphLabelPosition(entity, ctx), translate() {}, bounds(entity, ctx) { const at = graphLabelPosition(entity, ctx), width = Math.max(entity.size * 1.2, entity.latex.length * entity.size * .55); return { x: at.x - width / 2, y: at.y - entity.size * .75, width, height: entity.size * 1.5 }; }, handles: () => [], dragHandle() {},
  fields: [graphSourceField(), { key: "latex", label: "LaTeX", input: "latex" }, { key: "graphX", label: "Curve x (blank = right end)", input: "number", nullable: true, step: .1 }, { key: "direction", label: "Direction", input: "select", options: DIRECTIONS }, { key: "size", label: "Text size", input: "range", min: 12, max: 72 }],
});

function graphEnd(doc: SceneDoc | undefined, source: string, visiting = new Set<string>()): number {
  if (!doc || visiting.has(source)) return 0;
  visiting.add(source);
  const entity = doc.entities.find((candidate) => candidate.id === source);
  if (entity?.kind === "plot") return entity.x1;
  if (entity?.kind === "deriv" || entity?.kind === "accum") return graphEnd(doc, entity.source, visiting);
  return 0;
}

export function boxToPoints(entity: BoxToEntity, ctx?: GeometryContext): Point[] {
  const source = graphSource(entity.source, ctx), domain = source ? graphDomain(source, ctx) : null, point = source ? graphPoint(source, entity.graphX, ctx) : null;
  if (!domain || !point) return [];
  const origin = { x: domain.x, y: domain.y }, corner = { x: point.x, y: point.y };
  return [origin, { x: corner.x, y: origin.y }, corner, { x: origin.x, y: corner.y }];
}

registerEntity<BoxToEntity>({
  kind: "boxto", ctor: "boxto", group: "Math", label: "Coordinate box", icon: "▣ƒ", order: 62, fidelity: "semantic", colorInCtor: true, defaultOpacity: .5, hint: "A live rectangle from the graph origin to (x, f(x))", movable: false,
  canCreate: (doc) => graphCandidates(doc).length > 0, createBlockedReason: "Add a Plot before creating a coordinate box.", create: (id, _x, _y, doc, selectedId) => ({ ...baseEntity(id, "cyan"), opacity: .5, kind: "boxto", source: chosenGraph(doc, selectedId), graphX: 1 }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1), graphX = argNumber(stmt.args, 2), color = argName(stmt.args, 3); return id && source && graphX !== null && stmt.args.length <= 4 && !(stmt.args.length === 4 && !color) ? { ...baseEntity(id, color ?? "cyan"), opacity: .5, kind: "boxto", source, graphX } : null; },
  ctorLine: (entity) => `boxto(${entity.id}, ${entity.source}, ${num(entity.graphX)}, ${entity.color});`, extraLines: () => [], modifiers: {}, references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; }, anchor: (entity, ctx) => centerOf(boxToPoints(entity, ctx)), translate() {}, bounds: (entity, ctx) => pointsBox(boxToPoints(entity, ctx)), handles: () => [], dragHandle() {}, fields: [graphSourceField(), { key: "graphX", label: "Curve x", input: "number", step: .1 }],
});

export interface RiemannBar extends Box { index: number; }
export function riemannBars(entity: RiemannEntity, ctx?: GeometryContext): RiemannBar[] {
  const source = graphSource(entity.source, ctx), domain = source ? graphDomain(source, ctx) : null;
  if (!source || !domain) return [];
  const lo = Math.min(entity.a, entity.b), hi = Math.max(entity.a, entity.b), step = Math.max(1e-4, Math.abs(entity.dx ?? (hi - lo) / 10));
  const bars: RiemannBar[] = []; let left = lo;
  while (left < hi - 1e-6 && bars.length < 600) {
    const right = Math.min(hi, left + step), y = graphValue(source, left, ctx);
    if (Number.isFinite(y)) { const x0 = domain.x + left * domain.sx, x1 = domain.x + right * domain.sx, top = domain.y - y * domain.sy; bars.push({ index: bars.length, x: Math.min(x0, x1), y: Math.min(domain.y, top), width: Math.abs(x1 - x0), height: Math.max(1, Math.abs(domain.y - top)) }); }
    left = right;
  }
  return bars;
}

registerEntity<RiemannEntity>({
  kind: "riemann", ctor: "riemann", group: "Math", label: "Riemann rectangles", icon: "▥∫", order: 63, fidelity: "semantic", colorInCtor: true, defaultOpacity: .6, hint: "Left-endpoint rectangles generated under a plotted curve", movable: false,
  canCreate: (doc) => graphCandidates(doc).length > 0, createBlockedReason: "Add a Plot before creating Riemann rectangles.", create: (id, _x, _y, doc, selectedId) => ({ ...baseEntity(id, "lime"), opacity: .6, kind: "riemann", source: chosenGraph(doc, selectedId), a: 0, b: 2, dx: null }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1), a = argNumber(stmt.args, 2), b = argNumber(stmt.args, 3), dx = argNumber(stmt.args, 4), color = argName(stmt.args, 5); if (!id || !source || a === null || b === null || stmt.args.length > 6 || (stmt.args.length >= 5 && dx === null) || (stmt.args.length === 6 && !color)) return null; return { ...baseEntity(id, color ?? "lime"), opacity: .6, kind: "riemann", source, a, b, dx }; },
  ctorLine: (entity) => `riemann(${entity.id}, ${entity.source}, ${num(entity.a)}, ${num(entity.b)}, ${num(entity.dx ?? Math.max(1e-4, Math.abs(entity.b - entity.a) / 10))}, ${entity.color});`, extraLines: () => [], modifiers: {}, references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; },
  referenceIds: (entity) => Array.from({ length: Math.min(600, Math.ceil(Math.abs(entity.b - entity.a) / Math.max(1e-4, Math.abs(entity.dx ?? (entity.b - entity.a) / 10)))) }, (_unused, index) => `${entity.id}.r${index}`), anchor: (entity, ctx) => centerOf(riemannBars(entity, ctx)), translate() {}, bounds: (entity, ctx) => pointsBox(riemannBars(entity, ctx).flatMap((bar) => [{ x: bar.x, y: bar.y }, { x: bar.x + bar.width, y: bar.y + bar.height }])), handles: () => [], dragHandle() {},
  fields: [graphSourceField(), { key: "a", label: "From x", input: "number", step: .1 }, { key: "b", label: "To x", input: "number", step: .1 }, { key: "dx", label: "Rectangle width (blank = native default)", input: "number", nullable: true, min: .0001, step: .05 }],
});

function derivative(source: GraphEntity, x: number, order: number, ctx?: GeometryContext): number {
  if (order === 0) return graphValue(source, x, ctx);
  const domain = graphDomain(source, ctx), h = Math.max(1e-3, Math.abs((domain?.x1 ?? 1) - (domain?.x0 ?? -1)) * .006);
  let sum = 0;
  for (let index = 0; index <= order; index += 1) sum += (index % 2 === 0 ? 1 : -1) * binomial(order, index) * graphValue(source, x + (order / 2 - index) * h, ctx);
  return sum / h ** order;
}

function factorial(n: number): number { let value = 1; for (let k = 2; k <= n; k += 1) value *= k; return value; }
function binomial(n: number, k: number): number { let value = 1; for (let index = 1; index <= k; index += 1) value = value * (n - index + 1) / index; return value; }

export function taylorPoints(entity: TaylorEntity, ctx?: GeometryContext): Point[] {
  const source = graphSource(entity.source, ctx), domain = source ? graphDomain(source, ctx) : null;
  if (!source || !domain) return [];
  const degree = Math.max(0, Math.min(12, Math.round(entity.degree))), coefficients = Array.from({ length: degree + 1 }, (_unused, order) => derivative(source, entity.a, order, ctx) / factorial(order));
  const points: Point[] = [];
  for (let index = 0; index <= 240; index += 1) { const x = domain.x0 + (domain.x1 - domain.x0) * index / 240, dx = x - entity.a; let y = 0, power = 1; for (const coefficient of coefficients) { y += coefficient * power; power *= dx; } if (Number.isFinite(y)) points.push({ x: domain.x + x * domain.sx, y: domain.y - y * domain.sy }); }
  return points;
}

registerEntity<TaylorEntity>({
  kind: "taylor", ctor: "taylor", group: "Math", label: "Taylor approximation", icon: "Σƒ", order: 64, fidelity: "semantic", colorInCtor: true, hint: "A numerical Taylor polynomial derived from a plotted curve", movable: false,
  canCreate: (doc) => graphCandidates(doc).length > 0, createBlockedReason: "Add a Plot before deriving a Taylor curve.", create: (id, _x, _y, doc, selectedId) => ({ ...baseEntity(id, "gold"), kind: "taylor", source: chosenGraph(doc, selectedId), a: 0, degree: 3, strokeWidth: null }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1), a = argNumber(stmt.args, 2), degree = argNumber(stmt.args, 3), color = argName(stmt.args, 4); return id && source && a !== null && degree !== null && stmt.args.length <= 5 && !(stmt.args.length === 5 && !color) ? { ...baseEntity(id, color ?? "gold"), kind: "taylor", source, a, degree: Math.max(0, Math.min(12, Math.round(degree))), strokeWidth: null } : null; },
  ctorLine: (entity) => `taylor(${entity.id}, ${entity.source}, ${num(entity.a)}, ${num(entity.degree)}, ${entity.color});`, extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`], modifiers: { stroke: strokeWidthModifier }, references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; }, anchor: (entity, ctx) => centerOf(taylorPoints(entity, ctx)), translate() {}, bounds: (entity, ctx) => pointsBox(taylorPoints(entity, ctx)), handles: () => [], dragHandle() {}, fields: [graphSourceField(), { key: "a", label: "Expansion x", input: "number", step: .1 }, { key: "degree", label: "Degree", input: "range", min: 0, max: 12, step: 1 }, { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }],
});

export function newtonPoints(entity: NewtonEntity, ctx?: GeometryContext): Point[] {
  const source = graphSource(entity.source, ctx), domain = source ? graphDomain(source, ctx) : null;
  if (!source || !domain) return [];
  const points: Point[] = []; let x = entity.x0;
  const initial = graphPoint(source, x, ctx); if (initial) points.push(initial);
  for (let step = 0; step < Math.max(1, Math.min(40, Math.round(entity.steps))); step += 1) { const y = graphValue(source, x, ctx), slope = graphSlope(source, x, ctx); if (!Number.isFinite(y) || !Number.isFinite(slope) || Math.abs(slope) < 1e-6) break; const next = x - y / slope; if (!Number.isFinite(next)) break; points.push({ x: domain.x + next * domain.sx, y: domain.y }); const curve = graphPoint(source, next, ctx); if (curve) points.push(curve); if (Math.abs(next - x) < 1e-5) break; x = next; }
  return points;
}

registerEntity<NewtonEntity>({
  kind: "newton", ctor: "newton", group: "Math", label: "Newton walk", icon: "N↯", order: 65, fidelity: "semantic", hint: "Newton's-method zig-zag generated from a plotted curve", movable: false,
  canCreate: (doc) => graphCandidates(doc).length > 0, createBlockedReason: "Add a Plot before creating a Newton walk.", create: (id, _x, _y, doc, selectedId) => ({ ...baseEntity(id, "gold"), kind: "newton", source: chosenGraph(doc, selectedId), x0: 2, steps: 6, strokeWidth: null }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1), x0 = argNumber(stmt.args, 2), steps = argNumber(stmt.args, 3); return id && source && x0 !== null && stmt.args.length <= 4 && !(stmt.args.length === 4 && steps === null) ? { ...baseEntity(id, "gold"), kind: "newton", source, x0, steps: Math.max(1, Math.min(40, Math.round(steps ?? 6))), strokeWidth: null } : null; },
  ctorLine: (entity) => `newton(${entity.id}, ${entity.source}, ${num(entity.x0)}, ${num(entity.steps)});`, extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`], modifiers: { stroke: strokeWidthModifier }, references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; }, anchor: (entity, ctx) => centerOf(newtonPoints(entity, ctx)), translate() {}, bounds: (entity, ctx) => pointsBox(newtonPoints(entity, ctx)), handles: () => [], dragHandle() {}, fields: [graphSourceField(), { key: "x0", label: "Starting guess", input: "number", step: .1 }, { key: "steps", label: "Iterations", input: "range", min: 1, max: 40, step: 1 }, { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }],
});

function catmullPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t, t3 = t2 * t;
  return { x: .5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3), y: .5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3) };
}

export function splinePoints(entity: SplineEntity): Point[] {
  const knots = entity.points; if (knots.length < 2) return knots;
  const result: Point[] = [];
  for (let index = 0; index < knots.length - 1; index += 1) { const p0 = index === 0 ? { x: 2 * knots[0].x - knots[1].x, y: 2 * knots[0].y - knots[1].y } : knots[index - 1], p1 = knots[index], p2 = knots[index + 1], p3 = index + 2 < knots.length ? knots[index + 2] : { x: 2 * knots.at(-1)!.x - knots.at(-2)!.x, y: 2 * knots.at(-1)!.y - knots.at(-2)!.y }; for (let sample = 0; sample < 24; sample += 1) result.push(catmullPoint(p0, p1, p2, p3, sample / 24)); }
  result.push(knots.at(-1)!); return result;
}

registerEntity<SplineEntity>({
  kind: "spline", ctor: "spline", anchorArgIndex: 1, group: "Math", label: "Spline", icon: "⌁", order: 66, fidelity: "semantic", hint: "A smooth Catmull-Rom path through editable knots",
  create: (id, x, y) => ({ ...baseEntity(id, "cyan"), kind: "spline", points: [{ x: x - 100, y: y + 50 }, { x, y: y - 60 }, { x: x + 100, y: y + 40 }], strokeWidth: null }),
  parseArgs(stmt) { const id = argName(stmt.args, 0); if (!id || stmt.args.length < 3) return null; const points = stmt.args.slice(1).map((_arg, index) => argPoint(stmt.args, index + 1)); return points.every((point): point is Point => point !== null) ? { ...baseEntity(id, "cyan"), kind: "spline", points, strokeWidth: null } : null; },
  ctorLine: (entity) => `spline(${entity.id}, ${entity.points.map((point) => pt(point.x, point.y)).join(", ")});`, extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`], modifiers: { stroke: strokeWidthModifier }, anchor: (entity) => centerOf(entity.points), translate(entity, dx, dy) { for (const point of entity.points) { point.x += dx; point.y += dy; } }, bounds: (entity) => pointsBox(splinePoints(entity)), handles: (entity) => entity.points.map((point, index) => ({ name: `p${index}`, x: point.x, y: point.y })), dragHandle(entity, handle, x, y) { const index = Number(handle.slice(1)); if (Number.isInteger(index) && entity.points[index]) entity.points[index] = { x, y }; }, referenceIds: (entity) => entity.points.map((_point, index) => `${entity.id}.k${index}`), fields: [{ key: "points", label: "Knots", input: "point-list", minItems: 2, hint: "Drag knots on Canvas or edit, add, and remove them here." }, { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }],
});

function trajectoryNode(source: string): ExprNode | null { return formula(source); }
function trajectoryValue(node: ExprNode | null, x: number, y: number): number { return value(node, { x, y, t: 0 }); }

export function trajectoryPoints(entity: TrajectoryEntity, cap = 800): Point[] {
  const fx = trajectoryNode(entity.fx), fy = trajectoryNode(entity.fy); if (!fx || !fy) return [];
  const points: Point[] = []; let x = entity.start.x, y = entity.start.y, steps = Math.min(cap, Math.max(2, Math.min(5000, Math.round(entity.steps))));
  for (let index = 0; index <= steps; index += 1) { if (!Number.isFinite(x) || !Number.isFinite(y)) break; points.push({ x: entity.x + x * entity.scaleFactor, y: entity.y - y * entity.scaleFactor }); const dt = .02, k1x = trajectoryValue(fx, x, y), k1y = trajectoryValue(fy, x, y), k2x = trajectoryValue(fx, x + k1x * dt / 2, y + k1y * dt / 2), k2y = trajectoryValue(fy, x + k1x * dt / 2, y + k1y * dt / 2), k3x = trajectoryValue(fx, x + k2x * dt / 2, y + k2y * dt / 2), k3y = trajectoryValue(fy, x + k2x * dt / 2, y + k2y * dt / 2), k4x = trajectoryValue(fx, x + k3x * dt, y + k3y * dt), k4y = trajectoryValue(fy, x + k3x * dt, y + k3y * dt); x += dt / 6 * (k1x + 2 * k2x + 2 * k3x + k4x); y += dt / 6 * (k1y + 2 * k2y + 2 * k3y + k4y); }
  return points;
}

registerEntity<TrajectoryEntity>({
  kind: "trajectory", ctor: "trajectory", anchorArgIndex: 4, group: "Math", label: "ODE trajectory", icon: "ẋ", order: 67, fidelity: "semantic", hint: "A bounded RK4 design sample of an authored differential system",
  create: (id, x, y) => ({ ...baseEntity(id, "lime"), kind: "trajectory", fx: "-y", fy: "x", start: { x: 2, y: 0 }, x, y, scaleFactor: 80, steps: 400, strokeWidth: null }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), fx = argString(stmt.args, 1), fy = argString(stmt.args, 2), start = argPoint(stmt.args, 3), center = argPoint(stmt.args, 4), scaleFactor = argNumber(stmt.args, 5), steps = argNumber(stmt.args, 6); return id && fx !== null && fy !== null && start && center && scaleFactor !== null && stmt.args.length <= 7 && !(stmt.args.length === 7 && steps === null) ? { ...baseEntity(id, "lime"), kind: "trajectory", fx, fy, start, x: center.x, y: center.y, scaleFactor, steps: Math.max(2, Math.min(5000, Math.round(steps ?? 400))), strokeWidth: null } : null; },
  ctorLine: (entity) => `trajectory(${entity.id}, "${escapeString(entity.fx)}", "${escapeString(entity.fy)}", ${pt(entity.start.x, entity.start.y)}, ${pt(entity.x, entity.y)}, ${num(entity.scaleFactor)}, ${num(entity.steps)});`, extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`], modifiers: { stroke: strokeWidthModifier }, anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; }, bounds: (entity) => pointsBox(trajectoryPoints(entity)), handles: () => [], dragHandle() {}, fields: [{ key: "fx", label: "dx/dt", input: "text" }, { key: "fy", label: "dy/dt", input: "text" }, { key: "start", label: "Math start", input: "point" }, { key: "scaleFactor", label: "Pixels per unit", input: "number", min: 1 }, { key: "steps", label: "Integration steps", input: "range", min: 2, max: 5000, step: 1 }, { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }],
});
