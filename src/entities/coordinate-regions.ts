// Math-kit coordinate systems and circular regions. These are native geometric
// constructors: Canvas keeps their authored parameters and generated child ids
// visible while Preview remains the final rasterization authority.

import { argName, argNumber, argPoint, num, pt } from "../args.js";
import { registerEntity, type Box } from "../registry.js";
import type { CallStatement } from "../script.js";
import type {
  AnnulusEntity, ArcEntity, ComplexPlaneEntity, NumberLineEntity, PaintMode,
  PlaneEntity, PolarPlaneEntity, SectorEntity,
} from "../types.js";
import { baseEntity, strokeWidthModifier } from "./base.js";

export const COORDINATE_CHILD_CAP = 1000;

export function planeUnit(entity: PlaneEntity | ComplexPlaneEntity): number {
  return Math.max(4, entity.unit ?? 50);
}

function planeOffsets(extent: number, unit: number): number[] {
  const count = Math.min(COORDINATE_CHILD_CAP, Math.max(0, Math.floor(Math.abs(extent) / unit)));
  return Array.from({ length: count * 2 }, (_unused, index) => index < count ? index - count : index - count + 1);
}

export function planeGrid(entity: PlaneEntity | ComplexPlaneEntity) {
  const unit = planeUnit(entity);
  return {
    vertical: planeOffsets(entity.halfw, unit).map((offset) => ({ offset, x: entity.x + offset * unit })),
    horizontal: planeOffsets(entity.halfh, unit).map((offset) => ({ offset, y: entity.y + offset * unit })),
  };
}

export function polarPlaneCounts(entity: PolarPlaneEntity): { rings: number; spokes: number } {
  return {
    rings: Math.min(COORDINATE_CHILD_CAP, Math.max(1, Math.trunc(entity.rings ?? 4))),
    spokes: Math.min(COORDINATE_CHILD_CAP, Math.max(2, Math.trunc(entity.spokes ?? 12))),
  };
}

export function numberLineValues(entity: NumberLineEntity): number[] {
  if (!(entity.step > 0) || !(entity.to > entity.from)) return [];
  const values: number[] = [];
  let value = entity.from;
  for (let index = 0; value <= entity.to + 1e-4 && index < 1000; index += 1, value += entity.step) {
    values.push(Math.round(value * 1e6) / 1e6);
  }
  return values;
}

export interface ArcGeometry {
  outer: { x: number; y: number }[];
  inner: { x: number; y: number }[];
  path: string;
  full: boolean;
}

function polarPoint(x: number, y: number, radius: number, degrees: number) {
  const radians = degrees * Math.PI / 180;
  return { x: x + Math.cos(radians) * radius, y: y + Math.sin(radians) * radius };
}

/** Bounded equivalent of the engine's six-degree Arc tessellation. */
export function arcGeometry(x: number, y: number, outer: number, inner: number, start: number, sweep: number): ArcGeometry {
  const clamped = Math.max(-360, Math.min(360, sweep));
  const segments = Math.max(2, Math.ceil(Math.abs(clamped) / 6));
  const outerRadius = Math.abs(outer), innerRadius = Math.max(0, Math.abs(inner));
  const outerPoints = Array.from({ length: segments + 1 }, (_unused, index) => polarPoint(x, y, outerRadius, start + clamped * index / segments));
  const innerPoints = Array.from({ length: segments + 1 }, (_unused, index) => polarPoint(x, y, innerRadius, start + clamped * index / segments));
  const full = Math.abs(clamped) >= 359.999;
  const forward = outerPoints.map((point, index) => `${index ? "L" : "M"} ${num(point.x)} ${num(point.y)}`).join(" ");
  if (innerRadius <= .5) return { outer: outerPoints, inner: innerPoints, path: full ? `${forward} Z` : `M ${num(x)} ${num(y)} L ${outerPoints.map((point) => `${num(point.x)} ${num(point.y)}`).join(" L ")} Z`, full };
  const reverse = [...innerPoints].reverse().map((point) => `L ${num(point.x)} ${num(point.y)}`).join(" ");
  return { outer: outerPoints, inner: innerPoints, path: `${forward} ${reverse} Z`, full };
}

