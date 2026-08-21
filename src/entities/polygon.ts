// polygon — a closed shape through ≥3 points, with an optional trailing color.

import { argName, argNumber, argPoint, num, pt } from "../args.js";
import { registerEntity } from "../registry.js";
import { baseEntity, shapeExtraLines, shapeModifiers } from "./base.js";
import type { PolygonEntity } from "../types.js";

registerEntity<PolygonEntity>({
  kind: "polygon",
  ctor: "polygon",
  group: "Shapes",
  label: "Polygon",
  icon: "▲",
  order: 23,
  hint: "A closed shape through three or more points",
  create: (id, x, y) => ({
    ...baseEntity(id, "cyan"), kind: "polygon",
    points: [{ x, y: y - 80 }, { x: x - 90, y: y + 60 }, { x: x + 90, y: y + 60 }],
    paint: "default", strokeWidth: null, outlineColor: null,
  }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0);
    if (!id) return null;
    const points: { x: number; y: number }[] = [];
    let index = 1;
    for (;;) {
      const point = argPoint(stmt.args, index);
      if (!point) break;
      points.push(point);
      index += 1;
    }
    if (points.length < 3) return null;
    let color = "cyan";
    const trailing = argName(stmt.args, index);
    if (trailing !== null) { color = trailing; index += 1; }
    if (index !== stmt.args.length) return null;
    return { ...baseEntity(id, color), kind: "polygon", points, paint: "default", strokeWidth: null, outlineColor: null };
  },
  ctorLine: (entity) => `polygon(${entity.id}, ${entity.points.map((point) => pt(point.x, point.y)).join(", ")});`,
  extraLines: shapeExtraLines,
  modifiers: shapeModifiers,
  anchor(entity) {
    const n = entity.points.length;
    return {
      x: entity.points.reduce((sum, point) => sum + point.x, 0) / n,
      y: entity.points.reduce((sum, point) => sum + point.y, 0) / n,
    };
  },
  translate(entity, dx, dy) {
    for (const point of entity.points) { point.x += dx; point.y += dy; }
  },
  bounds(entity) {
    const xs = entity.points.map((point) => point.x);
    const ys = entity.points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  },
  handles: (entity) => entity.points.map((point, index) => ({ name: `p${index}`, x: point.x, y: point.y })),
  dragHandle(entity, handle, px, py) {
    const index = Number(handle.slice(1));
    const point = entity.points[index];
    if (point) { point.x = px; point.y = py; }
  },
  fields: [
    { key: "paint", label: "Paint", input: "select", options: ["default", "outlined", "filled"] },
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 },
    { key: "outlineColor", label: "Rim color", input: "color", nullable: true },
  ],
});
