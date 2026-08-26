// Calculus authoring layer: sampled plots and dependency-aware views derived
// from them. Native Manic remains the numerical/pixel truth; these utilities
// provide an honest deterministic design sketch and editable semantics.

import { argName, argNumber, argPoint, argString, escapeString, num, pt } from "../args.js";
import { evalExpr, parseExpr, type ExprNode } from "../expr.js";
import { preferReference, defFor, registerEntity, type Box, type GeometryContext } from "../registry.js";
import { lexTokens } from "../script.js";
import type {
  AreaEntity, BandEntity, CalculusMarksEntity, DerivedCurveEntity, IntegralEntity, LimitEntity,
  PlotEntity, SceneDoc, SceneEntity, SlopeEntity, TangentEntity,
} from "../types.js";
import { baseEntity, strokeWidthModifier } from "./base.js";
import { circleTangentPoints, geoPointField, geoPointReferences } from "./geometry.js";

export type GraphEntity = PlotEntity | DerivedCurveEntity;
export interface GraphPoint { x: number; y: number; graphX: number; value: number; }

const GRAPH_KINDS = ["plot", "deriv", "accum"] as const;
const NAMED_FORMULAS: Record<string, string> = {
  sin: "sin(x)", cos: "cos(x)", tan: "tan(x)", exp: "exp(x)",
  parabola: "x^2", cubic: "x^3", sigmoid: "1/(1+exp(-x))",
};

function graphCandidates(doc?: SceneDoc): GraphEntity[] {
  return doc?.entities.filter((entity): entity is GraphEntity => GRAPH_KINDS.includes(entity.kind as GraphEntity["kind"]) && entity.origin !== "generated") ?? [];
}

function sourceGraph(source: string, ctx?: GeometryContext): GraphEntity | null {
  const entity = ctx?.entity(source);
  return entity && GRAPH_KINDS.includes(entity.kind as GraphEntity["kind"]) ? entity as GraphEntity : null;
}

function formulaNode(entity: PlotEntity): ExprNode | null {
  const source = entity.formulaForm === "name" ? NAMED_FORMULAS[entity.formula] : entity.formula;
  if (!source) return null;
  try { return parseExpr(lexTokens(source)); } catch { return null; }
}

function plotValue(entity: PlotEntity, x: number): number {
  const node = formulaNode(entity);
  if (!node) return Number.NaN;
  try { return evalExpr(node, new Map([["x", x], ["t", x]])); } catch { return Number.NaN; }
}

export function graphDomain(entity: GraphEntity, ctx?: GeometryContext): { x0: number; x1: number; x: number; y: number; sx: number; sy: number } | null {
  if (entity.kind === "plot") return { x0: entity.x0, x1: entity.x1, x: entity.x, y: entity.y, sx: entity.sx, sy: entity.sy };
  const source = sourceGraph(entity.source, ctx);
  return source ? graphDomain(source, ctx) : null;
}

export function graphValue(entity: GraphEntity, x: number, ctx?: GeometryContext, visiting = new Set<string>()): number {
  if (visiting.has(entity.id)) return Number.NaN;
  visiting.add(entity.id);
  let value: number;
  if (entity.kind === "plot") value = plotValue(entity, x);
  else {
    const source = sourceGraph(entity.source, ctx);
    if (!source) value = Number.NaN;
    else if (entity.kind === "deriv") value = graphSlope(source, x, ctx, visiting);
    else value = integrateGraph(source, entity.a ?? graphDomain(source, ctx)?.x0 ?? 0, x, ctx, 64, visiting);
  }
  visiting.delete(entity.id);
  return value;
}

export function graphSlope(entity: GraphEntity, x: number, ctx?: GeometryContext, visiting = new Set<string>()): number {
  const domain = graphDomain(entity, ctx);
  const h = Math.max(1e-4, Math.abs((domain?.x1 ?? 1) - (domain?.x0 ?? -1)) * 1e-4);
  return (graphValue(entity, x + h, ctx, new Set(visiting)) - graphValue(entity, x - h, ctx, new Set(visiting))) / (2 * h);
}

export function graphSecond(entity: GraphEntity, x: number, ctx?: GeometryContext): number {
  const domain = graphDomain(entity, ctx);
  const h = Math.max(1e-3, Math.abs((domain?.x1 ?? 1) - (domain?.x0 ?? -1)) * 5e-4);
  return (graphSlope(entity, x + h, ctx) - graphSlope(entity, x - h, ctx)) / (2 * h);
}

export function integrateGraph(entity: GraphEntity, a: number, b: number, ctx?: GeometryContext, samples = 80, visiting = new Set<string>()): number {
  if (a === b) return 0;
  const n = Math.max(8, samples + (samples % 2));
  const step = (b - a) / n;
  let sum = 0;
  for (let index = 0; index <= n; index += 1) {
    const value = graphValue(entity, a + step * index, ctx, new Set(visiting));
    if (!Number.isFinite(value)) return Number.NaN;
    sum += value * (index === 0 || index === n ? 1 : index % 2 === 0 ? 2 : 4);
  }
  return sum * step / 3;
}

