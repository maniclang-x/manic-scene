// Optics kit. Canvas draws bounded structural diagrams and stable children;
// native Preview remains authoritative for Snell, dispersion and ray tracing.

import { argName, argNumber, argPoint, argString, escapeString, num, pt } from "../args.js";
import { registerEntity, type Box, type FieldSpec, type StoryTargetSpec } from "../registry.js";
import type { CallStatement } from "../script.js";
import type { OpticsEntity, OpticsKind, Point, VirtualChildStyle } from "../types.js";
import { baseEntity } from "./base.js";

export type OpticsPrimitive =
  | { id: string; kind: "line"; from: Point; to: Point; color: string; width: number; opacity: number; tags: string[]; dashed?: boolean }
  | { id: string; kind: "rect"; x: number; y: number; width: number; height: number; color: string; opacity: number; tags: string[]; outline?: boolean }
  | { id: string; kind: "circle"; x: number; y: number; radius: number; color: string; opacity: number; tags: string[]; fill?: boolean; dashed?: boolean }
  | { id: string; kind: "polyline" | "polygon"; points: Point[]; color: string; width: number; opacity: number; tags: string[] }
  | { id: string; kind: "text"; x: number; y: number; text: string; size: number; color: string; opacity: number; tags: string[] };

export interface OpticsGeometry { primitives: OpticsPrimitive[]; note: string }

const tags = (entity: OpticsEntity, ...rest: string[]) => [entity.id, `${entity.id}.parts`, ...rest];
const line = (entity: OpticsEntity, id: string, from: Point, to: Point, color = "dim", width = 2, opacity = 1, extra: string[] = [], dashed = false): OpticsPrimitive => ({ id: `${entity.id}.${id}`, kind: "line", from, to, color, width, opacity, tags: tags(entity, ...extra), dashed });
const rect = (entity: OpticsEntity, id: string, x: number, y: number, width: number, height: number, color: string, opacity: number, outline = false): OpticsPrimitive => ({ id: `${entity.id}.${id}`, kind: "rect", x, y, width, height, color, opacity, outline, tags: tags(entity) });
const circle = (entity: OpticsEntity, id: string, x: number, y: number, radius: number, color: string, extra: string[] = [], opacity = 1, fill = true, dashed = false): OpticsPrimitive => ({ id: `${entity.id}.${id}`, kind: "circle", x, y, radius, color, opacity, fill, dashed, tags: tags(entity, ...extra) });
const path = (entity: OpticsEntity, id: string, points: Point[], color: string, kind: "polyline" | "polygon" = "polyline", width = 2.5, opacity = 1, extra: string[] = []): OpticsPrimitive => ({ id: `${entity.id}.${id}`, kind, points, color, width, opacity, tags: tags(entity, ...extra) });
const text = (entity: OpticsEntity, id: string, value: string, x: number, y: number, color = "dim", size = 16): OpticsPrimitive => ({ id: `${entity.id}.${id}`, kind: "text", x, y, text: value, color, size, opacity: 1, tags: tags(entity) });
const lensOutline = (cx: number, cy: number, aperture: number): Point[] => {
  const right = Array.from({ length: 25 }, (_v, i) => { const y = aperture - 2 * aperture * i / 24; return { x: cx + 23 * (1 - (y / aperture) ** 2), y: cy + y }; });
  const left = Array.from({ length: 25 }, (_v, i) => { const y = -aperture + 2 * aperture * i / 24; return { x: cx - 23 * (1 - (y / aperture) ** 2), y: cy + y }; });
  return [...right, ...left];
};
const presetFactor = (name: string) => /aspher/u.test(name) ? .08 : /triplet|cooke/u.test(name) ? .12 : /doublet|achromat/u.test(name) ? .22 : /meniscus/u.test(name) ? .65 : /plano/u.test(name) ? .8 : 1;
const spectrum = ["red", "orange", "gold", "lime", "cyan", "blue", "purple", "magenta", "violet"];

