// circle · rect · dot — the filled-shape family.

import { argName, argNumber, argPoint, num, pt } from "../args.js";
import { registerEntity } from "../registry.js";
import { baseEntity, shapeExtraLines, shapeModifiers } from "./base.js";
import type { CircleEntity, DotEntity, RectEntity } from "../types.js";

registerEntity<CircleEntity>({
  kind: "circle",
  ctor: "circle",
  anchorArgIndex: 1,
  group: "Shapes",
  label: "Circle",
  icon: "○",
  order: 20,
  hint: "Filled + outlined by default; outlined for constructions",
  create: (id, x, y) => ({
    ...baseEntity(id, "cyan"), kind: "circle", x, y, r: 90, paint: "default", strokeWidth: null, outlineColor: null,
  }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0);
    const point = argPoint(stmt.args, 1);
    const r = argNumber(stmt.args, 2);
    if (!id || !point || r === null) return null;
    return { ...baseEntity(id, "cyan"), kind: "circle", x: point.x, y: point.y, r, paint: "default", strokeWidth: null, outlineColor: null };
  },
  ctorLine: (entity) => `circle(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.r)});`,
  extraLines: shapeExtraLines,
  modifiers: shapeModifiers,
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds: (entity) => ({ x: entity.x - entity.r, y: entity.y - entity.r, width: entity.r * 2, height: entity.r * 2 }),
  handles: (entity) => [{ name: "radius", x: entity.x + entity.r, y: entity.y }],
  dragHandle(entity, _handle, px, py) {
    entity.r = Math.max(3, Math.round(Math.hypot(px - entity.x, py - entity.y)));
  },
  fields: [
    { key: "r", label: "Radius", input: "range", min: 3, max: 280 },
    { key: "paint", label: "Paint", input: "select", options: ["default", "outlined", "filled"] },
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 },
    { key: "outlineColor", label: "Rim color", input: "color", nullable: true },
  ],
});

registerEntity<RectEntity>({
  kind: "rect",
  ctor: "rect",
  anchorArgIndex: 1,
  group: "Shapes",
  label: "Rect",
  icon: "▭",
  order: 21,
  hint: "A rectangle, centred on its point",
  create: (id, x, y) => ({
    ...baseEntity(id, "magenta"), kind: "rect", x, y, width: 240, height: 140, paint: "default", strokeWidth: null, outlineColor: null,
  }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0);
    const point = argPoint(stmt.args, 1);
    const width = argNumber(stmt.args, 2);
    const height = argNumber(stmt.args, 3);
    if (!id || !point || width === null || height === null) return null;
    return { ...baseEntity(id, "cyan"), kind: "rect", x: point.x, y: point.y, width, height, paint: "default", strokeWidth: null, outlineColor: null };
  },
  ctorLine: (entity) => `rect(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.width)}, ${num(entity.height)});`,
  extraLines: shapeExtraLines,
  modifiers: shapeModifiers,
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds: (entity) => ({ x: entity.x - entity.width / 2, y: entity.y - entity.height / 2, width: entity.width, height: entity.height }),
  handles: (entity) => [{ name: "corner", x: entity.x + entity.width / 2, y: entity.y + entity.height / 2 }],
  dragHandle(entity, _handle, px, py) {
    entity.width = Math.max(20, Math.round(Math.abs(px - entity.x) * 2));
    entity.height = Math.max(20, Math.round(Math.abs(py - entity.y) * 2));
  },
  fields: [
    { key: "width", label: "Width", input: "number", min: 20 },
    { key: "height", label: "Height", input: "number", min: 20 },
    { key: "paint", label: "Paint", input: "select", options: ["default", "outlined", "filled"] },
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 },
    { key: "outlineColor", label: "Rim color", input: "color", nullable: true },
  ],
});

registerEntity<DotEntity>({
  kind: "dot",
  ctor: "dot",
  anchorArgIndex: 1,
  group: "Shapes",
  label: "Dot",
  icon: "·",
  order: 22,
  hint: "A small filled disc — markers, anchors, points",
  create: (id, x, y) => ({ ...baseEntity(id, "cyan"), kind: "dot", x, y, r: 6 }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0);
    const point = argPoint(stmt.args, 1);
    if (!id || !point) return null;
    return { ...baseEntity(id, "cyan"), kind: "dot", x: point.x, y: point.y, r: argNumber(stmt.args, 2) ?? 6 };
  },
  ctorLine: (entity) => `dot(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.r)});`,
  extraLines: () => [],
  modifiers: {},
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds: (entity) => ({ x: entity.x - entity.r, y: entity.y - entity.r, width: entity.r * 2, height: entity.r * 2 }),
  handles: (entity) => [{ name: "radius", x: entity.x + entity.r, y: entity.y }],
  dragHandle(entity, _handle, px, py) {
    entity.r = Math.max(2, Math.round(Math.hypot(px - entity.x, py - entity.y)));
  },
  fields: [{ key: "r", label: "Radius", input: "range", min: 2, max: 40 }],
});
