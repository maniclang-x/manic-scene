// Dependency-aware core entities: labels, live links, target-derived frames,
// braces, split equations, and deterministic particle groups.

import { argName, argNumber, argPoint, argString, escapeString, latexLiteral, num, pt } from "../args.js";
import { defFor, preferReference, registerEntity, type Box, type GeometryContext } from "../registry.js";
import type { CallStatement } from "../script.js";
import type {
  BraceDirection, BraceEntity, BraceLabelEntity, FrameboxEntity, LabelEntity, LinkEntity,
  MathPart, MathPartsEntity, ParticlesEntity, RectEntity, SceneDoc, SceneEntity,
} from "../types.js";
import { baseEntity, strokeWidthModifier } from "./base.js";

const textLiteral = (value: string) => `"${escapeString(value)}"`;
const centerOf = (box: Box): { x: number; y: number } => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
const emptyBox = (x = 0, y = 0): Box => ({ x, y, width: 1, height: 1 });

function targetAnchor(ref: string, ctx?: GeometryContext): { x: number; y: number } {
  const entity = ctx?.entity(ref);
  if (entity) return defFor(entity).anchor(entity, ctx);
  const box = ctx?.bounds(ref);
  return box ? centerOf(box) : { x: 0, y: 0 };
}

function candidateTargets(doc?: SceneDoc, predicate: (entity: SceneEntity) => boolean = () => true): SceneEntity[] {
  return doc?.entities.filter((entity) => predicate(entity) && entity.origin !== "generated") ?? [];
}

// --- label -----------------------------------------------------------------

registerEntity<LabelEntity>({
  kind: "label", ctor: "label", group: "Annotations", label: "Label", icon: "Aa", order: 13,
  hint: "Text pinned to another entity; moving the target carries the label",
  renameable: false,
  canCreate: (doc) => candidateTargets(doc, (entity) => entity.kind !== "label").length > 0,
  createBlockedReason: "Add or select an entity before attaching a label.",
  create(_id, _x, _y, doc, selectedId) {
    const target = preferReference(doc, selectedId, (entity) => entity.kind !== "label")?.id ?? "target";
    return { ...baseEntity(`${target}.label`, "fg"), kind: "label", target, dx: 0, dy: -48, text: "label", size: 24 };
  },
  parseArgs(stmt) {
    const target = argName(stmt.args, 0);
    const text = argString(stmt.args, 1);
    const offset = argPoint(stmt.args, 2) ?? { x: 0, y: 0 };
    if (!target || text === null) return null;
    return { ...baseEntity(`${target}.label`, "fg"), kind: "label", target, dx: offset.x, dy: offset.y, text, size: 24 };
  },
  ctorLine: (entity) => `label(${entity.target}, ${textLiteral(entity.text)}${entity.dx || entity.dy ? `, ${pt(entity.dx, entity.dy)}` : ""});`,
  extraLines: (entity) => entity.size === 24 ? [] : [`size(${entity.id}, ${num(entity.size)});`],
  modifiers: {
    size(entity, stmt) {
      const size = argNumber(stmt.args, 1);
      if (size === null) return false;
      entity.size = size;
      return true;
    },
  },
  references: (entity) => [entity.target],
  replaceReference(entity, from, to) {
    if (entity.target !== from) return;
    entity.target = to;
    entity.id = `${to}.label`;
  },
  anchor: (entity, ctx) => {
    const target = targetAnchor(entity.target, ctx);
    return { x: target.x + entity.dx, y: target.y + entity.dy };
  },
  translate(entity, dx, dy) { entity.dx += dx; entity.dy += dy; },
  bounds(entity, ctx) {
    const at = this.anchor(entity, ctx);
    const width = Math.max(entity.size * 1.2, entity.text.length * entity.size * 0.62);
    return { x: at.x - width / 2, y: at.y - entity.size * 0.75, width, height: entity.size * 1.5 };
  },
  handles: () => [], dragHandle() {},
  fields: [
    { key: "target", label: "Attached to", input: "entity", hint: "Re-attaching renames this child to {target}.label and updates its beats." },
    { key: "text", label: "Text", input: "textarea" },
    { key: "size", label: "Size", input: "range", min: 12, max: 72 },
  ],
});