function refractGeometry(entity: OpticsEntity): OpticsGeometry {
  const out: OpticsPrimitive[] = [], n1 = Math.max(1, entity.p1 ?? 1), n2 = Math.max(1, entity.p2 ?? 1.5), angle = Math.max(1, Math.min(88, entity.p3 ?? 36)), rad = angle * Math.PI / 180, ratio = n1 / n2 * Math.sin(rad), tir = Math.abs(ratio) > 1, transmitted = tir ? Math.PI / 2 : Math.asin(ratio), l = 260;
  out.push(rect(entity, "medium1", entity.x - 360, entity.y - 210, 720, 210, "cyan", Math.max(0, Math.min(.26, (n1 - 1) * .18))));
  out.push(rect(entity, "medium2", entity.x - 360, entity.y, 720, 210, "cyan", Math.max(0, Math.min(.26, (n2 - 1) * .18))));
  out.push(line(entity, "interface", { x: entity.x - 380, y: entity.y }, { x: entity.x + 380, y: entity.y }, "fg", 2));
  out.push(line(entity, "normal", { x: entity.x, y: entity.y - 168 }, { x: entity.x, y: entity.y + 168 }, "dim", 1.5, .8, [], true));
  out.push(line(entity, "incident", { x: entity.x - Math.sin(rad) * l, y: entity.y - Math.cos(rad) * l }, { x: entity.x, y: entity.y }, "gold", 3));
  out.push(line(entity, "reflected", { x: entity.x, y: entity.y }, { x: entity.x + Math.sin(rad) * l, y: entity.y - Math.cos(rad) * l }, "orange", 2.5, tir ? 1 : .3));
  out.push(line(entity, "refracted", { x: entity.x, y: entity.y }, { x: entity.x + Math.sin(transmitted) * l, y: entity.y + Math.cos(transmitted) * l }, "cyan", 3, tir ? 0 : 1));
  out.push(text(entity, "thetai", `in ${Math.round(angle)}°`, entity.x - 75, entity.y - 42, "gold", 18));
  out.push(text(entity, "thetat", tir ? "out —" : `out ${Math.round(transmitted * 180 / Math.PI)}°`, entity.x + 80, entity.y + 42, "cyan", 18));
  out.push(text(entity, "tir", "TOTAL INTERNAL REFLECTION", entity.x + 150, entity.y - 120, "orange", 16));
  return { primitives: out, note: entity.p3 === null ? "Run sweeps incidence angle" : `Fixed incidence ${angle}°` };
}

function lensGeometry(entity: OpticsEntity): OpticsGeometry {
  const out: OpticsPrimitive[] = [], focal = Math.max(40, entity.p1 ?? 360), ap = Math.max(40, Math.min(320, entity.p2 ?? 150)), left = entity.x - 400, right = entity.x + 540, focus = entity.x + focal;
  out.push(line(entity, "axis", { x: left, y: entity.y }, { x: right, y: entity.y }, "dim", 1));
  out.push(path(entity, "lens", lensOutline(entity.x, entity.y, ap), "cyan", "polygon", 2, .22));
  for (let i = 0; i < 7; i++) { const y = -ap + 2 * ap * i / 6, endY = entity.y + y * (1 - (right - entity.x) / focal); out.push(line(entity, `in${i}`, { x: left, y: entity.y + y }, { x: entity.x, y: entity.y + y }, "gold", 2, 1, [`${entity.id}.rays`])); out.push(line(entity, `out${i}`, { x: entity.x, y: entity.y + y }, { x: right, y: endY }, "cyan", 2, 1, [`${entity.id}.rays`])); }
  out.push(circle(entity, "focus", focus, entity.y, 6, "lime"), text(entity, "flabel", `F · ${Math.round(focal)} px`, focus, entity.y - 24, "lime", 17));
  return { primitives: out, note: entity.p1 === null ? "Run sweeps focal length" : `Fixed focal length ${Math.round(focal)} px` };
}

