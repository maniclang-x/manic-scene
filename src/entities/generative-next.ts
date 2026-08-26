// Generative Fields III. Native Manic owns the full point/pixel budgets;
// Canvas evaluates deterministic bounded samples that expose authored state,
// relationships, and approximate shape without pretending to be the renderer.

import { argName, argNumber, argPoint, argString, escapeString, num, pt } from "../args.js";
import { CONSTANTS, evalExpr, type ExprNode } from "../expr.js";
import { preferReference, registerEntity, type Box, type GeometryContext } from "../registry.js";
import { parseScript } from "../script.js";
import type { Hull2Entity, Ifs2Entity, MandelbrotEntity, PolarPathEntity, SceneDoc } from "../types.js";
import { baseEntity, strokeWidthModifier } from "./base.js";

export const IFS2_CANVAS_POINT_CAP = 1_200;
export const IFS2_CANVAS_SEGMENT_CAP = 1_500;
export const MANDELBROT_CANVAS_COLUMN_CAP = 56;
export const MANDELBROT_CANVAS_ROW_CAP = 72;
export const POLARPATH_CANVAS_POINT_CAP = 2_000;

interface Affine { a: number; b: number; c: number; d: number; e: number; f: number; weight: number; }
interface Point { x: number; y: number; }
export interface Ifs2Sample extends Point { rule: number; }
export interface Ifs2Geometry { mode: "points" | "segments"; points: Ifs2Sample[]; segments: { from: Point; to: Point; rule: number }[]; total: number; issue: string | null; bounds: Box; }
export interface MandelbrotCell { x: number; y: number; width: number; height: number; escape: number; }
export interface MandelbrotGeometry { cells: MandelbrotCell[]; nativeCells: number; bounds: Box; }
export interface PolarPathGeometry { points: Point[]; nativePoints: number; issue: string | null; bounds: Box; }
export interface Hull2Geometry { points: Point[]; sourcePoints: number; issue: string | null; bounds: Box; }

const box = (x: number, y: number, width: number, height: number): Box => ({ x: x - width / 2, y: y - height / 2, width, height });
const pointBox = (points: readonly Point[], fallback: Box): Box => {
  if (points.length === 0) return fallback;
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
};

function formulaExpression(raw: string): ExprNode | null {
  try {
    const parsed = parseScript(`let value = ${raw};`);
    const statement = parsed.statements[0];
    return parsed.unsupported.length === 0 && parsed.statements.length === 1 && statement?.kind === "let" ? statement.expr : null;
  } catch { return null; }
}

function parseAffines(raw: string): Affine[] | null {
  const rules: Affine[] = [];
  for (const text of raw.split(";").map((part) => part.trim()).filter(Boolean)) {
    const values = text.split(/\s+/u).map(Number);
    if (values.length !== 7 || values.some((value) => !Number.isFinite(value)) || values[6] < 0) return null;
    rules.push({ a: values[0], b: values[1], c: values[2], d: values[3], e: values[4], f: values[5], weight: values[6] });
  }
  if (rules.length < 1 || rules.length > 12) return null;
  const total = rules.reduce((sum, rule) => sum + rule.weight, 0);
  if (total <= 1e-6) return null;
  return rules.map((rule) => ({ ...rule, weight: rule.weight / total }));
}

function parseIfsOptions(raw: string | null): { mode: "points" | "segments"; burn: number; depth: number } | null {
  const parsed = { mode: "points" as "points" | "segments", burn: 100, depth: 6 };
  for (const token of (raw ?? "").split(/\s+/u).filter(Boolean)) {
    const [key, value, extra] = token.split("=");
    if (!key || value === undefined || extra !== undefined) return null;
    if (key === "mode" && (value === "points" || value === "segments")) parsed.mode = value;
    else if (key === "burn" && /^\d+$/u.test(value)) parsed.burn = Math.min(10_000, Number(value));
    else if (key === "depth" && /^\d+$/u.test(value) && Number(value) >= 1 && Number(value) <= 10) parsed.depth = Number(value);
    else return null;
  }
  return parsed;
}

