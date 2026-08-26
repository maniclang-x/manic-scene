// Formula-authored fields. Native Manic owns full-resolution pixels and live
// time; Canvas evaluates a deterministic, bounded t=0 sample that stays useful
// even for 192k-point corpus scenes.

import { argName, argNumber, argString, escapeString, num, pt } from "../args.js";
import { CONSTANTS, evalExpr, type Env } from "../expr.js";
import { registerEntity, type Box, type EntityParseContext, type GeometryContext } from "../registry.js";
import { parseScript, type CallStatement, type LetStatement } from "../script.js";
import type { Cloud3Entity, CloudEntity, GlslEntity, SceneDoc, ShaderEntity } from "../types.js";
import { docSize } from "../model.js";
import { baseEntity } from "./base.js";
import { projectPoint3 } from "./three.js";

export const GENERATIVE_SAMPLE_CAP = 600;
const SHADER_COLUMNS = 28;

export interface CloudSample { index: number; x: number; y: number; radius: number; hue: number | null; saturation: number; value: number; alpha: number; }
export interface Cloud3Sample extends CloudSample { z: number; scale: number; }
export interface ShaderSample { x: number; y: number; width: number; height: number; r: number; g: number; b: number; hue: number | null; saturation: number; value: number; alpha: number; }
export type GlslUniformBinding = "builtin" | "camera" | "parameter" | "unbound";
export interface GlslUniform { name: string; binding: GlslUniformBinding; target: string | null; }

const GLSL_CAMERA_UNIFORMS = new Set(["iCamEye", "iCamFwd", "iCamRight", "iCamUp", "iCamThf"]);
const GLSL_BUILTIN_UNIFORMS = new Set(["iTime", "iResolution", "iMouse"]);

/** Match the native engine's deliberately pragmatic uniform declaration scan. */
export function glslUniformNames(source: string): string[] {
  const names: string[] = [];
  const pattern = /\buniform\s+[A-Za-z_][A-Za-z0-9_]*\s+([A-Za-z_][A-Za-z0-9_]*)/gu;
  for (const match of source.matchAll(pattern)) if (!names.includes(match[1])) names.push(match[1]);
  return names;
}

export function glslUniforms(entity: GlslEntity, doc?: SceneDoc): GlslUniform[] {
  const parameters = new Set((doc?.entities ?? []).filter((item) => item.kind === "parameter").map((item) => item.id));
  return glslUniformNames(entity.source).map((name) => {
    if (GLSL_BUILTIN_UNIFORMS.has(name)) return { name, binding: "builtin", target: null };
    if (GLSL_CAMERA_UNIFORMS.has(name)) return { name, binding: "camera", target: "__camera3" };
    if (name.startsWith("u_") && parameters.has(name.slice(2))) return { name, binding: "parameter", target: name.slice(2) };
    return { name, binding: "unbound", target: null };
  });
}

function glslLiteral(source: string): string {
  return source.includes("`") ? `"${escapeString(source)}"` : `\`${source}\``;
}

function programOf(statement: CallStatement): string | null {
  if (!statement.block) return null;
  const open = statement.raw.indexOf("{");
  const close = statement.raw.lastIndexOf("}");
  if (open < 0 || close <= open) return null;
  const lines = statement.raw.slice(open + 1, close).replace(/^\s*\n/u, "").replace(/\n\s*$/u, "").split("\n");
  const indentation = Math.min(...lines.filter((line) => line.trim()).map((line) => /^\s*/u.exec(line)?.[0].length ?? 0));
  return lines.map((line) => line.slice(Number.isFinite(indentation) ? indentation : 0).trimEnd()).join("\n").trim();
}

function indented(program: string): string {
  const body = program.trim();
  return body ? body.split("\n").map((line) => `  ${line.trimEnd()}`).join("\n") : "  // Add let formulas here.";
}

function blockCall(head: string, program: string, source: string | null = null): string {
  return `${head}${source ? ` from ${source}` : ""} {\n${indented(program)}\n}`;
}