export function graphPoint(entity: GraphEntity, graphX: number, ctx?: GeometryContext): GraphPoint | null {
  const domain = graphDomain(entity, ctx);
  if (!domain) return null;
  const value = graphValue(entity, graphX, ctx);
  if (!Number.isFinite(value)) return null;
  return { x: domain.x + graphX * domain.sx, y: domain.y - value * domain.sy, graphX, value };
}

export function graphSamples(entity: GraphEntity, ctx?: GeometryContext, count = 240): GraphPoint[] {
  const domain = graphDomain(entity, ctx);
  if (!domain) return [];
  const points: GraphPoint[] = [];
  for (let index = 0; index <= count; index += 1) {
    const x = domain.x0 + (domain.x1 - domain.x0) * index / count;
    const point = graphPoint(entity, x, ctx);
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) points.push(point);
  }
  return points;
}

function boxOfPoints(points: { x: number; y: number }[]): Box {
  if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
}

export function graphEntityBounds(entity: GraphEntity, ctx?: GeometryContext): Box {
  return boxOfPoints(graphSamples(entity, ctx));
}

export function graphZeros(entity: GraphEntity, mode: "slope" | "second", ctx?: GeometryContext): number[] {
  const domain = graphDomain(entity, ctx);
  if (!domain) return [];
  const f = mode === "slope" ? (x: number) => graphSlope(entity, x, ctx) : (x: number) => graphSecond(entity, x, ctx);
  const roots: number[] = [];
  const n = 300;
  let previousX = domain.x0, previous = f(previousX);
  for (let index = 1; index <= n; index += 1) {
    const x = domain.x0 + (domain.x1 - domain.x0) * index / n;
    const value = f(x);
    if (Number.isFinite(previous) && Number.isFinite(value) && (previous === 0 || value === 0 || Math.sign(previous) !== Math.sign(value))) {
      let lo = previousX, hi = x;
      for (let refine = 0; refine < 18; refine += 1) {
        const mid = (lo + hi) / 2;
        if (Math.sign(f(lo)) === Math.sign(f(mid))) lo = mid; else hi = mid;
      }
      const root = (lo + hi) / 2;
      if (!roots.some((candidate) => Math.abs(candidate - root) < Math.abs(domain.x1 - domain.x0) / 100)) roots.push(root);
    }
    previousX = x; previous = value;
  }
  return roots;
}

function graphSourceField() {
  return { key: "source", label: "Curve", input: "entity" as const, entityKinds: GRAPH_KINDS };
}

registerEntity<PlotEntity>({
  kind: "plot", ctor: "plot", anchorArgIndex: 1, group: "Math", label: "Plot", icon: "ƒ", order: 44,
  hint: "A sampled function y=f(x); formula and graph scale stay editable",
  create: (id, x, y) => ({ ...baseEntity(id, "cyan"), kind: "plot", x, y, sx: 90, sy: 60, formula: "x^2", formulaForm: "string", x0: -3, x1: 3, strokeWidth: null }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), center = argPoint(stmt.args, 1), sx = argNumber(stmt.args, 2), sy = argNumber(stmt.args, 3);
    const stringFormula = argString(stmt.args, 4), namedFormula = argName(stmt.args, 4);
    if (!id || !center || sx === null || sy === null || (stringFormula === null && namedFormula === null)) return null;
    const range = argPoint(stmt.args, 5), domain = argNumber(stmt.args, 5) ?? 6;
    return { ...baseEntity(id, "cyan"), kind: "plot", x: center.x, y: center.y, sx, sy, formula: stringFormula ?? namedFormula!, formulaForm: stringFormula !== null ? "string" : "name", x0: range?.x ?? -domain, x1: range?.y ?? domain, strokeWidth: null };
  },
  ctorLine: (entity) => `plot(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.sx)}, ${num(entity.sy)}, ${entity.formulaForm === "string" ? `"${escapeString(entity.formula)}"` : entity.formula}, ${pt(entity.x0, entity.x1)});`,
  extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`],
  modifiers: { stroke: strokeWidthModifier },
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds: (entity) => graphEntityBounds(entity),
  handles: () => [], dragHandle() {},
  fields: [
    { key: "formula", label: "Formula y =", input: "text", hint: "Use x, arithmetic and functions such as sin, cos, exp and sqrt." },
    { key: "sx", label: "Horizontal px/unit", input: "number", min: 1 },
    { key: "sy", label: "Vertical px/unit", input: "number", min: 1 },
    { key: "x0", label: "Domain start", input: "number" },
    { key: "x1", label: "Domain end", input: "number" },
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 },
  ],
});

function registerDerivedCurve(kind: "deriv" | "accum", color: string, order: number) {
  registerEntity<DerivedCurveEntity>({
    kind, ctor: kind, group: "Math", label: kind === "deriv" ? "Derivative curve" : "Accumulation curve", icon: kind === "deriv" ? "ƒ′" : "∫", order,
    hint: kind === "deriv" ? "A live numerical derivative of another plotted curve" : "The running integral of another plotted curve",
    movable: false,
    canCreate: (doc) => graphCandidates(doc).length > 0,
    createBlockedReason: "Add a Plot before creating a derived calculus curve.",
    create(id, _x, _y, doc, selectedId) { return { ...baseEntity(id, color), kind, source: (preferReference(doc, selectedId, (entity: SceneEntity) => graphCandidates(doc).some((graph) => graph.id === entity.id))?.id ?? graphCandidates(doc).at(-1)?.id ?? "curve"), a: kind === "accum" ? 0 : null, strokeWidth: null }; },
    parseArgs(stmt) {
      const id = argName(stmt.args, 0), source = argName(stmt.args, 1);
      if (!id || !source) return null;
      const a = kind === "accum" ? argNumber(stmt.args, 2) : null;
      const colorIndex = kind === "accum" ? (a === null ? 2 : 3) : 2;
      return { ...baseEntity(id, argName(stmt.args, colorIndex) ?? color), kind, source, a: kind === "accum" ? a : null, strokeWidth: null };
    },
    ctorLine: (entity) => kind === "deriv"
      ? `deriv(${entity.id}, ${entity.source});`
      : `accum(${entity.id}, ${entity.source}${entity.a === null ? "" : `, ${num(entity.a)}`});`,
    extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`],
    modifiers: { stroke: strokeWidthModifier },
    references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; },
    anchor(entity, ctx) { const box = graphEntityBounds(entity, ctx); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; },
    translate() {}, bounds: (entity, ctx) => graphEntityBounds(entity, ctx), handles: () => [], dragHandle() {},
    fields: kind === "deriv" ? [graphSourceField(), { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }] : [graphSourceField(), { key: "a", label: "Starts integrating at x", input: "number", nullable: true }, { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }],
  });
}

