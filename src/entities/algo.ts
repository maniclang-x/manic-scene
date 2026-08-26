// Algo-kit structures. Canvas keeps declarations, stable child ids, and
// relationships editable; native Preview owns operation-time occupancy.

import { argName, argNumber, argPoint, argString, escapeString, num, pt } from "../args.js";
import { preferReference, registerEntity, type Box, type GeometryContext, type StoryTargetSpec } from "../registry.js";
import type { CallStatement } from "../script.js";
import type { AlgoContainerEntity, ArrayEntity, CaretEntity, GraphEntity, GraphLayout, HashMapEntity, ListEntity, Point, PointerEntity, SceneAction, SceneDoc, VirtualChildStyle } from "../types.js";
import { baseEntity } from "./base.js";

export const ALGO_POINTER_FIELD_WIDTH = 26;

export function algoValues(source: string): string[] {
  return source.trim().split(/\s+/u).filter(Boolean);
}

function move(entity: { x: number; y: number }, dx: number, dy: number): void { entity.x += dx; entity.y += dy; }
function emptyMove(): void {}
function childStyle(entity: { childStyles: Record<string, VirtualChildStyle> }, ref: string): VirtualChildStyle { return entity.childStyles[ref] ?? (entity.childStyles[ref] = {}); }
function applyChild(entity: { childStyles: Record<string, VirtualChildStyle> }, ref: string, stmt: CallStatement): boolean {
  const style = childStyle(entity, ref);
  switch (stmt.name) {
    case "color": { const value = argName(stmt.args, 1); if (!value) return false; style.color = value; return true; }
    case "opacity": { const value = argNumber(stmt.args, 1); if (value === null) return false; style.opacity = value; return true; }
    case "hidden": style.reveal = argName(stmt.args, 1) === "center" ? "grow" : "fade"; return true;
    case "untraced": style.untraced = true; return true;
    default: return false;
  }
}
function childLines(styles: Record<string, VirtualChildStyle>): string[] {
  return Object.entries(styles).flatMap(([ref, style]) => [
    ...(style.color ? [`color(${ref}, ${style.color});`] : []),
    ...(style.opacity !== undefined ? [`opacity(${ref}, ${num(style.opacity)});`] : []),
    ...(style.reveal ? [`hidden(${ref}${style.reveal === "grow" ? ", center" : ""});`] : []),
    ...(style.untraced ? [`untraced(${ref});`] : []),
  ]);
}
function styleTargets(refs: readonly string[], kind: (ref: string) => StoryTargetSpec["kind"]): StoryTargetSpec[] {
  return refs.map((id) => ({ id, label: id, kind: kind(id) }));
}

export interface ArrayLayout {
  values: string[];
  boxes: Box[];
  cells: Box[];
  bounds: Box;
}

export function arrayLayout(entity: ArrayEntity): ArrayLayout {
  const values = algoValues(entity.source), count = Math.max(1, values.length), width = count * entity.cellWidth;
  const left = entity.x - width / 2;
  const boxes = Array.from({ length: count }, (_unused, index) => ({
    x: left + index * entity.cellWidth + entity.cellWidth * .05,
    y: entity.y - entity.cellHeight * .45,
    width: entity.cellWidth * .9,
    height: entity.cellHeight * .9,
  }));
  const cells = boxes.map((box, index) => {
    const text = values[index] ?? "?", size = entity.cellHeight * .42;
    return { x: box.x + box.width / 2 - Math.max(size * .32, text.length * size * .31), y: entity.y - size * .55, width: Math.max(size * .64, text.length * size * .62), height: size * 1.1 };
  });
  return { values, boxes, cells, bounds: { x: left, y: entity.y - entity.cellHeight / 2, width, height: entity.cellHeight } };
}

function arrayReferences(entity: ArrayEntity): string[] {
  const count = algoValues(entity.source).length;
  return [`${entity.id}.boxes`, `${entity.id}.cells`, ...Array.from({ length: count }, (_unused, index) => `${entity.id}.box${index}`), ...Array.from({ length: count }, (_unused, index) => `${entity.id}.c${index}`)];
}

