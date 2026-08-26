// Core motion-dependent constructors. These are semantic authoring objects:
// native Preview resolves the recorded trail and expands sweep template cells.

import { argName, argNumber, argPoint, num, pt } from "../args.js";
import { catalogEntry } from "../catalog.js";
import { defFor, preferReference, registerEntity, type Box } from "../registry.js";
import type { SceneDoc, SceneEntity, SweepEntity, TrailEntity } from "../types.js";
import { baseEntity } from "./base.js";

export const SWEEP_CANVAS_CELL_CAP = 144;
const SWEEP_RESERVED_PARAMETERS = new Set(["w", "h", "cx", "cy", "pi", "tau", "e", "inf"]);
const TRAIL_TARGET_KINDS = [
  "text", "equation", "circle", "rect", "dot", "polygon", "counter", "label", "link", "framebox",
  "brace", "bracelabel", "bracetext", "invertpath", "reflectpath", "boolean", "cloud", "shader", "lsystem",
  "line", "arrow", "segment", "vector", "ellipse", "circle2", "midpoint", "anglemark", "rightangle",
  "plot", "deriv", "accum", "tangent", "slope", "area", "integral", "safezone", "watermark",
] as const;
const TRAIL_TARGET_SET = new Set<string>(TRAIL_TARGET_KINDS);

export interface SweepCell {
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  xValue: number;
  yValue: number;
}

export interface SweepGeometry {
  cells: SweepCell[];
  total: number;
  bounds: Box;
}

function sampleAxis(length: number, wanted: number): number[] {
  const count = Math.max(1, Math.min(length, wanted));
  if (count === 1) return [Math.floor((length - 1) / 2)];
  return [...new Set(Array.from({ length: count }, (_unused, index) => Math.round(index * (length - 1) / (count - 1))))];
}

function lerp(from: number, to: number, index: number, count: number): number {
  return count <= 1 ? (from + to) / 2 : from + (to - from) * index / (count - 1);
}

export function sweepGeometry(entity: SweepEntity): SweepGeometry {
  const rows = Math.max(1, Math.round(entity.rows)), cols = Math.max(1, Math.round(entity.cols));
  const width = cols * entity.cellWidth, height = rows * entity.cellHeight;
  const shownRows = Math.min(rows, Math.max(1, Math.floor(Math.sqrt(SWEEP_CANVAS_CELL_CAP * rows / cols))));
  const rowIndexes = sampleAxis(rows, shownRows);
  const colIndexes = sampleAxis(cols, Math.max(1, Math.floor(SWEEP_CANVAS_CELL_CAP / rowIndexes.length)));
  const cells = rowIndexes.flatMap((row) => colIndexes.map((col) => ({
    row, col,
    x: entity.x - width / 2 + col * entity.cellWidth,
    y: entity.y - height / 2 + row * entity.cellHeight,
    width: entity.cellWidth,
    height: entity.cellHeight,
    xValue: lerp(entity.xFrom, entity.xTo, col, cols),
    yValue: lerp(entity.yFrom, entity.yTo, row, rows),
  })));
  return { cells, total: rows * cols, bounds: { x: entity.x - width / 2, y: entity.y - height / 2, width, height } };
}

function numericParameters(entity: SceneEntity): string[] {
  return (catalogEntry(defFor(entity).ctor)?.params ?? []).filter((param) => param.ty === "num" && !param.optional && !SWEEP_RESERVED_PARAMETERS.has(param.name)).map((param) => param.name);
}

function sweepTemplates(doc?: SceneDoc): SceneEntity[] {
  return doc?.entities.filter((entity) => entity.kind !== "sweep" && entity.origin !== "generated" && numericParameters(entity).length >= 2) ?? [];
}

registerEntity<TrailEntity>({
  kind: "trail", ctor: "trail", group: "Motion", label: "Motion trail", icon: "〰", order: 52, fidelity: "semantic", colorInCtor: true, movable: false,
  hint: "Persistent path that records another entity's resolved motion",
  canCreate: (doc) => doc.entities.some((entity) => TRAIL_TARGET_SET.has(entity.kind) && entity.origin !== "generated"),
  createBlockedReason: "Motion trail needs an earlier concrete entity whose position it can record.",
  create(id, _x, _y, doc, selectedId) {
    const target = preferReference(doc, selectedId, (entity) => TRAIL_TARGET_SET.has(entity.kind))
      ?? [...(doc?.entities ?? [])].reverse().find((entity) => TRAIL_TARGET_SET.has(entity.kind));
    return { ...baseEntity(id, "gold"), kind: "trail", target: target?.id ?? "target", thickness: 2.5 };
  },
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), target = argName(stmt.args, 1), color = argName(stmt.args, 2) ?? "gold", thickness = argNumber(stmt.args, 3) ?? 2.5;
    if (!id || !target || stmt.args.length > 4) return null;
    return { ...baseEntity(id, color), kind: "trail", target, thickness: Math.max(.5, thickness) };
  },
  ctorLine: (entity) => `trail(${entity.id}, ${entity.target}, ${entity.color}, ${num(Math.max(.5, entity.thickness))});`,
  extraLines: () => [], modifiers: {},
  references: (entity) => [entity.target],
  replaceReference(entity, from, to) { if (entity.target === from) entity.target = to; },
  anchor(entity, ctx) {
    const box = ctx?.bounds(entity.target);
    return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : { x: 0, y: 0 };
  },
  translate() {},
  bounds(entity, ctx) {
    const box = ctx?.bounds(entity.target);
    if (!box) return { x: 0, y: 0, width: 120, height: 60 };
    return { x: box.x - 80, y: box.y, width: box.width + 80, height: Math.max(35, box.height) };
  },
  handles: () => [], dragHandle() {},
  fields: [
    { key: "target", label: "Recorded entity", input: "entity", entityKinds: TRAIL_TARGET_KINDS, referencesEarlierOnly: true, hint: "Preview resolves the full motion timeline; Canvas shows the live relationship." },
    { key: "thickness", label: "Trail thickness", input: "number", min: .5, max: 40, step: .5 },
  ],
});