registerDerivedCurve("deriv", "gold", 45);
registerDerivedCurve("accum", "lime", 46);

export function tangentGeometry(entity: TangentEntity, ctx?: GeometryContext) {
  const source = sourceGraph(entity.source, ctx), touch = source ? graphPoint(source, entity.graphX, ctx) : null;
  if (!source || !touch) return { touch: { x: 0, y: 0 }, from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, slope: Number.NaN };
  const domain = graphDomain(source, ctx)!;
  const slope = graphSlope(source, entity.graphX, ctx);
  const vx = domain.sx, vy = -slope * domain.sy;
  const length = Math.max(1, Math.hypot(vx, vy)), half = entity.length / 2;
  const dx = vx / length * half, dy = vy / length * half;
  return { touch, from: { x: touch.x - dx, y: touch.y - dy }, to: { x: touch.x + dx, y: touch.y + dy }, slope };
}

export function tangentPointGeometry(entity: TangentEntity, ctx?: GeometryContext) {
  return circleTangentPoints(entity.point ?? "P", entity.center ?? "O", entity.through ?? "R", ctx);
}

function tangentBase(id: string): TangentEntity {
  return {
    ...baseEntity(id, "gold"), kind: "tangent", mode: "curve", source: "curve", graphX: 0, length: 120,
    point: null, center: null, through: null, point0Color: "gold", point1Color: "gold",
    point0Reveal: "none", point1Reveal: "none", point0Tags: [], point1Tags: [], strokeWidth: null,
  };
}

function circleTangentRefs(doc?: SceneDoc, selectedId?: string): [string, string, string] | null {
  const pool = geoPointReferences(doc), selected = selectedId && pool.includes(selectedId) ? selectedId : null;
  const ordered = [...new Set([...(selected ? [selected] : []), ...[...pool].reverse()])];
  return ordered.length >= 3 ? [ordered[0]!, ordered[1]!, ordered[2]!] : null;
}

const tangentRevealLine = (id: string, reveal: TangentEntity["point0Reveal"]) => reveal === "grow" ? `hidden(${id}, center);` : reveal === "fade" ? `hidden(${id});` : null;