function circularBounds(x: number, y: number, radius: number, padding = 0): Box {
  const r = Math.abs(radius);
  return { x: x - r - padding, y: y - r - padding, width: r * 2 + padding * 2, height: r * 2 + padding * 2 };
}

function planeReferenceIds(entity: PlaneEntity | ComplexPlaneEntity): string[] {
  const grid = planeGrid(entity);
  return [
    `${entity.id}.grid`, `${entity.id}.x`, `${entity.id}.y`,
    ...grid.vertical.map(({ offset }) => `${entity.id}.gv${offset}`),
    ...grid.horizontal.map(({ offset }) => `${entity.id}.gh${offset}`),
    ...(entity.kind === "complexplane" ? [`${entity.id}.re`, `${entity.id}.im`] : []),
  ];
}

function planeFields() {
  return [
    { key: "halfw", label: "Half width", input: "number" as const, min: 20 },
    { key: "halfh", label: "Half height", input: "number" as const, min: 20 },
    { key: "unit", label: "Grid spacing", input: "number" as const, nullable: true, min: 4, hint: "Blank uses Manic's native 50px default; values below 4px are clamped by the engine." },
  ];
}

function registerCartesianPlane(kind: "plane" | "complexplane", order: number) {
  type E = PlaneEntity | ComplexPlaneEntity;
  registerEntity<E>({
    kind, ctor: kind, aliases: kind === "plane" ? ["numberplane"] : undefined,
    anchorArgIndex: 1, group: "Math", label: kind === "plane" ? "Number plane" : "Complex plane",
    icon: kind === "plane" ? "▦xy" : "▦ℂ", order, hint: kind === "plane" ? "Cartesian grid with addressable grid and axis children" : "Cartesian grid with native Re and Im labels",
    create(id, x, y) {
      const common = { ...baseEntity(id, "fg"), nativePaint: true, x, y, halfw: 300, halfh: 190, unit: 50 };
      return (kind === "plane" ? { ...common, kind, spelling: "plane" } : { ...common, kind }) as E;
    },
    parseArgs(stmt) {
      const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1), halfw = argNumber(stmt.args, 2), halfh = argNumber(stmt.args, 3), unit = argNumber(stmt.args, 4);
      if (!id || !at || halfw === null || halfh === null || stmt.args.length < 4 || stmt.args.length > 5 || (stmt.args.length === 5 && unit === null)) return null;
      const common = { ...baseEntity(id, "fg"), nativePaint: true, x: at.x, y: at.y, halfw, halfh, unit };
      return (kind === "plane" ? { ...common, kind, spelling: stmt.name as PlaneEntity["spelling"] } : { ...common, kind }) as E;
    },
    ctorLine(entity) {
      const spelling = entity.kind === "plane" ? entity.spelling : "complexplane";
      return `${spelling}(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.halfw)}, ${num(entity.halfh)}${entity.unit === null ? "" : `, ${num(entity.unit)}`});`;
    },
    extraLines: () => [], modifiers: {}, referenceIds: planeReferenceIds,
    anchor: (entity) => ({ x: entity.x, y: entity.y }),
    translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
    bounds: (entity) => ({ x: entity.x - Math.abs(entity.halfw) - 12, y: entity.y - Math.abs(entity.halfh) - 24, width: Math.abs(entity.halfw) * 2 + 36, height: Math.abs(entity.halfh) * 2 + 36 }),
    handles: (entity) => [{ name: "xextent", x: entity.x + Math.abs(entity.halfw), y: entity.y }, { name: "yextent", x: entity.x, y: entity.y - Math.abs(entity.halfh) }],
    dragHandle(entity, handle, px, py) { if (handle === "xextent") entity.halfw = Math.max(20, Math.round(Math.abs(px - entity.x))); else entity.halfh = Math.max(20, Math.round(Math.abs(py - entity.y))); },
    fields: planeFields(),
  });
}

