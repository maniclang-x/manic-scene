// image · svg — stable asset URI entities. Hosts resolve the URI for Canvas;
// the native Manic engine independently resolves it for Preview and rendering.

import { argName, argNumber, argPoint, argString, escapeString, num, pt } from "../args.js";
import { registerEntity } from "../registry.js";
import { baseEntity } from "./base.js";
import type { ImageEntity, SvgEntity } from "../types.js";

export function imageSize(entity: ImageEntity): { width: number; height: number } {
  const width = Math.max(1, entity.width ?? 300);
  return { width, height: Math.max(1, entity.height ?? width) };
}

export function svgSize(entity: SvgEntity): number {
  return Math.max(1, entity.size ?? 240);
}

registerEntity<ImageEntity>({
  kind: "image", ctor: "image", anchorArgIndex: 1, group: "Media", label: "Image", icon: "▧", order: 24,
  hint: "Raster artwork from the bundled Library or this project",
  create: (id, x, y) => ({ ...baseEntity(id, "fg"), nativePaint: true, kind: "image", x, y, path: "asset:manic-logo.png", width: 300, height: 300 }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), center = argPoint(stmt.args, 1), path = argString(stmt.args, 2);
    if (!id || !center || path === null || stmt.args.length < 3 || stmt.args.length > 5) return null;
    const width = argNumber(stmt.args, 3), height = argNumber(stmt.args, 4);
    if ((stmt.args.length >= 4 && width === null) || (stmt.args.length === 5 && height === null)) return null;
    return { ...baseEntity(id, "fg"), nativePaint: true, kind: "image", x: center.x, y: center.y, path, width, height };
  },
  ctorLine(entity) {
    const dimensions = entity.width === null ? "" : `, ${num(entity.width)}${entity.height === null ? "" : `, ${num(entity.height)}`}`;
    return `image(${entity.id}, ${pt(entity.x, entity.y)}, "${escapeString(entity.path)}"${dimensions});`;
  },
  extraLines: () => [], modifiers: {},
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds(entity) { const size = imageSize(entity); return { x: entity.x - size.width / 2, y: entity.y - size.height / 2, ...size }; },
  handles(entity) { const size = imageSize(entity); return [{ name: "corner", x: entity.x + size.width / 2, y: entity.y + size.height / 2 }]; },
  dragHandle(entity, _handle, px, py) {
    entity.width = Math.max(10, Math.round(Math.abs(px - entity.x) * 2));
    entity.height = Math.max(10, Math.round(Math.abs(py - entity.y) * 2));
  },
  fields: [
    { key: "path", label: "Asset URI or path", input: "text", hint: "Use asset: URIs for portable projects." },
    { key: "width", label: "Width", input: "number", nullable: true, min: 1, hint: "Empty uses the native 300px default." },
    { key: "height", label: "Height", input: "number", nullable: true, min: 1, hint: "Empty follows width." },
  ],
});

registerEntity<SvgEntity>({
  kind: "svg", ctor: "svg", anchorArgIndex: 1, group: "Media", label: "SVG artwork", icon: "◇", order: 25,
  fidelity: "semantic",
  hint: "Vector artwork imported as native, individually animatable paths",
  create: (id, x, y) => ({ ...baseEntity(id, "fg"), nativePaint: true, kind: "svg", x, y, path: "asset:svg/lucide/star.svg", size: 240 }),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), center = argPoint(stmt.args, 1), path = argString(stmt.args, 2);
    if (!id || !center || path === null || stmt.args.length < 3 || stmt.args.length > 4) return null;
    const size = argNumber(stmt.args, 3);
    if (stmt.args.length === 4 && size === null) return null;
    return { ...baseEntity(id, "fg"), nativePaint: true, kind: "svg", x: center.x, y: center.y, path, size };
  },
  ctorLine: (entity) => `svg(${entity.id}, ${pt(entity.x, entity.y)}, "${escapeString(entity.path)}"${entity.size === null ? "" : `, ${num(entity.size)}`});`,
  extraLines: () => [], modifiers: {},
  anchor: (entity) => ({ x: entity.x, y: entity.y }),
  translate(entity, dx, dy) { entity.x += dx; entity.y += dy; },
  bounds(entity) { const size = svgSize(entity); return { x: entity.x - size / 2, y: entity.y - size / 2, width: size, height: size }; },
  handles: (entity) => [{ name: "size", x: entity.x + svgSize(entity) / 2, y: entity.y + svgSize(entity) / 2 }],
  dragHandle(entity, _handle, px, py) { entity.size = Math.max(10, Math.round(Math.max(Math.abs(px - entity.x), Math.abs(py - entity.y)) * 2)); },
  fields: [
    { key: "path", label: "Asset URI or path", input: "text", hint: "Canvas shows the source artwork; Preview imports native paths." },
    { key: "size", label: "Fitted width", input: "number", nullable: true, min: 1, hint: "Empty uses the native 240px default." },
  ],
});