function prismGeometry(entity: OpticsEntity): OpticsGeometry {
  const out: OpticsPrimitive[] = [], apex = { x: entity.x, y: entity.y - 140 }, bl = { x: entity.x - 162, y: entity.y + 140 }, br = { x: entity.x + 162, y: entity.y + 140 }, entry = { x: apex.x + (bl.x - apex.x) * .55, y: apex.y + (bl.y - apex.y) * .55 };
  out.push(path(entity, "prism", [apex, br, bl], "cyan", "polygon", 2, .2));
  out.push(line(entity, "beam", { x: entry.x - 350, y: entry.y + 20 }, entry, "fg", 4));
  for (let i = 0; i < 9; i++) { const exit = { x: entity.x + 105 + i * 2, y: entity.y + 42 + i * 4 }, end = { x: entity.x + 560, y: entity.y - 40 + i * 18 }; out.push(line(entity, `in${i}`, entry, exit, spectrum[i], 2, 1, [`${entity.id}.spectrum`])); out.push(line(entity, `out${i}`, exit, end, spectrum[i], 2.5, 1, [`${entity.id}.spectrum`])); }
  out.push(text(entity, "label", entity.source || "bk7", entity.x, entity.y + 176, "dim", 15));
  return { primitives: out, note: "Run sweeps incidence; Preview computes Sellmeier dispersion" };
}

function achromatGeometry(entity: OpticsEntity): OpticsGeometry {
  const out: OpticsPrimitive[] = [], ap = Math.max(50, Math.min(260, entity.p1 ?? 120)), left = entity.x - 400, right = entity.x + 580, fred = entity.x + 390, fblue = entity.x + 305;
  out.push(line(entity, "axis", { x: left, y: entity.y }, { x: right, y: entity.y }, "dim", 1), path(entity, "lens", lensOutline(entity.x, entity.y, ap), "cyan", "polygon", 2, .2));
  [-ap, ap].forEach((y, i) => { out.push(line(entity, `in${i}`, { x: left, y: entity.y + y }, { x: entity.x, y: entity.y + y }, "fg", 2)); for (const [prefix, paint, focus] of [["r", "red", fred], ["b", "blue", fblue]] as const) out.push(line(entity, `${prefix}${i}`, { x: entity.x, y: entity.y + y }, { x: right, y: entity.y + y * (1 - (right - entity.x) / (focus - entity.x)) }, paint, 2.2)); });
  out.push(circle(entity, "fred", fred, entity.y, 6, "red"), circle(entity, "fblue", fblue, entity.y, 6, "blue"));
  return { primitives: out, note: "Run merges red and blue focus through achromatic correction" };
}

function prescriptionElements(source: string): number { if (source.includes("|")) return Math.max(1, source.split("|").filter(Boolean).length - 1); return /triplet|cooke/u.test(source) ? 3 : /doublet|achromat/u.test(source) ? 2 : 1; }
function lensSystemGeometry(entity: OpticsEntity): OpticsGeometry {
  const out: OpticsPrimitive[] = [], count = prescriptionElements(entity.source), left = entity.x - 410, first = entity.x - 150, right = entity.x + (entity.p1 !== null ? 620 : 440), ap = 115;
  out.push(line(entity, "axis", { x: left, y: entity.y }, { x: right, y: entity.y }, "dim", 1));
  for (let i = 0; i < count; i++) out.push(rect(entity, `elem${i}`, first + i * 44, entity.y - ap, 30, ap * 2, i % 2 ? "blue" : "cyan", .18, true));
  const last = first + Math.max(0, count - 1) * 44 + 30, best = last + 280 * (1 + presetFactor(entity.source) * .15);
  for (let i = 0; i < 11; i++) { const y = -ap + 2 * ap * i / 10, endY = entity.y + y * presetFactor(entity.source) * .18; out.push(path(entity, `ray${i}`, [{ x: left, y: entity.y + y }, { x: first, y: entity.y + y }, { x: last, y: entity.y + y * .75 }, { x: best, y: endY }, { x: right, y: entity.y - y * .35 }], "cyan", "polyline", 1.7, .8, [`${entity.id}.rays`])); }
  out.push(line(entity, "sensor", { x: best, y: entity.y - 150 }, { x: best, y: entity.y + 150 }, "gold", 2, 1, [], true));
  out.push(text(entity, "spot", "spot RMS", best + 45, entity.y - 120, "gold", 16), text(entity, "fnum", "f/≈2.8", left + 35, entity.y - 150, "dim", 15), text(entity, "na", "NA", left + 35, entity.y - 126, "dim", 15), circle(entity, "bestfocus", best, entity.y, 5, "lime"), text(entity, "bestfocuslabel", "best focus", best, entity.y + 178, "lime", 14), text(entity, "label", entity.source || "singlet", entity.x, entity.y + 210, "fg", 18));
  return { primitives: out, note: `Run sweeps sensor · ${count} optical element${count === 1 ? "" : "s"}` };
}

