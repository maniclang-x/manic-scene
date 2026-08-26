// Coordinate frames and live Euclidean constructions. These definitions keep
// Manic's value-space and dependency semantics editable without pretending the
// Canvas is the native renderer.

import { argName, argNumber, argPoint, argString, escapeString, num, pt } from "../args.js";
import { defFor, preferReference, registerEntity, type Box, type FieldSpec, type GeometryContext } from "../registry.js";
import type { CallStatement } from "../script.js";
import type {
  AngleMarkEntity, AxesEntity, AxisTickEntity, Circle2Entity, CoordsEntity, EllipseEntity,
  CommonTangentEntity, FullLineEntity, GeoCircleEntity, GeoDerivedPointEntity, GeoDerivedPointKind,
  GeoIntersectionEntity, HyperbolaEntity, MidpointEntity, ParabolaEntity, PointEntity,
  RightAngleEntity, SceneDoc, SceneEntity, SegmentEntity, VectorEntity,
} from "../types.js";
import { baseEntity, strokeWidthModifier } from "./base.js";

export interface ScreenPoint { x: number; y: number; }
export interface AngleMarkGeometry {
  vertex: ScreenPoint;
  start: ScreenPoint;
  end: ScreenPoint;
  label: ScreenPoint;
  path: string;
  sweep: number;
}

const POINT_KINDS = ["point", "midpoint", "centroid", "circumcenter", "incenter", "orthocenter", "foot", "meet", "reflect", "bisector", "rotpoint", "between", "anglepoint"] as const;
const POINT_PAIR_KINDS = ["linecircle", "circlecircle"] as const;
const POINT_CHILD_OWNER_KINDS = [...POINT_PAIR_KINDS, "commontangent", "tangent"] as const;
const POINT_FIELD_KINDS = [...POINT_KINDS, ...POINT_CHILD_OWNER_KINDS] as const;
const POINT_KIND_SET = new Set<string>(POINT_KINDS);
const textLiteral = (value: string) => `"${escapeString(value)}"`;
const centerOf = (box: Box): ScreenPoint => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
const atLeastOne = (value: number) => Math.max(1, Math.abs(value));
const round = (value: number, places = 3) => Math.round(value * 10 ** places) / 10 ** places;

export function geoPointReferences(doc?: SceneDoc): string[] {
  return doc?.entities.flatMap((entity) => {
    if (POINT_KIND_SET.has(entity.kind) && entity.origin !== "generated") return [entity.id];
    if ((POINT_PAIR_KINDS as readonly string[]).includes(entity.kind)) return [`${entity.id}0`, `${entity.id}1`];
    if (entity.kind === "commontangent") return [`${entity.id}.a`, `${entity.id}.b`];
    if (entity.kind === "tangent" && entity.mode === "circle") return [`${entity.id}0`, `${entity.id}1`];
    return [];
  }) ?? [];
}

const pointReferenceOptions = geoPointReferences;

function localGeometryContext(doc: SceneDoc): GeometryContext {
  const resolving = new Set<string>();
  const context: GeometryContext = {
    doc,
    entity: (ref) => doc.entities.find((entity) => entity.id === ref),
    bounds(ref) {
      if (resolving.has(ref)) return null;
      resolving.add(ref);
      const boxes: Box[] = [];
      for (const entity of doc.entities) {
        const def = defFor(entity);
        if (entity.id === ref || entity.tags?.includes(ref)) boxes.push(def.bounds(entity, context));
        else { const box = def.referenceBounds?.(entity, ref, context); if (box) boxes.push(box); }
      }
      resolving.delete(ref);
      if (boxes.length === 0) return null;
      const left = Math.min(...boxes.map((box) => box.x)), top = Math.min(...boxes.map((box) => box.y));
      const right = Math.max(...boxes.map((box) => box.x + box.width)), bottom = Math.max(...boxes.map((box) => box.y + box.height));
      return { x: left, y: top, width: right - left, height: bottom - top };
    },
  };
  return context;
}

function pairReferences(doc?: SceneDoc, selectedId?: string): [string, string] {
  const pool = pointReferenceOptions(doc);
  const selected = selectedId && pool.includes(selectedId) ? selectedId : pool.at(-1);
  const other = [...pool].reverse().find((id) => id !== selected);
  return [selected ?? "A", other ?? "B"];
}

function tripleReferences(doc?: SceneDoc, selectedId?: string): [string, string, string] {
  const pool = pointReferenceOptions(doc);
  const selected = selectedId && pool.includes(selectedId) ? selectedId : null;
  if (selected) {
    const others = [...pool].reverse().filter((id) => id !== selected).slice(0, 2);
    return [others[0] ?? "A", selected, others[1] ?? "C"];
  }
  const last = pool.slice(-3);
  return [last[0] ?? "A", last[1] ?? "B", last[2] ?? "C"];
}

function referenceSet(count: number, doc?: SceneDoc, selectedId?: string): string[] {
  const pool = pointReferenceOptions(doc), selected = selectedId && pool.includes(selectedId) ? selectedId : null;
  const ordered = selected ? [selected, ...[...pool].reverse().filter((id) => id !== selected)] : [...pool].reverse();
  return Array.from({ length: count }, (_unused, index) => ordered[index] ?? String.fromCharCode(65 + index));
}

export function geoPointField(key: string, label: string): FieldSpec {
  return { key, label, input: "entity", entityKinds: POINT_FIELD_KINDS, includeChildren: true, childrenOnlyKinds: POINT_CHILD_OWNER_KINDS, hint: "This construction follows the referenced point when it moves." };
}

const pointField = geoPointField;

function referencePoint(ref: string, ctx?: GeometryContext, visiting = new Set<string>()): ScreenPoint {
  if (!ctx || visiting.has(ref)) return { x: 0, y: 0 };
  visiting.add(ref);
  const entity = ctx.entity(ref);
  if (!entity) {
    visiting.delete(ref);
    const box = ctx.bounds(ref);
    return box ? centerOf(box) : { x: 0, y: 0 };
  }
  let point: ScreenPoint;
  if (entity.kind === "point") point = { x: entity.x, y: entity.y };
  else if (entity.kind === "midpoint") {
    const a = referencePoint(entity.a, ctx, visiting), b = referencePoint(entity.b, ctx, visiting);
    point = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  } else point = defFor(entity).anchor(entity, ctx);
  visiting.delete(ref);
  return point;
}

export function geometryPoint(ref: string, ctx?: GeometryContext): ScreenPoint {
  return referencePoint(ref, ctx);
}

export function segmentGeometry(entity: SegmentEntity, ctx?: GeometryContext): { from: ScreenPoint; to: ScreenPoint } {
  return { from: referencePoint(entity.from, ctx), to: referencePoint(entity.to, ctx) };
}

export function circle2Geometry(entity: Circle2Entity, ctx?: GeometryContext): { center: ScreenPoint; radius: number } {
  const center = referencePoint(entity.center, ctx), through = referencePoint(entity.through, ctx);
  return { center, radius: Math.max(1, Math.hypot(through.x - center.x, through.y - center.y)) };
}