registerEntity<ArrayEntity>({
  kind: "array", ctor: "array", group: "Algo", label: "Array", icon: "[ ]", order: 60, fidelity: "exact",
  hint: "Fixed addressable slots and values for sorting, searching, comparisons, and pointers", anchorArgIndex: 2, authorOnly: true,
  create: (id, x, y) => ({ ...baseEntity(id, "fg"), nativePaint: true, kind: "array", source: "5 2 8 1", x, y, cellWidth: 74, cellHeight: 74, childStyles: {} }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), source = argString(stmt.args, 1), at = argPoint(stmt.args, 2), cw = argNumber(stmt.args, 3), ch = argNumber(stmt.args, 4);
    if (!id || source === null || !at || !algoValues(source).length || stmt.args.length < 3 || stmt.args.length > 5 || (stmt.args.length >= 4 && cw === null) || (stmt.args.length >= 5 && ch === null)) return null;
    return { ...baseEntity(id, "fg"), nativePaint: true, kind: "array", source, x: at.x, y: at.y, cellWidth: cw ?? 74, cellHeight: ch ?? 74, childStyles: {} };
  },
  ctorLine: (entity) => `array(${entity.id}, "${escapeString(entity.source)}", ${pt(entity.x, entity.y)}, ${num(entity.cellWidth)}, ${num(entity.cellHeight)});`,
  extraLines: (entity) => childLines(entity.childStyles), modifiers: {}, referenceIds: arrayReferences,
  storyTargets(entity) { return styleTargets(arrayReferences(entity), (ref) => ref.includes(".box") || ref.endsWith(".boxes") ? "rect" : "text"); },
  referenceBounds(entity, ref) {
    const layout = arrayLayout(entity), box = new RegExp(`^${escapeRegExp(entity.id)}\\.box(\\d+)$`, "u").exec(ref), cell = new RegExp(`^${escapeRegExp(entity.id)}\\.c(\\d+)$`, "u").exec(ref);
    if (ref === `${entity.id}.boxes`) return union(layout.boxes); if (ref === `${entity.id}.cells`) return union(layout.cells);
    if (box) return layout.boxes[Number(box[1])] ?? null; if (cell) return layout.cells[Number(cell[1])] ?? null; return null;
  },
  applyReferenceModifier(entity, ref, stmt) { return applyChild(entity, ref, stmt); },
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate: move, bounds: (entity) => arrayLayout(entity).bounds,
  handles: (entity) => [{ name: "cell", x: entity.x + entity.cellWidth / 2, y: entity.y + entity.cellHeight / 2 }],
  dragHandle(entity, _handle, px, py) { entity.cellWidth = Math.max(24, Math.abs(px - entity.x) * 2); entity.cellHeight = Math.max(24, Math.abs(py - entity.y) * 2); },
  fields: [
    { key: "source", label: "Values", input: "text", hint: "Whitespace-separated; each token becomes one stable cN value child." },
    { key: "cellWidth", label: "Slot width", input: "number", min: 24, step: 2 },
    { key: "cellHeight", label: "Slot height", input: "number", min: 24, step: 2 },
  ],
});

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"); }
function union(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map((box) => box.x)), top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width)), bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function caretShape(direction: CaretEntity["direction"]): { points: Point[]; labelOffset: Point } {
  switch (direction) {
    case "down": return { points: [{ x: -11, y: -10 }, { x: 11, y: -10 }, { x: 0, y: 10 }], labelOffset: { x: 0, y: -32 } };
    case "left": return { points: [{ x: 10, y: -11 }, { x: 10, y: 11 }, { x: -10, y: 0 }], labelOffset: { x: 48, y: 0 } };
    case "right": return { points: [{ x: -10, y: -11 }, { x: -10, y: 11 }, { x: 10, y: 0 }], labelOffset: { x: -48, y: 0 } };
    default: return { points: [{ x: -11, y: 10 }, { x: 11, y: 10 }, { x: 0, y: -10 }], labelOffset: { x: 0, y: 32 } };
  }
}

function caretBoundsAt(x: number, y: number, label: string | null, direction: CaretEntity["direction"], labelOffset?: Point): Box {
  const geometry = caretShape(direction), offset = labelOffset ?? geometry.labelOffset, labelWidth = label ? Math.max(18, label.length * 14) : 0;
  const boxes: Box[] = [{ x: x - 11, y: y - 11, width: 22, height: 22 }];
  if (label) boxes.push({ x: x + offset.x - labelWidth / 2, y: y + offset.y - 13, width: labelWidth, height: 26 });
  return union(boxes)!;
}

export function pointerPosition(entity: PointerEntity, ctx?: GeometryContext): Point {
  const slot = ctx?.bounds(`${entity.array}.box${Math.max(0, Math.trunc(entity.slot))}`);
  return slot ? { x: slot.x + slot.width / 2, y: slot.y + slot.height + 26 } : { x: 0, y: 0 };
}

registerEntity<PointerEntity>({
  kind: "pointer", ctor: "pointer", group: "Algo", label: "Array pointer", icon: "▲i", order: 60.1, fidelity: "exact", hint: "Index marker attached to one array slot; Point at changes the slot in Story", movable: false,
  canCreate: (doc) => doc.entities.some((entity) => entity.kind === "array"), createBlockedReason: "Add an array before adding a pointer.",
  create(id, _x, _y, doc, selectedId) { const array = preferReference(doc, selectedId, (entity) => entity.kind === "array"); return { ...baseEntity(id, "magenta"), nativePaint: true, kind: "pointer", array: array?.id ?? "array", slot: 0, label: "i", childStyles: {} }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), array = argName(stmt.args, 1), slot = argNumber(stmt.args, 2), label = argString(stmt.args, 3); if (!id || !array || slot === null || stmt.args.length < 3 || stmt.args.length > 4 || (stmt.args.length === 4 && label === null)) return null; return { ...baseEntity(id, "magenta"), nativePaint: true, kind: "pointer", array, slot: Math.trunc(slot), label, childStyles: {} }; },
  ctorLine: (entity) => `pointer(${entity.id}, ${entity.array}, ${num(Math.max(0, Math.trunc(entity.slot)))}${entity.label === null ? "" : `, "${escapeString(entity.label)}"`});`, extraLines: (entity) => childLines(entity.childStyles), modifiers: {},
  references: (entity) => [entity.array], replaceReference(entity, from, to) { if (entity.array === from) entity.array = to; },
  referenceIds: (entity) => entity.label === null ? [] : [`${entity.id}.label`], storyTargets: (entity) => entity.label === null ? [] : [{ id: `${entity.id}.label`, label: `${entity.id}.label`, kind: "text" }],
  referenceBounds(entity, ref, ctx) { if (ref !== `${entity.id}.label` || entity.label === null) return null; const at = pointerPosition(entity, ctx); return { x: at.x - Math.max(18, entity.label.length * 14) / 2, y: at.y + 21, width: Math.max(18, entity.label.length * 14), height: 26 }; },
  applyReferenceModifier(entity, ref, stmt) { return applyChild(entity, ref, stmt); }, anchor: pointerPosition, translate: emptyMove,
  bounds(entity, ctx) { const at = pointerPosition(entity, ctx); return caretBoundsAt(at.x, at.y, entity.label, "up", { x: 0, y: 34 }); }, handles: () => [], dragHandle() {},
  fields: [
    { key: "array", label: "Array", input: "entity", entityKinds: ["array"], referencesEarlierOnly: true, hint: "Pointers must be declared after their array." },
    { key: "slot", label: "Initial slot", input: "number", min: 0, step: 1 },
    { key: "label", label: "Label", input: "text", nullable: true },
  ],
});