function analysisGeometry(entity: OpticsEntity): OpticsGeometry {
  const out: OpticsPrimitive[] = [], factor = presetFactor(entity.source), label = entity.source || (entity.kind === "fieldspot" ? "doublet" : "singlet");
  if (entity.kind === "rayfan") {
    const hw = 320, hh = 170; out.push(rect(entity, "box", entity.x - hw, entity.y - hh, hw * 2, hh * 2, "dim", 0, true), line(entity, "zerox", { x: entity.x - hw, y: entity.y }, { x: entity.x + hw, y: entity.y }, "dim", 1, .6), line(entity, "zeroy", { x: entity.x, y: entity.y - hh }, { x: entity.x, y: entity.y + hh }, "dim", 1, .6));
    out.push(path(entity, "curve", Array.from({ length: 81 }, (_v, i) => { const h = -1 + 2 * i / 80; return { x: entity.x + h * hw, y: entity.y - factor * (h ** 3 - .18 * h) * hh * .9 }; }), "cyan", "polyline", 3, 1, [`${entity.id}.curve`]));
    out.push(text(entity, "label", `${label} · transverse ray error`, entity.x, entity.y - hh - 28, "fg", 18), text(entity, "xlabel", "pupil height", entity.x, entity.y + hh + 28, "dim", 14), text(entity, "ylabel", "ray error", entity.x - hw - 48, entity.y, "dim", 14));
    return { primitives: out, note: "Bounded aberration-curve proxy; Preview traces the prescription" };
  }
  const field = entity.kind === "fieldspot" ? entity.p1 ?? 5 : 0, spread = 140 * factor * (entity.kind === "fieldspot" ? 1 + Math.abs(field) / 6 : 1), count = entity.kind === "fieldspot" ? 113 : 100;
  out.push(line(entity, "crossx", { x: entity.x - 170, y: entity.y }, { x: entity.x + 170, y: entity.y }, "dim", 1, .4), line(entity, "crossy", { x: entity.x, y: entity.y - 170 }, { x: entity.x, y: entity.y + 170 }, "dim", 1, .4));
  for (let i = 0; i < count; i++) { const a = i * 2.399963, r = spread * Math.sqrt((i + .5) / count), coma = entity.kind === "fieldspot" ? Math.abs(field) * (r / Math.max(1, spread)) ** 2 * 8 : 0; out.push(circle(entity, `dot${i}`, entity.x + Math.cos(a) * r * (entity.kind === "fieldspot" ? 1.25 : 1) + coma, entity.y + Math.sin(a) * r * .72, 2.6, "cyan", [`${entity.id}.dots`], .8)); }
  if (entity.kind === "spotdiagram") out.push(circle(entity, "ideal", entity.x, entity.y, 5, "lime"));
  else out.push(circle(entity, "airy", entity.x, entity.y, 18, "lime", [], .9, false, true), text(entity, "airylabel", "Airy disk", entity.x + 52, entity.y + 22, "lime", 13));
  out.push(text(entity, "rms", `RMS · ${Math.max(.1, factor * 18).toFixed(1)}`, entity.x, entity.y + 205, "gold", 17), text(entity, "label", entity.kind === "fieldspot" ? `${label} · field ${field}°` : label, entity.x, entity.y - 205, "fg", 18));
  return { primitives: out, note: entity.kind === "fieldspot" ? "Semantic coma/astigmatism footprint with Airy overlay" : "Semantic best-focus ray landing footprint" };
}

export function opticsGeometry(entity: OpticsEntity): OpticsGeometry {
  if (entity.kind === "refract") return refractGeometry(entity);
  if (entity.kind === "lens") return lensGeometry(entity);
  if (entity.kind === "prism") return prismGeometry(entity);
  if (entity.kind === "achromat") return achromatGeometry(entity);
  if (entity.kind === "lenssystem") return lensSystemGeometry(entity);
  return analysisGeometry(entity);
}