registerEntity<TangentEntity>({
  kind: "tangent", ctor: "tangent", group: "Math", label: "Tangent", icon: "⊣", order: 47,
  hint: "A live curve tangent, or the two tangency points from a point to a circle", movable: false,
  colorInCtor: (entity) => entity.mode === "circle", authorOnlyWhen: (entity) => entity.mode === "circle",
  canCreate: (doc) => graphCandidates(doc).length > 0 || circleTangentRefs(doc) !== null,
  createBlockedReason: "Add a Plot, or add three points defining an external point, circle centre, and rim.",
  create(id, _x, _y, doc, selectedId) {
    const entity = tangentBase(id), pointRefs = circleTangentRefs(doc, selectedId);
    const selectedIsPoint = Boolean(selectedId && geoPointReferences(doc).includes(selectedId));
    if (pointRefs && (selectedIsPoint || graphCandidates(doc).length === 0)) {
      entity.mode = "circle"; entity.point0Color = "cyan"; entity.point1Color = "cyan"; [entity.point, entity.center, entity.through] = pointRefs; return entity;
    }
    entity.source = preferReference(doc, selectedId, (candidate: SceneEntity) => graphCandidates(doc).some((graph) => graph.id === candidate.id))?.id ?? graphCandidates(doc).at(-1)?.id ?? "curve";
    return entity;
  },
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), first = argName(stmt.args, 1), graphX = argNumber(stmt.args, 2);
    if (!id || !first) return null;
    const entity = tangentBase(id);
    if (graphX !== null && stmt.args.length >= 3 && stmt.args.length <= 4) {
      entity.source = first; entity.graphX = graphX; entity.length = argNumber(stmt.args, 3) ?? 120; return entity;
    }
    const center = argName(stmt.args, 2), through = argName(stmt.args, 3);
    if (!center || !through || stmt.args.length !== 4) return null;
    entity.mode = "circle"; entity.point = first; entity.center = center; entity.through = through; entity.point0Color = "cyan"; entity.point1Color = "cyan"; return entity;
  },
  ctorLine: (entity) => entity.mode === "circle"
    ? `tangent(${entity.id}, ${entity.point}, ${entity.center}, ${entity.through});`
    : `tangent(${entity.id}, ${entity.source}, ${num(entity.graphX)}, ${num(entity.length)});`,
  extraLines(entity) {
    if (entity.mode === "curve") return entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`];
    const out: string[] = [];
    if (entity.point0Color !== "cyan") out.push(`color(${entity.id}0, ${entity.point0Color});`);
    if (entity.point1Color !== "cyan") out.push(`color(${entity.id}1, ${entity.point1Color});`);
    const reveal0 = tangentRevealLine(`${entity.id}0`, entity.point0Reveal), reveal1 = tangentRevealLine(`${entity.id}1`, entity.point1Reveal);
    if (reveal0) out.push(reveal0); if (reveal1) out.push(reveal1);
    for (const tag of entity.point0Tags) out.push(`tag(${entity.id}0, ${tag});`);
    for (const tag of entity.point1Tags) out.push(`tag(${entity.id}1, ${tag});`);
    return out;
  },
  modifiers: { stroke: strokeWidthModifier },
  references: (entity) => entity.mode === "circle" ? [entity.point!, entity.center!, entity.through!] : [entity.source],
  replaceReference(entity, from, to) { if (entity.mode === "circle") { if (entity.point === from) entity.point = to; if (entity.center === from) entity.center = to; if (entity.through === from) entity.through = to; } else if (entity.source === from) entity.source = to; },
  referenceIds: (entity) => entity.mode === "circle" ? [`${entity.id}0`, `${entity.id}1`] : [],
  storyTargets: (entity) => entity.mode === "circle" ? [
    { id: `${entity.id}0`, label: `${entity.id}0 — first tangency`, kind: "point" },
    { id: `${entity.id}1`, label: `${entity.id}1 — second tangency`, kind: "point" },
  ] : [],
  referenceBounds(entity, ref, ctx) { if (entity.mode !== "circle") return null; const points = tangentPointGeometry(entity, ctx).points, point = ref === `${entity.id}0` ? points[0] : ref === `${entity.id}1` ? points[1] : null; return point ? { x: point.x - 5, y: point.y - 5, width: 10, height: 10 } : null; },
  applyReferenceModifier(entity, ref, stmt) {
    if (entity.mode !== "circle") return false;
    const first = ref === `${entity.id}0`, second = ref === `${entity.id}1`; if (!first && !second) return false;
    if (stmt.name === "hidden") { const reveal = argName(stmt.args, 1) === "center" ? "grow" : "fade"; if (first) entity.point0Reveal = reveal; else entity.point1Reveal = reveal; return true; }
    if (stmt.name === "tag") { const tag = argName(stmt.args, 1); if (!tag) return false; const tags = first ? entity.point0Tags : entity.point1Tags; if (!tags.includes(tag)) tags.push(tag); return true; }
    if (stmt.name !== "color") return false; const color = argName(stmt.args, 1); if (!color) return false; if (first) entity.point0Color = color; else entity.point1Color = color; return true;
  },
  anchor(entity, ctx) { if (entity.mode === "circle") { const [a, b] = tangentPointGeometry(entity, ctx).points; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; } return tangentGeometry(entity, ctx).touch; }, translate() {},
  bounds(entity, ctx) { if (entity.mode === "circle") return boxOfPoints(tangentPointGeometry(entity, ctx).points); const geometry = tangentGeometry(entity, ctx); return boxOfPoints([geometry.from, geometry.to]); },
  handles: () => [], dragHandle() {}, fields: [
    { key: "mode", label: "Native form", input: "select", options: ["curve", "circle"], readonly: true },
    { ...graphSourceField(), visibleWhen: { key: "mode", equals: "curve" } },
    { key: "graphX", label: "Curve x", input: "number", step: 0.1, visibleWhen: { key: "mode", equals: "curve" } },
    { key: "length", label: "Line length", input: "range", min: 20, max: 600, visibleWhen: { key: "mode", equals: "curve" } },
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20, visibleWhen: { key: "mode", equals: "curve" } },
    { ...geoPointField("point", "External point"), visibleWhen: { key: "mode", equals: "circle" } },
    { ...geoPointField("center", "Circle centre"), visibleWhen: { key: "mode", equals: "circle" } },
    { ...geoPointField("through", "Circle rim point"), visibleWhen: { key: "mode", equals: "circle" } },
    { key: "point0Color", label: "First tangency color", input: "color", visibleWhen: { key: "mode", equals: "circle" } },
    { key: "point1Color", label: "Second tangency color", input: "color", visibleWhen: { key: "mode", equals: "circle" } },
    { key: "point0Reveal", label: "First tangency starts", input: "select", options: ["none", "fade", "grow"], visibleWhen: { key: "mode", equals: "circle" } },
    { key: "point1Reveal", label: "Second tangency starts", input: "select", options: ["none", "fade", "grow"], visibleWhen: { key: "mode", equals: "circle" } },
  ],
});

export function slopeGeometry(entity: SlopeEntity, ctx?: GeometryContext) {
  const source = sourceGraph(entity.source, ctx), point = source ? graphPoint(source, entity.graphX, ctx) : null;
  const slope = source ? graphSlope(source, entity.graphX, ctx) : Number.NaN;
  return { point: point ?? { x: 0, y: 0 }, at: { x: (point?.x ?? 0) + entity.dx, y: (point?.y ?? 0) + entity.dy }, slope };
}

registerEntity<SlopeEntity>({
  kind: "slope", ctor: "slope", group: "Math", label: "Slope readout", icon: "m", order: 48, hint: "A live numerical slope readout pinned to a plotted curve", movable: false,
  canCreate: (doc) => graphCandidates(doc).length > 0,
  createBlockedReason: "Add a Plot before attaching a slope readout.",
  create(id, _x, _y, doc, selectedId) { return { ...baseEntity(id, "gold"), kind: "slope", source: (preferReference(doc, selectedId, (entity: SceneEntity) => graphCandidates(doc).some((graph) => graph.id === entity.id))?.id ?? graphCandidates(doc).at(-1)?.id ?? "curve"), graphX: 0, dx: 16, dy: -20, size: 24 }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1), graphX = argNumber(stmt.args, 2), offset = argPoint(stmt.args, 3) ?? { x: 16, y: -20 }; return id && source && graphX !== null ? { ...baseEntity(id, "gold"), kind: "slope", source, graphX, dx: offset.x, dy: offset.y, size: 24 } : null; },
  ctorLine: (entity) => `slope(${entity.id}, ${entity.source}, ${num(entity.graphX)}, ${pt(entity.dx, entity.dy)});`,
  extraLines: (entity) => entity.size === 24 ? [] : [`size(${entity.id}, ${num(entity.size)});`],
  modifiers: { size(entity, stmt) { const value = argNumber(stmt.args, 1); if (value === null) return false; entity.size = value; return true; } },
  references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; },
  anchor: (entity, ctx) => slopeGeometry(entity, ctx).at, translate() {},
  bounds(entity, ctx) { const at = slopeGeometry(entity, ctx).at; return { x: at.x - entity.size * 2, y: at.y - entity.size * .75, width: entity.size * 4, height: entity.size * 1.5 }; },
  handles: () => [], dragHandle() {}, fields: [graphSourceField(), { key: "graphX", label: "Curve x", input: "number", step: .1 }, { key: "dx", label: "Label offset x", input: "number" }, { key: "dy", label: "Label offset y", input: "number" }, { key: "size", label: "Text size", input: "range", min: 12, max: 64 }],
});

export function areaPoints(entity: AreaEntity, ctx?: GeometryContext): { x: number; y: number }[] {
  const source = sourceGraph(entity.source, ctx), domain = source ? graphDomain(source, ctx) : null;
  if (!source || !domain) return [];
  const count = Math.max(2, Math.min(300, entity.samples));
  const points = [{ x: domain.x + entity.a * domain.sx, y: domain.y }];
  for (let index = 0; index <= count; index += 1) {
    const x = entity.a + (entity.b - entity.a) * index / count;
    const point = graphPoint(source, x, ctx);
    if (point) points.push(point);
  }
  points.push({ x: domain.x + entity.b * domain.sx, y: domain.y });
  return points;
}

registerEntity<AreaEntity>({
  kind: "area", ctor: "area", group: "Math", label: "Area", icon: "▰", order: 49, hint: "A filled region under a plotted curve", movable: false,
  canCreate: (doc) => graphCandidates(doc).length > 0,
  createBlockedReason: "Add a Plot before creating an area region.",
  create(id, _x, _y, doc, selectedId) { return { ...baseEntity(id, "cyan"), kind: "area", source: (preferReference(doc, selectedId, (entity: SceneEntity) => graphCandidates(doc).some((graph) => graph.id === entity.id))?.id ?? graphCandidates(doc).at(-1)?.id ?? "curve"), a: 0, b: 1, samples: 60 }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1), a = argNumber(stmt.args, 2), b = argNumber(stmt.args, 3); return id && source && a !== null && b !== null ? { ...baseEntity(id, "cyan"), kind: "area", source, a, b, samples: Math.max(2, Math.round(argNumber(stmt.args, 4) ?? 60)) } : null; },
  ctorLine: (entity) => `area(${entity.id}, ${entity.source}, ${num(entity.a)}, ${num(entity.b)}, ${num(entity.samples)});`, extraLines: () => [], modifiers: {},
  references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; },
  anchor(entity, ctx) { const box = boxOfPoints(areaPoints(entity, ctx)); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, translate() {},
  bounds: (entity, ctx) => boxOfPoints(areaPoints(entity, ctx)), handles: () => [], dragHandle() {},
  fields: [graphSourceField(), { key: "a", label: "From x", input: "number", step: .1 }, { key: "b", label: "To x", input: "number", step: .1 }, { key: "samples", label: "Samples", input: "range", min: 2, max: 200 }],
});

export interface BandGeometry {
  points: { x: number; y: number }[];
  x0: number;
  x1: number;
  issue: string | null;
}

/** Native `band` samples 160 strips over the two curves' shared x-domain. */
export function bandGeometry(entity: BandEntity, ctx?: GeometryContext): BandGeometry {
  const top = sourceGraph(entity.top, ctx), bottom = sourceGraph(entity.bottom, ctx);
  const topDomain = top ? graphDomain(top, ctx) : null, bottomDomain = bottom ? graphDomain(bottom, ctx) : null;
  if (!top || !bottom || !topDomain || !bottomDomain) {
    return { points: [], x0: 0, x1: 0, issue: `Band needs plotted curves ${entity.top} and ${entity.bottom}.` };
  }
  const range0 = entity.restricted ? Math.min(entity.a, entity.b) : -Infinity;
  const range1 = entity.restricted ? Math.max(entity.a, entity.b) : Infinity;
  const x0 = Math.max(topDomain.x0, bottomDomain.x0, range0);
  const x1 = Math.min(topDomain.x1, bottomDomain.x1, range1);
  if (x1 <= x0) return { points: [], x0, x1, issue: "The two curves do not overlap in the selected x-range." };
  const upper: { x: number; y: number }[] = [], lower: { x: number; y: number }[] = [];
  for (let index = 0; index <= 160; index += 1) {
    const x = x0 + (x1 - x0) * index / 160;
    const a = graphPoint(top, x, ctx), b = graphPoint(bottom, x, ctx);
    if (a && b && Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(b.x) && Number.isFinite(b.y)) {
      upper.push(a);
      lower.push(b);
    }
  }
  return upper.length < 2
    ? { points: [], x0, x1, issue: "The formulas produced no fillable region in this range." }
    : { points: [...upper, ...lower.reverse()], x0, x1, issue: null };
}

registerEntity<BandEntity>({
  kind: "band", ctor: "band", group: "Math", label: "Between curves", icon: "≋", order: 50, fidelity: "semantic", movable: false, defaultOpacity: .28,
  hint: "A translucent region that follows two plotted curves over their shared x-range",
  canCreate: (doc) => graphCandidates(doc).length >= 2,
  createBlockedReason: "Add two plots before creating a band between them.",
  create(id, _x, _y, doc, selectedId) {
    const curves = graphCandidates(doc);
    const top = preferReference(doc, selectedId, (entity: SceneEntity) => curves.some((curve) => curve.id === entity.id))?.id ?? curves.at(-1)?.id ?? "top";
    const bottom = curves.find((curve) => curve.id !== top)?.id ?? top;
    return { ...baseEntity(id, "cyan"), nativePaint: true, opacity: .28, kind: "band", top, bottom, constructorColor: null, restricted: false, a: 0, b: 1 };
  },
  parseArgs(stmt, doc) {
    const id = argName(stmt.args, 0), top = argName(stmt.args, 1), bottom = argName(stmt.args, 2);
    const constructorColor = argName(stmt.args, 3), range = argPoint(stmt.args, 4);
    const validGraph = (ref: string | null) => ref !== null && (!doc || doc.entities.some((entity) => entity.id === ref && GRAPH_KINDS.includes(entity.kind as GraphEntity["kind"])));
    if (!id || !validGraph(top) || !validGraph(bottom) || stmt.args.length < 3 || stmt.args.length > 5 || (stmt.args.length >= 4 && constructorColor === null) || (stmt.args.length === 5 && !range)) return null;
    return { ...baseEntity(id, constructorColor ?? "cyan"), nativePaint: true, opacity: .28, kind: "band", top: top!, bottom: bottom!, constructorColor, restricted: range !== null, a: range?.x ?? 0, b: range?.y ?? 1 };
  },
  ctorLine(entity) {
    const color = entity.constructorColor ?? (entity.restricted ? entity.color : null);
    return `band(${entity.id}, ${entity.top}, ${entity.bottom}${color ? `, ${color}` : ""}${entity.restricted ? `, ${pt(entity.a, entity.b)}` : ""});`;
  },
  extraLines: () => [], modifiers: {},
  references: (entity) => [entity.top, entity.bottom],
  replaceReference(entity, from, to) { if (entity.top === from) entity.top = to; if (entity.bottom === from) entity.bottom = to; },
  anchor(entity, ctx) { const box = boxOfPoints(bandGeometry(entity, ctx).points); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; },
  translate() {}, bounds: (entity, ctx) => boxOfPoints(bandGeometry(entity, ctx).points), handles: () => [], dragHandle() {},
  fields: [
    { key: "top", label: "Top curve", input: "entity", entityKinds: GRAPH_KINDS, referencesEarlierOnly: true },
    { key: "bottom", label: "Bottom curve", input: "entity", entityKinds: GRAPH_KINDS, referencesEarlierOnly: true },
    { key: "restricted", label: "Restrict x-range", input: "checkbox", hint: "Off fills the complete domain shared by both plots." },
    { key: "a", label: "Range start", input: "number", step: .1, visibleWhen: { key: "restricted", equals: true } },
    { key: "b", label: "Range end", input: "number", step: .1, visibleWhen: { key: "restricted", equals: true } },
  ],
});

function integralPosition(entity: IntegralEntity, ctx?: GeometryContext) {
  if (entity.x !== null && entity.y !== null) return { x: entity.x, y: entity.y };
  const source = sourceGraph(entity.source, ctx), domain = source ? graphDomain(source, ctx) : null;
  return domain ? { x: domain.x, y: domain.y - 170 } : { x: 0, y: 0 };
}

export function integralValue(entity: IntegralEntity, ctx?: GeometryContext): number {
  const source = sourceGraph(entity.source, ctx);
  return source ? integrateGraph(source, entity.a, entity.b, ctx) : Number.NaN;
}

registerEntity<IntegralEntity>({
  kind: "integral", ctor: "integral", group: "Math", label: "Integral readout", icon: "∫=", order: 50, hint: "A live numerical definite-integral readout", movable: false,
  canCreate: (doc) => graphCandidates(doc).length > 0,
  createBlockedReason: "Add a Plot before attaching an integral readout.",
  create(id, x, y, doc, selectedId) { return { ...baseEntity(id, "lime"), kind: "integral", source: (preferReference(doc, selectedId, (entity: SceneEntity) => graphCandidates(doc).some((graph) => graph.id === entity.id))?.id ?? graphCandidates(doc).at(-1)?.id ?? "curve"), a: 0, b: 1, x, y, size: 26 }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1), a = argNumber(stmt.args, 2), b = argNumber(stmt.args, 3), at = argPoint(stmt.args, 4); return id && source && a !== null && b !== null ? { ...baseEntity(id, "lime"), kind: "integral", source, a, b, x: at?.x ?? null, y: at?.y ?? null, size: 26 } : null; },
  ctorLine: (entity) => `integral(${entity.id}, ${entity.source}, ${num(entity.a)}, ${num(entity.b)}${entity.x !== null && entity.y !== null ? `, ${pt(entity.x, entity.y)}` : ""});`,
  extraLines: (entity) => entity.size === 26 ? [] : [`size(${entity.id}, ${num(entity.size)});`],
  modifiers: { size(entity, stmt) { const value = argNumber(stmt.args, 1); if (value === null) return false; entity.size = value; return true; } },
  references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; },
  anchor: (entity, ctx) => integralPosition(entity, ctx), translate() {},
  bounds(entity, ctx) { const at = integralPosition(entity, ctx); return { x: at.x - entity.size * 2.4, y: at.y - entity.size * .75, width: entity.size * 4.8, height: entity.size * 1.5 }; },
  handles: () => [], dragHandle() {}, fields: [graphSourceField(), { key: "a", label: "From x", input: "number", step: .1 }, { key: "b", label: "To x", input: "number", step: .1 }, { key: "x", label: "Pinned x", input: "number", nullable: true }, { key: "y", label: "Pinned y", input: "number", nullable: true }, { key: "size", label: "Text size", input: "range", min: 12, max: 64 }],
});

function marksPoints(entity: CalculusMarksEntity, ctx?: GeometryContext): GraphPoint[] {
  const source = sourceGraph(entity.source, ctx);
  if (!source) return [];
  return graphZeros(source, entity.kind === "extrema" ? "slope" : "second", ctx).map((x) => graphPoint(source, x, ctx)).filter((point): point is GraphPoint => point !== null);
}

function registerMarks(kind: "extrema" | "inflections", color: string, order: number) {
  registerEntity<CalculusMarksEntity>({
    kind, ctor: kind, group: "Math", label: kind === "extrema" ? "Extrema" : "Inflections", icon: kind === "extrema" ? "●↕" : "●∿", order,
    hint: kind === "extrema" ? "Numerically found maxima and minima" : "Numerically found concavity changes", colorInCtor: true, movable: false,
    canCreate: (doc) => graphCandidates(doc).length > 0,
    createBlockedReason: "Add a Plot before finding calculus markers.",
    create(id, _x, _y, doc, selectedId) { return { ...baseEntity(id, color), kind, source: (preferReference(doc, selectedId, (entity: SceneEntity) => graphCandidates(doc).some((graph) => graph.id === entity.id))?.id ?? graphCandidates(doc).at(-1)?.id ?? "curve") }; },
    parseArgs(stmt) { const id = argName(stmt.args, 0), source = argName(stmt.args, 1); return id && source ? { ...baseEntity(id, argName(stmt.args, 2) ?? color), kind, source } : null; },
    ctorLine: (entity) => `${kind}(${entity.id}, ${entity.source}, ${entity.color});`, extraLines: () => [], modifiers: {},
    references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; },
    anchor(entity, ctx) { const box = boxOfPoints(marksPoints(entity, ctx)); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, translate() {},
    bounds: (entity, ctx) => boxOfPoints(marksPoints(entity, ctx)), handles: () => [], dragHandle() {}, fields: [graphSourceField()],
  });
}

registerMarks("extrema", "gold", 51);
registerMarks("inflections", "magenta", 52);

export function calculusMarkPoints(entity: CalculusMarksEntity, ctx?: GeometryContext) { return marksPoints(entity, ctx); }

export function limitGeometry(entity: LimitEntity, ctx?: GeometryContext) {
  const source = sourceGraph(entity.source, ctx), domain = source ? graphDomain(source, ctx) : null;
  if (!source || !domain) return { infinity: false, target: { x: 0, y: 0 }, start: { x: 0, y: 0 }, value: Number.NaN, domain: null };
  if (!Number.isFinite(entity.at)) {
    let value = Number.NaN;
    for (const magnitude of [1e3, 1e4, 1e5, 1e6]) { const sample = graphValue(source, Math.sign(entity.at) * magnitude, ctx); if (Number.isFinite(sample)) value = sample; }
    const edge = entity.at > 0 ? domain.x1 : domain.x0;
    const opposite = entity.at > 0 ? domain.x0 : domain.x1;
    return { infinity: true, target: { x: domain.x + edge * domain.sx, y: domain.y - value * domain.sy }, start: { x: domain.x + opposite * domain.sx, y: domain.y - value * domain.sy }, value, domain };
  }
  const eps = Math.max(1e-4, Math.abs(domain.x1 - domain.x0) * 1e-3);
  const left = graphValue(source, entity.at - eps, ctx), right = graphValue(source, entity.at + eps, ctx);
  const value = Number.isFinite(left) && Number.isFinite(right) ? (left + right) / 2 : Number.isFinite(left) ? left : right;
  const target = { x: domain.x + entity.at * domain.sx, y: domain.y - value * domain.sy };
  const startX = entity.at - Math.abs(domain.x1 - domain.x0) * .3 >= domain.x0 ? entity.at - Math.abs(domain.x1 - domain.x0) * .3 : entity.at + Math.abs(domain.x1 - domain.x0) * .3;
  return { infinity: false, target, start: graphPoint(source, startX, ctx) ?? target, value, domain };
}

registerEntity<LimitEntity>({
  kind: "limit", ctor: "limit", group: "Math", label: "Limit", icon: "lim", order: 53, hint: "An approaching marker, guides and numerical limiting value", colorInCtor: true, movable: false,
  canCreate: (doc) => graphCandidates(doc).length > 0,
  createBlockedReason: "Add a Plot before visualising a limit.",
  create(id, _x, _y, doc, selectedId) { return { ...baseEntity(id, "gold"), kind: "limit", source: (preferReference(doc, selectedId, (entity: SceneEntity) => graphCandidates(doc).some((graph) => graph.id === entity.id))?.id ?? graphCandidates(doc).at(-1)?.id ?? "curve"), at: 0 }; },
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), source = argName(stmt.args, 1);
    const namedAt = argName(stmt.args, 2), at = argNumber(stmt.args, 2) ?? (namedAt === "inf" ? Infinity : namedAt === "-inf" ? -Infinity : null);
    return id && source && at !== null ? { ...baseEntity(id, argName(stmt.args, 3) ?? "gold"), kind: "limit", source, at } : null;
  },
  ctorLine: (entity) => `limit(${entity.id}, ${entity.source}, ${Number.isFinite(entity.at) ? num(entity.at) : entity.at > 0 ? "inf" : "-inf"}, ${entity.color});`, extraLines: () => [], modifiers: {},
  references: (entity) => [entity.source], replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; },
  anchor: (entity, ctx) => limitGeometry(entity, ctx).target, translate() {},
  bounds(entity, ctx) { const geometry = limitGeometry(entity, ctx); return boxOfPoints([geometry.start, geometry.target, { x: geometry.target.x + 70, y: geometry.target.y - 40 }]); },
  handles: () => [], dragHandle() {}, fields: [graphSourceField(), { key: "at", label: "Approaches x", input: "number", step: .1, hint: "An empty field represents ±infinity from Source; enter a number to make the limit finite." }],
});