registerCartesianPlane("plane", 38);
registerCartesianPlane("complexplane", 38.1);

registerEntity<PolarPlaneEntity>({
  kind: "polarplane", ctor: "polarplane", anchorArgIndex: 1, group: "Math", label: "Polar plane", icon: "◎θ", order: 38.2,
  hint: "Concentric rings and radial spokes, addressable through the .grid tag",
  create: (id, x, y) => ({ ...baseEntity(id, "dim"), nativePaint: true, kind: "polarplane", x, y, radius: 190, rings: 4, spokes: 12 }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1), radius = argNumber(stmt.args, 2), rings = argNumber(stmt.args, 3), spokes = argNumber(stmt.args, 4);
    if (!id || !at || radius === null || stmt.args.length < 3 || stmt.args.length > 5 || (stmt.args.length >= 4 && rings === null) || (stmt.args.length === 5 && spokes === null)) return null;
    return { ...baseEntity(id, "dim"), nativePaint: true, kind: "polarplane", x: at.x, y: at.y, radius, rings, spokes };
  },
  ctorLine(entity) {
    const tail = entity.spokes !== null ? `, ${num(entity.rings ?? 4)}, ${num(entity.spokes)}` : entity.rings !== null ? `, ${num(entity.rings)}` : "";
    return `polarplane(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.radius)}${tail});`;
  },
  extraLines: () => [], modifiers: {},
  referenceIds(entity) { const counts = polarPlaneCounts(entity); return [`${entity.id}.grid`, ...Array.from({ length: counts.rings }, (_v, i) => `${entity.id}.ring${i + 1}`), ...Array.from({ length: counts.spokes }, (_v, i) => `${entity.id}.spoke${i}`)]; },
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds: (entity) => circularBounds(entity.x, entity.y, entity.radius, 4), handles: (entity) => [{ name: "radius", x: entity.x + Math.abs(entity.radius), y: entity.y }],
  dragHandle(entity, _handle, px, py) { entity.radius = Math.max(10, Math.round(Math.hypot(px - entity.x, py - entity.y))); },
  fields: [
    { key: "radius", label: "Radius", input: "number", min: 10 },
    { key: "rings", label: "Rings", input: "number", nullable: true, min: 1, max: 360, hint: "Blank uses 4." },
    { key: "spokes", label: "Spokes", input: "number", nullable: true, min: 2, max: 360, hint: "Blank uses 12." },
  ],
});

registerEntity<NumberLineEntity>({
  kind: "numberline", ctor: "numberline", anchorArgIndex: 1, group: "Math", label: "Number line", icon: "↔123", order: 38.3,
  hint: "Ranged axis with deterministic, addressable tick and label children",
  create: (id, x, y) => ({ ...baseEntity(id, "dim"), nativePaint: true, kind: "numberline", x, y, halfw: 260, from: -5, to: 5, step: 1 }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1), halfw = argNumber(stmt.args, 2), from = argNumber(stmt.args, 3), to = argNumber(stmt.args, 4), step = argNumber(stmt.args, 5); return id && at && halfw !== null && from !== null && to !== null && step !== null && stmt.args.length === 6 ? { ...baseEntity(id, "dim"), nativePaint: true, kind: "numberline", x: at.x, y: at.y, halfw, from, to, step } : null; },
  ctorLine: (entity) => `numberline(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.halfw)}, ${num(entity.from)}, ${num(entity.to)}, ${num(entity.step)});`, extraLines: () => [], modifiers: {},
  referenceIds(entity) { return [`${entity.id}.axis`, ...numberLineValues(entity).flatMap((_value, index) => [`${entity.id}.t${index}`, `${entity.id}.l${index}`])]; },
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds: (entity) => ({ x: entity.x - Math.abs(entity.halfw) - 12, y: entity.y - 12, width: Math.abs(entity.halfw) * 2 + 24, height: 54 }),
  handles: (entity) => [{ name: "extent", x: entity.x + Math.abs(entity.halfw), y: entity.y }], dragHandle(entity, _handle, px) { entity.halfw = Math.max(20, Math.round(Math.abs(px - entity.x))); },
  fields: [
    { key: "halfw", label: "Half width", input: "number", min: 20 }, { key: "from", label: "From", input: "number", step: .1 },
    { key: "to", label: "To", input: "number", step: .1 }, { key: "step", label: "Tick step", input: "number", min: .0001, step: .1, hint: "Manic requires a positive step and To greater than From." },
  ],
});

