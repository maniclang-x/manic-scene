// Structured generators whose native output can be very large. Canvas keeps
// their authoring semantics first-class, but only materialises bounded SVG
// geometry; Preview remains the final pixel and expansion authority.

import { argName, argNumber, argPoint, argString, escapeString, num, pt } from "../args.js";
import { preferReference, registerEntity, type Box, type GeometryContext } from "../registry.js";
import type { LSystemEntity, RepeatEntity, RepeatLayout, SceneDoc, SceneEntity } from "../types.js";
import { baseEntity, strokeWidthModifier } from "./base.js";

export const REPEAT_CANVAS_INSTANCE_CAP = 300;
export const LSYSTEM_CANVAS_POINT_CAP = 5_000;
const LSYSTEM_NATIVE_SYMBOL_CAP = 250_000;
const LSYSTEM_NATIVE_POINT_CAP = 100_000;

export interface RepeatPlacement {
  index: number;
  x: number;
  y: number;
  rotation: number;
  box: Box;
}

export interface RepeatGeometry {
  motifBox: Box | null;
  placements: RepeatPlacement[];
  total: number;
  nativeEntities: number;
  bounds: Box;
}

export interface LSystemGeometry {
  points: { x: number; y: number }[];
  expandedSymbols: number;
  drawnSegments: number;
  issue: string | null;
  bounds: Box;
}

