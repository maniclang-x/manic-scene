// Creator/publishing vocabulary: structured profiles, responsive generated
// footer/end-card families, safe-area guides, and group-fitting destinations.

import { argName, argNumber, argPoint, argString, escapeString, num, pt } from "../args.js";
import { preferReference, registerEntity, type Box, type GeometryContext } from "../registry.js";
import {
  CANVAS_SIZES, type CreatorEntity, type CreatorFooter, type CreatorSafe,
  type FigureEntity, type SafezoneEntity, type SceneDoc, type SceneEntity,
} from "../types.js";
import { baseEntity } from "./base.js";

const SAFE_VALUES = ["shorts", "reels", "tiktok", "clean"] as const;

function docSize(doc?: SceneDoc): { width: number; height: number } {
  return doc?.size ?? CANVAS_SIZES[doc?.format ?? "16:9"];
}

function safeAlias(value: string): CreatorSafe | null {
  const key = value.toLowerCase();
  if (["shorts", "short", "youtube"].includes(key)) return "shorts";
  if (["reels", "reel", "instagram"].includes(key)) return "reels";
  if (["tiktok", "tt"].includes(key)) return "tiktok";
  if (["clean", "none", "canvas"].includes(key)) return "clean";
  return null;
}

function footerAlias(value: string): CreatorFooter | null {
  const key = value.toLowerCase();
  if (["social", "icons"].includes(key)) return "social";
  if (["compact", "small"].includes(key)) return "compact";
  if (["signature", "brand"].includes(key)) return "signature";
  if (["none", "off", "hidden"].includes(key)) return "none";
  return null;
}

function decode(value: string): string { return value.replaceAll("_", " "); }
function encode(value: string): string { return value.trim().replaceAll(/\s+/gu, "_"); }

export function publishingSafeBox(doc: SceneDoc | undefined, mode: CreatorSafe | "inset", inset = 0): Box {
  const size = docSize(doc);
  if (mode === "inset") {
    const amount = Math.max(0, Math.min(inset, Math.min(size.width, size.height) * .45));
    return { x: amount, y: amount, width: Math.max(1, size.width - amount * 2), height: Math.max(1, size.height - amount * 2) };
  }
  const ratios: Record<CreatorSafe, [number, number, number, number]> = {
    shorts: [.06, .09, .055, .11], reels: [.065, .105, .075, .135],
    tiktok: [.065, .145, .075, .155], clean: [.045, .045, .045, .045],
  };
  const [left, right, top, bottom] = ratios[mode];
  return { x: size.width * left, y: size.height * top, width: size.width * (1 - left - right), height: size.height * (1 - top - bottom) };
}

export function creatorFooterBox(entity: CreatorEntity, doc?: SceneDoc): Box {
  const safe = publishingSafeBox(doc, entity.safe);
  const tall = docSize(doc).height / docSize(doc).width >= 1.34;
  const height = Math.max(42, safe.height * (tall ? .09 : .08));
  const center = entity.socialsAt ?? { x: safe.x + safe.width / 2, y: safe.y + safe.height - height / 2 };
  return { x: center.x - safe.width * .44, y: center.y - height / 2, width: safe.width * .88, height };
}

export function creatorEndcardBox(entity: CreatorEntity, doc?: SceneDoc): Box {
  const safe = publishingSafeBox(doc, entity.endcard?.safe ?? entity.safe);
  const size = docSize(doc);
  const height = safe.height * (size.height / size.width > 1.3 ? .62 : .78);
  return { x: safe.x + safe.width * .06, y: safe.y + (safe.height - height) / 2, width: safe.width * .88, height };
}

/** Whether `socials(profile)` actually creates native drawables. */
export function creatorHasFooter(entity: CreatorEntity): boolean {
  return entity.socials && entity.footer !== "none";
}

function union(boxes: Box[]): Box {
  if (boxes.length === 0) return { x: 18, y: 18, width: 220, height: 46 };
  const x = Math.min(...boxes.map((box) => box.x)), y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width)), bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x, y, width: right - x, height: bottom - y };
}