export function midpointGeometry(entity: MidpointEntity, ctx?: GeometryContext): ScreenPoint {
  const a = referencePoint(entity.a, ctx), b = referencePoint(entity.b, ctx);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function normalize(x: number, y: number): ScreenPoint {
  const length = Math.hypot(x, y);
  return length < 1e-6 ? { x: 1, y: 0 } : { x: x / length, y: y / length };
}

export function angleMarkGeometry(entity: AngleMarkEntity, ctx?: GeometryContext): AngleMarkGeometry {
  const a = referencePoint(entity.a, ctx), vertex = referencePoint(entity.b, ctx), c = referencePoint(entity.c, ctx);
  const da = normalize(a.x - vertex.x, a.y - vertex.y), dc = normalize(c.x - vertex.x, c.y - vertex.y);
  const startAngle = Math.atan2(da.y, da.x);
  const endAngle = Math.atan2(dc.y, dc.x);
  let sweep = endAngle - startAngle;
  while (sweep <= -Math.PI) sweep += Math.PI * 2;
  while (sweep > Math.PI) sweep -= Math.PI * 2;
  const radius = 26;
  const start = { x: vertex.x + da.x * radius, y: vertex.y + da.y * radius };
  const end = { x: vertex.x + dc.x * radius, y: vertex.y + dc.y * radius };
  const sum = { x: da.x + dc.x, y: da.y + dc.y };
  const bisector = Math.hypot(sum.x, sum.y) < 1e-4 ? { x: -da.y, y: da.x } : normalize(sum.x, sum.y);
  const label = { x: vertex.x + bisector.x * 46, y: vertex.y + bisector.y * 46 };
  const path = `M ${num(start.x)} ${num(start.y)} A ${radius} ${radius} 0 0 ${sweep >= 0 ? 1 : 0} ${num(end.x)} ${num(end.y)}`;
  return { vertex, start, end, label, path, sweep: sweep * 180 / Math.PI };
}

export function rightAnglePoints(entity: RightAngleEntity, ctx?: GeometryContext): ScreenPoint[] {
  const a = referencePoint(entity.a, ctx), b = referencePoint(entity.b, ctx), c = referencePoint(entity.c, ctx);
  const u = normalize(a.x - b.x, a.y - b.y), v = normalize(c.x - b.x, c.y - b.y);
  const size = 16;
  return [
    { x: b.x + u.x * size, y: b.y + u.y * size },
    { x: b.x + (u.x + v.x) * size, y: b.y + (u.y + v.y) * size },
    { x: b.x + v.x * size, y: b.y + v.y * size },
  ];
}

export function axisTickGeometry(entity: AxisTickEntity, ctx?: GeometryContext): { markFrom: ScreenPoint; markTo: ScreenPoint; label: ScreenPoint } {
  const frame = ctx?.entity(entity.coords);
  if (!frame || frame.kind !== "coords") return { markFrom: { x: 0, y: -6 }, markTo: { x: 0, y: 6 }, label: { x: 0, y: 22 } };
  if (entity.kind === "xtick") {
    const x = frame.x + entity.value * frame.sx;
    return { markFrom: { x, y: frame.y - 6 }, markTo: { x, y: frame.y + 6 }, label: { x, y: frame.y + 22 } };
  }
  const y = frame.y - entity.value * frame.sy;
  return { markFrom: { x: frame.x - 6, y }, markTo: { x: frame.x + 6, y }, label: { x: frame.x - 22, y } };
}

export function coordsAxisValues(low: number, high: number, step: number, cap = 240): number[] {
  const interval = Math.max(1e-3, Math.abs(step));
  const values: number[] = [];
  let value = Math.ceil(low / interval) * interval;
  for (let guard = 0; value <= high + 1e-4 && guard < cap; guard += 1, value += interval) {
    if (Math.abs(value) > 1e-6) values.push(round(value));
  }
  return values;
}

function pointsBox(points: ScreenPoint[], padding = 0): Box {
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  const left = Math.min(...xs), top = Math.min(...ys), right = Math.max(...xs), bottom = Math.max(...ys);
  return { x: left - padding, y: top - padding, width: Math.max(1, right - left + padding * 2), height: Math.max(1, bottom - top + padding * 2) };
}

function childRevealLine(id: string, reveal: PointEntity["labelReveal"]): string | null {
  if (reveal === "fade") return `hidden(${id});`;
  if (reveal === "grow") return `hidden(${id}, center);`;
  return null;
}

function applyLabelModifier(target: { labelSize: number; labelColor: string; labelReveal: PointEntity["labelReveal"] }, stmt: CallStatement): boolean {
  if (stmt.name === "size") {
    const value = argNumber(stmt.args, 1);
    if (value === null) return false;
    target.labelSize = value;
    return true;
  }
  if (stmt.name === "color") {
    const value = argName(stmt.args, 1);
    if (!value) return false;
    target.labelColor = value;
    return true;
  }
  if (stmt.name === "hidden") {
    target.labelReveal = argName(stmt.args, 1) === "center" ? "grow" : "fade";
    return true;
  }
  return false;
}

// --- axes and value-space coordinate frames --------------------------------

registerEntity<AxesEntity>({
  kind: "axes", ctor: "axes", anchorArgIndex: 1, group: "Geometry", label: "Axes", icon: "↗", order: 27,
  hint: "A symmetric coordinate cross with optional integer ticks",
  create: (id, x, y) => ({ ...baseEntity(id, "dim"), kind: "axes", x, y, halfw: 260, halfh: 180, unit: 50 }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1), halfw = argNumber(stmt.args, 2), halfh = argNumber(stmt.args, 3);
    return id && at && halfw !== null && halfh !== null
      ? { ...baseEntity(id, "dim"), kind: "axes", x: at.x, y: at.y, halfw, halfh, unit: argNumber(stmt.args, 4) }
      : null;
  },
  ctorLine: (entity) => `axes(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.halfw)}, ${num(entity.halfh)}${entity.unit === null ? "" : `, ${num(entity.unit)}`});`,
  extraLines: () => [], modifiers: {}, referenceIds: (entity) => [`${entity.id}.x`, `${entity.id}.y`],
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds: (entity) => ({ x: entity.x - entity.halfw - 30, y: entity.y - entity.halfh - 30, width: entity.halfw * 2 + 60, height: entity.halfh * 2 + 60 }),
  handles: (entity) => [{ name: "xextent", x: entity.x + entity.halfw, y: entity.y }, { name: "yextent", x: entity.x, y: entity.y - entity.halfh }],
  dragHandle(entity, handle, px, py) {
    if (handle === "xextent") entity.halfw = Math.max(20, Math.round(Math.abs(px - entity.x)));
    else entity.halfh = Math.max(20, Math.round(Math.abs(py - entity.y)));
  },
  fields: [
    { key: "halfw", label: "Half width", input: "number", min: 20 },
    { key: "halfh", label: "Half height", input: "number", min: 20 },
    { key: "unit", label: "Tick spacing", input: "number", nullable: true, min: 1, hint: "Manic draws integer ticks only when spacing is greater than 1 px." },
  ],
});

registerEntity<CoordsEntity>({
  kind: "coords", ctor: "coords", anchorArgIndex: 1, group: "Geometry", label: "Coordinate frame", icon: "↗xy", order: 28,
  hint: "Value-space ranges and scales that align with plots and custom ticks",
  create: (id, x, y) => ({ ...baseEntity(id, "fg"), kind: "coords", x, y, xmin: -5, xmax: 5, ymin: -3, ymax: 3, sx: 50, sy: 50, tips: true, step: 1, numbers: true, xname: null, yname: null }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1), xr = argPoint(stmt.args, 2), yr = argPoint(stmt.args, 3);
    const sx = argNumber(stmt.args, 4), sy = argNumber(stmt.args, 5);
    if (!id || !at || !xr || !yr || sx === null || sy === null) return null;
    return {
      ...baseEntity(id, "fg"), kind: "coords", x: at.x, y: at.y,
      xmin: xr.x, xmax: xr.y, ymin: yr.x, ymax: yr.y, sx, sy,
      tips: (argNumber(stmt.args, 6) ?? 1) !== 0,
      step: Math.max(1e-3, argNumber(stmt.args, 7) ?? 1),
      numbers: (argNumber(stmt.args, 8) ?? 1) !== 0,
      xname: argString(stmt.args, 9), yname: argString(stmt.args, 10),
    };
  },
  ctorLine(entity) {
    const base = `coords(${entity.id}, ${pt(entity.x, entity.y)}, ${pt(entity.xmin, entity.xmax)}, ${pt(entity.ymin, entity.ymax)}, ${num(entity.sx)}, ${num(entity.sy)}`;
    const hasNames = entity.xname !== null || entity.yname !== null;
    const hasNumbers = !entity.numbers || hasNames;
    const hasStep = entity.step !== 1 || hasNumbers;
    const hasTips = !entity.tips || hasStep;
    const tail: string[] = [];
    if (hasTips) tail.push(entity.tips ? "1" : "0");
    if (hasStep) tail.push(num(entity.step));
    if (hasNumbers) tail.push(entity.numbers ? "1" : "0");
    if (hasNames) tail.push(textLiteral(entity.xname ?? ""));
    if (entity.yname !== null) tail.push(textLiteral(entity.yname));
    return `${base}${tail.length ? `, ${tail.join(", ")}` : ""});`;
  },
  extraLines: () => [], modifiers: {},
  referenceIds(entity) {
    const ids = [`${entity.id}.xaxis`, `${entity.id}.yaxis`];
    coordsAxisValues(entity.xmin, entity.xmax, entity.step).forEach((_value, index) => { ids.push(`${entity.id}.xt${index}`); if (entity.numbers) ids.push(`${entity.id}.xn${index}`); });
    coordsAxisValues(entity.ymin, entity.ymax, entity.step).forEach((_value, index) => { ids.push(`${entity.id}.yt${index}`); if (entity.numbers) ids.push(`${entity.id}.yn${index}`); });
    if (entity.xname !== null) ids.push(`${entity.id}.xname`);
    if (entity.yname !== null) ids.push(`${entity.id}.yname`);
    return ids;
  },
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds(entity) {
    const left = entity.x + entity.xmin * entity.sx, right = entity.x + entity.xmax * entity.sx;
    const top = entity.y - entity.ymax * entity.sy, bottom = entity.y - entity.ymin * entity.sy;
    return { x: Math.min(left, right) - 34, y: Math.min(top, bottom) - 34, width: Math.abs(right - left) + 68, height: Math.abs(bottom - top) + 68 };
  },
  handles: (entity) => [
    { name: "xmax", x: entity.x + entity.xmax * entity.sx, y: entity.y },
    { name: "ymax", x: entity.x, y: entity.y - entity.ymax * entity.sy },
  ],
  dragHandle(entity, handle, px, py) {
    if (handle === "xmax") entity.xmax = round((px - entity.x) / Math.max(1e-3, entity.sx));
    else entity.ymax = round((entity.y - py) / Math.max(1e-3, entity.sy));
  },
  fields: [
    { key: "xmin", label: "X min", input: "number", step: .1 }, { key: "xmax", label: "X max", input: "number", step: .1 },
    { key: "ymin", label: "Y min", input: "number", step: .1 }, { key: "ymax", label: "Y max", input: "number", step: .1 },
    { key: "sx", label: "X scale (px/unit)", input: "number", min: .001, step: 1 }, { key: "sy", label: "Y scale (px/unit)", input: "number", min: .001, step: 1 },
    { key: "tips", label: "Arrow tips", input: "checkbox" }, { key: "step", label: "Tick step", input: "number", min: .001, step: .1 },
    { key: "numbers", label: "Automatic numbers", input: "checkbox" }, { key: "xname", label: "X-axis name", input: "text", nullable: true },
    { key: "yname", label: "Y-axis name", input: "text", nullable: true },
  ],
});