type Region = SectorEntity | AnnulusEntity;
function regionExtraLines(entity: Region): string[] {
  return [
    ...(entity.paint === "default" ? [] : [`${entity.paint}(${entity.id});`]),
    ...(entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`]),
    ...(entity.outlineColor === null ? [] : [`outline(${entity.id}, ${entity.outlineColor});`]),
  ];
}
function regionModifiers() {
  return {
    outlined(entity: Region) { entity.paint = "outlined"; return true; },
    filled(entity: Region) { entity.paint = "filled"; return true; },
    stroke(entity: Region, stmt: CallStatement) { return strokeWidthModifier(entity, stmt); },
    outline(entity: Region, stmt: CallStatement) { const color = argName(stmt.args, 1); if (!color) return false; entity.outlineColor = color; return true; },
  };
}
const regionFields = [
  { key: "paint", label: "Paint", input: "select" as const, options: ["default", "outlined", "filled"] satisfies readonly PaintMode[] },
  { key: "strokeWidth", label: "Stroke width", input: "number" as const, nullable: true, min: 1, max: 20 },
  { key: "outlineColor", label: "Rim color", input: "color" as const, nullable: true },
];

registerEntity<ArcEntity>({
  kind: "arc", ctor: "arc", anchorArgIndex: 1, group: "Math", label: "Arc", icon: "⌒", order: 39,
  hint: "Circular arc with clockwise screen-space degree controls",
  create: (id, x, y) => ({ ...baseEntity(id, "cyan"), nativePaint: true, kind: "arc", x, y, r: 120, start: 200, sweep: 140, strokeWidth: null, outlineColor: null }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1), r = argNumber(stmt.args, 2), start = argNumber(stmt.args, 3), sweep = argNumber(stmt.args, 4); return id && at && r !== null && start !== null && sweep !== null && stmt.args.length === 5 ? { ...baseEntity(id, "cyan"), nativePaint: true, kind: "arc", x: at.x, y: at.y, r, start, sweep, strokeWidth: null, outlineColor: null } : null; },
  ctorLine: (entity) => `arc(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.r)}, ${num(entity.start)}, ${num(entity.sweep)});`,
  extraLines: (entity) => [...(entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`]), ...(entity.outlineColor === null ? [] : [`outline(${entity.id}, ${entity.outlineColor});`])],
  modifiers: { stroke: strokeWidthModifier, outline(entity, stmt) { const color = argName(stmt.args, 1); if (!color) return false; entity.outlineColor = color; return true; } },
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; }, bounds: (entity) => circularBounds(entity.x, entity.y, entity.r, (entity.strokeWidth ?? 3) / 2),
  handles: (entity) => [{ name: "radius", ...polarPoint(entity.x, entity.y, Math.abs(entity.r), entity.start) }], dragHandle(entity, _handle, px, py) { entity.r = Math.max(3, Math.round(Math.hypot(px - entity.x, py - entity.y))); },
  fields: [{ key: "r", label: "Radius", input: "number", min: 3 }, { key: "start", label: "Start angle", input: "number", step: 1, unit: "°" }, { key: "sweep", label: "Sweep", input: "number", min: -360, max: 360, step: 1, unit: "°" }, { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }, { key: "outlineColor", label: "Arc color", input: "color", nullable: true, hint: "Blank preserves the constructor's native cyan stroke; color(id, …) does not replace an explicit native outline." }],
});

