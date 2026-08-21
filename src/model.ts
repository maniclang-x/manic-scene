// Scene-document helpers over the registries. (Types live in types.ts;
// behavior lives in entities/ and verbs.ts.)

import "./entities/index.js";
import "./verbs.js";
import { defFor, entityDef, verbDef } from "./registry.js";
import { CANVAS_SIZES, type CanvasFormat, type EntityKind, type ManicTemplate, type SceneAction, type SceneDoc, type SceneEntity } from "./types.js";

export * from "./types.js";

/** The doc's real canvas dimensions (exact file size, else the format bucket). */
export function docSize(doc: SceneDoc): { width: number; height: number } {
  return doc.size ?? CANVAS_SIZES[doc.format];
}

export function emptyDoc(format: CanvasFormat = "16:9", template: ManicTemplate = "black"): SceneDoc {
  return { format, template, entities: [], steps: [] };
}

export function cloneDoc(doc: SceneDoc): SceneDoc {
  return JSON.parse(JSON.stringify(doc)) as SceneDoc;
}

export function docsEqual(a: SceneDoc, b: SceneDoc): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The point an entity scales/rotates about and that `move` relocates. */
export function entityAnchor(entity: SceneEntity): { x: number; y: number } {
  return defFor(entity).anchor(entity);
}

export function translateEntity(entity: SceneEntity, dx: number, dy: number): void {
  defFor(entity).translate(entity, dx, dy);
}

export function createEntity(kind: EntityKind, id: string, x: number, y: number): SceneEntity {
  const def = entityDef(kind);
  if (!def) throw new Error(`Unknown entity kind "${kind}"`);
  return def.create(id, x, y);
}

export function createAction(verb: string, target: string): SceneAction {
  const def = verbDef(verb);
  if (!def) throw new Error(`Unknown verb "${verb}"`);
  return def.create(target);
}

export function sanitizeId(value: string): string {
  const cleaned = value.replaceAll(/[^A-Za-z0-9_]/gu, "_");
  return /^[A-Za-z_]/u.test(cleaned) ? cleaned : `e_${cleaned}`;
}

export function uniqueEntityId(doc: SceneDoc, base: string): string {
  const taken = new Set(doc.entities.map((entity) => entity.id));
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base}${index}`)) index += 1;
  return `${base}${index}`;
}