function numericVariables(doc: SceneDoc | undefined, captured: Readonly<Record<string, number>>): Record<string, number> {
  const size = doc ? docSize(doc) : { width: 1280, height: 720 };
  const values: Record<string, number> = { ...CONSTANTS, w: size.width, h: size.height, cx: size.width / 2, cy: size.height / 2, asp: size.width / size.height, ...captured };
  for (const entity of doc?.entities ?? []) if (entity.kind === "parameter") values[entity.id] = entity.value;
  return values;
}

function defaultVariables(doc?: SceneDoc): Record<string, number> {
  return numericVariables(doc, {});
}

function statements(program: string): LetStatement[] | null {
  try {
    const parsed = parseScript(program);
    if (parsed.unsupported.length > 0 || parsed.statements.some((statement) => statement.kind !== "let")) return null;
    return parsed.statements as LetStatement[];
  } catch { return null; }
}

function evaluate(program: readonly LetStatement[], variables: Readonly<Record<string, number>>): Env | null {
  const env: Env = new Map(Object.entries(variables));
  try {
    for (const statement of program) env.set(statement.name, evalExpr(statement.expr, env));
    return env;
  } catch { return null; }
}

function bounded(value: number | undefined, fallback: number, low: number, high: number): number {
  return Number.isFinite(value) ? Math.max(low, Math.min(high, value!)) : fallback;
}

function pointIndexes(count: number, cap = GENERATIVE_SAMPLE_CAP): number[] {
  const shown = Math.min(Math.max(0, Math.floor(count)), cap);
  return Array.from({ length: shown }, (_, index) => Math.floor(index * count / Math.max(1, shown)));
}

export function cloudSamples(entity: CloudEntity, doc?: SceneDoc, time = 0, cap = GENERATIVE_SAMPLE_CAP): CloudSample[] {
  // Home-source geometry belongs to native Manic. A zero-filled hx/hy preview
  // would be actively misleading, so source-backed fields use a semantic card.
  if (entity.source) return [];
  const program = statements(entity.program);
  if (!program) return [];
  const variables = numericVariables(doc, entity.variables);
  return pointIndexes(entity.count, cap).flatMap((index) => {
    const env = evaluate(program, { ...variables, i: index, t: time });
    const x = env?.get("x"), y = env?.get("y");
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    return [{
      index, x: x!, y: y!, radius: bounded(env?.get("r") ?? env?.get("rr"), 1.5, .35, 20),
      hue: Number.isFinite(env?.get("hue")) ? env!.get("hue")! : null,
      saturation: bounded(env?.get("sat"), 1, 0, 1), value: bounded(env?.get("val"), .62, 0, 1),
      alpha: bounded(env?.get("alpha"), 1, 0, 1) * entity.pointOpacity,
    }];
  });
}

export function cloud3Samples(entity: Cloud3Entity, doc?: SceneDoc, time = 0, cap = GENERATIVE_SAMPLE_CAP): Cloud3Sample[] {
  const program = statements(entity.program);
  if (!program) return [];
  const variables = numericVariables(doc, entity.variables);
  return pointIndexes(entity.count, cap).flatMap((index) => {
    const env = evaluate(program, { ...variables, i: index, t: time });
    const x = env?.get("x"), y = env?.get("y"), z = env?.get("z");
    if (![x, y, z].every(Number.isFinite)) return [];
    const projected = projectPoint3({ x: x!, y: y!, z: z! }, doc);
    return [{
      index, x: projected.x, y: projected.y, z: z!, scale: projected.scale,
      radius: bounded(env?.get("r") ?? env?.get("rr"), .05, .005, 2),
      hue: Number.isFinite(env?.get("hue")) ? env!.get("hue")! : null,
      saturation: bounded(env?.get("sat"), 1, 0, 1), value: bounded(env?.get("val"), .62, 0, 1),
      alpha: bounded(env?.get("alpha"), 1, 0, 1) * entity.pointOpacity,
    }];
  });
}