function random(seed: number): () => number {
  const mask = (1n << 64n) - 1n;
  let state = BigInt(Math.max(1, Math.round(seed) + 1)) & mask;
  return () => {
    let value = state;
    value ^= value >> 12n; value ^= (value << 25n) & mask; value ^= value >> 27n;
    state = value & mask;
    const mixed = (state * 0x2545_f491_4f6c_dd1dn) & mask;
    return Number(mixed >> 40n) / 2 ** 24;
  };
}

function apply(rule: Affine, point: Point): Point {
  return { x: rule.a * point.x + rule.b * point.y + rule.e, y: rule.c * point.x + rule.d * point.y + rule.f };
}

function fitted(points: readonly Point[], entity: Ifs2Entity): Point[] {
  if (points.length === 0) return [];
  const bounds = pointBox(points, box(0, 0, 1, 1));
  const scale = Math.min(entity.width / Math.max(1e-5, bounds.width), entity.height / Math.max(1e-5, bounds.height));
  const middle = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  return points.map((point) => ({ x: entity.x + (point.x - middle.x) * scale, y: entity.y - (point.y - middle.y) * scale }));
}

export function ifs2Geometry(entity: Ifs2Entity): Ifs2Geometry {
  const bounds = box(entity.x, entity.y, entity.width, entity.height);
  const rules = parseAffines(entity.rules), options = parseIfsOptions(entity.options);
  if (!rules || !options) return { mode: options?.mode ?? "points", points: [], segments: [], total: 0, issue: !rules ? "Each affine rule needs a b c d e f weight." : "Options use mode, burn, and depth.", bounds };
  if (options.mode === "points") {
    const shown = Math.min(Math.max(1, Math.floor(entity.count)), IFS2_CANVAS_POINT_CAP), next = random(entity.seed);
    const raw: Ifs2Sample[] = [];
    let point: Point = { x: 0, y: 0 };
    for (let iteration = 0; iteration < shown + options.burn; iteration += 1) {
      const choice = next(); let cumulative = 0, selected = rules.length - 1;
      for (let index = 0; index < rules.length; index += 1) { cumulative += rules[index].weight; if (choice <= cumulative) { selected = index; break; } }
      point = apply(rules[selected], point);
      if (iteration >= options.burn) raw.push({ ...point, rule: selected });
    }
    const placed = fitted(raw, entity).map((point, index) => ({ ...point, rule: raw[index].rule }));
    return { mode: "points", points: placed, segments: [], total: Math.floor(entity.count), issue: null, bounds };
  }
  const total = Math.round(rules.length ** options.depth), shown = Math.min(total, IFS2_CANVAS_SEGMENT_CAP);
  if (total > 200_000) return { mode: "segments", points: [], segments: [], total, issue: "Segment expansion exceeds Manic's 200,000 limit; reduce depth or rules.", bounds };
  const ordinals = Array.from({ length: shown }, (_unused, index) => Math.min(total - 1, Math.floor(index * total / shown)));
  const raw = ordinals.map((ordinal) => {
    const digits = Array(options.depth).fill(0); let value = ordinal;
    for (let at = options.depth - 1; at >= 0; at -= 1) { digits[at] = value % rules.length; value = Math.floor(value / rules.length); }
    let from: Point = { x: 0, y: 0 }, to: Point = { x: 0, y: 1 };
    for (const digit of digits) { from = apply(rules[digit], from); to = apply(rules[digit], to); }
    return { from, to, rule: digits.at(-1) ?? 0 };
  });
  const placed = fitted(raw.flatMap((segment) => [segment.from, segment.to]), entity);
  return { mode: "segments", points: [], segments: raw.map((segment, index) => ({ from: placed[index * 2], to: placed[index * 2 + 1], rule: segment.rule })), total, issue: null, bounds };
}