function base(id: string, kind: OpticsKind, x: number, y: number): OpticsEntity { return { ...baseEntity(id, "cyan"), nativePaint: true, kind, x, y, source: "", p1: null, p2: null, p3: null, childStyles: {} }; }
const move = (entity: OpticsEntity, dx: number, dy: number) => { entity.x += dx; entity.y += dy; };
function childStyle(entity: OpticsEntity, ref: string): VirtualChildStyle { return entity.childStyles[ref] ?? (entity.childStyles[ref] = {}); }
function applyChild(entity: OpticsEntity, ref: string, stmt: CallStatement): boolean { const style = childStyle(entity, ref); if (stmt.name === "color") { const value = argName(stmt.args, 1); if (!value) return false; style.color = value; return true; } if (stmt.name === "opacity") { const value = argNumber(stmt.args, 1); if (value === null) return false; style.opacity = value; return true; } if (stmt.name === "hidden") { style.reveal = argName(stmt.args, 1) === "center" ? "grow" : "fade"; return true; } if (stmt.name === "untraced") { style.untraced = true; return true; } return false; }
function childLines(styles: Record<string, VirtualChildStyle>): string[] { return Object.entries(styles).flatMap(([ref, style]) => [...(style.color ? [`color(${ref}, ${style.color});`] : []), ...(style.opacity !== undefined ? [`opacity(${ref}, ${num(style.opacity)});`] : []), ...(style.reveal ? [`hidden(${ref}${style.reveal === "grow" ? ", center" : ""});`] : []), ...(style.untraced ? [`untraced(${ref});`] : [])]); }
const numField = (key: string, label: string, min?: number, step = 1): FieldSpec => ({ key, label, input: "number", nullable: true, min, step });
const textField = (label: string, hint: string): FieldSpec => ({ key: "source", label, input: "text", hint });
function bounds(entity: OpticsEntity): Box { const sizes: Record<OpticsKind, [number, number]> = { refract: [800, 520], lens: [980, 500], prism: [1040, 520], achromat: [1020, 480], lenssystem: [940, 470], rayfan: [740, 430], spotdiagram: [430, 460], fieldspot: [470, 460] }; const [width, height] = sizes[entity.kind]; return { x: entity.x - width / 2, y: entity.y - height / 2, width, height }; }
function parseEntity(kind: OpticsKind, stmt: CallStatement): OpticsEntity | null {
  const id = argName(stmt.args, 0); if (!id) return null;
  const defaults: Record<OpticsKind, Point> = { refract: { x: 640, y: 360 }, lens: { x: 640, y: 360 }, prism: { x: 540, y: 380 }, achromat: { x: 540, y: 360 }, lenssystem: { x: 640, y: 380 }, rayfan: { x: 640, y: 360 }, spotdiagram: { x: 640, y: 360 }, fieldspot: { x: 640, y: 360 } };
  const at = stmt.args.length > 1 ? argPoint(stmt.args, 1) : defaults[kind]; if (!at) return null; const entity = base(id, kind, at.x, at.y);
  if (kind === "refract") { if (stmt.args.length > 5) return null; const values=[argNumber(stmt.args,2),argNumber(stmt.args,3),argNumber(stmt.args,4)]; if(values.some((v,i)=>stmt.args.length>i+2&&v===null))return null;[entity.p1,entity.p2,entity.p3]=values; }
  else if (kind === "lens") { if (stmt.args.length > 4) return null; const values=[argNumber(stmt.args,2),argNumber(stmt.args,3)];if(values.some((v,i)=>stmt.args.length>i+2&&v===null))return null;[entity.p1,entity.p2]=values; }
  else if (kind === "achromat") { if (stmt.args.length > 3) return null; entity.p1=argNumber(stmt.args,2);if(stmt.args.length>2&&entity.p1===null)return null; }
  else { const max=kind==="lenssystem"||kind==="fieldspot"?4:3;if(stmt.args.length>max)return null;const value=stmt.args.length>2?argString(stmt.args,2):null;if(stmt.args.length>2&&value===null)return null;entity.source=value??(kind==="prism"?"bk7":kind==="fieldspot"?"doublet":"singlet");if(kind==="lenssystem"||kind==="fieldspot"){entity.p1=argNumber(stmt.args,3);if(stmt.args.length>3&&entity.p1===null)return null;} }
  return entity;
}
function ctorLine(entity: OpticsEntity): string {
  const at=pt(entity.x,entity.y);
  if(entity.kind==="refract"){let last=entity.p3!==null?3:entity.p2!==null?2:entity.p1!==null?1:0;const vals=[entity.p1??1,entity.p2??1.5,entity.p3??36];return `refract(${entity.id}, ${at}${vals.slice(0,last).map(v=>`, ${num(v)}`).join("")});`;}
  if(entity.kind==="lens"){const tail=entity.p2!==null?`, ${num(entity.p1??240)}, ${num(entity.p2)}`:entity.p1!==null?`, ${num(entity.p1)}`:"";return `lens(${entity.id}, ${at}${tail});`;}
  if(entity.kind==="achromat")return `achromat(${entity.id}, ${at}${entity.p1===null?"":`, ${num(entity.p1)}`});`;
  const source=`"${escapeString(entity.source)}"`, number=entity.p1===null?"":`, ${num(entity.p1)}`;return `${entity.kind}(${entity.id}, ${at}, ${source}${number});`;
}