registerEntity<CaretEntity>({
  kind: "caret", ctor: "caret", group: "Algo", label: "Caret marker", icon: "▲", order: 60.2, fidelity: "exact", hint: "Movable labelled marker for a stack top, queue front, or queue back", anchorArgIndex: 1,
  create: (id, x, y) => ({ ...baseEntity(id, "magenta"), nativePaint: true, kind: "caret", x, y, label: "top", direction: "up", childStyles: {} }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1), label = argString(stmt.args, 2), direction = argName(stmt.args, 3) ?? "up"; if (!id || !at || label === null || stmt.args.length < 3 || stmt.args.length > 4 || !["up", "down", "left", "right"].includes(direction)) return null; return { ...baseEntity(id, "magenta"), nativePaint: true, kind: "caret", x: at.x, y: at.y, label, direction: direction as CaretEntity["direction"], childStyles: {} }; },
  ctorLine: (entity) => `caret(${entity.id}, ${pt(entity.x, entity.y)}, "${escapeString(entity.label)}", ${entity.direction});`, extraLines: (entity) => childLines(entity.childStyles), modifiers: {},
  referenceIds: (entity) => [`${entity.id}.label`], storyTargets: (entity) => [{ id: `${entity.id}.label`, label: `${entity.id}.label`, kind: "text" }],
  referenceBounds(entity, ref) { if (ref !== `${entity.id}.label`) return null; const offset = caretShape(entity.direction).labelOffset, width = Math.max(18, entity.label.length * 13); return { x: entity.x + offset.x - width / 2, y: entity.y + offset.y - 13, width, height: 26 }; },
  applyReferenceModifier(entity, ref, stmt) { return applyChild(entity, ref, stmt); }, anchor: (entity) => ({ x: entity.x, y: entity.y }), translate: move,
  bounds: (entity) => caretBoundsAt(entity.x, entity.y, entity.label, entity.direction), handles: () => [], dragHandle() {},
  fields: [{ key: "label", label: "Label", input: "text" }, { key: "direction", label: "Points", input: "select", options: ["up", "down", "left", "right"] }],
});

function registerContainer(kind: AlgoContainerEntity["kind"], order: number): void {
  registerEntity<AlgoContainerEntity>({
    kind, ctor: kind, group: "Algo", label: kind === "stack" ? "Stack" : "Queue", icon: kind === "stack" ? "▤" : "▥", order, fidelity: "semantic", authorOnly: true,
    hint: kind === "stack" ? "Empty LIFO anchor populated by Push and Pop Story beats" : "Empty FIFO anchor populated by Enqueue and Dequeue Story beats", anchorArgIndex: 1,
    create: (id, x, y) => ({ ...baseEntity(id, "panel"), nativePaint: true, kind, x, y, cellWidth: 84, cellHeight: 64 }),
    parseArgs(stmt) { const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1), cw = argNumber(stmt.args, 2), ch = argNumber(stmt.args, 3); if (!id || !at || stmt.args.length < 2 || stmt.args.length > 4 || (stmt.args.length >= 3 && cw === null) || (stmt.args.length >= 4 && ch === null)) return null; return { ...baseEntity(id, "panel"), nativePaint: true, kind, x: at.x, y: at.y, cellWidth: cw ?? 84, cellHeight: ch ?? 64 }; },
    ctorLine: (entity) => `${kind}(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.cellWidth)}, ${num(entity.cellHeight)});`, extraLines: () => [], modifiers: {},
    referenceIds: (entity) => [`${entity.id}.anchor`, `${entity.id}.cells`], storyTargets: () => [],
    referenceBounds(entity, ref) { return ref === `${entity.id}.anchor` || ref === `${entity.id}.cells` ? { x: entity.x - entity.cellWidth / 2, y: entity.y - entity.cellHeight / 2, width: entity.cellWidth, height: entity.cellHeight } : null; },
    anchor: (entity) => ({ x: entity.x, y: entity.y }), translate: move,
    bounds(entity) { return kind === "stack" ? { x: entity.x - entity.cellWidth / 2 - 30, y: entity.y - entity.cellHeight * 3.5, width: entity.cellWidth + 60, height: entity.cellHeight * 4 } : { x: entity.x - entity.cellWidth / 2, y: entity.y - entity.cellHeight / 2 - 32, width: entity.cellWidth * 4, height: entity.cellHeight + 64 }; },
    handles: (entity) => [{ name: "cell", x: entity.x + entity.cellWidth / 2, y: entity.y + entity.cellHeight / 2 }], dragHandle(entity, _handle, px, py) { entity.cellWidth = Math.max(24, Math.abs(px - entity.x) * 2); entity.cellHeight = Math.max(24, Math.abs(py - entity.y) * 2); },
    fields: [{ key: "cellWidth", label: "Cell width", input: "number", min: 24, step: 2 }, { key: "cellHeight", label: "Cell height", input: "number", min: 24, step: 2 }],
  });
}
registerContainer("stack", 61); registerContainer("queue", 61.1);