export function mandelbrotGeometry(entity: MandelbrotEntity): MandelbrotGeometry {
  const columns = Math.min(Math.max(8, Math.round(entity.columns ?? 240)), MANDELBROT_CANVAS_COLUMN_CAP);
  const rows = Math.min(MANDELBROT_CANVAS_ROW_CAP, Math.max(16, Math.round(columns * entity.height / Math.max(1, entity.width))));
  const left = entity.x - entity.width / 2, top = entity.y - entity.height / 2;
  const cells: MandelbrotCell[] = [];
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const cx = entity.xMin + (entity.xMax - entity.xMin) * column / Math.max(1, columns - 1);
    const cy = entity.yMax - (entity.yMax - entity.yMin) * row / Math.max(1, rows - 1);
    let zx = 0, zy = 0, escaped = -1;
    for (let iteration = 0; iteration < Math.floor(entity.iterations); iteration += 1) {
      const nextX = zx * zx - zy * zy + cx;
      zy = 2 * zx * zy + cy; zx = nextX;
      if (zx * zx + zy * zy > 16) { escaped = iteration / Math.max(1, entity.iterations); break; }
    }
    cells.push({ x: left + column * entity.width / columns, y: top + row * entity.height / rows, width: entity.width / columns + .5, height: entity.height / rows + .5, escape: escaped });
  }
  const nativeColumns = Math.round(entity.columns ?? 240), nativeRows = Math.max(16, Math.min(600, Math.round(nativeColumns * entity.height / entity.width)));
  return { cells, nativeCells: nativeColumns * nativeRows, bounds: box(entity.x, entity.y, entity.width, entity.height) };
}

export function polarPathGeometry(entity: PolarPathEntity): PolarPathGeometry {
  const fallback = box(entity.x, entity.y, entity.scale * 2, entity.scale * 2);
  const expression = formulaExpression(entity.formula);
  if (!expression) return { points: [], nativePoints: 0, issue: "The polar formula could not be evaluated by Canvas.", bounds: fallback };
  const native = Math.max(16, Math.floor(entity.samples ?? 720)), shown = Math.min(native, POLARPATH_CANVAS_POINT_CAP), points: Point[] = [];
  for (let index = 0; index < shown; index += 1) {
    const t = entity.start + (entity.end - entity.start) * index / Math.max(1, shown - 1);
    try {
      const r = evalExpr(expression, new Map([...Object.entries(CONSTANTS), ["t", t]])) * entity.scale;
      const point = { x: entity.x + r * Math.cos(t), y: entity.y - r * Math.sin(t) };
      if (Number.isFinite(point.x) && Number.isFinite(point.y)) points.push(point);
    } catch { /* Native Preview remains the formula authority. */ }
  }
  if ((entity.closed ?? 1) !== 0 && points.length) points.push(points[0]);
  return { points, nativePoints: native + Number((entity.closed ?? 1) !== 0), issue: points.length > 1 ? null : "The formula produced no visible Canvas points.", bounds: pointBox(points, fallback) };
}

function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y).filter((point, index, all) => index === 0 || Math.hypot(point.x - all[index - 1].x, point.y - all[index - 1].y) > 1e-4);
  if (sorted.length < 3) return sorted;
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (source: Point[]) => { const out: Point[] = []; for (const point of source) { while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], point) <= 0) out.pop(); out.push(point); } return out; };
  const lower = half(sorted), upper = half([...sorted].reverse()); lower.pop(); upper.pop(); return [...lower, ...upper];
}

export function hull2Geometry(entity: Hull2Entity, doc?: SceneDoc): Hull2Geometry {
  const source = doc?.entities.find((candidate): candidate is Ifs2Entity => candidate.id === entity.cloud && candidate.kind === "ifs2");
  const fallback = source ? box(source.x, source.y, source.width, source.height) : box(0, 0, 220, 120);
  if (!source) return { points: [], sourcePoints: 0, issue: `Missing ifs2 cloud ${entity.cloud}.`, bounds: fallback };
  const cloud = ifs2Geometry(source);
  if (cloud.mode !== "points" || cloud.points.length < 3) return { points: [], sourcePoints: cloud.points.length, issue: "Hull needs an ifs2 point cloud in points mode.", bounds: fallback };
  let remaining: Point[] = cloud.points, hull: Point[] = [];
  for (let layer = 0; layer <= Math.floor(entity.depth ?? 0); layer += 1) {
    hull = convexHull(remaining);
    if (hull.length < 3) break;
    remaining = remaining.filter((point) => !hull.some((boundary) => Math.hypot(point.x - boundary.x, point.y - boundary.y) < 1e-3));
  }
  if (hull.length < 3) return { points: [], sourcePoints: cloud.points.length, issue: "Hull depth leaves fewer than three sampled points.", bounds: fallback };
  const shift = Math.max(0, Math.round(entity.pivot ?? 0)) % hull.length;
  hull = [...hull.slice(shift), ...hull.slice(0, shift), hull[shift]];
  return { points: hull, sourcePoints: cloud.points.length, issue: null, bounds: pointBox(hull, fallback) };
}