const definitions: Array<{ kind: OpticsKind; label: string; icon: string; order: number; fields: FieldSpec[]; create: (entity: OpticsEntity) => void }> = [
  { kind:"refract",label:"Refraction",icon:"↘│↘",order:90,fields:[numField("p1","Index n₁",1,.01),numField("p2","Index n₂",1,.01),numField("p3","Fixed angle °",1,1)],create:e=>{} },
  { kind:"lens",label:"Thin lens",icon:")(",order:90.1,fields:[numField("p1","Fixed focal length",40),numField("p2","Half-aperture",40)],create:e=>{} },
  { kind:"prism",label:"Dispersive prism",icon:"△",order:90.2,fields:[textField("Glass","Named glass, for example bk7 or sf11")],create:e=>{e.source="bk7";} },
  { kind:"achromat",label:"Achromatic doublet",icon:")|(",order:90.3,fields:[numField("p1","Half-aperture",50)],create:e=>{} },
  { kind:"lenssystem",label:"Lens system",icon:")()(",order:90.4,fields:[textField("Preset or prescription","singlet, doublet, triplet, or radius thickness glass | …"),numField("p1","Object distance",1)],create:e=>{e.source="singlet";} },
  { kind:"rayfan",label:"Ray-fan plot",icon:"S↕",order:90.5,fields:[textField("Lens preset","singlet, doublet, triplet, aspheric…")],create:e=>{e.source="singlet";} },
  { kind:"spotdiagram",label:"Spot diagram",icon:"⁙",order:90.6,fields:[textField("Lens preset","singlet, doublet, triplet, aspheric…")],create:e=>{e.source="singlet";} },
  { kind:"fieldspot",label:"Off-axis field spot",icon:"☄",order:90.7,fields:[textField("Lens preset","singlet, doublet, triplet, aspheric…"),numField("p1","Field angle °",0,.5)],create:e=>{e.source="doublet";} },
];
for(const spec of definitions) registerEntity<OpticsEntity>({ kind:spec.kind,ctor:spec.kind,group:"Optics",label:spec.label,icon:spec.icon,order:spec.order,fidelity:"semantic",hint:"Editable optical contract and stable parts; Preview owns physical ray tracing",anchorArgIndex:1,create(id,x,y){const entity=base(id,spec.kind,x,y);spec.create(entity);return entity;},parseArgs(stmt){return parseEntity(spec.kind,stmt);},ctorLine,extraLines:(entity)=>childLines(entity.childStyles),modifiers:{},references:()=>[],replaceReference(){},referenceIds(entity){return [...new Set([`${entity.id}.parts`,...opticsGeometry(entity).primitives.flatMap(primitive=>[primitive.id,...primitive.tags])])];},storyTargets(entity){return opticsGeometry(entity).primitives.map((primitive):StoryTargetSpec=>({id:primitive.id,label:primitive.id,kind:primitive.kind==="circle"?"dot":primitive.kind==="text"?"text":primitive.kind==="rect"||primitive.kind==="polygon"?"rect":"line"}));},applyReferenceModifier:applyChild,anchor:(entity)=>({x:entity.x,y:entity.y}),translate:move,bounds,handles:()=>[],dragHandle(){},fields:spec.fields });
