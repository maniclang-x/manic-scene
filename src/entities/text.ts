// text — one label entity, with the full text behaviour vocabulary:
// size/bold/display · align · leading · wrap · vertical (see text-guide.manic).

import { argName, argNumber, argPoint, argString, escapeString, num, pt } from "../args.js";
import { registerEntity } from "../registry.js";
import { baseEntity } from "./base.js";
import { CANVAS_SIZES, type CanvasSize, type SceneDoc, type TextEntity } from "../types.js";

const GLYPH_ADVANCE = .62;
const AUTO_WRAP_MARGIN = 40;
const NARROWEST_AUTO_COLUMN = 220;

function textLength(value: string): number { return [...value].length; }
function canvasSize(doc?: SceneDoc): CanvasSize | null { return doc ? (doc.size ?? CANVAS_SIZES[doc.format]) : null; }

export function textBounds(entity: TextEntity, doc?: SceneDoc): { x: number; y: number; width: number; height: number } {
  const lines = layoutTextLines(entity, doc);
  const widest = Math.max(1, ...lines.map(textLength));
  const glyph = entity.size * 0.62;
  const width = entity.vertical ? entity.size : widest * glyph;
  const height = entity.vertical
    ? Math.max(1, entity.text.replaceAll(/\s+/gu, "").length) * entity.size * entity.leading
    : lines.length * entity.size * entity.leading;
  const x = entity.align === "left" ? entity.x : entity.align === "right" ? entity.x - width : entity.x - width / 2;
  return { x, y: entity.y - height / 2, width, height };
}

/** Engine-compatible source semantics with approximate Canvas font metrics:
 * explicit wrap wins; otherwise long text folds to the room around its anchor. */
export function textWrapWidth(entity: TextEntity, doc?: SceneDoc): number | null {
  if (entity.wrap !== null) return Math.max(1, entity.wrap);
  if (entity.vertical) return null;
  const canvas = canvasSize(doc);
  if (!canvas) return null;
  const hard = entity.text.replaceAll("\\n", "\n").split("\n");
  const natural = Math.max(0, ...hard.map((line) => textLength(line) * entity.size * GLYPH_ADVANCE));
  const room = (entity.align === "center" ? 2 * Math.min(entity.x, canvas.width - entity.x)
    : entity.align === "left" ? canvas.width - entity.x : entity.x) - AUTO_WRAP_MARGIN;
  if (natural <= room || room <= 0) return null;
  return Math.max(room, NARROWEST_AUTO_COLUMN);
}

/** Approximate native shaping: hard breaks, atomic inline math, and word wrap. */
export function layoutTextLines(entity: TextEntity, doc?: SceneDoc): string[] {
  const hard = entity.text.replaceAll("\\n", "\n").split("\n");
  const width = textWrapWidth(entity, doc);
  if (width === null) return hard;
  const perLine = Math.max(3, Math.floor(width / (entity.size * GLYPH_ADVANCE)));
  const wrapped: string[] = [];
  for (const line of hard) {
    let current = "";
    // `$…$` stays one word even when the formula contains spaces, matching the
    // native rich-text shaper's atomic inline-math spans.
    const words = line.match(/\$[^$]*\$|\S+/gu) ?? [];
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (textLength(candidate) > perLine && current) {
        wrapped.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    wrapped.push(current);
  }
  return wrapped.length ? wrapped : [""];
}

registerEntity<TextEntity>({
  kind: "text",
  ctor: "text",
  anchorArgIndex: 1,
  group: "Text",
  label: "Text",
  icon: "T",
  order: 10,
  hint: "One label, centred on its point",
  create: (id, x, y) => ({
    ...baseEntity(id, "fg"), kind: "text", x, y, text: "New text", size: 32,
    bold: false, display: false, align: "center", leading: 1.4, wrap: null, vertical: false,
  }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0);
    const point = argPoint(stmt.args, 1);
    const text = argString(stmt.args, 2);
    if (!id || !point || text === null) return null;
    const size = argNumber(stmt.args, 3);
    return {
      ...baseEntity(id, "fg"), kind: "text", x: point.x, y: point.y, text, size: size ?? 28,
      bold: false, display: false, align: "center", leading: 1.4, wrap: null, vertical: false,
    };
  },
  ctorLine: (entity) => `text(${entity.id}, ${pt(entity.x, entity.y)}, "${escapeString(entity.text)}");`,
  extraLines(entity) {
    const out = [`size(${entity.id}, ${num(entity.size)});`];
    if (entity.bold) out.push(`bold(${entity.id});`);
    if (entity.display) out.push(`display(${entity.id});`);
    if (entity.align !== "center") out.push(`align(${entity.id}, ${entity.align});`);
    if (entity.leading !== 1.4) out.push(`leading(${entity.id}, ${num(entity.leading)});`);
    if (entity.wrap !== null) out.push(`wrap(${entity.id}, ${num(entity.wrap)});`);
    if (entity.vertical) out.push(`vertical(${entity.id});`);
    return out;
  },
  modifiers: {
    size(entity, stmt) {
      const size = argNumber(stmt.args, 1);
      if (size === null) return false;
      entity.size = size;
      return true;
    },
    bold(entity) { entity.bold = true; return true; },
    display(entity) { entity.display = true; return true; },
    align(entity, stmt) {
      const edge = argName(stmt.args, 1);
      if (edge !== "left" && edge !== "center" && edge !== "right") return false;
      entity.align = edge;
      return true;
    },
    leading(entity, stmt) {
      const factor = argNumber(stmt.args, 1);
      if (factor === null) return false;
      entity.leading = factor;
      return true;
    },
    wrap(entity, stmt) {
      const width = argNumber(stmt.args, 1);
      if (width === null) return false;
      entity.wrap = width;
      return true;
    },
    vertical(entity) { entity.vertical = true; return true; },
  },
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds: (entity, ctx) => textBounds(entity, ctx?.doc),
  handles: () => [],
  dragHandle() {},
  fields: [
    { key: "text", label: "Words", input: "textarea" },
    { key: "size", label: "Text size", input: "range", min: 12, max: 96 },
    { key: "align", label: "Align (pinned edge)", input: "select", options: ["left", "center", "right"] },
    { key: "leading", label: "Leading (line height ×)", input: "number", step: 0.1, min: 0.8, max: 3 },
    { key: "wrap", label: "Wrap column (px)", input: "number", nullable: true, min: 60, hint: "Empty = wrap to the room it has" },
    { key: "bold", label: "Bold", input: "checkbox" },
    { key: "display", label: "Display font (headlines)", input: "checkbox" },
    { key: "vertical", label: "Vertical (upright letters)", input: "checkbox" },
  ],
});