export interface ListLayout {
  values: string[];
  nodeWidth: number;
  spacing: number;
  dataOffset: number;
  nextOffset: number;
  prevOffset: number | null;
  dividers: number[];
  centers: Point[];
  bounds: Box;
}

export function listLayout(entity: ListEntity): ListLayout {
  const values = algoValues(entity.source), count = Math.max(1, values.length), doubly = entity.listKind === "doubly";
  const nodeWidth = entity.cellWidth + (doubly ? ALGO_POINTER_FIELD_WIDTH * 2 : ALGO_POINTER_FIELD_WIDTH), spacing = nodeWidth + 50;
  const x0 = entity.x - (count - 1) * spacing / 2, centers = Array.from({ length: count }, (_unused, index) => ({ x: x0 + index * spacing, y: entity.y }));
  return {
    values, nodeWidth, spacing, dataOffset: doubly ? 0 : -ALGO_POINTER_FIELD_WIDTH / 2,
    nextOffset: doubly ? (ALGO_POINTER_FIELD_WIDTH + entity.cellWidth) / 2 : entity.cellWidth / 2,
    prevOffset: doubly ? -(ALGO_POINTER_FIELD_WIDTH + entity.cellWidth) / 2 : null,
    dividers: doubly ? [-entity.cellWidth / 2, entity.cellWidth / 2] : [(entity.cellWidth - ALGO_POINTER_FIELD_WIDTH) / 2], centers,
    bounds: { x: x0 - nodeWidth / 2 - (doubly ? 82 : 0), y: entity.y - entity.cellHeight / 2 - 72, width: (count - 1) * spacing + nodeWidth + (entity.listKind === "circular" ? 0 : 82) + (doubly ? 82 : 0), height: entity.cellHeight + (entity.listKind === "circular" ? entity.cellHeight * 2.3 + 72 : 72) },
  };
}

function listArrowCount(entity: ListEntity): number { const n = algoValues(entity.source).length; return entity.listKind === "doubly" ? 2 * n + 1 : n + 1; }
function listReferences(entity: ListEntity): string[] {
  const count = algoValues(entity.source).length, refs = [`${entity.id}.nodes`, `${entity.id}.next`, `${entity.id}.head`, `${entity.id}.head`];
  if (entity.listKind === "doubly") refs.push(`${entity.id}.prev`);
  if (entity.listKind !== "circular") refs.push(`${entity.id}.null`);
  if (entity.listKind === "doubly") refs.push(`${entity.id}.nullL`);
  for (let index = 0; index < count; index += 1) {
    refs.push(`${entity.id}.node${index}`, `${entity.id}.node${index}.v`, `${entity.id}.node${index}.pn`, `${entity.id}.node${index}.dv0`);
    if (entity.listKind === "doubly") refs.push(`${entity.id}.node${index}.pp`, `${entity.id}.node${index}.dv1`);
  }
  refs.push(...Array.from({ length: listArrowCount(entity) }, (_unused, index) => `${entity.id}.ar${index}`));
  return [...new Set(refs)];
}