registerEntity<Ifs2Entity>({
  kind: "ifs2", ctor: "ifs2", anchorArgIndex: 1, group: "Generative", label: "Affine IFS", icon: "⁙ƒ", order: 75, fidelity: "semantic",
  hint: `A deterministic affine fractal; Canvas shows at most ${IFS2_CANVAS_POINT_CAP.toLocaleString()} points`,
  create: (id, x, y) => ({ ...baseEntity(id, "lime"), nativePaint: true, kind: "ifs2", x, y, width: 360, height: 500, count: 30_000, seed: 7, rules: "0 0 0 .16 0 0 .01; .85 .04 -.04 .85 0 1.6 .85; .2 -.26 .23 .22 0 1.6 .07; -.15 .28 .26 .24 0 .44 .07", options: null }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), center = argPoint(stmt.args, 1), size = argPoint(stmt.args, 2), count = argNumber(stmt.args, 3), seed = argNumber(stmt.args, 4), rules = argString(stmt.args, 5), options = argString(stmt.args, 6);
    const affine = rules === null ? null : parseAffines(rules), parsedOptions = parseIfsOptions(options);
    if (!id || !center || !size || count === null || seed === null || rules === null || stmt.args.length < 6 || stmt.args.length > 7 || size.x <= 0 || size.y <= 0 || count < 1 || count > 500_000 || !Number.isInteger(count) || seed < 0 || !affine || !parsedOptions || (parsedOptions.mode === "segments" && affine.length ** parsedOptions.depth > 200_000)) return null;
    return { ...baseEntity(id, "lime"), nativePaint: true, kind: "ifs2", x: center.x, y: center.y, width: size.x, height: size.y, count, seed, rules, options };
  },
  ctorLine: (entity) => `ifs2(${entity.id}, ${pt(entity.x, entity.y)}, ${pt(entity.width, entity.height)}, ${Math.floor(entity.count)}, ${num(entity.seed)}, "${escapeString(entity.rules)}"${entity.options === null ? "" : `, "${escapeString(entity.options)}"`});`, extraLines: () => [], modifiers: {},
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; }, bounds: (entity) => box(entity.x, entity.y, entity.width, entity.height),
  handles: (entity) => [{ name: "size", x: entity.x + entity.width / 2, y: entity.y + entity.height / 2 }], dragHandle(entity, _handle, px, py) { entity.width = Math.max(20, Math.round(Math.abs(px - entity.x) * 2)); entity.height = Math.max(20, Math.round(Math.abs(py - entity.y) * 2)); },
  fields: [{ key: "width", label: "Field width", input: "number", min: 1 }, { key: "height", label: "Field height", input: "number", min: 1 }, { key: "count", label: "Native elements", input: "number", min: 1, max: 500_000, step: 1, hint: `Canvas is capped at ${IFS2_CANVAS_POINT_CAP.toLocaleString()}; Preview uses the full count.` }, { key: "seed", label: "Seed", input: "number", min: 0, step: 1 }, { key: "rules", label: "Affine rules", input: "textarea", hint: "One a b c d e f weight rule per semicolon; 1–12 rules." }, { key: "options", label: "Options", input: "text", nullable: true, hint: "Optional mode=points|segments burn=N depth=N." }],
});