// --- link ------------------------------------------------------------------

function linkGeometry(entity: LinkEntity, ctx?: GeometryContext) {
  const fromBox = ctx?.bounds(entity.from);
  const toBox = ctx?.bounds(entity.to);
  const a = fromBox ? centerOf(fromBox) : { x: 0, y: 0 };
  const b = toBox ? centerOf(toBox) : { x: 1, y: 0 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const trim = (box: Box | null | undefined, x: number, y: number, sign: number) => {
    if (!box) return { x, y };
    const hw = box.width / 2;
    const hh = box.height / 2;
    const tx = Math.abs(ux) > 1e-6 ? hw / Math.abs(ux) : Number.POSITIVE_INFINITY;
    const ty = Math.abs(uy) > 1e-6 ? hh / Math.abs(uy) : Number.POSITIVE_INFINITY;
    const d = Math.min(tx, ty);
    return { x: x + ux * d * sign, y: y + uy * d * sign };
  };
  const from = trim(fromBox, a.x, a.y, 1);
  const to = trim(toBox, b.x, b.y, -1);
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const nx = -(to.y - from.y) / Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
  const ny = (to.x - from.x) / Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
  return { from, to, ctrl: { x: mx + nx * entity.bend, y: my + ny * entity.bend }, normal: { x: nx, y: ny } };
}

registerEntity<LinkEntity>({
  kind: "link", ctor: "link", group: "Annotations", label: "Link", icon: "⌁", order: 32,
  hint: "A straight or bent connection that follows both endpoints",
  movable: false,
  canCreate: (doc) => candidateTargets(doc, (entity) => entity.kind !== "link").length >= 2,
  createBlockedReason: "Link needs at least two scene entities for its endpoints.",
  create(id, _x, _y, doc, selectedId) {
    // from = the selection (or newest entity); to = the nearest other candidate.
    const pool = candidateTargets(doc, (entity) => entity.kind !== "link");
    const from = preferReference(doc, selectedId, (entity) => entity.kind !== "link");
    const to = [...pool].reverse().find((entity) => entity.id !== from?.id);
    return { ...baseEntity(id, "fg"), kind: "link", from: from?.id ?? "from", to: to?.id ?? "to", bend: 0, strokeWidth: null };
  },
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), from = argName(stmt.args, 1), to = argName(stmt.args, 2);
    if (!id || !from || !to) return null;
    return { ...baseEntity(id, "fg"), kind: "link", from, to, bend: argNumber(stmt.args, 3) ?? 0, strokeWidth: null };
  },
  ctorLine: (entity) => `link(${entity.id}, ${entity.from}, ${entity.to}${entity.bend ? `, ${num(entity.bend)}` : ""});`,
  extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`],
  modifiers: { stroke: strokeWidthModifier },
  references: (entity) => [entity.from, entity.to],
  replaceReference(entity, from, to) {
    if (entity.from === from) entity.from = to;
    if (entity.to === from) entity.to = to;
  },
  anchor(entity, ctx) {
    const geometry = linkGeometry(entity, ctx);
    return { x: (geometry.from.x + geometry.to.x) / 2, y: (geometry.from.y + geometry.to.y) / 2 };
  },
  translate() {},
  bounds(entity, ctx) {
    const { from, to, ctrl } = linkGeometry(entity, ctx);
    const xs = [from.x, to.x, ctrl.x], ys = [from.y, to.y, ctrl.y];
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
  },
  handles: () => [], dragHandle() {},
  fields: [
    { key: "from", label: "From", input: "entity", includeChildren: true },
    { key: "to", label: "To", input: "entity", includeChildren: true },
    { key: "bend", label: "Bend", input: "number", step: 5 },
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 },
  ],
});

// --- framebox --------------------------------------------------------------

function framedBox(entity: FrameboxEntity, ctx?: GeometryContext): Box {
  const target = ctx?.bounds(entity.target) ?? emptyBox();
  return { x: target.x - entity.buff, y: target.y - entity.buff, width: target.width + 2 * entity.buff, height: target.height + 2 * entity.buff };
}

registerEntity<FrameboxEntity>({
  kind: "framebox", ctor: "framebox", group: "Annotations", label: "Frame box", icon: "▣", order: 33,
  hint: "A highlight rectangle derived from an entity or group bounds", colorInCtor: true, movable: false,
  canCreate: (doc) => candidateTargets(doc, (entity) => entity.kind !== "framebox").length > 0,
  createBlockedReason: "Add or select an entity before creating a highlight frame.",
  create(id, _x, _y, doc, selectedId) {
    const target = preferReference(doc, selectedId, (entity) => entity.kind !== "framebox")?.id ?? "target";
    return { ...baseEntity(id, "gold"), kind: "framebox", target, buff: 8 };
  },
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), target = argName(stmt.args, 1);
    if (!id || !target) return null;
    return { ...baseEntity(id, argName(stmt.args, 3) ?? "gold"), kind: "framebox", target, buff: Math.max(0, argNumber(stmt.args, 2) ?? 8) };
  },
  ctorLine: (entity) => `framebox(${entity.id}, ${entity.target}, ${num(entity.buff)}, ${entity.color});`,
  extraLines: () => [], modifiers: {},
  references: (entity) => [entity.target],
  replaceReference(entity, from, to) { if (entity.target === from) entity.target = to; },
  anchor: (entity, ctx) => centerOf(framedBox(entity, ctx)), translate() {},
  bounds: framedBox, handles: () => [], dragHandle() {},
  fields: [
    { key: "target", label: "Frames", input: "entity", includeTags: true, includeChildren: true },
    { key: "buff", label: "Padding", input: "range", min: 0, max: 80 },
  ],
});

// --- braces ----------------------------------------------------------------

export function bracePoints(x1: number, y1: number, x2: number, y2: number, depth: number, direction: BraceDirection | null = null) {
  const dx = x1 - x2, dy = y1 - y2;
  const len = Math.max(1e-3, Math.hypot(dx, dy));
  const ux = dx / len, uy = dy / len;
  const px = uy, py = -ux;
  let signed = depth;
  if (direction) {
    const wants: Record<BraceDirection, { x: number; y: number }> = {
      up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
    };
    signed = (px * wants[direction].x + py * wants[direction].y >= 0 ? 1 : -1) * Math.abs(depth);
  }
  const point = (fraction: number, bulge: number) => ({ x: x1 - ux * fraction * len + px * bulge, y: y1 - uy * fraction * len + py * bulge });
  const p0 = { x: x1, y: y1 }, p6 = { x: x2, y: y2 };
  const c1 = { x: p0.x + px * signed * 0.6, y: p0.y + py * signed * 0.6 };
  const e1 = point(0.25, signed * 0.4), tip = point(0.5, signed);
  const c3 = { x: p6.x + px * signed * 0.6, y: p6.y + py * signed * 0.6 };
  const e2 = point(0.75, signed * 0.4);
  const r1 = { x: e1.x * 2 - c1.x, y: e1.y * 2 - c1.y };
  const r2 = { x: e2.x * 2 - c3.x, y: e2.y * 2 - c3.y };
  const path = `M ${num(p0.x)} ${num(p0.y)} Q ${num(c1.x)} ${num(c1.y)} ${num(e1.x)} ${num(e1.y)} Q ${num(r1.x)} ${num(r1.y)} ${num(tip.x)} ${num(tip.y)} Q ${num(r2.x)} ${num(r2.y)} ${num(e2.x)} ${num(e2.y)} Q ${num(c3.x)} ${num(c3.y)} ${num(p6.x)} ${num(p6.y)}`;
  return { points: [p0, c1, e1, r1, tip, r2, e2, c3, p6], path, tip, normal: { x: px * Math.sign(signed || 1), y: py * Math.sign(signed || 1) } };
}

function braceBox(entity: BraceEntity | BraceLabelEntity, withLabel = false): Box {
  const geometry = bracePoints(entity.x1, entity.y1, entity.x2, entity.y2, entity.depth, entity.kind === "brace" ? entity.direction : null);
  const points = [...geometry.points];
  if (withLabel) points.push({ x: geometry.tip.x + geometry.normal.x * 24, y: geometry.tip.y + geometry.normal.y * 24 });
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
}

registerEntity<BraceEntity>({
  kind: "brace", ctor: "brace", group: "Annotations", label: "Brace", icon: "}", order: 34,
  hint: "A curly brace between two editable points",
  create: (id, x, y) => ({ ...baseEntity(id, "fg"), kind: "brace", x1: x - 110, y1: y, x2: x + 110, y2: y, depth: 22, direction: "down", strokeWidth: null }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), p1 = argPoint(stmt.args, 1), p2 = argPoint(stmt.args, 2);
    if (!id || !p1 || !p2) return null;
    const fourthName = argName(stmt.args, 3);
    const direction = (argName(stmt.args, 4) ?? fourthName) as BraceDirection | null;
    if (direction && !["up", "down", "left", "right"].includes(direction)) return null;
    return { ...baseEntity(id, "fg"), kind: "brace", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, depth: argNumber(stmt.args, 3) ?? 22, direction, strokeWidth: null };
  },
  ctorLine: (entity) => `brace(${entity.id}, ${pt(entity.x1, entity.y1)}, ${pt(entity.x2, entity.y2)}, ${num(entity.depth)}${entity.direction ? `, ${entity.direction}` : ""});`,
  extraLines: (entity) => entity.strokeWidth === null ? [] : [`stroke(${entity.id}, ${num(entity.strokeWidth)});`],
  modifiers: { stroke: strokeWidthModifier },
  anchor: (entity) => ({ x: (entity.x1 + entity.x2) / 2, y: (entity.y1 + entity.y2) / 2 }),
  translate(entity, dx, dy) { entity.x1 += dx; entity.y1 += dy; entity.x2 += dx; entity.y2 += dy; },
  bounds: (entity) => braceBox(entity),
  handles: (entity) => [{ name: "p1", x: entity.x1, y: entity.y1 }, { name: "p2", x: entity.x2, y: entity.y2 }],
  dragHandle(entity, handle, px, py) { if (handle === "p1") { entity.x1 = px; entity.y1 = py; } else { entity.x2 = px; entity.y2 = py; } },
  fields: [
    { key: "depth", label: "Depth", input: "range", min: 4, max: 100 },
    { key: "direction", label: "Direction", input: "select", options: ["up", "down", "left", "right"] },
    { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 },
  ],
});

function registerBraceLabel(kind: "bracelabel" | "bracetext", label: string, order: number) {
  registerEntity<BraceLabelEntity>({
    kind, ctor: kind, group: "Annotations", label, icon: kind === "bracelabel" ? "}A" : "}¶", order,
    hint: "A curly brace with text beyond its cusp",
    create: (id, x, y) => ({ ...baseEntity(id, "fg"), kind, x1: x - 110, y1: y, x2: x + 110, y2: y, depth: 22, text: kind === "bracelabel" ? "label" : "explanation", size: 24, strokeWidth: null }),
    parseArgs(stmt) {
      const id = argName(stmt.args, 0), p1 = argPoint(stmt.args, 1), p2 = argPoint(stmt.args, 2), text = argString(stmt.args, 3);
      if (!id || !p1 || !p2 || text === null) return null;
      return { ...baseEntity(id, "fg"), kind, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, depth: argNumber(stmt.args, 4) ?? 22, text, size: 24, strokeWidth: null };
    },
    ctorLine: (entity) => `${kind}(${entity.id}, ${pt(entity.x1, entity.y1)}, ${pt(entity.x2, entity.y2)}, ${textLiteral(entity.text)}, ${num(entity.depth)});`,
    extraLines(entity) {
      const lines: string[] = [];
      if (entity.size !== 24) lines.push(`size(${entity.id}.label, ${num(entity.size)});`);
      if (entity.strokeWidth !== null) lines.push(`stroke(${entity.id}, ${num(entity.strokeWidth)});`);
      return lines;
    },
    modifiers: { stroke: strokeWidthModifier },
    referenceIds: (entity) => [`${entity.id}.label`],
    applyReferenceModifier(entity, ref, stmt) {
      if (ref !== `${entity.id}.label` || stmt.name !== "size") return false;
      const size = argNumber(stmt.args, 1);
      if (size === null) return false;
      entity.size = size;
      return true;
    },
    referenceBounds(entity, ref) {
      if (ref !== `${entity.id}.label`) return null;
      const { tip, normal } = bracePoints(entity.x1, entity.y1, entity.x2, entity.y2, entity.depth);
      const at = { x: tip.x + normal.x * 24, y: tip.y + normal.y * 24 };
      const width = Math.max(entity.size, entity.text.length * entity.size * 0.62);
      return { x: at.x - width / 2, y: at.y - entity.size * 0.75, width, height: entity.size * 1.5 };
    },
    anchor: (entity) => ({ x: (entity.x1 + entity.x2) / 2, y: (entity.y1 + entity.y2) / 2 }),
    translate(entity, dx, dy) { entity.x1 += dx; entity.y1 += dy; entity.x2 += dx; entity.y2 += dy; },
    bounds: (entity) => braceBox(entity, true),
    handles: (entity) => [{ name: "p1", x: entity.x1, y: entity.y1 }, { name: "p2", x: entity.x2, y: entity.y2 }],
    dragHandle(entity, handle, px, py) { if (handle === "p1") { entity.x1 = px; entity.y1 = py; } else { entity.x2 = px; entity.y2 = py; } },
    fields: [
      { key: "text", label: "Text", input: "textarea" },
      { key: "depth", label: "Depth", input: "range", min: -100, max: 100 },
      { key: "size", label: "Label size", input: "range", min: 12, max: 72 },
      { key: "strokeWidth", label: "Stroke width", input: "number", nullable: true, min: 1, max: 20 },
    ],
  });
}

registerBraceLabel("bracelabel", "Brace label", 35);
registerBraceLabel("bracetext", "Brace text", 36);

// --- mathparts -------------------------------------------------------------

function mathPartBoxes(entity: MathPartsEntity): Box[] {
  const gap = 5;
  const widths = entity.parts.map((part) => Math.max(entity.size * 0.8, part.latex.replaceAll(/\\[a-zA-Z]+/gu, "M").replaceAll(/[{}^_&\\]/gu, "").length * entity.size * 0.52));
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * gap;
  let x = entity.x - total / 2;
  return widths.map((width, index) => {
    const tall = /\\(frac|int|sum|prod|lim|sqrt|binom|begin)/u.test(entity.parts[index].latex);
    const height = entity.size * (tall ? 2.2 : 1.4);
    const box = { x, y: entity.y - height / 2, width, height };
    x += width + gap;
    return box;
  });
}

registerEntity<MathPartsEntity>({
  kind: "mathparts", ctor: "mathparts", anchorArgIndex: 1, group: "Math", label: "Math parts", icon: "∑·", order: 41,
  hint: "One equation split into editable, individually addressable LaTeX parts",
  create: (id, x, y) => ({ ...baseEntity(id, "fg"), kind: "mathparts", x, y, parts: ["a^2", "+", "b^2", "=", "c^2"].map((latex) => ({ latex, color: null, reveal: "none", untraced: false })), size: 40 }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), point = argPoint(stmt.args, 1);
    if (!id || !point) return null;
    const parts: MathPart[] = [];
    let index = 2;
    while (argString(stmt.args, index) !== null) {
      parts.push({ latex: argString(stmt.args, index)!, color: null, reveal: "none", untraced: false });
      index += 1;
    }
    if (parts.length === 0) return null;
    return { ...baseEntity(id, "fg"), kind: "mathparts", x: point.x, y: point.y, parts, size: argNumber(stmt.args, index) ?? 40 };
  },
  ctorLine: (entity) => `mathparts(${entity.id}, ${pt(entity.x, entity.y)}, ${entity.parts.map((part) => latexLiteral(part.latex)).join(", ")}, ${num(entity.size)});`,
  extraLines(entity) {
    const lines: string[] = [];
    entity.parts.forEach((part, index) => {
      const id = `${entity.id}.${index}`;
      if (part.color) lines.push(`color(${id}, ${part.color});`);
      if (part.reveal !== "none") lines.push(`hidden(${id}${part.reveal === "grow" ? ", center" : ""});`);
      if (part.untraced) lines.push(`untraced(${id});`);
    });
    return lines;
  },
  modifiers: {},
  referenceIds: (entity) => entity.parts.map((_part, index) => `${entity.id}.${index}`),
  referenceBounds(entity, ref) {
    const match = new RegExp(`^${entity.id.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\.(\\d+)$`, "u").exec(ref);
    if (!match) return null;
    return mathPartBoxes(entity)[Number(match[1])] ?? null;
  },
  applyReferenceModifier(entity, ref, stmt) {
    const index = Number(ref.slice(entity.id.length + 1));
    const part = entity.parts[index];
    if (!part) return false;
    if (stmt.name === "color") {
      const color = argName(stmt.args, 1);
      if (!color) return false;
      part.color = color;
      return true;
    }
    if (stmt.name === "hidden") {
      part.reveal = argName(stmt.args, 1) === "center" ? "grow" : "fade";
      return true;
    }
    if (stmt.name === "untraced") { part.untraced = true; return true; }
    return false;
  },
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds(entity) {
    const boxes = mathPartBoxes(entity);
    const x = Math.min(...boxes.map((box) => box.x)), y = Math.min(...boxes.map((box) => box.y));
    const right = Math.max(...boxes.map((box) => box.x + box.width)), bottom = Math.max(...boxes.map((box) => box.y + box.height));
    return { x, y, width: right - x, height: bottom - y };
  },
  handles: () => [], dragHandle() {},
  fields: [
    { key: "parts", label: "LaTeX parts", input: "latex-list", hint: "Each row is addressable as id.0, id.1, …" },
    { key: "size", label: "Size", input: "range", min: 12, max: 96 },
  ],
});

// --- particles -------------------------------------------------------------

registerEntity<ParticlesEntity>({
  kind: "particles", ctor: "particles", group: "Shapes", label: "Particles", icon: "⠿", order: 26,
  hint: "Deterministic dots derived from a circle or rectangle container", movable: false,
  canCreate: (doc) => candidateTargets(doc, (entity) => entity.kind === "circle" || entity.kind === "rect").length > 0,
  createBlockedReason: "Particles need a circle or rectangle container first.",
  create(id, _x, _y, doc) {
    const container = candidateTargets(doc, (entity) => entity.kind === "circle" || entity.kind === "rect")[0]?.id ?? "container";
    return { ...baseEntity(id, "cyan"), kind: "particles", container, count: 24, radius: 5, seed: 1, layout: "random" };
  },
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), container = argName(stmt.args, 1), count = argNumber(stmt.args, 2);
    const layout = argString(stmt.args, 5) ?? "random";
    if (!id || !container || count === null || !["random", "grid", "ring"].includes(layout)) return null;
    return { ...baseEntity(id, "cyan"), kind: "particles", container, count: Math.round(count), radius: argNumber(stmt.args, 3) ?? 5, seed: Math.round(argNumber(stmt.args, 4) ?? 1), layout: layout as ParticlesEntity["layout"] };
  },
  ctorLine: (entity) => `particles(${entity.id}, ${entity.container}, ${Math.round(entity.count)}, ${num(entity.radius)}, ${Math.round(entity.seed)}, ${textLiteral(entity.layout)});`,
  extraLines: () => [], modifiers: {},
  references: (entity) => [entity.container],
  replaceReference(entity, from, to) { if (entity.container === from) entity.container = to; },
  referenceIds: (entity) => Array.from({ length: Math.max(0, Math.round(entity.count)) }, (_unused, index) => `${entity.id}.p${index}`),
  anchor: (entity, ctx) => targetAnchor(entity.container, ctx), translate() {},
  bounds(entity, ctx) { return ctx?.bounds(entity.container) ?? emptyBox(); },
  handles: () => [], dragHandle() {},
  fields: [
    { key: "container", label: "Container", input: "entity", entityKinds: ["circle", "rect"] },
    { key: "count", label: "Count", input: "range", min: 1, max: 500 },
    { key: "radius", label: "Dot radius", input: "range", min: 0.5, max: 64, step: 0.5 },
    { key: "seed", label: "Seed", input: "number", min: 1 },
    { key: "layout", label: "Layout", input: "select", options: ["random", "grid", "ring"] },
  ],
});

export { linkGeometry, mathPartBoxes };