registerEntity<ListEntity>({
  kind: "list", ctor: "list", group: "Algo", label: "Linked list", icon: "[•]→", order: 62, fidelity: "exact", authorOnly: true,
  hint: "Singly, doubly, or circular nodes with addressable compartments and pointers", anchorArgIndex: 2,
  create: (id, x, y) => ({ ...baseEntity(id, "panel"), nativePaint: true, kind: "list", source: "3 8 5", x, y, listKind: "doubly", cellWidth: 74, cellHeight: 56, childStyles: {} }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argString(stmt.args, 1), at = argPoint(stmt.args, 2), listKind = argName(stmt.args, 3) ?? "doubly", cw = argNumber(stmt.args, 4), ch = argNumber(stmt.args, 5); if (!id || source === null || !at || !algoValues(source).length || stmt.args.length < 3 || stmt.args.length > 6 || !["singly", "doubly", "circular"].includes(listKind) || (stmt.args.length >= 5 && cw === null) || (stmt.args.length >= 6 && ch === null)) return null; return { ...baseEntity(id, "panel"), nativePaint: true, kind: "list", source, x: at.x, y: at.y, listKind: listKind as ListEntity["listKind"], cellWidth: cw ?? 74, cellHeight: ch ?? 56, childStyles: {} }; },
  ctorLine: (entity) => `list(${entity.id}, "${escapeString(entity.source)}", ${pt(entity.x, entity.y)}, ${entity.listKind}, ${num(entity.cellWidth)}, ${num(entity.cellHeight)});`, extraLines: (entity) => childLines(entity.childStyles), modifiers: {},
  referenceIds: listReferences, storyTargets(entity) { return styleTargets(listReferences(entity), (ref) => ref.includes(".node") && !/\.(?:pn|pp|dv\d+)$/u.test(ref) ? (ref.endsWith(".v") ? "text" : "rect") : ref.endsWith(".head") || ref.endsWith(".null") || ref.endsWith(".nullL") ? "text" : "arrow"); },
  referenceBounds(entity, ref) {
    const layout = listLayout(entity), node = new RegExp(`^${escapeRegExp(entity.id)}\\.node(\\d+)(?:\\.(v|pn|pp|dv0|dv1))?$`, "u").exec(ref), arrow = new RegExp(`^${escapeRegExp(entity.id)}\\.ar(\\d+)$`, "u").exec(ref);
    if (ref === `${entity.id}.nodes`) return layout.bounds;
    if (node) { const center = layout.centers[Number(node[1])]; if (!center) return null; const suffix = node[2]; if (!suffix) return { x: center.x - layout.nodeWidth / 2, y: center.y - entity.cellHeight / 2, width: layout.nodeWidth, height: entity.cellHeight }; if (suffix === "v") return { x: center.x + layout.dataOffset - entity.cellWidth * .35, y: center.y - entity.cellHeight * .25, width: entity.cellWidth * .7, height: entity.cellHeight * .5 }; const off = suffix === "pn" ? layout.nextOffset : suffix === "pp" ? layout.prevOffset ?? 0 : layout.dividers[Number(suffix.slice(-1))] ?? 0; return { x: center.x + off - 5, y: center.y - entity.cellHeight * .45, width: 10, height: entity.cellHeight * .9 }; }
    if (ref === `${entity.id}.head`) { const first = layout.centers[0]; return { x: first.x - 28, y: first.y - entity.cellHeight / 2 - 62, width: 56, height: 24 }; }
    if (ref === `${entity.id}.null`) { const last = layout.centers.at(-1)!; return { x: last.x + layout.nodeWidth / 2 + 27, y: last.y - 12, width: 50, height: 24 }; }
    if (ref === `${entity.id}.nullL`) { const first = layout.centers[0]; return { x: first.x - layout.nodeWidth / 2 - 77, y: first.y - 12, width: 50, height: 24 }; }
    if (arrow || ref === `${entity.id}.next` || ref === `${entity.id}.prev`) return layout.bounds;
    return null;
  },
  applyReferenceModifier(entity, ref, stmt) { return applyChild(entity, ref, stmt); }, anchor: (entity) => ({ x: entity.x, y: entity.y }), translate: move, bounds: (entity) => listLayout(entity).bounds,
  handles: (entity) => [{ name: "cell", x: entity.x + entity.cellWidth / 2, y: entity.y + entity.cellHeight / 2 }], dragHandle(entity, _handle, px, py) { entity.cellWidth = Math.max(30, Math.abs(px - entity.x) * 2); entity.cellHeight = Math.max(28, Math.abs(py - entity.y) * 2); },
  fields: [
    { key: "source", label: "Initial values", input: "text", hint: "Whitespace-separated; operations in Story mutate this initial order at runtime." },
    { key: "listKind", label: "Anatomy", input: "select", options: ["singly", "doubly", "circular"] },
    { key: "cellWidth", label: "Data width", input: "number", min: 30, step: 2 },
    { key: "cellHeight", label: "Node height", input: "number", min: 28, step: 2 },
  ],
});

function sceneActions(doc: SceneDoc): SceneAction[] {
  return doc.steps.flatMap((step) => step.timed
    ? step.timed.phases.flatMap((phase) => phase.segments.flatMap((segment) => segment.items.flatMap((item) => item.kind === "action" ? [item.action] : [])))
    : step.actions);
}

// --- hash maps -------------------------------------------------------------

export function algoHash(key: string): number {
  return [...new TextEncoder().encode(key)].reduce((sum, byte) => sum + byte, 0);
}

export interface HashMapEntryLayout {
  id: string;
  arrowId: string;
  key: string;
  value: string;
  bucket: number;
  chainIndex: number;
  x: number; y: number;
}
export interface HashMapLayout {
  buckets: { x: number; y: number; width: number; height: number }[];
  entries: HashMapEntryLayout[];
  bounds: Box;
}

export function hashmapLayout(entity: HashMapEntity, doc?: SceneDoc, before?: SceneAction): HashMapLayout {
  const count = Math.max(1, Math.trunc(entity.buckets)), bucketWidth = 48, rowHeight = entity.cellHeight + 18;
  const y0 = entity.y - (count - 1) * rowHeight / 2;
  const buckets = Array.from({ length: count }, (_unused, index) => ({ x: entity.x - bucketWidth / 2, y: y0 + index * rowHeight - entity.cellHeight / 2, width: bucketWidth, height: entity.cellHeight }));
  const chainCounts = Array.from({ length: count }, () => 0), entries: HashMapEntryLayout[] = [];
  for (const action of doc ? sceneActions(doc) : []) {
    if (action === before) break;
    if (action.verb !== "put" || action.target !== entity.id) continue;
    const key = action.texts?.[0] ?? "", value = action.texts?.[1] ?? "", bucket = algoHash(key) % count, chainIndex = chainCounts[bucket]++;
    entries.push({ id: `${entity.id}.e${entries.length}`, arrowId: `${entity.id}.ar${entries.length}`, key, value, bucket, chainIndex, x: entity.x + bucketWidth / 2 + 44 + chainIndex * (entity.entryWidth + 44) + entity.entryWidth / 2, y: y0 + bucket * rowHeight });
  }
  const right = Math.max(entity.x + bucketWidth / 2, ...entries.map((entry) => entry.x + entity.entryWidth / 2));
  return { buckets, entries, bounds: { x: entity.x - bucketWidth / 2, y: y0 - entity.cellHeight / 2, width: right - (entity.x - bucketWidth / 2), height: (count - 1) * rowHeight + entity.cellHeight } };
}