function creatorSpec(entity: CreatorEntity): string {
  const parts: string[] = [];
  if (entity.handle) parts.push(entity.handle);
  if (entity.displayName) parts.push(`name=${encode(entity.displayName)}`);
  if (entity.tagline) parts.push(`tagline=${encode(entity.tagline)}`);
  if (entity.logo) parts.push(`logo=${entity.logo}`);
  if (entity.website) parts.push(`web=${encode(entity.website)}`);
  if (entity.platforms.trim()) parts.push(...entity.platforms.trim().split(/\s+/u));
  if (entity.accent) parts.push(`accent=${entity.accent}`);
  if (entity.secondary) parts.push(`secondary=${entity.secondary}`);
  if (entity.footer !== "social") parts.push(`footer=${entity.footer}`);
  if (entity.cta) parts.push(`cta=${encode(entity.cta)}`);
  if (entity.safe !== "shorts") parts.push(`safe=${entity.safe}`);
  return parts.join(" ");
}

function endcardLine(entity: CreatorEntity): string | null {
  if (!entity.endcard) return null;
  const parts: string[] = [];
  if (entity.endcard.title) parts.push(`title=${encode(entity.endcard.title)}`);
  if (entity.endcard.cta) parts.push(`cta=${encode(entity.endcard.cta)}`);
  if (entity.endcard.safe) parts.push(`safe=${entity.endcard.safe}`);
  return `endcard(${entity.id}${parts.length ? `, "${escapeString(parts.join(" "))}"` : ""});`;
}

