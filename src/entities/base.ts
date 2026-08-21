// Shared pieces for entity definitions.

import { argName, argNumber, num } from "../args.js";
import type { CallStatement } from "../script.js";
import type { CircleEntity, EntityBase, PolygonEntity, RectEntity } from "../types.js";

export function baseEntity(id: string, color: string): EntityBase {
  return { id, color, opacity: 1, rotation: 0, reveal: "none", untraced: false, hue: null };
}

type Shape = CircleEntity | RectEntity | PolygonEntity;

/** paint / stroke / outline vocabulary shared by filled shapes. */
export const shapeModifiers = {
  outlined(entity: Shape): boolean {
    entity.paint = "outlined";
    return true;
  },
  filled(entity: Shape): boolean {
    entity.paint = "filled";
    return true;
  },
  stroke(entity: Shape, stmt: CallStatement): boolean {
    const width = argNumber(stmt.args, 1);
    if (width === null) return false;
    entity.strokeWidth = width;
    return true;
  },
  outline(entity: Shape, stmt: CallStatement): boolean {
    const color = argName(stmt.args, 1);
    if (!color) return false;
    entity.outlineColor = color;
    return true;
  },
};

export function shapeExtraLines(entity: Shape): string[] {
  const out: string[] = [];
  if (entity.paint !== "default") out.push(`${entity.paint}(${entity.id});`);
  if (entity.strokeWidth !== null) out.push(`stroke(${entity.id}, ${num(entity.strokeWidth)});`);
  if (entity.outlineColor !== null) out.push(`outline(${entity.id}, ${entity.outlineColor});`);
  return out;
}

export function strokeWidthModifier(entity: { strokeWidth: number | null }, stmt: CallStatement): boolean {
  const width = argNumber(stmt.args, 1);
  if (width === null) return false;
  entity.strokeWidth = width;
  return true;
}
