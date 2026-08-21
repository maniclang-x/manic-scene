// counter — a live numeric readout (`to(id, value, target)` makes it count).

import { argName, argNumber, argPoint, argString, escapeString, num, pt } from "../args.js";
import { registerEntity } from "../registry.js";
import { baseEntity } from "./base.js";
import type { CounterEntity } from "../types.js";

export function counterText(entity: CounterEntity): string {
  return `${entity.prefix}${entity.value.toFixed(entity.decimals)}${entity.suffix}`;
}

registerEntity<CounterEntity>({
  kind: "counter",
  ctor: "counter",
  anchorArgIndex: 1,
  group: "Math",
  label: "Counter",
  icon: "№",
  order: 41,
  hint: "A numeric readout — animate it with to(id, value, target)",
  create: (id, x, y) => ({
    ...baseEntity(id, "fg"), kind: "counter", x, y, value: 0, decimals: 0, prefix: "", suffix: "",
  }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0);
    const point = argPoint(stmt.args, 1);
    const value = argNumber(stmt.args, 2);
    if (!id || !point || value === null) return null;
    return {
      ...baseEntity(id, "fg"), kind: "counter", x: point.x, y: point.y, value,
      decimals: argNumber(stmt.args, 3) ?? 0,
      prefix: argString(stmt.args, 4) ?? "",
      suffix: argString(stmt.args, 5) ?? "",
    };
  },
  ctorLine(entity) {
    const parts = [entity.id, pt(entity.x, entity.y), num(entity.value), num(entity.decimals), `"${escapeString(entity.prefix)}"`, `"${escapeString(entity.suffix)}"`];
    return `counter(${parts.join(", ")});`;
  },
  extraLines: () => [],
  modifiers: {},
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds(entity) {
    const width = Math.max(3, counterText(entity).length) * 28 * 0.62;
    return { x: entity.x - width / 2, y: entity.y - 22, width, height: 44 };
  },
  handles: () => [],
  dragHandle() {},
  fields: [
    { key: "value", label: "Value", input: "number", step: 1 },
    { key: "decimals", label: "Decimals", input: "number", min: 0, max: 6, step: 1 },
    { key: "prefix", label: "Prefix", input: "text" },
    { key: "suffix", label: "Suffix", input: "text" },
  ],
});
