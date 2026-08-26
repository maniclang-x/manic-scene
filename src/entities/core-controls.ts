// Core UI/control constructors. These are logical authoring objects with
// predictable native children; Preview remains authoritative for live passes.

import { argName, argNumber, argPoint, num, pt } from "../args.js";
import { registerEntity, type Box } from "../registry.js";
import type { LoupeEntity, SlidersEntity } from "../types.js";
import { baseEntity } from "./base.js";

function sliderX(entity: SlidersEntity, index: number): number {
  return entity.count <= 1 ? entity.x : entity.x - entity.width / 2 + (index + .5) * entity.width / entity.count;
}

function slidersBox(entity: SlidersEntity): Box {
  return { x: entity.x - entity.width / 2, y: entity.y - entity.height / 2, width: entity.width, height: entity.height + 74 };
}

registerEntity<SlidersEntity>({
  kind: "sliders", ctor: "sliders", group: "Data", label: "Coordinate sliders", icon: "☷", order: 54,
  fidelity: "semantic", colorInCtor: true,
  hint: "An editable 1–32 dial coordinate rack with a live sum-of-squares readout",
  create(id, x, y) { return { ...baseEntity(id, "gold"), kind: "sliders", x, y, count: 4, width: 520, height: 280 }; },
  parseArgs(stmt, doc) {
    const id = argName(stmt.args, 0), count = argNumber(stmt.args, 1), center = argPoint(stmt.args, 2);
    const dialCount = count === null ? 0 : Math.round(count);
    const width = argNumber(stmt.args, 3), height = argNumber(stmt.args, 4);
    if (!id || !center || dialCount < 1 || dialCount > 32 || (width !== null && width <= 0) || (height !== null && height <= 0) || stmt.args.length > 6) return null;
    const canvas = doc?.format === "square" ? { width: 720, height: 720 } : doc?.format === "portrait" ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
    return {
      ...baseEntity(id, argName(stmt.args, 5) ?? "gold"), kind: "sliders", x: center.x, y: center.y,
      count: dialCount, width: width ?? Math.min(980, Math.max(300, canvas.width * .52)),
      height: height ?? Math.min(520, Math.max(200, canvas.height * .42)),
    };
  },
  ctorLine: (entity) => `sliders(${entity.id}, ${Math.max(1, Math.min(32, Math.round(entity.count)))}, ${pt(entity.x, entity.y)}, ${num(Math.max(40, entity.width))}, ${num(Math.max(40, entity.height))}, ${entity.color});`,
  extraLines: () => [], modifiers: {},
  referenceIds(entity) {
    return [
      `${entity.id}.dials`, `${entity.id}.sum`,
      ...Array.from({ length: Math.max(1, Math.min(32, Math.round(entity.count))) }, (_unused, index) => `${entity.id}.line${index}`),
      ...Array.from({ length: Math.max(1, Math.min(32, Math.round(entity.count))) }, (_unused, index) => `${entity.id}.d${index}`),
      ...Array.from({ length: Math.max(1, Math.min(32, Math.round(entity.count))) }, (_unused, index) => `${entity.id}.label${index}`),
    ];
  },
  referenceBounds(entity, ref) {
    if (ref === `${entity.id}.dials`) return { x: entity.x - entity.width / 2, y: entity.y - entity.height / 2 - 10, width: entity.width, height: entity.height + 20 };
    if (ref === `${entity.id}.sum`) return { x: entity.x - 90, y: entity.y + entity.height / 2 + 38, width: 180, height: 28 };
    const match = ref.match(/\.(line|d|label)(\d+)$/u);
    if (!match) return null;
    const index = Number(match[2]);
    if (index >= entity.count) return null;
    const x = sliderX(entity, index);
    if (match[1] === "line") return { x: x - 2, y: entity.y - entity.height / 2, width: 4, height: entity.height };
    if (match[1] === "d") return { x: x - 10, y: entity.y - 10, width: 20, height: 20 };
    return { x: x - 24, y: entity.y + entity.height / 2 + 10, width: 48, height: 24 };
  },
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds: slidersBox,
  handles: (entity) => [{ name: "rack-size", x: entity.x + entity.width / 2, y: entity.y + entity.height / 2 }],
  dragHandle(entity, handle, px, py) { if (handle === "rack-size") { entity.width = Math.max(40, Math.abs(px - entity.x) * 2); entity.height = Math.max(40, Math.abs(py - entity.y) * 2); } },
  fields: [
    { key: "count", label: "Dials", input: "range", min: 1, max: 32, step: 1, hint: "Set Sliders beats automatically expose exactly this many values." },
    { key: "width", label: "Rack width", input: "number", min: 40, step: 10 },
    { key: "height", label: "Rack height", input: "number", min: 40, step: 10 },
  ],
});