export function shaderSamples(entity: ShaderEntity, doc: SceneDoc, time = 0): ShaderSample[] {
  const program = statements(entity.program);
  if (!program) return [];
  const size = docSize(doc);
  const width = entity.fullCanvas ? size.width : entity.width, height = entity.fullCanvas ? size.height : entity.height;
  const centerX = entity.fullCanvas ? size.width / 2 : entity.x, centerY = entity.fullCanvas ? size.height / 2 : entity.y;
  const left = centerX - width / 2, top = centerY - height / 2;
  const columns = SHADER_COLUMNS;
  const rows = Math.max(8, Math.round(columns * height / Math.max(1, width)));
  const cellWidth = width / columns, cellHeight = height / rows;
  const variables = numericVariables(doc, entity.variables);
  const out: ShaderSample[] = [];
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const u = (column + .5) / columns, v = (row + .5) / rows;
    const env = evaluate(program, { ...variables, u, v, t: time });
    if (!env) continue;
    const c = bounded(env.get("c"), 0, 0, 1);
    const hasRgb = ["r", "g", "b"].every((name) => Number.isFinite(env.get(name)));
    out.push({ x: left + column * cellWidth, y: top + row * cellHeight, width: cellWidth + .5, height: cellHeight + .5,
      r: bounded(env.get("r"), c, 0, 1), g: bounded(env.get("g"), c, 0, 1), b: bounded(env.get("b"), c, 0, 1),
      hue: !hasRgb && Number.isFinite(env.get("hue")) ? env.get("hue")! : null,
      saturation: bounded(env.get("sat"), 1, 0, 1), value: bounded(env.get("val"), .5, 0, 1), alpha: bounded(env.get("alpha"), 1, 0, 1),
    });
  }
  return out;
}

function boxOf(points: readonly { x: number; y: number }[], fallback: Box): Box {
  if (points.length === 0) return fallback;
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
}

function fieldFallback(ctx?: GeometryContext): Box {
  const size = ctx?.doc ? docSize(ctx.doc) : { width: 1280, height: 720 };
  return { x: size.width / 2 - 120, y: size.height / 2 - 60, width: 240, height: 120 };
}

function formulaContext(context?: EntityParseContext): Record<string, number> {
  return { ...(context?.variables ?? {}) };
}

