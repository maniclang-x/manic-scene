// equation — LaTeX math, typeset by the engine (RaTeX / KaTeX-grade).
// The LaTeX lives in backticks (raw: every backslash survives). The canvas
// sketches it with KaTeX; the engine remains the typesetting truth.

import { argName, argNumber, argPoint, argString, latexLiteral, num, pt } from "../args.js";
import { registerEntity } from "../registry.js";
import { baseEntity } from "./base.js";
import type { EquationEntity } from "../types.js";

/** Rough sketch bounds: strip commands, count glyphs, allow tall structures. */
export function equationBounds(entity: EquationEntity): { x: number; y: number; width: number; height: number } {
  const plain = entity.latex
    .replaceAll(/\\[a-zA-Z]+/gu, "M")
    .replaceAll(/[{}^_&\\]/gu, "")
    .replaceAll(/\s+/gu, "");
  const tall = /\\(frac|int|sum|prod|lim|sqrt|binom|begin)/u.test(entity.latex);
  const width = Math.max(entity.size * 2, plain.length * entity.size * 0.52);
  const height = entity.size * (tall ? 2.6 : 1.5);
  return { x: entity.x - width / 2, y: entity.y - height / 2, width, height };
}

registerEntity<EquationEntity>({
  kind: "equation",
  ctor: "equation",
  anchorArgIndex: 1,
  group: "Math",
  label: "Equation",
  icon: "∑",
  order: 40,
  hint: "LaTeX math — real fractions, roots, big operators (typeset by the engine)",
  create: (id, x, y) => ({
    ...baseEntity(id, "fg"), kind: "equation", x, y,
    latex: "\\int_{a}^{b} f(x)\\,dx", size: 48,
  }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0);
    const point = argPoint(stmt.args, 1);
    const latex = argString(stmt.args, 2);
    if (!id || !point || latex === null) return null;
    return {
      ...baseEntity(id, "fg"), kind: "equation", x: point.x, y: point.y,
      latex, size: argNumber(stmt.args, 3) ?? 48,
    };
  },
  ctorLine: (entity) => `equation(${entity.id}, ${pt(entity.x, entity.y)}, ${latexLiteral(entity.latex)}, ${num(entity.size)});`,
  extraLines: () => [],
  modifiers: {},
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds: equationBounds,
  handles: () => [],
  dragHandle() {},
  fields: [
    { key: "latex", label: "LaTeX", input: "latex" },
    { key: "size", label: "Size (em height px)", input: "range", min: 20, max: 96 },
  ],
});