function registerAxisTick(kind: "xtick" | "ytick", order: number) {
  registerEntity<AxisTickEntity>({
    kind, ctor: kind, group: "Geometry", label: kind === "xtick" ? "X tick" : "Y tick", icon: kind === "xtick" ? "x│" : "y─", order,
    hint: "A custom label positioned by an axis value on a coordinate frame", movable: false,
    canCreate: (doc) => doc.entities.some((entity) => entity.kind === "coords"),
    createBlockedReason: "Add a Coordinate frame before adding a custom axis tick.",
    create(id, _x, _y, doc, selectedId) {
      const frame = preferReference(doc, selectedId, (entity) => entity.kind === "coords");
      return { ...baseEntity(id, "fg"), kind, coords: frame?.id ?? "coords", value: 1, text: null, size: 16, markColor: "fg", markWidth: null, markReveal: "none" };
    },
    parseArgs(stmt) {
      const id = argName(stmt.args, 0), coords = argName(stmt.args, 1), value = argNumber(stmt.args, 2);
      return id && coords && value !== null
        ? { ...baseEntity(id, "fg"), kind, coords, value, text: argString(stmt.args, 3), size: 16, markColor: "fg", markWidth: null, markReveal: "none" }
        : null;
    },
    ctorLine: (entity) => `${kind}(${entity.id}, ${entity.coords}, ${num(entity.value)}${entity.text === null ? "" : `, ${textLiteral(entity.text)}`});`,
    extraLines(entity) {
      const out: string[] = [];
      if (entity.size !== 16) out.push(`size(${entity.id}, ${num(entity.size)});`);
      if (entity.markColor !== "fg") out.push(`color(${entity.id}.mark, ${entity.markColor});`);
      if (entity.markWidth !== null) out.push(`stroke(${entity.id}.mark, ${num(entity.markWidth)});`);
      const reveal = childRevealLine(`${entity.id}.mark`, entity.markReveal);
      if (reveal) out.push(reveal);
      return out;
    },
    modifiers: {
      size(entity, stmt) { const value = argNumber(stmt.args, 1); if (value === null) return false; entity.size = value; return true; },
    },
    references: (entity) => [entity.coords], replaceReference(entity, from, to) { if (entity.coords === from) entity.coords = to; },
    referenceIds: (entity) => [`${entity.id}.mark`],
    referenceBounds(entity, ref, ctx) { if (ref !== `${entity.id}.mark`) return null; const g = axisTickGeometry(entity, ctx); return pointsBox([g.markFrom, g.markTo], 2); },
    applyReferenceModifier(entity, ref, stmt) {
      if (ref !== `${entity.id}.mark`) return false;
      if (stmt.name === "color") { const color = argName(stmt.args, 1); if (!color) return false; entity.markColor = color; return true; }
      if (stmt.name === "stroke") { const width = argNumber(stmt.args, 1); if (width === null) return false; entity.markWidth = width; return true; }
      if (stmt.name === "hidden") { entity.markReveal = argName(stmt.args, 1) === "center" ? "grow" : "fade"; return true; }
      return false;
    },
    anchor: (entity, ctx) => axisTickGeometry(entity, ctx).label, translate() {},
    bounds(entity, ctx) { const g = axisTickGeometry(entity, ctx); const width = Math.max(entity.size, (entity.text ?? num(entity.value)).length * entity.size * .62); return { x: g.label.x - width / 2, y: g.label.y - entity.size * .75, width, height: entity.size * 1.5 }; },
    handles: () => [], dragHandle() {},
    fields: [
      { key: "coords", label: "Coordinate frame", input: "entity", entityKinds: ["coords"] },
      { key: "value", label: "Axis value", input: "number", step: .1 },
      { key: "text", label: "Custom label", input: "text", nullable: true, hint: "Clear to let Manic format the numeric value." },
      { key: "size", label: "Label size", input: "range", min: 10, max: 48 },
    ],
  });
}

registerAxisTick("xtick", 29);
registerAxisTick("ytick", 29.1);

// --- free and dependent Euclidean geometry ---------------------------------

registerEntity<PointEntity>({
  kind: "point", ctor: "point", anchorArgIndex: 1, group: "Geometry", label: "Point", icon: "●", order: 34,
  hint: "A free geometry point with an optional addressable label",
  create: (id, x, y) => ({ ...baseEntity(id, "cyan"), kind: "point", x, y, label: null, labelSize: 22, labelColor: "fg", labelReveal: "none" }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1);
    return id && at ? { ...baseEntity(id, "cyan"), kind: "point", x: at.x, y: at.y, label: argString(stmt.args, 2), labelSize: 22, labelColor: "fg", labelReveal: "none" } : null;
  },
  ctorLine: (entity) => `point(${entity.id}, ${pt(entity.x, entity.y)}${entity.label === null ? "" : `, ${textLiteral(entity.label)}`});`,
  extraLines(entity) {
    if (entity.label === null) return [];
    const out: string[] = [];
    if (entity.labelSize !== 22) out.push(`size(${entity.id}.label, ${num(entity.labelSize)});`);
    if (entity.labelColor !== "fg") out.push(`color(${entity.id}.label, ${entity.labelColor});`);
    const reveal = childRevealLine(`${entity.id}.label`, entity.labelReveal);
    if (reveal) out.push(reveal);
    return out;
  },
  modifiers: {}, referenceIds: (entity) => entity.label === null ? [] : [`${entity.id}.label`],
  referenceBounds(entity, ref) {
    if (entity.label === null || ref !== `${entity.id}.label`) return null;
    const width = Math.max(entity.labelSize, entity.label.length * entity.labelSize * .62);
    return { x: entity.x - width / 2, y: entity.y - 22 - entity.labelSize * .75, width, height: entity.labelSize * 1.5 };
  },
  applyReferenceModifier(entity, ref, stmt) { return ref === `${entity.id}.label` && entity.label !== null ? applyLabelModifier(entity, stmt) : false; },
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds(entity) {
    const dot = { x: entity.x - 7, y: entity.y - 7, width: 14, height: 14 };
    if (entity.label === null) return dot;
    const width = Math.max(entity.labelSize, entity.label.length * entity.labelSize * .62);
    const label = { x: entity.x - width / 2, y: entity.y - 22 - entity.labelSize * .75, width, height: entity.labelSize * 1.5 };
    const left = Math.min(dot.x, label.x), top = Math.min(dot.y, label.y), right = Math.max(dot.x + dot.width, label.x + label.width), bottom = Math.max(dot.y + dot.height, label.y + label.height);
    return { x: left, y: top, width: right - left, height: bottom - top };
  },
  handles: () => [], dragHandle() {},
  fields: [
    { key: "label", label: "Point label", input: "text", nullable: true, hint: "The optional label is addressable as {id}.label." },
    { key: "labelSize", label: "Label size", input: "range", min: 10, max: 72 },
  ],
});

registerEntity<SegmentEntity>({
  kind: "segment", ctor: "segment", group: "Geometry", label: "Segment", icon: "A—B", order: 35,
  hint: "A line that reflows when either endpoint point moves", movable: false,
  canCreate: (doc) => pointReferenceOptions(doc).length >= 2, createBlockedReason: "Segment needs at least two Point references.",
  create(id, _x, _y, doc, selectedId) { const [from, to] = pairReferences(doc, selectedId); return { ...baseEntity(id, "fg"), kind: "segment", from, to, strokeWidth: null }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), from = argName(stmt.args, 1), to = argName(stmt.args, 2); return id && from && to ? { ...baseEntity(id, "fg"), kind: "segment", from, to, strokeWidth: null } : null; },
  ctorLine: (entity) => `segment(${entity.id}, ${entity.from}, ${entity.to});`,
  extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`], modifiers: { stroke: strokeWidthModifier },
  references: (entity) => [entity.from, entity.to], replaceReference(entity, from, to) { if (entity.from === from) entity.from = to; if (entity.to === from) entity.to = to; },
  anchor(entity, ctx) { const g = segmentGeometry(entity, ctx); return { x: (g.from.x + g.to.x) / 2, y: (g.from.y + g.to.y) / 2 }; }, translate() {},
  bounds(entity, ctx) { const g = segmentGeometry(entity, ctx); return pointsBox([g.from, g.to]); }, handles: () => [], dragHandle() {},
  fields: [pointField("from", "From point"), pointField("to", "To point"), { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }],
});

registerEntity<VectorEntity>({
  kind: "vector", ctor: "vector", anchorArgIndex: 1, group: "Geometry", label: "Vector", icon: "⇢", order: 36,
  hint: "An arrow whose delta uses mathematical positive-Y", colorInCtor: true,
  create: (id, x, y) => ({ ...baseEntity(id, "magenta"), kind: "vector", x, y, dx: 140, dy: 80, strokeWidth: null }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), origin = argPoint(stmt.args, 1), delta = argPoint(stmt.args, 2);
    return id && origin && delta ? { ...baseEntity(id, argName(stmt.args, 3) ?? "magenta"), kind: "vector", x: origin.x, y: origin.y, dx: delta.x, dy: delta.y, strokeWidth: null } : null;
  },
  ctorLine: (entity) => `vector(${entity.id}, ${pt(entity.x, entity.y)}, ${pt(entity.dx, entity.dy)}${entity.color === "magenta" ? "" : `, ${entity.color}`});`,
  extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`], modifiers: { stroke: strokeWidthModifier },
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds: (entity) => pointsBox([{ x: entity.x, y: entity.y }, { x: entity.x + entity.dx, y: entity.y - entity.dy }]),
  handles: (entity) => [{ name: "tip", x: entity.x + entity.dx, y: entity.y - entity.dy }],
  dragHandle(entity, _handle, px, py) { entity.dx = Math.round(px - entity.x); entity.dy = Math.round(entity.y - py); },
  fields: [
    { key: "dx", label: "Δx", input: "number", step: 1 }, { key: "dy", label: "Δy (up)", input: "number", step: 1 },
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 },
  ],
});