registerEntity<SectorEntity>({
  kind: "sector", ctor: "sector", anchorArgIndex: 1, group: "Math", label: "Sector", icon: "◔", order: 39.1,
  hint: "Filled and outlined pie-slice region",
  create: (id, x, y) => ({ ...baseEntity(id, "panel"), nativePaint: true, kind: "sector", x, y, r: 120, start: 210, sweep: 120, paint: "default", strokeWidth: null, outlineColor: null }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1), r = argNumber(stmt.args, 2), start = argNumber(stmt.args, 3), sweep = argNumber(stmt.args, 4); return id && at && r !== null && start !== null && sweep !== null && stmt.args.length === 5 ? { ...baseEntity(id, "panel"), nativePaint: true, kind: "sector", x: at.x, y: at.y, r, start, sweep, paint: "default", strokeWidth: null, outlineColor: null } : null; },
  ctorLine: (entity) => `sector(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.r)}, ${num(entity.start)}, ${num(entity.sweep)});`, extraLines: regionExtraLines, modifiers: regionModifiers(),
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; }, bounds: (entity) => circularBounds(entity.x, entity.y, entity.r, (entity.strokeWidth ?? 2.5) / 2),
  handles: (entity) => [{ name: "radius", ...polarPoint(entity.x, entity.y, Math.abs(entity.r), entity.start + entity.sweep) }], dragHandle(entity, _handle, px, py) { entity.r = Math.max(3, Math.round(Math.hypot(px - entity.x, py - entity.y))); },
  fields: [{ key: "r", label: "Radius", input: "number", min: 3 }, { key: "start", label: "Start angle", input: "number", step: 1, unit: "°" }, { key: "sweep", label: "Sweep", input: "number", min: -360, max: 360, step: 1, unit: "°" }, ...regionFields],
});

registerEntity<AnnulusEntity>({
  kind: "annulus", ctor: "annulus", anchorArgIndex: 1, group: "Math", label: "Annulus", icon: "◎", order: 39.2,
  hint: "Filled and outlined ring with editable inner and outer radii",
  create: (id, x, y) => ({ ...baseEntity(id, "panel"), nativePaint: true, kind: "annulus", x, y, outer: 130, inner: 75, paint: "default", strokeWidth: null, outlineColor: null }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1), outer = argNumber(stmt.args, 2), inner = argNumber(stmt.args, 3); return id && at && outer !== null && inner !== null && stmt.args.length === 4 ? { ...baseEntity(id, "panel"), nativePaint: true, kind: "annulus", x: at.x, y: at.y, outer, inner, paint: "default", strokeWidth: null, outlineColor: null } : null; },
  ctorLine: (entity) => `annulus(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.outer)}, ${num(entity.inner)});`, extraLines: regionExtraLines, modifiers: regionModifiers(),
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; }, bounds: (entity) => circularBounds(entity.x, entity.y, entity.outer, (entity.strokeWidth ?? 2.5) / 2),
  handles: (entity) => [{ name: "outer", x: entity.x + Math.abs(entity.outer), y: entity.y }, { name: "inner", x: entity.x + Math.abs(entity.inner), y: entity.y }],
  dragHandle(entity, handle, px, py) { const radius = Math.max(1, Math.round(Math.hypot(px - entity.x, py - entity.y))); if (handle === "outer") entity.outer = Math.max(radius, entity.inner + 1); else entity.inner = Math.min(radius, entity.outer - 1); },
  fields: [{ key: "outer", label: "Outer radius", input: "number", min: 2 }, { key: "inner", label: "Inner radius", input: "number", min: 1, hint: "Manic requires Inner to be smaller than Outer." }, ...regionFields],
});
