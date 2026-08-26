// Core mechanics and sampled outline relationships. Support is drawn exactly;
// derived paths use a bounded Canvas sample while preserving native sample
// counts and live references for Preview.

import { argName, argNumber, argPoint, argString, num, pt } from "../args.js";
import { defFor, preferReference, registerEntity, type Box, type GeometryContext } from "../registry.js";
import type {
  InvertPathEntity, ReflectPathEntity, SceneDoc, SceneEntity, SupportDirection, SupportEntity,
} from "../types.js";
import { baseEntity, strokeWidthModifier } from "./base.js";
import { bracePoints, linkGeometry } from "./dependent.js";
import { areaPoints, graphSamples, tangentGeometry } from "./calculus.js";
import { circle2Geometry, rightAnglePoints, segmentGeometry } from "./geometry.js";
import { lsystemGeometry } from "./patterns.js";

export const CANVAS_DERIVED_PATH_SAMPLE_CAP = 480;

const SOURCE_KINDS = [
  "text", "equation", "circle", "rect", "dot", "line", "arrow", "polygon", "counter",
  "point", "midpoint", "segment", "vector", "ellipse", "circle2", "rightangle",
  "link", "framebox", "brace", "bracelabel", "bracetext", "plot", "deriv", "accum",
  "tangent", "slope", "area", "integral", "lsystem", "watermark", "safezone",
  "invertpath", "reflectpath",
] as const;
const SOURCE_KIND_SET = new Set<string>(SOURCE_KINDS);
const MIRROR_KINDS = ["line", "segment", "tangent"] as const;
const MIRROR_KIND_SET = new Set<string>(MIRROR_KINDS);

function candidates(doc: SceneDoc | undefined, kinds: Set<string>): SceneEntity[] {
  return doc?.entities.filter((entity) => kinds.has(entity.kind) && entity.origin !== "generated") ?? [];
}

function pointBox(points: readonly { x: number; y: number }[]): Box {
  if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
}

function resample(points: readonly { x: number; y: number }[], count: number, closed: boolean): { x: number; y: number }[] {
  const poly = points.map((point) => ({ ...point }));
  if (closed && poly.length > 1 && (poly[0].x !== poly.at(-1)!.x || poly[0].y !== poly.at(-1)!.y)) poly.push({ ...poly[0] });
  if (poly.length < 2) return Array.from({ length: count }, () => ({ ...(poly[0] ?? { x: 0, y: 0 }) }));
  const cumulative = [0];
  for (let index = 1; index < poly.length; index += 1) cumulative.push(cumulative[index - 1] + Math.hypot(poly[index].x - poly[index - 1].x, poly[index].y - poly[index - 1].y));
  const total = cumulative.at(-1) ?? 0;
  if (total < 1e-6) return Array.from({ length: count }, () => ({ ...poly[0] }));
  return Array.from({ length: count }, (_unused, sample) => {
    const distance = total * sample / count;
    let index = 0;
    while (index + 1 < cumulative.length && cumulative[index + 1] < distance) index += 1;
    const span = cumulative[index + 1] - cumulative[index];
    const t = span > 1e-6 ? (distance - cumulative[index]) / span : 0;
    return { x: poly[index].x + (poly[index + 1].x - poly[index].x) * t, y: poly[index].y + (poly[index + 1].y - poly[index].y) * t };
  });
}

function ellipsePoints(x: number, y: number, rx: number, ry: number, angle: number, count: number) {
  const radians = angle * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  return Array.from({ length: count }, (_unused, index) => {
    const theta = Math.PI * 2 * index / count, lx = rx * Math.cos(theta), ly = ry * Math.sin(theta);
    return { x: x + lx * cos - ly * sin, y: y + lx * sin + ly * cos };
  });
}