registerEntity<EllipseEntity>({
  kind: "ellipse", ctor: "ellipse", anchorArgIndex: 1, group: "Geometry", label: "Ellipse", icon: "⬭", order: 37,
  hint: "An outlined ellipse with constructor-local rotation",
  create: (id, x, y) => ({ ...baseEntity(id, "magenta"), kind: "ellipse", x, y, rx: 130, ry: 75, angle: 0, strokeWidth: null }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), center = argPoint(stmt.args, 1), rx = argNumber(stmt.args, 2), ry = argNumber(stmt.args, 3);
    return id && center && rx !== null && ry !== null ? { ...baseEntity(id, "magenta"), kind: "ellipse", x: center.x, y: center.y, rx, ry, angle: argNumber(stmt.args, 4) ?? 0, strokeWidth: null } : null;
  },
  ctorLine: (entity) => `ellipse(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.rx)}, ${num(entity.ry)}${entity.angle ? `, ${num(entity.angle)}` : ""});`,
  extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`], modifiers: { stroke: strokeWidthModifier },
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds(entity) {
    const angle = entity.angle * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const ex = Math.sqrt(entity.rx ** 2 * c ** 2 + entity.ry ** 2 * s ** 2), ey = Math.sqrt(entity.rx ** 2 * s ** 2 + entity.ry ** 2 * c ** 2);
    return { x: entity.x - ex, y: entity.y - ey, width: ex * 2, height: ey * 2 };
  },
  handles(entity) {
    const angle = entity.angle * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    return [{ name: "rx", x: entity.x + entity.rx * c, y: entity.y + entity.rx * s }, { name: "ry", x: entity.x - entity.ry * s, y: entity.y + entity.ry * c }];
  },
  dragHandle(entity, handle, px, py) {
    const angle = entity.angle * Math.PI / 180, dx = px - entity.x, dy = py - entity.y;
    if (handle === "rx") entity.rx = Math.max(2, Math.round(Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle))));
    else entity.ry = Math.max(2, Math.round(Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle))));
  },
  fields: [
    { key: "rx", label: "X radius", input: "number", min: 2 }, { key: "ry", label: "Y radius", input: "number", min: 2 },
    { key: "angle", label: "Ellipse angle", input: "number", step: 5 }, { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 },
  ],
});

registerEntity<Circle2Entity>({
  kind: "circle2", ctor: "circle2", group: "Geometry", label: "Circle through point", icon: "⊙", order: 38,
  hint: "A circle whose centre and radius follow two points", movable: false,
  canCreate: (doc) => pointReferenceOptions(doc).length >= 2, createBlockedReason: "Circle through point needs a centre and rim point reference.",
  create(id, _x, _y, doc, selectedId) { const [center, through] = pairReferences(doc, selectedId); return { ...baseEntity(id, "cyan"), kind: "circle2", center, through, paint: "outlined", strokeWidth: null, outlineColor: null }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), center = argName(stmt.args, 1), through = argName(stmt.args, 2); return id && center && through ? { ...baseEntity(id, "cyan"), kind: "circle2", center, through, paint: "outlined", strokeWidth: null, outlineColor: null } : null; },
  ctorLine: (entity) => `circle2(${entity.id}, ${entity.center}, ${entity.through});`,
  extraLines(entity) {
    const out: string[] = [];
    if (entity.paint === "filled") out.push(`filled(${entity.id});`);
    if (entity.strokeWidth !== null) out.push(`stroke(${entity.id}, ${num(entity.strokeWidth)});`);
    if (entity.outlineColor !== null) out.push(`outline(${entity.id}, ${entity.outlineColor});`);
    return out;
  },
  modifiers: {
    outlined(entity) { entity.paint = "outlined"; return true; }, filled(entity) { entity.paint = "filled"; return true; }, stroke: strokeWidthModifier,
    outline(entity, stmt) { const color = argName(stmt.args, 1); if (!color) return false; entity.outlineColor = color; return true; },
  },
  references: (entity) => [entity.center, entity.through], replaceReference(entity, from, to) { if (entity.center === from) entity.center = to; if (entity.through === from) entity.through = to; },
  anchor: (entity, ctx) => circle2Geometry(entity, ctx).center, translate() {},
  bounds(entity, ctx) { const g = circle2Geometry(entity, ctx); return { x: g.center.x - g.radius, y: g.center.y - g.radius, width: g.radius * 2, height: g.radius * 2 }; },
  handles: () => [], dragHandle() {},
  fields: [
    pointField("center", "Centre point"), pointField("through", "Point on circle"),
    { key: "paint", label: "Paint", input: "select", options: ["outlined", "filled"] },
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 },
    { key: "outlineColor", label: "Rim color", input: "color", nullable: true },
  ],
});

registerEntity<MidpointEntity>({
  kind: "midpoint", ctor: "midpoint", group: "Geometry", label: "Midpoint", icon: "A·B", order: 39,
  hint: "A point that stays halfway between two referenced points", movable: false,
  canCreate: (doc) => pointReferenceOptions(doc).length >= 2, createBlockedReason: "Midpoint needs at least two point references.",
  create(id, _x, _y, doc, selectedId) { const [a, b] = pairReferences(doc, selectedId); return { ...baseEntity(id, "lime"), kind: "midpoint", a, b }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), a = argName(stmt.args, 1), b = argName(stmt.args, 2); return id && a && b ? { ...baseEntity(id, "lime"), kind: "midpoint", a, b } : null; },
  ctorLine: (entity) => `midpoint(${entity.id}, ${entity.a}, ${entity.b});`, extraLines: () => [], modifiers: {},
  references: (entity) => [entity.a, entity.b], replaceReference(entity, from, to) { if (entity.a === from) entity.a = to; if (entity.b === from) entity.b = to; },
  anchor: (entity, ctx) => midpointGeometry(entity, ctx), translate() {},
  bounds(entity, ctx) { const p = midpointGeometry(entity, ctx); return { x: p.x - 7, y: p.y - 7, width: 14, height: 14 }; }, handles: () => [], dragHandle() {},
  fields: [pointField("a", "First point"), pointField("b", "Second point")],
});

registerEntity<AngleMarkEntity>({
  kind: "anglemark", ctor: "anglemark", group: "Geometry", label: "Angle mark", icon: "∠", order: 40,
  hint: "A live angle arc at the middle referenced point", movable: false,
  canCreate: (doc) => pointReferenceOptions(doc).length >= 3, createBlockedReason: "Angle mark needs three point references; the selected point becomes the vertex.",
  create(id, _x, _y, doc, selectedId) { const [a, b, c] = tripleReferences(doc, selectedId); return { ...baseEntity(id, "lime"), kind: "anglemark", a, b, c, label: null, labelSize: 26, labelColor: "lime", labelReveal: "none", strokeWidth: null }; },
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), a = argName(stmt.args, 1), b = argName(stmt.args, 2), c = argName(stmt.args, 3);
    return id && a && b && c ? { ...baseEntity(id, "lime"), kind: "anglemark", a, b, c, label: argString(stmt.args, 4), labelSize: 26, labelColor: "lime", labelReveal: "none", strokeWidth: null } : null;
  },
  ctorLine: (entity) => `anglemark(${entity.id}, ${entity.a}, ${entity.b}, ${entity.c}${entity.label === null ? "" : `, ${textLiteral(entity.label)}`});`,
  extraLines(entity) {
    const out = entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`];
    if (entity.label !== null) {
      if (entity.labelSize !== 26) out.push(`size(${entity.id}.label, ${num(entity.labelSize)});`);
      if (entity.labelColor !== "lime") out.push(`color(${entity.id}.label, ${entity.labelColor});`);
      const reveal = childRevealLine(`${entity.id}.label`, entity.labelReveal); if (reveal) out.push(reveal);
    }
    return out;
  },
  modifiers: { stroke: strokeWidthModifier },
  references: (entity) => [entity.a, entity.b, entity.c], replaceReference(entity, from, to) { if (entity.a === from) entity.a = to; if (entity.b === from) entity.b = to; if (entity.c === from) entity.c = to; },
  referenceIds: (entity) => entity.label === null ? [] : [`${entity.id}.label`],
  referenceBounds(entity, ref, ctx) { if (entity.label === null || ref !== `${entity.id}.label`) return null; const g = angleMarkGeometry(entity, ctx); const width = Math.max(entity.labelSize, entity.label.length * entity.labelSize * .62); return { x: g.label.x - width / 2, y: g.label.y - entity.labelSize * .75, width, height: entity.labelSize * 1.5 }; },
  applyReferenceModifier(entity, ref, stmt) { return ref === `${entity.id}.label` && entity.label !== null ? applyLabelModifier(entity, stmt) : false; },
  anchor: (entity, ctx) => angleMarkGeometry(entity, ctx).vertex, translate() {},
  bounds(entity, ctx) { const g = angleMarkGeometry(entity, ctx); const points = [g.vertex, g.start, g.end]; if (entity.label !== null) points.push(g.label); return pointsBox(points, entity.label === null ? 3 : entity.labelSize / 2); },
  handles: () => [], dragHandle() {},
  fields: [
    pointField("a", "First arm point"), pointField("b", "Vertex"), pointField("c", "Second arm point"),
    { key: "label", label: "Angle label", input: "text", nullable: true }, { key: "labelSize", label: "Label size", input: "range", min: 10, max: 72 },
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 },
  ],
});