export interface HashLookupPlan { bucket: number; entries: HashMapEntryLayout[]; hit: number | null; duration: number; }
export function hashmapLookupPlan(entity: HashMapEntity, action: SceneAction, doc?: SceneDoc): HashLookupPlan {
  const layout = hashmapLayout(entity, doc, action), count = Math.max(1, Math.trunc(entity.buckets)), key = action.text ?? "", bucket = algoHash(key) % count;
  const entries = layout.entries.filter((entry) => entry.bucket === bucket), found = entries.findIndex((entry) => entry.key === key), hit = found < 0 ? null : found;
  const scanned = hit === null ? entries.length : hit + 1;
  return { bucket, entries, hit, duration: (scanned + 2) * Math.max(.01, action.dur) + .2 };
}

function hashmapReferences(entity: HashMapEntity): string[] {
  const count = Math.max(1, Math.trunc(entity.buckets));
  return [`${entity.id}.buckets`, `${entity.id}.anchor`, ...Array.from({ length: count }, (_unused, index) => `${entity.id}.bucket${index}`), ...Array.from({ length: count }, (_unused, index) => `${entity.id}.bucket${index}.v`)];
}

registerEntity<HashMapEntity>({
  kind: "hashmap", ctor: "hashmap", group: "Algo", label: "Hash map", icon: "#→", order: 63, fidelity: "exact", authorOnly: true,
  hint: "Numbered buckets with deterministic separate-chaining Put and Get operations", anchorArgIndex: 2,
  create: (id, x, y) => ({ ...baseEntity(id, "panel"), nativePaint: true, kind: "hashmap", buckets: 5, x, y, entryWidth: 120, cellHeight: 46, childStyles: {} }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), buckets = argNumber(stmt.args, 1), at = argPoint(stmt.args, 2), entryWidth = argNumber(stmt.args, 3), cellHeight = argNumber(stmt.args, 4); if (!id || buckets === null || Math.trunc(buckets) < 1 || !at || stmt.args.length < 3 || stmt.args.length > 5 || (stmt.args.length >= 4 && entryWidth === null) || (stmt.args.length >= 5 && cellHeight === null)) return null; return { ...baseEntity(id, "panel"), nativePaint: true, kind: "hashmap", buckets: Math.trunc(buckets), x: at.x, y: at.y, entryWidth: entryWidth ?? 120, cellHeight: cellHeight ?? 46, childStyles: {} }; },
  ctorLine: (entity) => `hashmap(${entity.id}, ${num(Math.max(1, Math.trunc(entity.buckets)))}, ${pt(entity.x, entity.y)}, ${num(entity.entryWidth)}, ${num(entity.cellHeight)});`, extraLines: (entity) => childLines(entity.childStyles), modifiers: {},
  referenceIds: hashmapReferences, storyTargets(entity) { return styleTargets(hashmapReferences(entity).filter((ref) => ref !== `${entity.id}.anchor`), (ref) => ref.endsWith(".v") ? "text" : "rect"); },
  referenceBounds(entity, ref) { const layout = hashmapLayout(entity), match = new RegExp(`^${escapeRegExp(entity.id)}\\.bucket(\\d+)(?:\\.v)?$`, "u").exec(ref); if (ref === `${entity.id}.buckets`) return union(layout.buckets); if (ref === `${entity.id}.anchor`) return { x: entity.x - entity.entryWidth / 2, y: entity.y - entity.cellHeight / 2, width: entity.entryWidth, height: entity.cellHeight }; if (!match) return null; const box = layout.buckets[Number(match[1])]; if (!box) return null; return ref.endsWith(".v") ? { x: box.x, y: box.y, width: box.width, height: box.height } : box; },
  applyReferenceModifier(entity, ref, stmt) { return applyChild(entity, ref, stmt); }, anchor: (entity) => ({ x: entity.x, y: entity.y }), translate: move, bounds(entity, ctx) { return hashmapLayout(entity, ctx?.doc).bounds; },
  handles: (entity) => [{ name: "entry", x: entity.x + entity.entryWidth / 2, y: entity.y + entity.cellHeight / 2 }], dragHandle(entity, _handle, px, py) { entity.entryWidth = Math.max(48, Math.abs(px - entity.x) * 2); entity.cellHeight = Math.max(28, Math.abs(py - entity.y) * 2); },
  fields: [
    { key: "buckets", label: "Bucket count", input: "number", min: 1, max: 64, step: 1 },
    { key: "entryWidth", label: "Entry width", input: "number", min: 48, step: 2 },
    { key: "cellHeight", label: "Row height", input: "number", min: 28, step: 2 },
  ],
});

// --- graphs ----------------------------------------------------------------