registerEntity<MandelbrotEntity>({
  kind: "mandelbrot", ctor: "mandelbrot", anchorArgIndex: 1, group: "Generative", label: "Mandelbrot field", icon: "M∞", order: 76, fidelity: "semantic",
  hint: `An escape-time field; Canvas uses at most ${MANDELBROT_CANVAS_COLUMN_CAP} columns`,
  create: (id, x, y) => ({ ...baseEntity(id, "fg"), nativePaint: true, kind: "mandelbrot", x, y, width: 520, height: 360, xMin: -2.25, xMax: .75, yMin: -1.3, yMax: 1.3, iterations: 64, columns: null }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), center = argPoint(stmt.args, 1), size = argPoint(stmt.args, 2), xr = argPoint(stmt.args, 3), yr = argPoint(stmt.args, 4), iterations = argNumber(stmt.args, 5), columns = argNumber(stmt.args, 6); if (!id || !center || !size || !xr || !yr || iterations === null || stmt.args.length < 6 || stmt.args.length > 7 || size.x <= 0 || size.y <= 0 || xr.y <= xr.x || yr.y <= yr.x || !Number.isInteger(iterations) || iterations < 4 || iterations > 500 || (stmt.args.length === 7 && (columns === null || !Number.isInteger(columns) || columns < 32 || columns > 600))) return null; return { ...baseEntity(id, "fg"), nativePaint: true, kind: "mandelbrot", x: center.x, y: center.y, width: size.x, height: size.y, xMin: xr.x, xMax: xr.y, yMin: yr.x, yMax: yr.y, iterations, columns }; },
  ctorLine: (entity) => `mandelbrot(${entity.id}, ${pt(entity.x, entity.y)}, ${pt(entity.width, entity.height)}, ${pt(entity.xMin, entity.xMax)}, ${pt(entity.yMin, entity.yMax)}, ${Math.floor(entity.iterations)}${entity.columns === null ? "" : `, ${Math.floor(entity.columns)}`});`, extraLines: () => [], modifiers: {},
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; }, bounds: (entity) => box(entity.x, entity.y, entity.width, entity.height),
  handles: (entity) => [{ name: "size", x: entity.x + entity.width / 2, y: entity.y + entity.height / 2 }], dragHandle(entity, _handle, px, py) { entity.width = Math.max(20, Math.round(Math.abs(px - entity.x) * 2)); entity.height = Math.max(20, Math.round(Math.abs(py - entity.y) * 2)); },
  fields: [{ key: "width", label: "Field width", input: "number", min: 1 }, { key: "height", label: "Field height", input: "number", min: 1 }, { key: "xMin", label: "X minimum", input: "number", step: .01 }, { key: "xMax", label: "X maximum", input: "number", step: .01 }, { key: "yMin", label: "Y minimum", input: "number", step: .01 }, { key: "yMax", label: "Y maximum", input: "number", step: .01 }, { key: "iterations", label: "Iterations", input: "number", min: 4, max: 500, step: 1 }, { key: "columns", label: "Native columns", input: "number", nullable: true, min: 32, max: 600, step: 1, hint: `Empty uses 240. Canvas stays at ${MANDELBROT_CANVAS_COLUMN_CAP} or fewer.` }],
});