registerEntity<CloudEntity>({
  kind: "cloud", ctor: "cloud", acceptsBlock: true, colorInCtor: true, fidelity: "semantic", group: "Generative", label: "Point cloud", icon: "⁙", order: 70,
  hint: "A live formula-driven 2D point field; Canvas shows a bounded t=0 sample", movable: false,
  create(id, x, y, doc) { return { ...baseEntity(id, "cyan"), kind: "cloud", count: 600, pointOpacity: .8, source: null, variables: defaultVariables(doc), program: `let a = i/600*tau;\nlet x = ${num(x)} + 150*cos(a);\nlet y = ${num(y)} + 150*sin(a);\nlet r = 2;\nlet hue = mod(i*0.6, 360);` }; },
  parseArgs(stmt, _doc, context) { const id = argName(stmt.args, 0), count = argNumber(stmt.args, 1), program = programOf(stmt); if (!id || count === null || count < 1 || program === null || stmt.args.length > 4) return null; return { ...baseEntity(id, argName(stmt.args, 2) ?? "fg"), kind: "cloud", count: Math.floor(count), pointOpacity: argNumber(stmt.args, 3) ?? 1, source: stmt.source?.raw ?? null, variables: formulaContext(context), program }; },
  ctorLine: (entity) => blockCall(`cloud(${entity.id}, ${num(entity.count)}, ${entity.color}, ${num(entity.pointOpacity)})`, entity.program, entity.source), extraLines: () => [], modifiers: {},
  anchor(entity, ctx) { const box = boxOf(cloudSamples(entity, ctx?.doc), fieldFallback(ctx)); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, translate() {},
  bounds: (entity, ctx) => boxOf(cloudSamples(entity, ctx?.doc), fieldFallback(ctx)), handles: () => [], dragHandle() {},
  fields: [{ key: "count", label: "Native point count", input: "number", min: 1, step: 1, hint: `Canvas samples at most ${GENERATIVE_SAMPLE_CAP}; Preview renders every point.` }, { key: "pointOpacity", label: "Point opacity", input: "range", min: 0, max: 1, step: .05, unit: "" }, { key: "source", label: "Home source", input: "text", nullable: true, hint: "Optional native text(...), shape(...), path(...), flow(...), or map(...). Canvas marks this relationship; Preview resolves its exact home points." }, { key: "program", label: "Formula block", input: "textarea", hint: "Use i and t; output x/y, optionally r, hue, sat, val, and alpha." }],
});

registerEntity<Cloud3Entity>({
  kind: "cloud3", ctor: "cloud3", acceptsBlock: true, colorInCtor: true, fidelity: "semantic", group: "Generative", label: "3D point cloud", icon: "⁙3", order: 71,
  hint: "A live formula-driven 3D point field projected through the initial camera", movable: false,
  create(id, _x, _y, doc) { return { ...baseEntity(id, "cyan"), kind: "cloud3", count: 1200, pointOpacity: .9, variables: defaultVariables(doc), program: "let ct = 1-2*(i+0.5)/1200;\nlet st = sqrt(1-ct*ct);\nlet a = i*2.39996;\nlet x = 3*st*cos(a);\nlet y = 3*st*sin(a);\nlet z = 3*ct;\nlet r = 0.05;\nlet hue = mod(i*0.3, 360);" }; },
  parseArgs(stmt, _doc, context) { const id = argName(stmt.args, 0), count = argNumber(stmt.args, 1), program = programOf(stmt); if (!id || count === null || count < 1 || program === null || stmt.args.length > 4) return null; return { ...baseEntity(id, argName(stmt.args, 2) ?? "fg"), kind: "cloud3", count: Math.floor(count), pointOpacity: argNumber(stmt.args, 3) ?? 1, variables: formulaContext(context), program }; },
  ctorLine: (entity) => blockCall(`cloud3(${entity.id}, ${num(entity.count)}, ${entity.color}, ${num(entity.pointOpacity)})`, entity.program), extraLines: () => [], modifiers: {},
  anchor(entity, ctx) { const box = boxOf(cloud3Samples(entity, ctx?.doc), fieldFallback(ctx)); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, translate() {},
  bounds: (entity, ctx) => boxOf(cloud3Samples(entity, ctx?.doc), fieldFallback(ctx)), handles: () => [], dragHandle() {},
  fields: [{ key: "count", label: "Native point count", input: "number", min: 1, step: 1, hint: `Canvas samples at most ${GENERATIVE_SAMPLE_CAP}; Preview renders every point.` }, { key: "pointOpacity", label: "Point opacity", input: "range", min: 0, max: 1, step: .05, unit: "" }, { key: "program", label: "Formula block", input: "textarea", hint: "Use i and t; output world-space x/y/z, optionally r, hue, sat, val, and alpha." }],
});

registerEntity<ShaderEntity>({
  kind: "shader", ctor: "shader", acceptsBlock: true, colorInCtor: true, fidelity: "semantic", group: "Generative", label: "Formula shader", icon: "▦", order: 72,
  hint: "A per-pixel formula field; Canvas shows a low-resolution t=0 design sample", movable: false,
  create(id, _x, _y, doc) { const size = doc ? docSize(doc) : { width: 1280, height: 720 }; return { ...baseEntity(id, "fg"), kind: "shader", variables: defaultVariables(doc), fullCanvas: true, x: size.width / 2, y: size.height / 2, width: Math.round(size.width * .6), height: Math.round(size.height * .6), program: "let r = u;\nlet g = v;\nlet b = 0.5 + 0.5*sin((u+v)*tau);" }; },
  parseArgs(stmt, doc, context) { const id = argName(stmt.args, 0), at = stmt.args.length > 1 && stmt.args[1].type === "point" ? stmt.args[1] : null, authoredWidth = argNumber(stmt.args, 2), authoredHeight = argNumber(stmt.args, 3), program = programOf(stmt); if (!id || program === null || !([1, 4].includes(stmt.args.length)) || (stmt.args.length === 4 && (!at || authoredWidth === null || authoredHeight === null))) return null; const size = doc ? docSize(doc) : { width: 1280, height: 720 }; return { ...baseEntity(id, "fg"), kind: "shader", variables: formulaContext(context), fullCanvas: stmt.args.length === 1, x: at?.x ?? size.width / 2, y: at?.y ?? size.height / 2, width: authoredWidth ?? Math.round(size.width * .6), height: authoredHeight ?? Math.round(size.height * .6), program }; },
  ctorLine(entity) { const region = entity.fullCanvas ? "" : `, ${pt(entity.x, entity.y)}, ${num(entity.width)}, ${num(entity.height)}`; return blockCall(`shader(${entity.id}${region})`, entity.program); }, extraLines: () => [], modifiers: {},
  anchor(entity, ctx) { const size = ctx?.doc ? docSize(ctx.doc) : { width: 1280, height: 720 }; return { x: entity.fullCanvas ? size.width / 2 : entity.x, y: entity.fullCanvas ? size.height / 2 : entity.y }; }, translate() {},
  bounds(entity, ctx) { const size = ctx?.doc ? docSize(ctx.doc) : { width: 1280, height: 720 }; const width = entity.fullCanvas ? size.width : entity.width, height = entity.fullCanvas ? size.height : entity.height; const x = entity.fullCanvas ? size.width / 2 : entity.x, y = entity.fullCanvas ? size.height / 2 : entity.y; return { x: x - width / 2, y: y - height / 2, width, height }; }, handles: () => [], dragHandle() {},
  fields: [{ key: "program", label: "Formula block", input: "textarea", hint: "Use u, v, t, and asp; output r/g/b, hue/sat/val, or c, optionally alpha." }, { key: "fullCanvas", label: "Fill the whole canvas", input: "checkbox" }, { key: "x", label: "Panel center X", input: "number" }, { key: "y", label: "Panel center Y", input: "number" }, { key: "width", label: "Panel width", input: "number", min: 1 }, { key: "height", label: "Panel height", input: "number", min: 1 }],
});

registerEntity<GlslEntity>({
  kind: "glsl", ctor: "glsl", colorInCtor: true, fidelity: "semantic", group: "Generative", label: "Raw GLSL", icon: "GL", order: 73,
  hint: "A full-canvas Shadertoy mainImage pass; Canvas exposes source and bindings while Preview runs the GPU pixels", movable: false,
  create(id) { return { ...baseEntity(id, "fg"), nativePaint: true, kind: "glsl", source: "void mainImage(out vec4 color, in vec2 fragCoord) {\n  vec2 uv = fragCoord / iResolution;\n  color = vec4(uv, 0.5 + 0.5*sin(iTime), 1.0);\n}" }; },
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argString(stmt.args, 1); if (!id || source === null || stmt.args.length !== 2) return null; return { ...baseEntity(id, "fg"), nativePaint: true, kind: "glsl", source }; },
  ctorLine: (entity) => `glsl(${entity.id}, ${glslLiteral(entity.source)});`, extraLines: () => [], modifiers: {},
  anchor(_entity, ctx) { const size = ctx?.doc ? docSize(ctx.doc) : { width: 1280, height: 720 }; return { x: size.width / 2, y: size.height / 2 }; }, translate() {},
  bounds(_entity, ctx) { const size = ctx?.doc ? docSize(ctx.doc) : { width: 1280, height: 720 }; return { x: 0, y: 0, width: size.width, height: size.height }; }, handles: () => [], dragHandle() {},
  // Uniforms are soft runtime bindings: expose them through Canvas annotations
  // and rewrite them on rename, but never cascade-delete the shader when a
  // parameter disappears. An unbound uniform remains valid native source.
  references() { return []; },
  replaceReference(entity, from, to, sourceKind) { if (sourceKind && sourceKind !== "parameter") return; entity.source = entity.source.replace(new RegExp(`\\bu_${from.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\b`, "gu"), `u_${to}`); },
  fields: [{ key: "source", label: "GLSL source", input: "textarea", hint: "Write a Shadertoy-style mainImage. iTime, iResolution and iMouse are built in; declared iCam… uniforms and u_<parameter> names bind automatically in Preview." }],
});