const fallbackBox = (x = 0, y = 0, width = 220, height = 110): Box => ({ x: x - width / 2, y: y - height / 2, width, height });
const centerOf = (box: Box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

function rotate(x: number, y: number, degrees: number) {
  const radians = degrees * Math.PI / 180;
  const sin = Math.sin(radians), cos = Math.cos(radians);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function boxAround(points: readonly { x: number; y: number }[], fallback: Box): Box {
  if (points.length === 0) return fallback;
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
}

function transformedBox(source: Box, offset: { x: number; y: number }, degrees: number, scale: number): Box {
  const center = centerOf(source);
  const corners = [
    { x: source.x, y: source.y }, { x: source.x + source.width, y: source.y },
    { x: source.x + source.width, y: source.y + source.height }, { x: source.x, y: source.y + source.height },
  ].map((point) => {
    const turned = rotate((point.x - center.x) * scale, (point.y - center.y) * scale, degrees);
    return { x: center.x + offset.x + turned.x, y: center.y + offset.y + turned.y };
  });
  return boxAround(corners, source);
}

function sampleAxis(length: number, wanted: number): number[] {
  const count = Math.max(1, Math.min(length, wanted));
  if (count === 1) return [Math.floor((length - 1) / 2)];
  return [...new Set(Array.from({ length: count }, (_unused, index) => Math.round(index * (length - 1) / (count - 1))))];
}

function repeatTotal(entity: RepeatEntity): number {
  if (entity.layout === "hex") {
    const radius = Math.max(0, Math.floor(entity.rings) - 1);
    return 1 + 3 * radius * (radius + 1);
  }
  if (entity.layout === "grid") return Math.max(1, Math.floor(entity.rows)) * Math.max(1, Math.floor(entity.cols));
  return Math.max(1, Math.floor(entity.count));
}

function nativeMotifEntities(ref: string, ctx: GeometryContext, seen = new Set<string>()): number {
  if (seen.has(ref)) return 1;
  seen.add(ref);
  const matches = ctx.doc.entities.filter((candidate) => candidate.id === ref || candidate.tags?.includes(ref));
  if (matches.length === 0) return 1;
  return matches.reduce((sum, candidate) => sum + (candidate.kind === "repeat"
    ? repeatTotal(candidate) * nativeMotifEntities(candidate.motif, ctx, new Set(seen))
    : 1), 0);
}

function rawRepeatPlacements(entity: RepeatEntity): { index: number; x: number; y: number; rotation: number }[] {
  const total = repeatTotal(entity);
  const placements: { index: number; x: number; y: number; rotation: number }[] = [];
  if (entity.layout === "radial") {
    for (const index of sampleAxis(total, REPEAT_CANVAS_INSTANCE_CAP)) {
      const degrees = entity.rotate + index * 360 / total;
      const point = rotate(0, -entity.radius, degrees);
      placements.push({ index, ...point, rotation: entity.face === "out" ? degrees : entity.rotate });
    }
    return placements;
  }
  if (entity.layout === "grid") {
    const rows = Math.max(1, Math.floor(entity.rows)), cols = Math.max(1, Math.floor(entity.cols));
    const shownRows = Math.min(rows, Math.max(1, Math.floor(Math.sqrt(REPEAT_CANVAS_INSTANCE_CAP * rows / cols))));
    const rowIndexes = sampleAxis(rows, shownRows), colIndexes = sampleAxis(cols, Math.max(1, Math.floor(REPEAT_CANVAS_INSTANCE_CAP / rowIndexes.length)));
    const ox = (cols - 1) * entity.gapX / 2, oy = (rows - 1) * entity.gapY / 2;
    for (const row of rowIndexes) for (const col of colIndexes) {
      const point = rotate(col * entity.gapX - ox, row * entity.gapY - oy, entity.rotate);
      placements.push({ index: row * cols + col, ...point, rotation: entity.rotate });
    }
    return placements;
  }

  const radius = Math.max(0, Math.floor(entity.rings) - 1);
  if (total <= REPEAT_CANVAS_INSTANCE_CAP) {
    let index = 0;
    for (let q = -radius; q <= radius; q += 1) {
      const r0 = Math.max(-radius, -q - radius), r1 = Math.min(radius, -q + radius);
      for (let r = r0; r <= r1; r += 1) {
        const point = rotate(entity.spacing * Math.sqrt(3) * (q + r / 2), entity.spacing * 1.5 * r, entity.rotate);
        placements.push({ index, ...point, rotation: entity.rotate });
        index += 1;
      }
    }
    return placements;
  }
  const qIndexes = sampleAxis(radius * 2 + 1, Math.max(3, Math.floor(Math.sqrt(REPEAT_CANVAS_INSTANCE_CAP))));
  let ordinal = 0;
  for (const qIndex of qIndexes) {
    const q = qIndex - radius;
    const r0 = Math.max(-radius, -q - radius), r1 = Math.min(radius, -q + radius);
    const rIndexes = sampleAxis(r1 - r0 + 1, Math.max(1, Math.floor(REPEAT_CANVAS_INSTANCE_CAP / qIndexes.length)));
    for (const rIndex of rIndexes) {
      const r = r0 + rIndex;
      const point = rotate(entity.spacing * Math.sqrt(3) * (q + r / 2), entity.spacing * 1.5 * r, entity.rotate);
      placements.push({ index: ordinal, ...point, rotation: entity.rotate });
      ordinal += 1;
    }
  }
  return placements;
}

export function repeatGeometry(entity: RepeatEntity, ctx?: GeometryContext): RepeatGeometry {
  const motifBox = ctx?.bounds(entity.motif) ?? null;
  const total = repeatTotal(entity);
  const nativeEntities = total * (ctx ? nativeMotifEntities(entity.motif, ctx) : 1);
  if (!motifBox) return { motifBox: null, placements: [], total, nativeEntities, bounds: fallbackBox() };
  const placements = rawRepeatPlacements(entity).map((placement) => ({
    ...placement,
    box: transformedBox(motifBox, placement, placement.rotation, entity.instanceScale),
  }));
  const corners = placements.flatMap((placement) => [
    { x: placement.box.x, y: placement.box.y },
    { x: placement.box.x + placement.box.width, y: placement.box.y + placement.box.height },
  ]);
  return { motifBox, placements, total, nativeEntities, bounds: boxAround(corners, motifBox) };
}

interface RepeatOptions extends Omit<RepeatEntity, keyof ReturnType<typeof baseEntity> | "kind" | "motif" | "strokeWidth"> {}

function parseWhole(raw: string, min = 1): number | null {
  if (!/^\d+$/u.test(raw)) return null;
  const value = Number(raw);
  return value >= min && value <= 1_000 ? value : null;
}

function parseFinite(raw: string): number | null {
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseRepeatOptions(raw: string): RepeatOptions | null {
  const options: RepeatOptions = { layout: "grid", rings: 3, rows: 3, cols: 3, count: 8, spacing: 80, gapX: 80, gapY: 80, radius: 180, rotate: 0, instanceScale: 1, face: "same" };
  for (const token of raw.trim().split(/\s+/u).filter(Boolean)) {
    const pair = token.split("=");
    if (pair.length !== 2) return null;
    const [key, value] = pair;
    if (key === "layout") {
      if (!["hex", "grid", "radial"].includes(value)) return null;
      options.layout = value as RepeatLayout;
    } else if (["rings", "rows", "cols", "count"].includes(key)) {
      const parsed = parseWhole(value);
      if (parsed === null) return null;
      (options as unknown as Record<string, unknown>)[key] = parsed;
    } else if (["spacing", "gapx", "gapy", "radius", "rotate", "scale"].includes(key)) {
      const parsed = parseFinite(value);
      if (parsed === null || (key === "scale" && parsed <= 0)) return null;
      if (key === "spacing") { options.spacing = parsed; options.gapX = parsed; options.gapY = parsed; }
      else if (key === "gapx") options.gapX = parsed;
      else if (key === "gapy") options.gapY = parsed;
      else if (key === "scale") options.instanceScale = parsed;
      else (options as unknown as Record<string, unknown>)[key] = parsed;
    } else if (key === "face") {
      if (value !== "same" && value !== "out") return null;
      options.face = value;
    } else return null;
  }
  return options;
}

function repeatOptionString(entity: RepeatEntity): string {
  // Preserve the inactive layout values too. This lets an author explore
  // hex/grid/radial and switch back without silently losing prior settings;
  // native Manic accepts all keys and only reads the active layout's subset.
  return `layout=${entity.layout} rings=${Math.floor(entity.rings)} rows=${Math.floor(entity.rows)} cols=${Math.floor(entity.cols)} count=${Math.floor(entity.count)} spacing=${num(entity.spacing)} gapx=${num(entity.gapX)} gapy=${num(entity.gapY)} radius=${num(entity.radius)} face=${entity.face} rotate=${num(entity.rotate)} scale=${num(entity.instanceScale)}`;
}

function selectableMotifs(doc?: SceneDoc): SceneEntity[] {
  return doc?.entities.filter((entity) => entity.origin !== "generated") ?? [];
}

registerEntity<RepeatEntity>({
  kind: "repeat", ctor: "repeat", group: "Generative", label: "Repeat motif", icon: "⠿", order: 73,
  hint: "Repeat one entity or tagged motif as a bounded hex, grid, or radial arrangement", fidelity: "semantic", movable: false,
  canCreate: (doc) => selectableMotifs(doc).length > 0,
  createBlockedReason: "Add or select a motif before creating a repeat field.",
  create(id, _x, _y, doc, selectedId) {
    const motif = preferReference(doc, selectedId)?.id ?? "motif";
    return { ...baseEntity(id, "cyan"), kind: "repeat", motif, ...parseRepeatOptions("layout=grid")!, strokeWidth: null };
  },
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), motif = argName(stmt.args, 1), options = argString(stmt.args, 2);
    if (!id || !motif || options === null || stmt.args.length !== 3) return null;
    const parsed = parseRepeatOptions(options);
    return parsed ? { ...baseEntity(id, "fg"), kind: "repeat", motif, ...parsed, strokeWidth: null } : null;
  },
  ctorLine: (entity) => `repeat(${entity.id}, ${entity.motif}, "${repeatOptionString(entity)}");`,
  extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`],
  modifiers: { stroke: strokeWidthModifier },
  references: (entity) => [entity.motif],
  replaceReference(entity, from, to) { if (entity.motif === from) entity.motif = to; },
  anchor(entity, ctx) { const box = ctx?.bounds(entity.motif); return box ? centerOf(box) : { x: 0, y: 0 }; },
  translate() {},
  bounds: (entity, ctx) => repeatGeometry(entity, ctx).bounds,
  handles: () => [], dragHandle() {},
  fields: [
    { key: "motif", label: "Motif entity or tag", input: "entity", includeTags: true, referencesEarlierOnly: true, hint: "The source artwork stays unchanged; Preview clones it into stable instance tags." },
    { key: "layout", label: "Arrangement", input: "select", options: ["hex", "grid", "radial"] },
    { key: "rings", label: "Hex rings", input: "range", min: 1, max: 30, step: 1, unit: "", visibleWhen: { key: "layout", equals: "hex" } },
    { key: "spacing", label: "Hex spacing", input: "range", min: 0, max: 300, step: 1, visibleWhen: { key: "layout", equals: "hex" } },
    { key: "rows", label: "Rows", input: "number", min: 1, max: 100, step: 1, visibleWhen: { key: "layout", equals: "grid" } },
    { key: "cols", label: "Columns", input: "number", min: 1, max: 100, step: 1, visibleWhen: { key: "layout", equals: "grid" } },
    { key: "gapX", label: "Column gap", input: "number", step: 1, visibleWhen: { key: "layout", equals: "grid" } },
    { key: "gapY", label: "Row gap", input: "number", step: 1, visibleWhen: { key: "layout", equals: "grid" } },
    { key: "count", label: "Radial count", input: "number", min: 1, max: 1_000, step: 1, visibleWhen: { key: "layout", equals: "radial" } },
    { key: "radius", label: "Radial radius", input: "range", min: 0, max: 800, step: 1, visibleWhen: { key: "layout", equals: "radial" } },
    { key: "face", label: "Motif direction", input: "select", options: ["same", "out"], visibleWhen: { key: "layout", equals: "radial" } },
    { key: "rotate", label: "Arrangement rotation", input: "range", min: -180, max: 180, step: 1, unit: "°" },
    { key: "instanceScale", label: "Motif scale", input: "range", min: .05, max: 3, step: .05, unit: "×" },
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 },
  ],
});

interface ParsedLSystemOptions {
  angle: number; heading: number; iterations: number; drawSymbols: string; padding: number; boundary: LSystemEntity["boundary"];
}

function parseBool(value: string): boolean | null {
  if (["true", "yes", "1"].includes(value)) return true;
  if (["false", "no", "0"].includes(value)) return false;
  return null;
}

function parseLSystemOptions(raw: string): ParsedLSystemOptions | null {
  const options: ParsedLSystemOptions = { angle: 90, heading: 0, iterations: 4, drawSymbols: "F", padding: .04, boundary: "open" };
  let closed = false, fill = false;
  for (const token of raw.trim().split(/\s+/u).filter(Boolean)) {
    const pair = token.split("=");
    if (pair.length !== 2) return null;
    const [key, value] = pair;
    if (key === "angle" || key === "heading" || key === "padding") {
      const parsed = parseFinite(value);
      if (parsed === null || (key === "padding" && (parsed < 0 || parsed > .4))) return null;
      options[key] = parsed;
    } else if (key === "iterations") {
      const parsed = parseWhole(value, 0);
      if (parsed === null || parsed > 16) return null;
      options.iterations = parsed;
    } else if (key === "draw") {
      if (!value) return null;
      options.drawSymbols = value;
    } else if (key === "closed" || key === "fill") {
      const parsed = parseBool(value);
      if (parsed === null) return null;
      if (key === "closed") closed = parsed; else fill = parsed;
    } else return null;
  }
  if (fill && !closed) return null;
  options.boundary = fill ? "filled" : closed ? "closed" : "open";
  return options;
}

function parseRules(raw: string): Map<string, string> | null {
  const rules = new Map<string, string>();
  for (const one of raw.split(";").map((rule) => rule.trim()).filter(Boolean)) {
    const split = one.indexOf("=");
    if (split < 0) return null;
    const left = one.slice(0, split).trim(), right = one.slice(split + 1).replaceAll(/\s/gu, "");
    if ([...left].length !== 1 || ["+", "-", "|"].includes(left) || rules.has(left)) return null;
    rules.set(left, right);
  }
  return rules.size > 0 ? rules : null;
}

const lsystemCache = new WeakMap<LSystemEntity, { signature: string; geometry: LSystemGeometry }>();

export function lsystemGeometry(entity: LSystemEntity): LSystemGeometry {
  const signature = [entity.x, entity.y, entity.size, entity.axiom, entity.rules, entity.angle, entity.heading, entity.iterations, entity.drawSymbols, entity.padding, entity.boundary].join("\u0000");
  const cached = lsystemCache.get(entity);
  if (cached?.signature === signature) return cached.geometry;
  const fallback = fallbackBox(entity.x, entity.y, entity.size, entity.size);
  const finish = (geometry: LSystemGeometry) => { lsystemCache.set(entity, { signature, geometry }); return geometry; };
  const rules = parseRules(entity.rules);
  if (!rules) return finish({ points: [], expandedSymbols: 0, drawnSegments: 0, issue: "The grammar needs rules such as F=F+F-F.", bounds: fallback });
  let program = entity.axiom.replaceAll(/\s/gu, "");
  if (!program) return finish({ points: [], expandedSymbols: 0, drawnSegments: 0, issue: "The axiom is empty.", bounds: fallback });
  for (let iteration = 0; iteration < Math.floor(entity.iterations); iteration += 1) {
    let next = "";
    for (const symbol of program) {
      next += rules.get(symbol) ?? symbol;
      if (next.length > LSYSTEM_NATIVE_SYMBOL_CAP) return finish({ points: [], expandedSymbols: next.length, drawnSegments: 0, issue: `Expansion exceeds the native ${LSYSTEM_NATIVE_SYMBOL_CAP.toLocaleString()}-symbol limit.`, bounds: fallback });
    }
    program = next;
  }
  const draw = new Set(entity.drawSymbols), raw = [{ x: 0, y: 0 }];
  let x = 0, y = 0, heading = entity.heading * Math.PI / 180;
  const turn = entity.angle * Math.PI / 180;
  for (const symbol of program) {
    if (draw.has(symbol)) {
      x += Math.cos(heading); y += Math.sin(heading); raw.push({ x, y });
      if (raw.length > LSYSTEM_NATIVE_POINT_CAP) return finish({ points: [], expandedSymbols: program.length, drawnSegments: raw.length - 1, issue: `Path exceeds the native ${LSYSTEM_NATIVE_POINT_CAP.toLocaleString()}-point limit.`, bounds: fallback });
    } else if (symbol === "+") heading += turn;
    else if (symbol === "-") heading -= turn;
    else if (symbol === "|") heading += Math.PI;
    else if (symbol === "[" || symbol === "]") return finish({ points: [], expandedSymbols: program.length, drawnSegments: raw.length - 1, issue: "Branching [ ] grammars need recursive def or tree3.", bounds: fallback });
  }
  if (raw.length < 2) return finish({ points: [], expandedSymbols: program.length, drawnSegments: 0, issue: "No drawn segments match the Draw symbols.", bounds: fallback });
  let minX = raw[0].x, maxX = raw[0].x, minY = raw[0].y, maxY = raw[0].y;
  for (const point of raw) {
    minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
  }
  const spanX = maxX - minX, spanY = maxY - minY, extent = Math.max(spanX, spanY);
  if (!Number.isFinite(extent) || extent <= 1e-6) return finish({ points: [], expandedSymbols: program.length, drawnSegments: raw.length - 1, issue: "The generated path has no visible extent.", bounds: fallback });
  const scale = entity.size * (1 - entity.padding * 2) / extent;
  const midpoint = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const step = Math.max(1, Math.ceil(raw.length / LSYSTEM_CANVAS_POINT_CAP));
  const indexes = [...new Set([...Array.from({ length: Math.ceil(raw.length / step) }, (_unused, index) => index * step), raw.length - 1])];
  const points = indexes.map((index) => ({ x: entity.x + (raw[index].x - midpoint.x) * scale, y: entity.y - (raw[index].y - midpoint.y) * scale }));
  const bounds = { x: entity.x - spanX * scale / 2, y: entity.y - spanY * scale / 2, width: Math.max(1, spanX * scale), height: Math.max(1, spanY * scale) };
  return finish({ points, expandedSymbols: program.length, drawnSegments: raw.length - 1, issue: null, bounds });
}

function lsystemOptions(entity: LSystemEntity): string {
  const boundary = entity.boundary === "filled" ? " closed=true fill=true" : entity.boundary === "closed" ? " closed=true" : "";
  return `angle=${num(entity.angle)} heading=${num(entity.heading)} iterations=${Math.floor(entity.iterations)} draw=${entity.drawSymbols} padding=${num(entity.padding)}${boundary}`;
}

registerEntity<LSystemEntity>({
  kind: "lsystem", ctor: "lsystem", anchorArgIndex: 1, group: "Generative", label: "L-system curve", icon: "⌁ƒ", order: 74,
  hint: "A deterministic rewrite grammar compiled into one fitted native path", fidelity: "semantic",
  create: (id, x, y) => ({ ...baseEntity(id, "cyan"), kind: "lsystem", x, y, size: 360, axiom: "F+F+F+F", rules: "F=FF+F+F+F+FF", angle: 90, heading: 0, iterations: 3, drawSymbols: "F", padding: .04, boundary: "open", strokeWidth: 3 }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), center = argPoint(stmt.args, 1), size = argNumber(stmt.args, 2), axiom = argString(stmt.args, 3), rules = argString(stmt.args, 4);
    if (!id || !center || size === null || size <= 0 || axiom === null || rules === null || stmt.args.length > 6) return null;
    const options = parseLSystemOptions(argString(stmt.args, 5) ?? "");
    return options ? { ...baseEntity(id, "cyan"), kind: "lsystem", x: center.x, y: center.y, size, axiom, rules, ...options, strokeWidth: null } : null;
  },
  ctorLine: (entity) => `lsystem(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.size)}, "${escapeString(entity.axiom)}", "${escapeString(entity.rules)}", "${lsystemOptions(entity)}");`,
  extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`],
  modifiers: { stroke: strokeWidthModifier },
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds: (entity) => lsystemGeometry(entity).bounds,
  handles: (entity) => [{ name: "size", x: entity.x + entity.size / 2, y: entity.y + entity.size / 2 }],
  dragHandle(entity, _handle, px, py) { entity.size = Math.max(20, 2 * Math.max(Math.abs(px - entity.x), Math.abs(py - entity.y))); },
  fields: [
    { key: "size", label: "Fit size", input: "range", min: 40, max: 1_200, step: 10 },
    { key: "axiom", label: "Axiom", input: "text", hint: "Starting symbols. F is drawn by default; +/− turn and | reverses." },
    { key: "rules", label: "Rewrite rules", input: "textarea", hint: "Separate rules with semicolons, for example X=YF+XF+Y;Y=XF-YF-X." },
    { key: "iterations", label: "Iterations", input: "range", min: 0, max: 16, step: 1, unit: "" },
    { key: "angle", label: "Turn angle", input: "range", min: -180, max: 180, step: 1, unit: "°" },
    { key: "heading", label: "Starting heading", input: "range", min: -180, max: 180, step: 1, unit: "°" },
    { key: "drawSymbols", label: "Draw symbols", input: "text", hint: "Every matching symbol advances the turtle with a stroke." },
    { key: "padding", label: "Fit padding", input: "range", min: 0, max: .4, step: .01, unit: "" },
    { key: "boundary", label: "Boundary", input: "select", options: ["open", "closed", "filled"] },
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 },
  ],
});