registerEntity<SweepEntity>({
  kind: "sweep", ctor: "sweep", group: "Layout", label: "Parameter sweep", icon: "▦ƒ", order: 53, fidelity: "semantic", colorInCtor: true,
  hint: "Grid of one earlier template evaluated across two numeric parameters",
  canCreate: (doc) => sweepTemplates(doc).length > 0,
  createBlockedReason: "Parameter sweep needs an earlier Canvas entity whose native constructor exposes at least two numeric parameters.",
  create(id, x, y, doc, selectedId) {
    const template = preferReference(doc, selectedId, (entity) => entity.kind !== "sweep" && numericParameters(entity).length >= 2) ?? sweepTemplates(doc).at(-1);
    const params = template ? numericParameters(template) : ["x", "y"];
    return { ...baseEntity(id, "dim"), kind: "sweep", template: template?.id ?? "template", xParam: params[0], xFrom: 40, xTo: 160, yParam: params[1], yFrom: 40, yTo: 160, x, y, cols: 3, rows: 3, cellWidth: 130, cellHeight: 120, keepOverlays: false, fit: 1 };
  },
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), template = argName(stmt.args, 1), xParam = argName(stmt.args, 2), xRange = argPoint(stmt.args, 3), yParam = argName(stmt.args, 4), yRange = argPoint(stmt.args, 5);
    const center = argPoint(stmt.args, 6) ?? { x: 640, y: 360 };
    if (!id || !template || !xParam || !xRange || !yParam || !yRange || stmt.args.length > 13) return null;
    return {
      ...baseEntity(id, "dim"), kind: "sweep", template, xParam, xFrom: xRange.x, xTo: xRange.y, yParam, yFrom: yRange.x, yTo: yRange.y,
      x: center.x, y: center.y,
      cols: Math.max(1, Math.round(argNumber(stmt.args, 7) ?? 3)), rows: Math.max(1, Math.round(argNumber(stmt.args, 8) ?? 3)),
      cellWidth: Math.max(20, argNumber(stmt.args, 9) ?? 130), cellHeight: Math.max(20, argNumber(stmt.args, 10) ?? 120),
      keepOverlays: (argNumber(stmt.args, 11) ?? 0) >= .5, fit: Math.max(0, Math.min(1, argNumber(stmt.args, 12) ?? 1)),
    };
  },
  ctorLine: (entity) => `sweep(${entity.id}, ${entity.template}, ${entity.xParam}, ${pt(entity.xFrom, entity.xTo)}, ${entity.yParam}, ${pt(entity.yFrom, entity.yTo)}, ${pt(entity.x, entity.y)}, ${Math.max(1, Math.round(entity.cols))}, ${Math.max(1, Math.round(entity.rows))}, ${num(Math.max(20, entity.cellWidth))}, ${num(Math.max(20, entity.cellHeight))}, ${entity.keepOverlays ? 1 : 0}, ${num(Math.max(0, Math.min(1, entity.fit)))});`,
  extraLines: (entity) => entity.color === "dim" ? [] : [`color(${entity.id}, ${entity.color});`], modifiers: {},
  references: (entity) => [entity.template],
  replaceReference(entity, from, to) { if (entity.template === from) entity.template = to; },
  referenceIds(entity) {
    const rows = Math.max(1, Math.round(entity.rows)), cols = Math.max(1, Math.round(entity.cols));
    return [`${entity.id}.cells`, ...(rows * cols <= 256 ? Array.from({ length: rows * cols }, (_unused, index) => `${entity.id}.c${Math.floor(index / cols)}x${index % cols}`) : [])];
  },
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds: (entity) => sweepGeometry(entity).bounds,
  handles: () => [], dragHandle() {},
  fields: [
    { key: "template", label: "Earlier template", input: "entity", referencesEarlierOnly: true, entityMinNumericParams: 2, resetParameterKeys: ["xParam", "yParam"], hint: "Preview re-runs this native declaration in every cell." },
    { key: "xParam", label: "Column parameter", input: "parameter", parameterSourceKey: "template" },
    { key: "xFrom", label: "Column range from", input: "number", step: 1 },
    { key: "xTo", label: "Column range to", input: "number", step: 1 },
    { key: "yParam", label: "Row parameter", input: "parameter", parameterSourceKey: "template" },
    { key: "yFrom", label: "Row range from", input: "number", step: 1 },
    { key: "yTo", label: "Row range to", input: "number", step: 1 },
    { key: "cols", label: "Columns", input: "number", min: 1, max: 100, step: 1 },
    { key: "rows", label: "Rows", input: "number", min: 1, max: 100, step: 1 },
    { key: "cellWidth", label: "Cell width", input: "number", min: 20, max: 1200, step: 5 },
    { key: "cellHeight", label: "Cell height", input: "number", min: 20, max: 1200, step: 5 },
    { key: "fit", label: "Template fit", input: "range", min: 0, max: 1, step: .05, unit: "" },
    { key: "keepOverlays", label: "Keep template overlays", input: "checkbox", hint: "Off matches the usual clean comparison grid." },
  ],
});