registerEntity<CreatorEntity>({
  kind: "creator", ctor: "creator", group: "Publishing", label: "Creator profile", icon: "@", order: 60,
  hint: "Reusable brand profile with responsive social footer and end card", colorInCtor: true, movable: false,
  create(id) {
    return { ...baseEntity(id, "fg"), kind: "creator", handle: "@creator", displayName: "Creator", tagline: "", logo: "", website: "", cta: "", platforms: "", accent: "cyan", secondary: "magenta", footer: "social", safe: "shorts", socials: false, socialsAt: null, endcard: null, stickyFooter: false, stickyEndcard: false };
  },
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), spec = argString(stmt.args, 1);
    if (!id || spec === null || stmt.args.length !== 2) return null;
    const entity: CreatorEntity = { ...baseEntity(id, "fg"), kind: "creator", handle: "", displayName: "", tagline: "", logo: "", website: "", cta: "", platforms: "", accent: null, secondary: null, footer: "social", safe: "shorts", socials: false, socialsAt: null, endcard: null, stickyFooter: false, stickyEndcard: false };
    const platforms: string[] = [];
    for (const token of spec.split(/\s+/u).filter(Boolean)) {
      const pair = token.split(/=(.*)/su);
      if (pair.length < 2) { if (!entity.handle) entity.handle = token; continue; }
      const [rawKey, value] = pair, key = rawKey.toLowerCase();
      if (key === "name" || key === "display") entity.displayName = decode(value);
      else if (key === "tagline" || key === "tag") entity.tagline = decode(value);
      else if (key === "logo" || key === "avatar") entity.logo = value;
      else if (["url", "site", "website", "web"].includes(key)) entity.website = decode(value);
      else if (key === "cta") entity.cta = decode(value);
      else if (key === "accent") entity.accent = value;
      else if (key === "secondary") entity.secondary = value;
      else if (key === "footer") { const footer = footerAlias(value); if (!footer) return null; entity.footer = footer; }
      else if (key === "safe" || key === "platform") { const safe = safeAlias(value); if (!safe) return null; entity.safe = safe; }
      else platforms.push(token);
    }
    if (!entity.displayName) entity.displayName = entity.handle.replace(/^@/u, "");
    entity.platforms = platforms.join(" ");
    return entity;
  },
  ctorLine: (entity) => `creator(${entity.id}, "${escapeString(creatorSpec(entity))}");`,
  extraLines(entity) {
    const lines: string[] = [];
    if (entity.socials) lines.push(`socials(${entity.id}${entity.socialsAt ? `, ${pt(entity.socialsAt.x, entity.socialsAt.y)}` : ""});`);
    const endcard = endcardLine(entity); if (endcard) lines.push(endcard);
    if (creatorHasFooter(entity) && entity.stickyFooter) lines.push(`sticky(${entity.id}.footer);`);
    if (entity.stickyEndcard) lines.push(`sticky(${entity.id}.endcard);`);
    return lines;
  },
  modifiers: {
    socials(entity, stmt) {
      const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1);
      if (id !== entity.id || stmt.args.length > 2 || (stmt.args.length === 2 && !at)) return false;
      entity.socials = true; entity.socialsAt = at; return true;
    },
    endcard(entity, stmt) {
      const id = argName(stmt.args, 0), spec = argString(stmt.args, 1);
      if (id !== entity.id || stmt.args.length > 2 || (stmt.args.length === 2 && spec === null)) return false;
      const result: CreatorEntity["endcard"] = { title: null, cta: null, safe: null };
      for (const token of (spec ?? "").split(/\s+/u).filter(Boolean)) {
        const [rawKey, value] = token.split(/=(.*)/su); if (!rawKey || value === undefined) return false;
        const key = rawKey.toLowerCase();
        if (key === "title" || key === "name") result.title = decode(value);
        else if (key === "cta") result.cta = decode(value);
        else if (key === "safe" || key === "platform") { const safe = safeAlias(value); if (!safe) return false; result.safe = safe; }
        else return false;
      }
      entity.endcard = result; return true;
    },
  },
  referenceIds(entity) {
    const ids: string[] = [];
    if (creatorHasFooter(entity)) ids.push(`${entity.id}.footer`, `${entity.id}.socials`, `${entity.id}.handle`, `${entity.id}.rule`);
    if (entity.endcard) ids.push(`${entity.id}.endcard`);
    return ids;
  },
  applyReferenceModifier(entity, ref, stmt) {
    if (stmt.name !== "sticky") return false;
    if (creatorHasFooter(entity) && (ref === `${entity.id}.footer` || ref === `${entity.id}.socials`)) { entity.stickyFooter = true; return true; }
    if (ref === `${entity.id}.endcard`) { entity.stickyEndcard = true; return true; }
    return false;
  },
  referenceBounds(entity, ref, ctx) {
    if ([`${entity.id}.footer`, `${entity.id}.socials`, `${entity.id}.handle`, `${entity.id}.rule`].includes(ref) && creatorHasFooter(entity)) return creatorFooterBox(entity, ctx?.doc);
    if (ref === `${entity.id}.endcard` && entity.endcard) return creatorEndcardBox(entity, ctx?.doc);
    return null;
  },
  anchor(entity, ctx) { const box = this.bounds(entity, ctx); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; },
  translate() {},
  bounds(entity, ctx) { return union([...(creatorHasFooter(entity) ? [creatorFooterBox(entity, ctx?.doc)] : []), ...(entity.endcard ? [creatorEndcardBox(entity, ctx?.doc)] : [])]); },
  handles: () => [], dragHandle() {},
  fields: [
    { key: "handle", label: "Handle", input: "text" }, { key: "displayName", label: "Display name", input: "text" },
    { key: "tagline", label: "Tagline", input: "text" }, { key: "website", label: "Website", input: "text" },
    { key: "cta", label: "Default CTA", input: "text" }, { key: "platforms", label: "Platform accounts", input: "textarea", hint: "Space-separated platform=value pairs, such as yt=channel x=@handle." },
    { key: "logo", label: "Logo asset", input: "text", hint: "Native Preview resolves bundled asset paths." },
    { key: "safe", label: "Safe-area profile", input: "select", options: SAFE_VALUES },
    { key: "accent", label: "Accent", input: "color", nullable: true }, { key: "secondary", label: "Secondary", input: "color", nullable: true },
  ],
});

