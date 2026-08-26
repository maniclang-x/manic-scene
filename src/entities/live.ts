// Live-control vocabulary: a visible bounded parameter and its bind relations.

import { argName, argNumber, argPoint, argString, escapeString, num, pt } from "../args.js";
import { registerEntity, type Box } from "../registry.js";
import type { ParameterEntity } from "../types.js";
import { baseEntity } from "./base.js";

function parameterBox(entity: ParameterEntity): Box {
  return { x: entity.x - 112, y: entity.y - 22, width: 224, height: 70 };
}

registerEntity<ParameterEntity>({
  kind: "parameter", ctor: "parameter", group: "Data", label: "Parameter", icon: "p↔", order: 29,
  hint: "A visible bounded value that can drive other entities through Bind",
  anchorArgIndex: 1,
  create: (id, x, y) => ({
    ...baseEntity(id, "fg"), kind: "parameter", x, y, value: 0, min: -1, max: 1,
    label: null, decimals: 2, bindings: [],
  }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1);
    const value = argNumber(stmt.args, 2), min = argNumber(stmt.args, 3), max = argNumber(stmt.args, 4);
    if (!id || !at || value === null || min === null || max === null || min >= max || value < min || value > max) return null;
    const label = argString(stmt.args, 5);
    const decimals = argNumber(stmt.args, 6) ?? 2;
    if (stmt.args.length > 7 || (stmt.args.length > 5 && label === null)) return null;
    return {
      ...baseEntity(id, "fg"), kind: "parameter", x: at.x, y: at.y, value, min, max,
      label, decimals: Math.max(0, Math.min(6, Math.trunc(decimals))), bindings: [],
    };
  },
  ctorLine(entity) {
    const optional = entity.label !== null || entity.decimals !== 2
      ? `, "${escapeString(entity.label ?? entity.id)}"${entity.decimals !== 2 ? `, ${num(entity.decimals)}` : ""}`
      : "";
    return `parameter(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.value)}, ${num(entity.min)}, ${num(entity.max)}${optional});`;
  },
  extraLines: () => [],
  modifiers: {
    bind(entity, stmt) {
      const source = argName(stmt.args, 0), target = argName(stmt.args, 1), property = argName(stmt.args, 2);
      if (source !== entity.id || !target || !property) return false;
      const formulas: string[] = [];
      for (let index = 3; index < stmt.args.length; index += 1) {
        const formula = argString(stmt.args, index);
        if (formula === null) break;
        formulas.push(formula);
      }
      if (formulas.length > 0 && formulas.length === stmt.args.length - 3) {
        entity.bindings.push({ target, property, formulas, from: null, to: null });
        return true;
      }
      const from = argNumber(stmt.args, 3), to = argNumber(stmt.args, 4);
      if (from === null || to === null || stmt.args.length !== 5) return false;
      entity.bindings.push({ target, property, formulas: [], from, to });
      return true;
    },
  },
  references: (entity) => entity.bindings.map((binding) => binding.target),
  replaceReference(entity, from, to) {
    for (const binding of entity.bindings) if (binding.target === from) binding.target = to;
  },
  referenceIds: (entity) => [`${entity.id}.track`, `${entity.id}.fill`, `${entity.id}.dot`],
  referenceBounds(entity, ref) {
    const box = parameterBox(entity);
    if (ref === `${entity.id}.track` || ref === `${entity.id}.fill`) return { x: box.x + 16, y: box.y + 52, width: box.width - 32, height: 6 };
    if (ref === `${entity.id}.dot`) {
      const u = (entity.value - entity.min) / (entity.max - entity.min);
      return { x: box.x + 16 + u * (box.width - 32) - 8, y: box.y + 47, width: 16, height: 16 };
    }
    return null;
  },
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds: parameterBox,
  handles: () => [], dragHandle() {},
  fields: [
    { key: "value", label: "Initial value", input: "number", step: .1 },
    { key: "min", label: "Minimum", input: "number", step: .1 },
    { key: "max", label: "Maximum", input: "number", step: .1 },
    { key: "label", label: "Label", input: "text", nullable: true, hint: "Empty uses the parameter name" },
    { key: "decimals", label: "Decimal places", input: "number", min: 0, max: 6, step: 1 },
  ],
});
