// line · arrow — the stroke family (two endpoints).

import { argName, argPoint, pt, num } from "../args.js";
import { registerEntity } from "../registry.js";
import { baseEntity, strokeWidthModifier } from "./base.js";
import type { ArrowEntity, LineEntity } from "../types.js";

function strokeDef<E extends LineEntity | ArrowEntity>(kind: E["kind"], ctor: string, label: string, icon: string, order: number, hint: string, color: string) {
  registerEntity<E>({
    kind,
    ctor,
    group: "Shapes",
    label,
    icon,
    order,
    hint,
    create: (id, x, y) => ({ ...baseEntity(id, color), kind, x1: x - 110, y1: y, x2: x + 110, y2: y, strokeWidth: null } as E),
    parseArgs(stmt) {
      const id = argName(stmt.args, 0);
      const from = argPoint(stmt.args, 1);
      const to = argPoint(stmt.args, 2);
      if (!id || !from || !to) return null;
      return { ...baseEntity(id, color), kind, x1: from.x, y1: from.y, x2: to.x, y2: to.y, strokeWidth: null } as E;
    },
    ctorLine: (entity) => `${ctor}(${entity.id}, ${pt(entity.x1, entity.y1)}, ${pt(entity.x2, entity.y2)});`,
    extraLines: (entity) => (entity.strokeWidth !== null ? [`stroke(${entity.id}, ${num(entity.strokeWidth)});`] : []),
    modifiers: { stroke: strokeWidthModifier },
    anchor: (entity) => ({ x: (entity.x1 + entity.x2) / 2, y: (entity.y1 + entity.y2) / 2 }),
    translate(entity, dx, dy) {
      entity.x1 += dx; entity.y1 += dy; entity.x2 += dx; entity.y2 += dy;
    },
    bounds: (entity) => ({
      x: Math.min(entity.x1, entity.x2),
      y: Math.min(entity.y1, entity.y2),
      width: Math.abs(entity.x2 - entity.x1),
      height: Math.abs(entity.y2 - entity.y1),
    }),
    handles: (entity) => [
      { name: "p1", x: entity.x1, y: entity.y1 },
      { name: "p2", x: entity.x2, y: entity.y2 },
    ],
    dragHandle(entity, handle, px, py) {
      if (handle === "p1") { entity.x1 = px; entity.y1 = py; }
      else { entity.x2 = px; entity.y2 = py; }
    },
    fields: [{ key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 }],
  });
}

strokeDef<LineEntity>("line", "line", "Line", "—", 30, "A straight stroke between two points", "dim");
strokeDef<ArrowEntity>("arrow", "arrow", "Arrow", "→", 31, "A line with an arrowhead at its second point", "gold");