registerEntity<SafezoneEntity>({
  kind: "safezone", ctor: "safezone", group: "Publishing", label: "Safe zone", icon: "▱", order: 61,
  hint: "Responsive platform UI clearance guide", movable: false,
  create(id) { return { ...baseEntity(id, "dim"), kind: "safezone", mode: "shorts", inset: 48 }; },
  parseArgs(stmt) {
    const id = argName(stmt.args, 0); if (!id || stmt.args.length > 2) return null;
    const numeric = argNumber(stmt.args, 1), named = argName(stmt.args, 1) ?? argString(stmt.args, 1);
    if (stmt.args.length === 1) return { ...baseEntity(id, "dim"), kind: "safezone", mode: "shorts", inset: 48 };
    if (numeric !== null) return { ...baseEntity(id, "dim"), kind: "safezone", mode: "inset", inset: Math.max(0, numeric) };
    const mode = named ? safeAlias(named) : null; return mode ? { ...baseEntity(id, "dim"), kind: "safezone", mode, inset: 48 } : null;
  },
  ctorLine(entity) { return `safezone(${entity.id}${entity.mode === "shorts" ? "" : entity.mode === "inset" ? `, ${num(entity.inset)}` : `, ${entity.mode}`});`; },
  extraLines: () => [], modifiers: {},
  anchor(entity, ctx) { const box = publishingSafeBox(ctx?.doc, entity.mode, entity.inset); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; },
  translate() {}, bounds: (entity, ctx) => publishingSafeBox(ctx?.doc, entity.mode, entity.inset), handles: () => [], dragHandle() {},
  fields: [{ key: "mode", label: "Safe-area profile", input: "select", options: [...SAFE_VALUES, "inset"] }, { key: "inset", label: "Custom inset", input: "number", min: 0, step: 4, hint: "Used only when profile is inset." }],
});

function figureDefault(doc?: SceneDoc): Box {
  const safe = publishingSafeBox(doc, "shorts"), size = docSize(doc), tall = size.height / size.width >= 1.34;
  return tall
    ? { x: safe.x + safe.width * .04, y: safe.y + safe.height * .19, width: safe.width * .92, height: safe.height * .24 }
    : { x: safe.x, y: safe.y + safe.height * .38, width: safe.width * .46, height: safe.height * .50 };
}

registerEntity<FigureEntity>({
  kind: "figure", ctor: "figure", group: "Publishing", label: "Figure region", icon: "▣↔", order: 62,
  hint: "Fit an entity or tagged group into a responsive media region", colorInCtor: true, renameable: false,
  canCreate: (doc) => doc.entities.some((entity) => entity.kind !== "creator" && entity.kind !== "safezone" && entity.kind !== "figure"),
  createBlockedReason: "Add or select visual content before fitting it into a figure region.",
  create(_id, _x, _y, doc, selectedId) {
    const target = preferReference(doc, selectedId, (entity) => !["creator", "safezone", "figure"].includes(entity.kind))?.id ?? "target";
    const box = figureDefault(doc);
    return { ...baseEntity(`${target}.figure`, "dim"), kind: "figure", target, x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width, height: box.height };
  },
  parseArgs(stmt, doc) {
    const target = argName(stmt.args, 0), center = argPoint(stmt.args, 1), size = argPoint(stmt.args, 2), fallback = figureDefault(doc);
    if (!target || stmt.args.length > 3 || (stmt.args.length > 1 && !center) || (stmt.args.length > 2 && !size)) return null;
    return { ...baseEntity(`${target}.figure`, "dim"), kind: "figure", target, x: center?.x ?? fallback.x + fallback.width / 2, y: center?.y ?? fallback.y + fallback.height / 2, width: size?.x ?? fallback.width, height: size?.y ?? fallback.height };
  },
  ctorLine: (entity) => `figure(${entity.target}, ${pt(entity.x, entity.y)}, ${pt(entity.width, entity.height)});`,
  extraLines: () => [], modifiers: {}, references: (entity) => [entity.target],
  replaceReference(entity, from, to) { if (entity.target === from) { entity.target = to; entity.id = `${to}.figure`; } },
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds: (entity) => ({ x: entity.x - entity.width / 2, y: entity.y - entity.height / 2, width: entity.width, height: entity.height }),
  handles: (entity) => [{ name: "size", x: entity.x + entity.width / 2, y: entity.y + entity.height / 2 }],
  dragHandle(entity, _handle, px, py) { entity.width = Math.max(40, Math.abs(px - entity.x) * 2); entity.height = Math.max(40, Math.abs(py - entity.y) * 2); },
  fields: [{ key: "target", label: "Content group", input: "entity", includeTags: true }, { key: "width", label: "Region width", input: "number", min: 40, step: 10 }, { key: "height", label: "Region height", input: "number", min: 40, step: 10 }],
});