registerEntity<RightAngleEntity>({
  kind: "rightangle", ctor: "rightangle", group: "Geometry", label: "Right-angle mark", icon: "∟", order: 41,
  hint: "A live square at the middle referenced point", movable: false,
  canCreate: (doc) => pointReferenceOptions(doc).length >= 3, createBlockedReason: "Right-angle mark needs three point references; the selected point becomes the vertex.",
  create(id, _x, _y, doc, selectedId) { const [a, b, c] = tripleReferences(doc, selectedId); return { ...baseEntity(id, "lime"), kind: "rightangle", a, b, c, strokeWidth: null }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), a = argName(stmt.args, 1), b = argName(stmt.args, 2), c = argName(stmt.args, 3); return id && a && b && c ? { ...baseEntity(id, "lime"), kind: "rightangle", a, b, c, strokeWidth: null } : null; },
  ctorLine: (entity) => `rightangle(${entity.id}, ${entity.a}, ${entity.b}, ${entity.c});`,
  extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`], modifiers: { stroke: strokeWidthModifier },
  references: (entity) => [entity.a, entity.b, entity.c], replaceReference(entity, from, to) { if (entity.a === from) entity.a = to; if (entity.b === from) entity.b = to; if (entity.c === from) entity.c = to; },
  anchor: (entity, ctx) => referencePoint(entity.b, ctx), translate() {}, bounds: (entity, ctx) => pointsBox([referencePoint(entity.b, ctx), ...rightAnglePoints(entity, ctx)], 3),
  handles: () => [], dragHandle() {},
  fields: [
    pointField("a", "First arm point"), pointField("b", "Vertex"), pointField("c", "Second arm point"),
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 },
  ],
});

// --- complete Euclidean construction graph ---------------------------------

function average(points: ScreenPoint[]): ScreenPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  return { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length };
}

function circumcenterOf(a: ScreenPoint, b: ScreenPoint, c: ScreenPoint): ScreenPoint | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-6) return null;
  const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
  return {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
}

function incenterOf(a: ScreenPoint, b: ScreenPoint, c: ScreenPoint): ScreenPoint {
  const la = Math.hypot(c.x - b.x, c.y - b.y), lb = Math.hypot(a.x - c.x, a.y - c.y), lc = Math.hypot(b.x - a.x, b.y - a.y);
  const total = la + lb + lc;
  return total < 1e-6 ? average([a, b, c]) : { x: (a.x * la + b.x * lb + c.x * lc) / total, y: (a.y * la + b.y * lb + c.y * lc) / total };
}

function perpendicularFoot(p: ScreenPoint, a: ScreenPoint, b: ScreenPoint): ScreenPoint {
  const dx = b.x - a.x, dy = b.y - a.y, denom = dx * dx + dy * dy;
  if (denom < 1e-6) return a;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / denom;
  return { x: a.x + dx * t, y: a.y + dy * t };
}

function lineIntersection(a: ScreenPoint, b: ScreenPoint, c: ScreenPoint, d: ScreenPoint): ScreenPoint | null {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
  const cross = rx * sy - ry * sx;
  if (Math.abs(cross) < 1e-6) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / cross;
  return { x: a.x + rx * t, y: a.y + ry * t };
}

export function geoDerivedPoint(entity: GeoDerivedPointEntity, ctx?: GeometryContext): ScreenPoint {
  const a = referencePoint(entity.a, ctx), b = referencePoint(entity.b, ctx);
  const c = entity.c ? referencePoint(entity.c, ctx) : { x: 0, y: 0 };
  const d = entity.d ? referencePoint(entity.d, ctx) : { x: 0, y: 0 };
  switch (entity.kind) {
    case "centroid": return average([a, b, c]);
    case "circumcenter": return circumcenterOf(a, b, c) ?? { x: 0, y: 0 };
    case "incenter": return incenterOf(a, b, c);
    case "orthocenter": { const o = circumcenterOf(a, b, c); return o ? { x: a.x + b.x + c.x - 2 * o.x, y: a.y + b.y + c.y - 2 * o.y } : { x: 0, y: 0 }; }
    case "foot": return perpendicularFoot(a, b, c);
    case "meet": return lineIntersection(a, b, c, d) ?? { x: 0, y: 0 };
    case "reflect": { const f = perpendicularFoot(a, b, c); return { x: f.x * 2 - a.x, y: f.y * 2 - a.y }; }
    case "bisector": {
      const u = normalize(a.x - b.x, a.y - b.y), v = normalize(c.x - b.x, c.y - b.y), direction = normalize(u.x + v.x, u.y + v.y);
      const length = (Math.hypot(a.x - b.x, a.y - b.y) + Math.hypot(c.x - b.x, c.y - b.y)) / 2;
      return { x: b.x + direction.x * length, y: b.y + direction.y * length };
    }
    case "rotpoint": {
      const angle = (entity.rotation !== 0 ? entity.rotation : entity.scalar ?? 0) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle), dx = a.x - b.x, dy = a.y - b.y;
      return { x: b.x + dx * cos - dy * sin, y: b.y + dx * sin + dy * cos };
    }
    case "between": { const t = entity.rotation !== 0 ? entity.rotation : entity.scalar ?? .5; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
    case "anglepoint": { const angle = (entity.rotation !== 0 ? entity.rotation : entity.scalar ?? 45) * Math.PI / 180, radius = Math.hypot(b.x - a.x, b.y - a.y); return { x: a.x + Math.cos(angle) * radius, y: a.y + Math.sin(angle) * radius }; }
  }
}

export function geoCircleGeometry(entity: GeoCircleEntity, ctx?: GeometryContext): { center: ScreenPoint; radius: number } {
  const a = referencePoint(entity.a, ctx), b = referencePoint(entity.b, ctx), c = referencePoint(entity.c, ctx);
  if (entity.kind === "circumcircle") {
    const center = circumcenterOf(a, b, c) ?? { x: 0, y: 0 };
    return { center, radius: Math.hypot(a.x - center.x, a.y - center.y) };
  }
  const center = incenterOf(a, b, c);
  const area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
  const semiperimeter = (Math.hypot(c.x - b.x, c.y - b.y) + Math.hypot(a.x - c.x, a.y - c.y) + Math.hypot(b.x - a.x, b.y - a.y)) / 2;
  return { center, radius: semiperimeter < 1e-6 ? 0 : area / semiperimeter };
}

function circleIntersections(c0: ScreenPoint, r0: number, c1: ScreenPoint, r1: number): [ScreenPoint, ScreenPoint] | null {
  const dx = c1.x - c0.x, dy = c1.y - c0.y, distance = Math.hypot(dx, dy);
  if (distance < 1e-6 || distance > r0 + r1 || distance < Math.abs(r0 - r1)) return null;
  const along = (r0 * r0 - r1 * r1 + distance * distance) / (2 * distance), height = Math.sqrt(Math.max(0, r0 * r0 - along * along));
  const ux = dx / distance, uy = dy / distance, mid = { x: c0.x + ux * along, y: c0.y + uy * along };
  return [{ x: mid.x - uy * height, y: mid.y + ux * height }, { x: mid.x + uy * height, y: mid.y - ux * height }];
}

/** Tangency points from an external point to a circle. Native creates `id0`
 * and `id1`; an inside/on-circle input collapses to the radial fallback. */
export function circleTangentPoints(pointRef: string, centerRef: string, throughRef: string, ctx?: GeometryContext): { points: [ScreenPoint, ScreenPoint]; valid: boolean } {
  const point = referencePoint(pointRef, ctx), center = referencePoint(centerRef, ctx), through = referencePoint(throughRef, ctx);
  const radius = Math.hypot(through.x - center.x, through.y - center.y), distance = Math.hypot(point.x - center.x, point.y - center.y);
  const intersections = circleIntersections(center, radius, { x: (point.x + center.x) / 2, y: (point.y + center.y) / 2 }, distance / 2);
  if (intersections) return { points: intersections, valid: true };
  const direction = normalize(point.x - center.x, point.y - center.y);
  const fallback = { x: center.x + direction.x * radius, y: center.y + direction.y * radius };
  return { points: [fallback, fallback], valid: false };
}

export function geoIntersectionPoints(entity: GeoIntersectionEntity, ctx?: GeometryContext): { points: [ScreenPoint, ScreenPoint]; intersects: boolean } {
  const a = referencePoint(entity.a, ctx), b = referencePoint(entity.b, ctx), c = referencePoint(entity.c, ctx), d = referencePoint(entity.d, ctx);
  if (entity.kind === "linecircle") {
    const foot = perpendicularFoot(c, a, b), radius = Math.hypot(d.x - c.x, d.y - c.y), dist2 = (c.x - foot.x) ** 2 + (c.y - foot.y) ** 2;
    if (dist2 > radius * radius) return { points: [foot, foot], intersects: false };
    const half = Math.sqrt(Math.max(0, radius * radius - dist2)), dir = normalize(b.x - a.x, b.y - a.y);
    return { points: [{ x: foot.x + dir.x * half, y: foot.y + dir.y * half }, { x: foot.x - dir.x * half, y: foot.y - dir.y * half }], intersects: true };
  }
  const radiusA = Math.hypot(b.x - a.x, b.y - a.y), radiusB = Math.hypot(d.x - c.x, d.y - c.y), intersections = circleIntersections(a, radiusA, c, radiusB);
  const fallback = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
  return intersections ? { points: intersections, intersects: true } : { points: [fallback, fallback], intersects: false };
}

export function fullLineGeometry(entity: FullLineEntity, ctx?: GeometryContext): { from: ScreenPoint; to: ScreenPoint } {
  const a = referencePoint(entity.a, ctx), b = referencePoint(entity.b, ctx), dir = normalize(b.x - a.x, b.y - a.y), extent = 4000;
  return { from: { x: a.x - dir.x * extent, y: a.y - dir.y * extent }, to: { x: b.x + dir.x * extent, y: b.y + dir.y * extent } };
}

export function parabolaPoints(entity: ParabolaEntity, samples = 81): ScreenPoint[] {
  const half = entity.halfWidth, k = Math.abs(half) < 1e-3 ? 0 : entity.height / (half * half);
  return Array.from({ length: samples }, (_unused, index) => { const t = -half + 2 * half * index / Math.max(1, samples - 1); return { x: entity.x + t, y: entity.y - k * t * t }; });
}

export function hyperbolaBranches(entity: HyperbolaEntity, samples = 65): { right: ScreenPoint[]; left: ScreenPoint[] } {
  const branch = (sign: number) => Array.from({ length: samples }, (_unused, index) => {
    const parameter = -entity.range + 2 * entity.range * index / Math.max(1, samples - 1);
    return { x: entity.x + sign * entity.a * Math.cosh(parameter), y: entity.y + entity.b * Math.sinh(parameter) };
  });
  return { right: branch(1), left: branch(-1) };
}

export function commonTangentGeometry(entity: CommonTangentEntity, ctx?: GeometryContext): { from: ScreenPoint; to: ScreenPoint; valid: boolean } {
  const c1 = referencePoint(entity.centerA, ctx), on1 = referencePoint(entity.throughA, ctx), c2 = referencePoint(entity.centerB, ctx), on2 = referencePoint(entity.throughB, ctx);
  const r1 = Math.hypot(on1.x - c1.x, on1.y - c1.y), r2 = Math.hypot(on2.x - c2.x, on2.y - c2.y), dx = c2.x - c1.x, dy = c2.y - c1.y, distance = Math.hypot(dx, dy);
  const fallback = { from: c1, to: c2, valid: false };
  if (distance < 1e-4) return fallback;
  const internal = entity.tangentType === "internal", cosine = (internal ? r1 + r2 : r1 - r2) / distance;
  if (Math.abs(cosine) > 1) return fallback;
  const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine)), ux = dx / distance, uy = dy / distance;
  const nx = ux * cosine - uy * sine, ny = uy * cosine + ux * sine;
  return {
    from: { x: c1.x + nx * r1, y: c1.y + ny * r1 },
    to: internal ? { x: c2.x - nx * r2, y: c2.y - ny * r2 } : { x: c2.x + nx * r2, y: c2.y + ny * r2 },
    valid: true,
  };
}

function commonTangentDefaultRefs(doc: SceneDoc, selectedId?: string): [string, string, string, string] | null {
  const all = pointReferenceOptions(doc), selected = selectedId && all.includes(selectedId) ? selectedId : null;
  const refs = [...new Set([...(selected ? [selected] : []), ...[...all].reverse()])].slice(0, 16), ctx = localGeometryContext(doc);
  for (const centerA of refs) for (const throughA of refs) for (const centerB of refs) for (const throughB of refs) {
    if (new Set([centerA, throughA, centerB, throughB]).size < 4) continue;
    const candidate = { ...baseEntity("candidate", "gold"), kind: "commontangent" as const, centerA, throughA, centerB, throughB, tangentType: "external" as const, strokeWidth: null, touchAColor: "gold", touchBColor: "gold", touchAReveal: "none" as const, touchBReveal: "none" as const, touchATags: [], touchBTags: [] };
    if (commonTangentGeometry(candidate, ctx).valid) return [centerA, throughA, centerB, throughB];
  }
  return null;
}

const GEO_POINT_CONFIG: readonly { kind: GeoDerivedPointKind; label: string; icon: string; refs: 2 | 3 | 4; scalar?: number; fields: readonly string[] }[] = [
  { kind: "centroid", label: "Centroid", icon: "△G", refs: 3, fields: ["Vertex A", "Vertex B", "Vertex C"] },
  { kind: "circumcenter", label: "Circumcenter", icon: "△O", refs: 3, fields: ["Vertex A", "Vertex B", "Vertex C"] },
  { kind: "incenter", label: "Incenter", icon: "△I", refs: 3, fields: ["Vertex A", "Vertex B", "Vertex C"] },
  { kind: "orthocenter", label: "Orthocenter", icon: "△H", refs: 3, fields: ["Vertex A", "Vertex B", "Vertex C"] },
  { kind: "foot", label: "Perpendicular foot", icon: "⊥·", refs: 3, fields: ["Point", "Line point A", "Line point B"] },
  { kind: "meet", label: "Line intersection", icon: "×", refs: 4, fields: ["Line 1 A", "Line 1 B", "Line 2 A", "Line 2 B"] },
  { kind: "reflect", label: "Reflected point", icon: "↔·", refs: 3, fields: ["Point", "Mirror line A", "Mirror line B"] },
  { kind: "bisector", label: "Angle-bisector point", icon: "∠/", refs: 3, fields: ["Arm point A", "Vertex", "Arm point C"] },
  { kind: "rotpoint", label: "Rotated point", icon: "↻·", refs: 2, scalar: 60, fields: ["Point", "Rotation centre"] },
  { kind: "between", label: "Point between", icon: "A·B", refs: 2, scalar: .5, fields: ["From point", "To point"] },
  { kind: "anglepoint", label: "Point at angle", icon: "∡·", refs: 2, scalar: 45, fields: ["Circle centre", "Radius point"] },
];

for (const [orderOffset, config] of GEO_POINT_CONFIG.entries()) {
  registerEntity<GeoDerivedPointEntity>({
    kind: config.kind, ctor: config.kind, group: "Geometry", label: config.label, icon: config.icon, order: 42 + orderOffset * .1,
    hint: "A live Euclidean construction that follows its referenced points", movable: false,
    canCreate: (doc) => pointReferenceOptions(doc).length >= config.refs,
    createBlockedReason: `${config.label} needs ${config.refs} earlier point references.`,
    create(id, _x, _y, doc, selectedId) {
      const refs = referenceSet(config.refs, doc, selectedId);
      return { ...baseEntity(id, "lime"), kind: config.kind, a: refs[0], b: refs[1], c: refs[2] ?? null, d: refs[3] ?? null, scalar: config.scalar ?? null };
    },
    parseArgs(stmt) {
      const id = argName(stmt.args, 0), refs = Array.from({ length: config.refs }, (_unused, index) => argName(stmt.args, index + 1));
      const scalar = config.scalar === undefined ? null : argNumber(stmt.args, config.refs + 1);
      const expected = config.refs + 1 + (config.scalar === undefined ? 0 : 1);
      if (!id || refs.some((ref) => !ref) || stmt.args.length !== expected || (config.scalar !== undefined && scalar === null)) return null;
      return { ...baseEntity(id, "lime"), kind: config.kind, a: refs[0]!, b: refs[1]!, c: refs[2] ?? null, d: refs[3] ?? null, scalar };
    },
    ctorLine(entity) { const refs = [entity.a, entity.b, entity.c, entity.d].filter((ref): ref is string => ref !== null); return `${config.kind}(${entity.id}, ${refs.join(", ")}${entity.scalar === null ? "" : `, ${num(entity.scalar)}`});`; },
    extraLines: () => [], modifiers: {},
    references: (entity) => [entity.a, entity.b, entity.c, entity.d].filter((ref): ref is string => ref !== null),
    replaceReference(entity, from, to) { if (entity.a === from) entity.a = to; if (entity.b === from) entity.b = to; if (entity.c === from) entity.c = to; if (entity.d === from) entity.d = to; },
    anchor: (entity, ctx) => geoDerivedPoint(entity, ctx), translate() {},
    bounds(entity, ctx) { const point = geoDerivedPoint(entity, ctx); return { x: point.x - 7, y: point.y - 7, width: 14, height: 14 }; },
    handles: () => [], dragHandle() {},
    fields: [
      ...config.fields.map((label, index) => pointField(["a", "b", "c", "d"][index], label)),
      ...(config.scalar === undefined ? [] : [{ key: "scalar", label: config.kind === "between" ? "Fraction" : "Angle (degrees)", input: "number" as const, step: config.kind === "between" ? .05 : 5 }]),
    ],
  });
}

for (const [kind, label, color, order] of [["circumcircle", "Circumcircle", "magenta", 43.2], ["incircle", "Incircle", "lime", 43.3]] as const) {
  registerEntity<GeoCircleEntity>({
    kind, ctor: kind, group: "Geometry", label, icon: kind === "circumcircle" ? "◯△" : "△◯", order,
    hint: "A triangle-derived circle that follows all three vertices", movable: false,
    canCreate: (doc) => pointReferenceOptions(doc).length >= 3, createBlockedReason: `${label} needs three earlier point references.`,
    create(id, _x, _y, doc, selectedId) { const [a, b, c] = referenceSet(3, doc, selectedId); return { ...baseEntity(id, color), kind, a, b, c, paint: "outlined", strokeWidth: null, outlineColor: null }; },
    parseArgs(stmt) { const id = argName(stmt.args, 0), a = argName(stmt.args, 1), b = argName(stmt.args, 2), c = argName(stmt.args, 3); return id && a && b && c && stmt.args.length === 4 ? { ...baseEntity(id, color), kind, a, b, c, paint: "outlined", strokeWidth: null, outlineColor: null } : null; },
    ctorLine: (entity) => `${kind}(${entity.id}, ${entity.a}, ${entity.b}, ${entity.c});`,
    extraLines(entity) { const out: string[] = []; if (entity.paint === "filled") out.push(`filled(${entity.id});`); if (entity.strokeWidth !== null) out.push(`stroke(${entity.id}, ${num(entity.strokeWidth)});`); if (entity.outlineColor !== null) out.push(`outline(${entity.id}, ${entity.outlineColor});`); return out; },
    modifiers: { stroke: strokeWidthModifier, outlined(entity) { entity.paint = "outlined"; return true; }, filled(entity) { entity.paint = "filled"; return true; }, outline(entity, stmt) { const value = argName(stmt.args, 1); if (!value) return false; entity.outlineColor = value; return true; } },
    references: (entity) => [entity.a, entity.b, entity.c], replaceReference(entity, from, to) { if (entity.a === from) entity.a = to; if (entity.b === from) entity.b = to; if (entity.c === from) entity.c = to; },
    anchor: (entity, ctx) => geoCircleGeometry(entity, ctx).center, translate() {},
    bounds(entity, ctx) { const circle = geoCircleGeometry(entity, ctx); return { x: circle.center.x - circle.radius, y: circle.center.y - circle.radius, width: circle.radius * 2, height: circle.radius * 2 }; },
    handles: () => [], dragHandle() {},
    fields: [pointField("a", "Vertex A"), pointField("b", "Vertex B"), pointField("c", "Vertex C"), { key: "paint", label: "Paint", input: "select", options: ["outlined", "filled"] }, { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }, { key: "outlineColor", label: "Rim color", input: "color", nullable: true }],
  });
}

for (const [kind, label, order] of [["linecircle", "Line-circle intersections", 43.4], ["circlecircle", "Circle-circle intersections", 43.5]] as const) {
  registerEntity<GeoIntersectionEntity>({
    kind, ctor: kind, group: "Geometry", label, icon: kind === "linecircle" ? "—◯" : "◯◯", order,
    hint: "Two addressable intersection points; the logical Canvas row has no native root", authorOnly: true, movable: false, colorInCtor: true,
    canCreate: (doc) => pointReferenceOptions(doc).length >= 4, createBlockedReason: `${label} needs four earlier point references.`,
    create(id, _x, _y, doc, selectedId) { const [a, b, c, d] = referenceSet(4, doc, selectedId); return { ...baseEntity(id, "cyan"), kind, a, b, c, d, point0Color: "cyan", point1Color: "cyan", point0Reveal: "none", point1Reveal: "none", point0Tags: [], point1Tags: [] }; },
    parseArgs(stmt) { const id = argName(stmt.args, 0), a = argName(stmt.args, 1), b = argName(stmt.args, 2), c = argName(stmt.args, 3), d = argName(stmt.args, 4); return id && a && b && c && d && stmt.args.length === 5 ? { ...baseEntity(id, "cyan"), kind, a, b, c, d, point0Color: "cyan", point1Color: "cyan", point0Reveal: "none", point1Reveal: "none", point0Tags: [], point1Tags: [] } : null; },
    ctorLine: (entity) => `${kind}(${entity.id}, ${entity.a}, ${entity.b}, ${entity.c}, ${entity.d});`,
    extraLines(entity) { const out: string[] = []; if (entity.point0Color !== "cyan") out.push(`color(${entity.id}0, ${entity.point0Color});`); if (entity.point1Color !== "cyan") out.push(`color(${entity.id}1, ${entity.point1Color});`); const reveal0 = childRevealLine(`${entity.id}0`, entity.point0Reveal), reveal1 = childRevealLine(`${entity.id}1`, entity.point1Reveal); if (reveal0) out.push(reveal0); if (reveal1) out.push(reveal1); for (const tag of entity.point0Tags) out.push(`tag(${entity.id}0, ${tag});`); for (const tag of entity.point1Tags) out.push(`tag(${entity.id}1, ${tag});`); return out; },
    modifiers: {}, references: (entity) => [entity.a, entity.b, entity.c, entity.d],
    replaceReference(entity, from, to) { if (entity.a === from) entity.a = to; if (entity.b === from) entity.b = to; if (entity.c === from) entity.c = to; if (entity.d === from) entity.d = to; },
    referenceIds: (entity) => [`${entity.id}0`, `${entity.id}1`],
    storyTargets: (entity) => [
      { id: `${entity.id}0`, label: `${entity.id}0 — first intersection`, kind: "point" },
      { id: `${entity.id}1`, label: `${entity.id}1 — second intersection`, kind: "point" },
    ],
    referenceBounds(entity, ref, ctx) { const points = geoIntersectionPoints(entity, ctx).points; const point = ref === `${entity.id}0` ? points[0] : ref === `${entity.id}1` ? points[1] : null; return point ? { x: point.x - 5, y: point.y - 5, width: 10, height: 10 } : null; },
    applyReferenceModifier(entity, ref, stmt) { const first = ref === `${entity.id}0`, second = ref === `${entity.id}1`; if (!first && !second) return false; if (stmt.name === "hidden") { const reveal = argName(stmt.args, 1) === "center" ? "grow" : "fade"; if (first) entity.point0Reveal = reveal; else entity.point1Reveal = reveal; return true; } if (stmt.name === "tag") { const tag = argName(stmt.args, 1); if (!tag) return false; const tags = first ? entity.point0Tags : entity.point1Tags; if (!tags.includes(tag)) tags.push(tag); return true; } if (stmt.name !== "color") return false; const color = argName(stmt.args, 1); if (!color) return false; if (first) entity.point0Color = color; else entity.point1Color = color; return true; },
    anchor(entity, ctx) { const [a, b] = geoIntersectionPoints(entity, ctx).points; return average([a, b]); }, translate() {},
    bounds(entity, ctx) { return pointsBox(geoIntersectionPoints(entity, ctx).points, 5); }, handles: () => [], dragHandle() {},
    fields: [pointField("a", kind === "linecircle" ? "Line point A" : "Circle A centre"), pointField("b", kind === "linecircle" ? "Line point B" : "Circle A rim point"), pointField("c", "Circle centre"), pointField("d", "Circle rim point"), { key: "point0Color", label: `${"{id}"}0 color`, input: "color" }, { key: "point1Color", label: `${"{id}"}1 color`, input: "color" }, { key: "point0Reveal", label: `${"{id}"}0 starts`, input: "select", options: ["none", "fade", "grow"] }, { key: "point1Reveal", label: `${"{id}"}1 starts`, input: "select", options: ["none", "fade", "grow"] }],
  });
}

registerEntity<FullLineEntity>({
  kind: "fullline", ctor: "fullline", group: "Geometry", label: "Infinite line", icon: "⟷", order: 43.6,
  hint: "A native line extended 4,000 px past two live points", movable: false,
  canCreate: (doc) => pointReferenceOptions(doc).length >= 2, createBlockedReason: "Infinite line needs two earlier point references.",
  create(id, _x, _y, doc, selectedId) { const [a, b] = referenceSet(2, doc, selectedId); return { ...baseEntity(id, "fg"), kind: "fullline", a, b, strokeWidth: null }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), a = argName(stmt.args, 1), b = argName(stmt.args, 2); return id && a && b && stmt.args.length === 3 ? { ...baseEntity(id, "fg"), kind: "fullline", a, b, strokeWidth: null } : null; },
  ctorLine: (entity) => `fullline(${entity.id}, ${entity.a}, ${entity.b});`, extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`], modifiers: { stroke: strokeWidthModifier },
  references: (entity) => [entity.a, entity.b], replaceReference(entity, from, to) { if (entity.a === from) entity.a = to; if (entity.b === from) entity.b = to; },
  anchor(entity, ctx) { const a = referencePoint(entity.a, ctx), b = referencePoint(entity.b, ctx); return average([a, b]); }, translate() {},
  bounds(entity, ctx) { const line = fullLineGeometry(entity, ctx); return pointsBox([line.from, line.to]); }, handles: () => [], dragHandle() {},
  fields: [pointField("a", "Point A"), pointField("b", "Point B"), { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }],
});