/** Match the native `sample_outline` shape policy for Canvas-known roots. */
function sourceOutline(source: SceneEntity, ctx: GeometryContext, count: number): { x: number; y: number }[] {
  if (source.kind === "circle") return ellipsePoints(source.x, source.y, source.r, source.r, 0, count);
  if (source.kind === "dot") return ellipsePoints(source.x, source.y, source.r, source.r, 0, count);
  if (source.kind === "point" || source.kind === "midpoint") {
    const box = defFor(source).bounds(source, ctx), anchor = defFor(source).anchor(source, ctx);
    const radius = Math.max(1, Math.min(box.width, box.height) / 2);
    return ellipsePoints(anchor.x, anchor.y, radius, radius, 0, count);
  }
  if (source.kind === "circle2") { const circle = circle2Geometry(source, ctx); return ellipsePoints(circle.center.x, circle.center.y, circle.radius, circle.radius, 0, count); }
  if (source.kind === "ellipse") return ellipsePoints(source.x, source.y, source.rx, source.ry, source.angle, count);
  if (source.kind === "rect" || source.kind === "framebox" || source.kind === "safezone") {
    const box = defFor(source).bounds(source, ctx);
    return resample([{ x: box.x + box.width, y: box.y }, { x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y + box.height }, { x: box.x, y: box.y }], count, true);
  }
  if (source.kind === "polygon") return resample(source.points, count, true);
  if (source.kind === "area") return resample(areaPoints(source, ctx), count, true);
  if (source.kind === "line" || source.kind === "arrow") return resample([{ x: source.x1, y: source.y1 }, { x: source.x2, y: source.y2 }], count, false);
  if (source.kind === "segment") { const line = segmentGeometry(source, ctx); return resample([line.from, line.to], count, false); }
  if (source.kind === "vector") return resample([{ x: source.x, y: source.y }, { x: source.x + source.dx, y: source.y - source.dy }], count, false);
  if (source.kind === "tangent") { const line = tangentGeometry(source, ctx); return resample([line.from, line.to], count, false); }
  if (source.kind === "link") { const link = linkGeometry(source, ctx); return resample([link.from, link.to], count, false); }
  if (source.kind === "rightangle") return resample(rightAnglePoints(source, ctx), count, false);
  if (source.kind === "brace" || source.kind === "bracelabel" || source.kind === "bracetext") return resample(bracePoints(source.x1, source.y1, source.x2, source.y2, source.depth, source.kind === "brace" ? source.direction : null).points, count, false);
  if (source.kind === "plot" || source.kind === "deriv" || source.kind === "accum") return resample(graphSamples(source, ctx, Math.min(240, count)), count, false);
  if (source.kind === "lsystem") return resample(lsystemGeometry(source).points, count, source.boundary !== "open");
  // Native text/arc/unsupported shape sampling degenerates to its entity position.
  const anchor = defFor(source).anchor(source, ctx);
  return Array.from({ length: count }, () => ({ ...anchor }));
}

function mirrorLine(entity: ReflectPathEntity, ctx: GeometryContext): [{ x: number; y: number }, { x: number; y: number }] | null {
  const mirror = ctx.entity(entity.mirror);
  if (!mirror) return null;
  if (mirror.kind === "line") return [{ x: mirror.x1, y: mirror.y1 }, { x: mirror.x2, y: mirror.y2 }];
  if (mirror.kind === "segment") { const line = segmentGeometry(mirror, ctx); return [line.from, line.to]; }
  if (mirror.kind === "tangent") { const line = tangentGeometry(mirror, ctx); return [line.from, line.to]; }
  return null;
}

export function derivedPathPoints(entity: InvertPathEntity | ReflectPathEntity, ctx?: GeometryContext): { x: number; y: number }[] {
  if (!ctx) return [];
  const source = ctx.entity(entity.source);
  if (!source) return [];
  const count = Math.max(16, Math.min(CANVAS_DERIVED_PATH_SAMPLE_CAP, Math.floor(entity.samples)));
  const points = sourceOutline(source, ctx, count);
  if (entity.kind === "invertpath") {
    const centerEntity = ctx.entity(entity.center);
    if (!centerEntity) return [];
    const center = defFor(centerEntity).anchor(centerEntity, ctx), squared = entity.radius * entity.radius;
    return points.map((point) => {
      const dx = point.x - center.x, dy = point.y - center.y, factor = squared / Math.max(1e-8, dx * dx + dy * dy);
      return { x: center.x + dx * factor, y: center.y + dy * factor };
    });
  }
  const mirror = mirrorLine(entity, ctx);
  if (!mirror) return [];
  const [from, to] = mirror, ax = to.x - from.x, ay = to.y - from.y, denominator = Math.max(1e-8, ax * ax + ay * ay);
  return points.map((point) => {
    const t = ((point.x - from.x) * ax + (point.y - from.y) * ay) / denominator;
    const foot = { x: from.x + ax * t, y: from.y + ay * t };
    return { x: foot.x * 2 - point.x, y: foot.y * 2 - point.y };
  });
}