export interface GraphEdge {
  raw: string;
  from: string;
  to: string;
  directed: boolean;
  weight: number | null;
  id: string;
}
export interface GraphGeometry {
  vertices: string[];
  positions: Point[];
  edges: GraphEdge[];
  issue: string | null;
  bounds: Box;
}

export function graphVertices(entity: Pick<GraphEntity, "vertices">): string[] { return entity.vertices.trim().split(/\s+/u).filter(Boolean); }
export function graphStartVertices(entity: Pick<GraphEntity, "vertices">): string[] { return graphVertices(entity).filter((name) => /^[A-Za-z_][A-Za-z0-9_.]*$/u.test(name)); }
export function graphGeometry(entity: GraphEntity): GraphGeometry {
  const vertices = graphVertices(entity), known = new Set(vertices), edges: GraphEdge[] = []; let issue: string | null = vertices.length ? (known.size === vertices.length ? null : "Graph vertex names must be unique.") : "Graph needs at least one vertex.";
  for (const raw of entity.edges.split(/[\s,]+/u).filter(Boolean)) {
    const [edgePart, weightPart, ...extra] = raw.split(":");
    const directed = edgePart.includes(">"), separator = directed ? ">" : "-", parts = edgePart.split(separator);
    const weight = weightPart === undefined ? null : Number(weightPart);
    if (extra.length || parts.length !== 2 || !parts[0] || !parts[1] || !known.has(parts[0]) || !known.has(parts[1]) || (weightPart !== undefined && !Number.isFinite(weight))) { issue ??= `Invalid graph edge “${raw}”. Use a-b, a>b, or a-b:2 with declared vertices.`; continue; }
    edges.push({ raw, from: parts[0], to: parts[1], directed, weight, id: `${entity.id}.${parts[0]}${separator}${parts[1]}` });
  }
  const n = Math.max(1, vertices.length), positions: Point[] = [];
  if (["circular", "circle", "ring"].includes(entity.layout)) for (let index = 0; index < n; index += 1) { const angle = Math.PI * 2 * index / n - Math.PI / 2; positions.push({ x: entity.x + Math.cos(angle) * entity.scale, y: entity.y + Math.sin(angle) * entity.scale }); }
  else if (["row", "line"].includes(entity.layout)) for (let index = 0; index < n; index += 1) positions.push({ x: n === 1 ? entity.x : entity.x - entity.scale + entity.scale * 2 * index / (n - 1), y: entity.y });
  else { const cols = Math.max(1, Math.ceil(Math.sqrt(n))), rows = Math.ceil(n / cols), cw = entity.scale * 2 / cols, ch = entity.scale * 2 / rows; for (let index = 0; index < n; index += 1) positions.push({ x: entity.x - entity.scale + cw * (index % cols + .5), y: entity.y - entity.scale + ch * (Math.floor(index / cols) + .5) }); }
  const xs = positions.map((point) => point.x), ys = positions.map((point) => point.y);
  return { vertices, positions, edges, issue, bounds: { x: Math.min(...xs) - entity.radius - 8, y: Math.min(...ys) - entity.radius - 8, width: Math.max(...xs) - Math.min(...xs) + entity.radius * 2 + 16, height: Math.max(...ys) - Math.min(...ys) + entity.radius * 2 + 16 } };
}

export interface GraphAlgorithmPlan { order: string[]; treeEdges: string[]; distances: Record<string, number>; duration: number; issue: string | null; }
export function graphAlgorithmPlan(entity: GraphEntity, startName: string, algorithm: "bfs" | "dfs" | "dijkstra"): GraphAlgorithmPlan {
  const geometry = graphGeometry(entity), index = new Map(geometry.vertices.map((name, at) => [name, at])), empty = { order: [], treeEdges: [], distances: {}, duration: .3, issue: geometry.issue };
  if (geometry.issue) return empty; if (!index.has(startName)) return { ...empty, issue: `Graph has no vertex “${startName}”.` };
  const adjacency = new Map<string, { to: string; edge: GraphEdge }[]>();
  for (const edge of geometry.edges) { const list = adjacency.get(edge.from) ?? []; list.push({ to: edge.to, edge }); adjacency.set(edge.from, list); if (!edge.directed) { const reverse = adjacency.get(edge.to) ?? []; reverse.push({ to: edge.from, edge }); adjacency.set(edge.to, reverse); } }
  if (algorithm !== "dijkstra") {
    const discovered = new Set([startName]), frontier = [startName], order: string[] = [], treeEdges: string[] = []; let t = .5;
    while (frontier.length) { const current = algorithm === "dfs" ? frontier.pop()! : frontier.shift()!; let sub = t + .3; for (const next of adjacency.get(current) ?? []) { if (discovered.has(next.to)) continue; discovered.add(next.to); frontier.push(next.to); treeEdges.push(next.edge.id); sub += .24; } const done = Math.max(sub, t + .5); order.push(current); t = done + .4; }
    return { order, treeEdges, distances: {}, duration: t + .3, issue: null };
  }
  const distances = Object.fromEntries(geometry.vertices.map((name) => [name, Number.POSITIVE_INFINITY])), settled = new Set<string>(), parents = new Map<string, string>(); distances[startName] = 0; const order: string[] = []; let t = .5;
  while (true) { let current: string | null = null, best = Number.POSITIVE_INFINITY; for (const name of geometry.vertices) if (!settled.has(name) && distances[name] < best) { best = distances[name]; current = name; } if (!current || !Number.isFinite(best)) break; settled.add(current); order.push(current); let sub = t + .3; for (const next of adjacency.get(current) ?? []) { if (settled.has(next.to)) continue; const distance = distances[current] + (next.edge.weight ?? 1); if (distance < distances[next.to]) { distances[next.to] = distance; parents.set(next.to, next.edge.id); sub += .26; } } const done = Math.max(sub, t + .5); t = done + .4; }
  return { order, treeEdges: [...parents.values()], distances, duration: t + .3, issue: null };
}