function loupeBoxes(entity: LoupeEntity) {
  const source = { x: entity.sourceX - entity.sourceWidth / 2, y: entity.sourceY - entity.sourceHeight / 2, width: entity.sourceWidth, height: entity.sourceHeight };
  const panel = { x: entity.panelX - entity.sourceWidth * entity.magnification / 2, y: entity.panelY - entity.sourceHeight * entity.magnification / 2, width: entity.sourceWidth * entity.magnification, height: entity.sourceHeight * entity.magnification };
  return { source, panel };
}

registerEntity<LoupeEntity>({
  kind: "loupe", ctor: "loupe", group: "Annotations", label: "Live loupe", icon: "⌕", order: 55,
  fidelity: "semantic", colorInCtor: true,
  hint: "A draggable source frame and a live magnified display panel",
  create(id, x, y) { return { ...baseEntity(id, "violet"), kind: "loupe", sourceX: x, sourceY: y, sourceWidth: 150, sourceHeight: 96, panelX: x + 360, panelY: y, magnification: 3, panelColor: "red" }; },
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), source = argPoint(stmt.args, 1), sw = argNumber(stmt.args, 2), sh = argNumber(stmt.args, 3), panel = argPoint(stmt.args, 4), mag = argNumber(stmt.args, 5);
    if (!id || !source || sw === null || sh === null || !panel || mag === null || sw <= 0 || sh <= 0 || mag <= 0 || stmt.args.length > 8) return null;
    return { ...baseEntity(id, argName(stmt.args, 6) ?? "violet"), kind: "loupe", sourceX: source.x, sourceY: source.y, sourceWidth: sw, sourceHeight: sh, panelX: panel.x, panelY: panel.y, magnification: mag, panelColor: argName(stmt.args, 7) ?? "red" };
  },
  ctorLine: (entity) => `loupe(${entity.id}, ${pt(entity.sourceX, entity.sourceY)}, ${num(Math.max(1, entity.sourceWidth))}, ${num(Math.max(1, entity.sourceHeight))}, ${pt(entity.panelX, entity.panelY)}, ${num(Math.max(.01, entity.magnification))}, ${entity.color}, ${entity.panelColor});`,
  extraLines: () => [], modifiers: {},
  referenceIds: (entity) => [`${entity.id}.frame`, `${entity.id}.panel`],
  storyTargets: (entity) => {
    const verbs = ["move", "shift", "slidex", "slidey", "scale", "spin", "rotate", "to", "set", "transform", "fade", "pulse", "flash", "recolor", "blink", "wiggle", "circumscribe", "passflash", "spotlight", "deform", "oscillate", "shake", "followshot", "breathe"];
    return [
      { id: `${entity.id}.frame`, label: `${entity.id}.frame — source frame`, kind: "rect", verbs },
      { id: `${entity.id}.panel`, label: `${entity.id}.panel — display panel`, kind: "rect", verbs },
    ];
  },
  referenceBounds(entity, ref) { const boxes = loupeBoxes(entity); return ref === `${entity.id}.frame` ? boxes.source : ref === `${entity.id}.panel` ? boxes.panel : null; },
  anchor: (entity) => ({ x: entity.sourceX, y: entity.sourceY }),
  translate(entity, dx, dy) { entity.sourceX += dx; entity.sourceY += dy; entity.panelX += dx; entity.panelY += dy; },
  bounds(entity) {
    const { source, panel } = loupeBoxes(entity), x = Math.min(source.x, panel.x), y = Math.min(source.y, panel.y);
    const right = Math.max(source.x + source.width, panel.x + panel.width), bottom = Math.max(source.y + source.height, panel.y + panel.height);
    return { x, y, width: right - x, height: bottom - y };
  },
  handles: (entity) => [
    { name: "source-size", x: entity.sourceX + entity.sourceWidth / 2, y: entity.sourceY + entity.sourceHeight / 2 },
    { name: "panel-position", x: entity.panelX, y: entity.panelY },
  ],
  dragHandle(entity, handle, px, py) {
    if (handle === "source-size") { entity.sourceWidth = Math.max(1, Math.abs(px - entity.sourceX) * 2); entity.sourceHeight = Math.max(1, Math.abs(py - entity.sourceY) * 2); }
    if (handle === "panel-position") { entity.panelX = px; entity.panelY = py; }
  },
  fields: [
    { key: "color", label: "Frame outline", input: "color" },
    { key: "sourceWidth", label: "Source width", input: "number", min: 1, step: 1 },
    { key: "sourceHeight", label: "Source height", input: "number", min: 1, step: 1 },
    { key: "panelX", label: "Panel x", input: "number", step: 1 },
    { key: "panelY", label: "Panel y", input: "number", step: 1 },
    { key: "magnification", label: "Magnification", input: "range", min: .1, max: 10, step: .1, unit: "×" },
    { key: "panelColor", label: "Panel outline", input: "color" },
  ],
});

export { loupeBoxes, sliderX, slidersBox };