export function supportGeometry(entity: SupportEntity) {
  const normal = entity.direction === "up" ? { x: 0, y: 1 } : entity.direction === "left" ? { x: 1, y: 0 } : entity.direction === "right" ? { x: -1, y: 0 } : { x: 0, y: -1 };
  const along = { x: -normal.y, y: normal.x }, half = entity.length / 2;
  const from = { x: entity.x - along.x * half, y: entity.y - along.y * half }, to = { x: entity.x + along.x * half, y: entity.y + along.y * half };
  const tickDir = { x: (normal.x + along.x) / Math.SQRT2 * 13, y: (normal.y + along.y) / Math.SQRT2 * 13 };
  const ticks = Array.from({ length: Math.floor(entity.length / 15) + 1 }, (_unused, index) => {
    const start = { x: from.x + along.x * index * 15, y: from.y + along.y * index * 15 };
    return { from: start, to: { x: start.x + tickDir.x, y: start.y + tickDir.y } };
  });
  return { from, to, ticks, along };
}

registerEntity<SupportEntity>({
  kind: "support", ctor: "support", anchorArgIndex: 1, group: "Shapes", label: "Fixed support", icon: "▨", order: 29,
  hint: "Hatched wall, ceiling, or floor support for mechanics diagrams",
  create: (id, x, y) => ({ ...baseEntity(id, "fg"), kind: "support", x, y, length: 220, direction: "down", strokeWidth: null }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), center = argPoint(stmt.args, 1);
    if (!id || !center || stmt.args.length > 4) return null;
    const raw = argString(stmt.args, 3) ?? "down";
    const direction = (["up", "down", "left", "right"].includes(raw) ? raw : "down") as SupportDirection;
    return { ...baseEntity(id, "fg"), kind: "support", x: center.x, y: center.y, length: Math.max(12, argNumber(stmt.args, 2) ?? 220), direction, strokeWidth: null };
  },
  ctorLine: (entity) => `support(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.length)}, "${entity.direction}");`,
  extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`],
  modifiers: { stroke: strokeWidthModifier },
  referenceIds: (entity) => [`${entity.id}.line`, `${entity.id}.parts`, ...supportGeometry(entity).ticks.map((_tick, index) => `${entity.id}.tick${index}`)],
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds(entity) { const geometry = supportGeometry(entity); return pointBox([geometry.from, geometry.to, ...geometry.ticks.flatMap((tick) => [tick.from, tick.to])]); },
  handles: (entity) => { const geometry = supportGeometry(entity); return [{ name: "length", x: geometry.to.x, y: geometry.to.y }]; },
  dragHandle(entity, _handle, px, py) { const geometry = supportGeometry(entity); entity.length = Math.max(12, Math.abs((px - entity.x) * geometry.along.x + (py - entity.y) * geometry.along.y) * 2); },
  fields: [
    { key: "length", label: "Baseline length", input: "range", min: 12, max: 800, step: 1 },
    { key: "direction", label: "Open side", input: "select", options: ["down", "up", "left", "right"] },
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: .5, max: 20, step: .5 },
  ],
});

function derivedCandidates(doc?: SceneDoc): SceneEntity[] { return candidates(doc, SOURCE_KIND_SET); }

registerEntity<InvertPathEntity>({
  kind: "invertpath", ctor: "invertpath", group: "Geometry", label: "Inverted path", icon: "◉↯", order: 58, fidelity: "semantic", movable: false,
  hint: "Live sampled outline inversion around a named center and radius",
  canCreate: (doc) => derivedCandidates(doc).length >= 2,
  createBlockedReason: "Inverted path needs a concrete source and another entity as its inversion center.",
  create(id, _x, _y, doc, selectedId) {
    const source = preferReference(doc, selectedId, (entity) => SOURCE_KIND_SET.has(entity.kind)) ?? derivedCandidates(doc).at(-1);
    const center = [...derivedCandidates(doc)].reverse().find((entity) => entity.id !== source?.id);
    return { ...baseEntity(id, "cyan"), kind: "invertpath", source: source?.id ?? "source", center: center?.id ?? "center", radius: 120, samples: 240, strokeWidth: null };
  },
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), source = argName(stmt.args, 1), center = argName(stmt.args, 2), radius = argNumber(stmt.args, 3), samples = argNumber(stmt.args, 4) ?? 240;
    if (!id || !source || !center || radius === null || radius <= 0 || !Number.isInteger(samples) || samples < 16 || samples > 20_000 || stmt.args.length > 5) return null;
    return { ...baseEntity(id, "cyan"), kind: "invertpath", source, center, radius, samples, strokeWidth: null };
  },
  ctorLine: (entity) => `invertpath(${entity.id}, ${entity.source}, ${entity.center}, ${num(entity.radius)}, ${Math.floor(entity.samples)});`,
  extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`], modifiers: { stroke: strokeWidthModifier },
  references: (entity) => [entity.source, entity.center],
  replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; if (entity.center === from) entity.center = to; },
  anchor(entity, ctx) { const box = this.bounds(entity, ctx); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, translate() {},
  bounds: (entity, ctx) => pointBox(derivedPathPoints(entity, ctx)), handles: () => [], dragHandle() {},
  fields: [
    { key: "source", label: "Source outline", input: "entity", entityKinds: SOURCE_KINDS, referencesEarlierOnly: true },
    { key: "center", label: "Inversion center", input: "entity", entityKinds: SOURCE_KINDS, referencesEarlierOnly: true },
    { key: "radius", label: "Inversion radius", input: "range", min: 1, max: 1_000, step: 1 },
    { key: "samples", label: "Native samples", input: "number", min: 16, max: 20_000, step: 1, hint: `Canvas shows at most ${CANVAS_DERIVED_PATH_SAMPLE_CAP}; Preview uses the full authored count.` },
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: .5, max: 20, step: .5 },
  ],
});