function graphReferences(entity: GraphEntity): string[] {
  const geometry = graphGeometry(entity);
  return [`${entity.id}.nodes`, `${entity.id}.edges`, ...geometry.vertices.flatMap((name) => [`${entity.id}.${name}`, `${entity.id}.${name}.label`]), ...geometry.edges.flatMap((edge) => [edge.id, ...(edge.weight === null ? [] : [`${edge.id}.w`])])];
}

registerEntity<GraphEntity>({
  kind: "graph", ctor: "graph", group: "Algo", label: "Graph", icon: "●—●", order: 64, fidelity: "exact", authorOnly: true,
  hint: "Directed or undirected labelled graph with BFS, DFS, and weighted shortest paths", anchorArgIndex: 4,
  create: (id, x, y) => ({ ...baseEntity(id, "panel"), nativePaint: true, kind: "graph", vertices: "a b c d e f", edges: "a-b a-c b-d b-e c-f", layout: "circular", x, y, scale: 180, radius: 30, childStyles: {} }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), vertices = argString(stmt.args, 1), edges = argString(stmt.args, 2), layout = argName(stmt.args, 3), at = argPoint(stmt.args, 4), scale = argNumber(stmt.args, 5), radius = argNumber(stmt.args, 6); if (!id || vertices === null || edges === null || !layout || !["circular", "circle", "ring", "row", "line", "grid"].includes(layout) || !at || scale === null || stmt.args.length < 6 || stmt.args.length > 7 || (stmt.args.length === 7 && radius === null)) return null; const entity = { ...baseEntity(id, "panel"), nativePaint: true, kind: "graph" as const, vertices, edges, layout: layout as GraphLayout, x: at.x, y: at.y, scale, radius: radius ?? 30, childStyles: {} }; return graphGeometry(entity).issue ? null : entity; },
  ctorLine: (entity) => `graph(${entity.id}, "${escapeString(entity.vertices)}", "${escapeString(entity.edges)}", ${entity.layout}, ${pt(entity.x, entity.y)}, ${num(entity.scale)}, ${num(entity.radius)});`, extraLines: (entity) => childLines(entity.childStyles), modifiers: {},
  referenceIds: graphReferences, storyTargets(entity) { return styleTargets(graphReferences(entity), (ref) => ref.endsWith(".label") || ref.endsWith(".w") ? "text" : ref === `${entity.id}.nodes` || graphVertices(entity).some((name) => ref === `${entity.id}.${name}`) ? "circle" : "line"); },
  referenceBounds(entity, ref) { const geometry = graphGeometry(entity); if (ref === `${entity.id}.nodes`) return geometry.bounds; if (ref === `${entity.id}.edges`) return geometry.bounds; const vertex = geometry.vertices.findIndex((name) => ref === `${entity.id}.${name}` || ref === `${entity.id}.${name}.label`); if (vertex >= 0) { const point = geometry.positions[vertex]; return { x: point.x - entity.radius, y: point.y - entity.radius, width: entity.radius * 2, height: entity.radius * 2 }; } const edge = geometry.edges.find((item) => ref === item.id || ref === `${item.id}.w`); if (!edge) return null; const a = geometry.positions[geometry.vertices.indexOf(edge.from)], b = geometry.positions[geometry.vertices.indexOf(edge.to)]; return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) - (ref.endsWith(".w") ? 18 : 0), width: Math.max(1, Math.abs(a.x - b.x)), height: Math.max(ref.endsWith(".w") ? 36 : 1, Math.abs(a.y - b.y)) }; },
  applyReferenceModifier(entity, ref, stmt) { return applyChild(entity, ref, stmt); }, anchor: (entity) => ({ x: entity.x, y: entity.y }), translate: move, bounds: (entity) => graphGeometry(entity).bounds,
  handles: (entity) => [{ name: "scale", x: entity.x + entity.scale, y: entity.y }, { name: "radius", x: entity.x + entity.radius, y: entity.y }], dragHandle(entity, handle, px, py) { if (handle === "scale") entity.scale = Math.max(40, Math.hypot(px - entity.x, py - entity.y)); else entity.radius = Math.max(8, Math.hypot(px - entity.x, py - entity.y)); },
  fields: [
    { key: "vertices", label: "Vertices", input: "text", hint: "Whitespace-separated unique names; bare identifiers become traversal start choices automatically." },
    { key: "edges", label: "Edges", input: "textarea", hint: "a-b undirected · a>b directed · append :weight for Dijkstra." },
    { key: "layout", label: "Layout", input: "select", options: ["circular", "circle", "ring", "row", "line", "grid"] },
    { key: "scale", label: "Layout scale", input: "number", min: 40, step: 5 },
    { key: "radius", label: "Node radius", input: "number", min: 8, step: 1 },
  ],
});
