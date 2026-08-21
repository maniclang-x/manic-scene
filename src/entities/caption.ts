// caption — one entity PER WORD ({id}.w0, {id}.w1, …), which is what karaoke
// and wordpop animate. Ctor carries size + color: caption(id, "words", (x,y), size, color).

import { argName, argNumber, argPoint, argString, escapeString, num, pt } from "../args.js";
import { registerEntity } from "../registry.js";
import { baseEntity } from "./base.js";
import type { CaptionEntity } from "../types.js";

export function captionWords(entity: CaptionEntity): string[] {
  return entity.text.trim().split(/\s+/u).filter(Boolean);
}

function captionWidth(entity: CaptionEntity): number {
  const words = captionWords(entity);
  const glyph = entity.size * 0.62;
  const chars = words.reduce((total, word) => total + word.length, 0);
  return chars * glyph + Math.max(0, words.length - 1) * glyph;
}

registerEntity<CaptionEntity>({
  kind: "caption",
  ctor: "caption",
  anchorArgIndex: 2,
  group: "Text",
  label: "Caption",
  icon: "⋯",
  order: 11,
  hint: "One entity per word, so words can be timed (karaoke / wordpop)",
  colorInCtor: true,
  create: (id, x, y) => ({
    ...baseEntity(id, "gold"), kind: "caption", x, y, text: "one word at a time", size: 24,
  }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0);
    const text = argString(stmt.args, 1);
    const point = argPoint(stmt.args, 2);
    if (!id || text === null || !point) return null;
    const size = argNumber(stmt.args, 3);
    const color = argName(stmt.args, 4);
    return { ...baseEntity(id, color ?? "fg"), kind: "caption", x: point.x, y: point.y, text, size: size ?? 28 };
  },
  ctorLine: (entity) =>
    `caption(${entity.id}, "${escapeString(entity.text)}", ${pt(entity.x, entity.y)}, ${num(entity.size)}, ${entity.color});`,
  extraLines: () => [],
  modifiers: {},
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds(entity) {
    const width = captionWidth(entity);
    const height = entity.size * 1.4;
    return { x: entity.x - width / 2, y: entity.y - height / 2, width, height };
  },
  handles: () => [],
  dragHandle() {},
  fields: [
    { key: "text", label: "Words (one entity each)", input: "textarea" },
    { key: "size", label: "Text size", input: "range", min: 12, max: 72 },
  ],
});