registerEntity<ParabolaEntity>({
  kind: "parabola", ctor: "parabola", anchorArgIndex: 1, group: "Geometry", label: "Parabola", icon: "∪", order: 43.7,
  hint: "A sampled parabola defined by its vertex, half-width, and signed height",
  create: (id, x, y) => ({ ...baseEntity(id, "magenta"), kind: "parabola", x, y, halfWidth: 150, height: 120, strokeWidth: null }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), vertex = argPoint(stmt.args, 1), halfWidth = argNumber(stmt.args, 2), height = argNumber(stmt.args, 3); return id && vertex && halfWidth !== null && height !== null && stmt.args.length === 4 ? { ...baseEntity(id, "magenta"), kind: "parabola", x: vertex.x, y: vertex.y, halfWidth, height, strokeWidth: null } : null; },
  ctorLine: (entity) => `parabola(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.halfWidth)}, ${num(entity.height)});`, extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`], modifiers: { stroke: strokeWidthModifier },
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; }, bounds: (entity) => pointsBox(parabolaPoints(entity)),
  handles: (entity) => [{ name: "extent", x: entity.x + entity.halfWidth, y: entity.y - entity.height }], dragHandle(entity, _handle, px, py) { entity.halfWidth = Math.max(1, Math.round(Math.abs(px - entity.x))); entity.height = Math.round(entity.y - py); },
  fields: [{ key: "halfWidth", label: "Half width", input: "number", min: 1 }, { key: "height", label: "Signed height", input: "number" }, { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }],
});

registerEntity<HyperbolaEntity>({
  kind: "hyperbola", ctor: "hyperbola", anchorArgIndex: 1, group: "Geometry", label: "Hyperbola", icon: ")(", order: 43.8,
  hint: "Two tagged sampled branches with editable semi-axes and parameter range",
  create: (id, x, y) => ({ ...baseEntity(id, "cyan"), kind: "hyperbola", x, y, a: 80, b: 65, range: 1.7, strokeWidth: null }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), center = argPoint(stmt.args, 1), a = argNumber(stmt.args, 2), b = argNumber(stmt.args, 3); return id && center && a !== null && b !== null && stmt.args.length <= 5 ? { ...baseEntity(id, "cyan"), kind: "hyperbola", x: center.x, y: center.y, a, b, range: argNumber(stmt.args, 4) ?? 1.7, strokeWidth: null } : null; },
  ctorLine: (entity) => `hyperbola(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.a)}, ${num(entity.b)}${entity.range === 1.7 ? "" : `, ${num(entity.range)}`});`, extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`], modifiers: { stroke: strokeWidthModifier },
  referenceIds: (entity) => [`${entity.id}.r`, `${entity.id}.l`], referenceBounds(entity, ref) { const branches = hyperbolaBranches(entity); if (ref === `${entity.id}.r`) return pointsBox(branches.right); if (ref === `${entity.id}.l`) return pointsBox(branches.left); return null; },
  storyTargets: (entity) => [{ id: `${entity.id}.r`, label: `${entity.id}.r — right branch`, kind: "hyperbola" }, { id: `${entity.id}.l`, label: `${entity.id}.l — left branch`, kind: "hyperbola" }],
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; }, bounds(entity) { const branches = hyperbolaBranches(entity); return pointsBox([...branches.left, ...branches.right]); },
  handles: (entity) => [{ name: "axes", x: entity.x + entity.a, y: entity.y - entity.b }], dragHandle(entity, _handle, px, py) { entity.a = Math.max(1, Math.round(Math.abs(px - entity.x))); entity.b = Math.max(1, Math.round(Math.abs(py - entity.y))); },
  fields: [{ key: "a", label: "Horizontal semi-axis", input: "number", min: 1 }, { key: "b", label: "Vertical semi-axis", input: "number", min: 1 }, { key: "range", label: "Parameter range", input: "number", min: .1, step: .1 }, { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }],
});