registerEntity<PolarPathEntity>({
  kind: "polarpath", ctor: "polarpath", anchorArgIndex: 1, group: "Generative", label: "Polar formula path", icon: "rθ", order: 77, fidelity: "semantic",
  hint: `A sampled r(t) curve; Canvas evaluates at most ${POLARPATH_CANVAS_POINT_CAP.toLocaleString()} points`,
  create: (id, x, y) => ({ ...baseEntity(id, "cyan"), kind: "polarpath", x, y, scale: 110, formula: "1 + 0.35*cos(5*t)", start: 0, end: Math.PI * 2, samples: null, closed: null, strokeWidth: null }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), center = argPoint(stmt.args, 1), scale = argNumber(stmt.args, 2), formula = argString(stmt.args, 3), range = argPoint(stmt.args, 4), samples = argNumber(stmt.args, 5), closed = argNumber(stmt.args, 6); if (!id || !center || scale === null || formula === null || !range || stmt.args.length < 5 || stmt.args.length > 7 || scale <= 0 || range.y <= range.x || (stmt.args.length >= 6 && (samples === null || !Number.isInteger(samples) || samples < 16 || samples > 20_000)) || (stmt.args.length === 7 && closed === null) || !formulaExpression(formula)) return null; return { ...baseEntity(id, "cyan"), kind: "polarpath", x: center.x, y: center.y, scale, formula, start: range.x, end: range.y, samples, closed, strokeWidth: null }; },
  ctorLine: (entity) => `polarpath(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.scale)}, "${escapeString(entity.formula)}", ${pt(entity.start, entity.end)}${entity.samples === null ? "" : `, ${Math.floor(entity.samples)}${entity.closed === null ? "" : `, ${num(entity.closed)}`}`});`, extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`], modifiers: { stroke: strokeWidthModifier },
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; }, bounds: (entity) => polarPathGeometry(entity).bounds,
  handles: (entity) => [{ name: "scale", x: entity.x + entity.scale, y: entity.y }], dragHandle(entity, _handle, px, py) { entity.scale = Math.max(1, Math.round(Math.hypot(px - entity.x, py - entity.y))); },
  fields: [{ key: "scale", label: "Radial scale", input: "range", min: 1, max: 800, step: 1 }, { key: "formula", label: "r(t) formula", input: "textarea" }, { key: "start", label: "Range start", input: "number", step: .01 }, { key: "end", label: "Range end", input: "number", step: .01 }, { key: "samples", label: "Native samples", input: "number", nullable: true, min: 16, max: 20_000, step: 1 }, { key: "closed", label: "Closed (0/1)", input: "number", nullable: true, min: 0, max: 1, step: 1 }, { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }],
});

registerEntity<Hull2Entity>({
  kind: "hull2", ctor: "hull2", group: "Generative", label: "Point-cloud hull", icon: "⬡", order: 78, fidelity: "semantic", movable: false,
  hint: "An onion-depth convex hull derived from an earlier ifs2 point cloud",
  canCreate: (doc) => doc.entities.some((entity) => entity.kind === "ifs2"), createBlockedReason: "Add an affine IFS in points mode before creating its hull.",
  create(id, _x, _y, doc, selectedId) { const cloud = preferReference(doc, selectedId, (entity) => entity.kind === "ifs2")?.id ?? doc?.entities.find((entity) => entity.kind === "ifs2")?.id ?? "cloud"; return { ...baseEntity(id, "cyan"), kind: "hull2", cloud, depth: null, pivot: null, strokeWidth: null }; },
  parseArgs(stmt, doc) { const id = argName(stmt.args, 0), cloud = argName(stmt.args, 1), depth = argNumber(stmt.args, 2), pivot = argNumber(stmt.args, 3); if (!id || !cloud || stmt.args.length < 2 || stmt.args.length > 4 || (stmt.args.length >= 3 && (depth === null || !Number.isInteger(depth) || depth < 0 || depth > 32)) || (stmt.args.length === 4 && pivot === null) || (doc && !doc.entities.some((entity) => entity.id === cloud && entity.kind === "ifs2"))) return null; return { ...baseEntity(id, "cyan"), kind: "hull2", cloud, depth, pivot, strokeWidth: null }; },
  ctorLine: (entity) => `hull2(${entity.id}, ${entity.cloud}${entity.depth === null ? "" : `, ${Math.floor(entity.depth)}${entity.pivot === null ? "" : `, ${num(entity.pivot)}`}`});`, extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`], modifiers: { stroke: strokeWidthModifier },
  references: (entity) => [entity.cloud], replaceReference(entity, from, to) { if (entity.cloud === from) entity.cloud = to; },
  anchor(entity, ctx) { const bounds = hull2Geometry(entity, ctx?.doc).bounds; return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }; }, translate() {}, bounds: (entity, ctx) => hull2Geometry(entity, ctx?.doc).bounds, handles: () => [], dragHandle() {},
  fields: [{ key: "cloud", label: "IFS point cloud", input: "entity", entityKinds: ["ifs2"], referencesEarlierOnly: true }, { key: "depth", label: "Onion depth", input: "number", nullable: true, min: 0, max: 32, step: 1 }, { key: "pivot", label: "Path pivot", input: "number", nullable: true, min: 0, step: 1 }, { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }],
});