registerEntity<ReflectPathEntity>({
  kind: "reflectpath", ctor: "reflectpath", group: "Geometry", label: "Reflected path", icon: "⇋", order: 59, fidelity: "semantic", movable: false,
  hint: "Live sampled outline reflection across a named line",
  canCreate: (doc) => derivedCandidates(doc).length > 0 && candidates(doc, MIRROR_KIND_SET).length > 0,
  createBlockedReason: "Reflected path needs a concrete source and a line, segment, or tangent mirror.",
  create(id, _x, _y, doc, selectedId) {
    const source = preferReference(doc, selectedId, (entity) => SOURCE_KIND_SET.has(entity.kind)) ?? derivedCandidates(doc).at(-1);
    const mirror = [...candidates(doc, MIRROR_KIND_SET)].reverse().find((entity) => entity.id !== source?.id) ?? candidates(doc, MIRROR_KIND_SET).at(-1);
    return { ...baseEntity(id, "magenta"), kind: "reflectpath", source: source?.id ?? "source", mirror: mirror?.id ?? "mirror", samples: 240, strokeWidth: null };
  },
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), source = argName(stmt.args, 1), mirror = argName(stmt.args, 2), samples = argNumber(stmt.args, 3) ?? 240;
    if (!id || !source || !mirror || !Number.isInteger(samples) || samples < 16 || samples > 20_000 || stmt.args.length > 4) return null;
    return { ...baseEntity(id, "magenta"), kind: "reflectpath", source, mirror, samples, strokeWidth: null };
  },
  ctorLine: (entity) => `reflectpath(${entity.id}, ${entity.source}, ${entity.mirror}, ${Math.floor(entity.samples)});`,
  extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`], modifiers: { stroke: strokeWidthModifier },
  references: (entity) => [entity.source, entity.mirror],
  replaceReference(entity, from, to) { if (entity.source === from) entity.source = to; if (entity.mirror === from) entity.mirror = to; },
  anchor(entity, ctx) { const box = this.bounds(entity, ctx); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, translate() {},
  bounds: (entity, ctx) => pointBox(derivedPathPoints(entity, ctx)), handles: () => [], dragHandle() {},
  fields: [
    { key: "source", label: "Source outline", input: "entity", entityKinds: SOURCE_KINDS, referencesEarlierOnly: true },
    { key: "mirror", label: "Mirror line", input: "entity", entityKinds: MIRROR_KINDS, referencesEarlierOnly: true },
    { key: "samples", label: "Native samples", input: "number", min: 16, max: 20_000, step: 1, hint: `Canvas shows at most ${CANVAS_DERIVED_PATH_SAMPLE_CAP}; Preview uses the full authored count.` },
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: .5, max: 20, step: .5 },
  ],
});