registerEntity<CommonTangentEntity>({
  kind: "commontangent", ctor: "commontangent", group: "Geometry", label: "Common tangent", icon: "◯—◯", order: 43.9,
  hint: "A direct or transverse common tangent with addressable touch-point children", movable: false,
  canCreate: (doc) => commonTangentDefaultRefs(doc) !== null, createBlockedReason: "Common tangent needs four point references that define two circles with a real external tangent.",
  create(id, _x, _y, doc, selectedId) { const [centerA, throughA, centerB, throughB] = (doc ? commonTangentDefaultRefs(doc, selectedId) : null) ?? referenceSet(4, doc, selectedId) as [string, string, string, string]; return { ...baseEntity(id, "gold"), kind: "commontangent", centerA, throughA, centerB, throughB, tangentType: "external", strokeWidth: null, touchAColor: "gold", touchBColor: "gold", touchAReveal: "none", touchBReveal: "none", touchATags: [], touchBTags: [] }; },
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), centerA = argName(stmt.args, 1), throughA = argName(stmt.args, 2), centerB = argName(stmt.args, 3), throughB = argName(stmt.args, 4), raw = argString(stmt.args, 5);
    if (!id || !centerA || !throughA || !centerB || !throughB || stmt.args.length > 6) return null;
    const tangentType = raw && ["internal", "transverse", "inner", "cross"].includes(raw.trim().toLowerCase()) ? "internal" : "external";
    return { ...baseEntity(id, "gold"), kind: "commontangent", centerA, throughA, centerB, throughB, tangentType, strokeWidth: null, touchAColor: "gold", touchBColor: "gold", touchAReveal: "none", touchBReveal: "none", touchATags: [], touchBTags: [] };
  },
  ctorLine: (entity) => `commontangent(${entity.id}, ${entity.centerA}, ${entity.throughA}, ${entity.centerB}, ${entity.throughB}${entity.tangentType === "external" ? "" : `, "internal"`});`,
  extraLines(entity) { const out: string[] = []; if (entity.strokeWidth !== null) out.push(`stroke(${entity.id}, ${num(entity.strokeWidth)});`); if (entity.touchAColor !== "gold") out.push(`color(${entity.id}.a, ${entity.touchAColor});`); if (entity.touchBColor !== "gold") out.push(`color(${entity.id}.b, ${entity.touchBColor});`); const revealA = childRevealLine(`${entity.id}.a`, entity.touchAReveal), revealB = childRevealLine(`${entity.id}.b`, entity.touchBReveal); if (revealA) out.push(revealA); if (revealB) out.push(revealB); for (const tag of entity.touchATags) out.push(`tag(${entity.id}.a, ${tag});`); for (const tag of entity.touchBTags) out.push(`tag(${entity.id}.b, ${tag});`); return out; },
  modifiers: { stroke: strokeWidthModifier }, references: (entity) => [entity.centerA, entity.throughA, entity.centerB, entity.throughB],
  replaceReference(entity, from, to) { if (entity.centerA === from) entity.centerA = to; if (entity.throughA === from) entity.throughA = to; if (entity.centerB === from) entity.centerB = to; if (entity.throughB === from) entity.throughB = to; },
  referenceIds: (entity) => [`${entity.id}.a`, `${entity.id}.b`],
  storyTargets: (entity) => [{ id: `${entity.id}.a`, label: `${entity.id}.a — touch point A`, kind: "point" }, { id: `${entity.id}.b`, label: `${entity.id}.b — touch point B`, kind: "point" }],
  referenceBounds(entity, ref, ctx) { const geometry = commonTangentGeometry(entity, ctx), point = ref === `${entity.id}.a` ? geometry.from : ref === `${entity.id}.b` ? geometry.to : null; return point ? { x: point.x - 5, y: point.y - 5, width: 10, height: 10 } : null; },
  applyReferenceModifier(entity, ref, stmt) { const first = ref === `${entity.id}.a`, second = ref === `${entity.id}.b`; if (!first && !second) return false; if (stmt.name === "hidden") { const reveal = argName(stmt.args, 1) === "center" ? "grow" : "fade"; if (first) entity.touchAReveal = reveal; else entity.touchBReveal = reveal; return true; } if (stmt.name === "tag") { const tag = argName(stmt.args, 1); if (!tag) return false; const tags = first ? entity.touchATags : entity.touchBTags; if (!tags.includes(tag)) tags.push(tag); return true; } if (stmt.name !== "color") return false; const color = argName(stmt.args, 1); if (!color) return false; if (first) entity.touchAColor = color; else entity.touchBColor = color; return true; },
  anchor(entity, ctx) { const geometry = commonTangentGeometry(entity, ctx); return average([geometry.from, geometry.to]); }, translate() {}, bounds(entity, ctx) { const geometry = commonTangentGeometry(entity, ctx); return pointsBox([geometry.from, geometry.to], 5); }, handles: () => [], dragHandle() {},
  fields: [pointField("centerA", "Circle A centre"), pointField("throughA", "Circle A rim point"), pointField("centerB", "Circle B centre"), pointField("throughB", "Circle B rim point"), { key: "tangentType", label: "Tangent type", input: "select", options: ["external", "internal"] }, { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }, { key: "touchAColor", label: "Touch A color", input: "color" }, { key: "touchBColor", label: "Touch B color", input: "color" }, { key: "touchAReveal", label: "Touch A starts", input: "select", options: ["none", "fade", "grow"] }, { key: "touchBReveal", label: "Touch B starts", input: "select", options: ["none", "fade", "grow"] }],
});
