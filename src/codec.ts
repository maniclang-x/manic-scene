// Scene ⇄ Manic source: a generic driver over the entity and verb registries,
// including the build-time COMPUTATION LAYER — `let`, `for`, `if`, `def`
// macros, expressions in arguments, and id interpolation are evaluated exactly
// as the engine's expand pass does, so files that lay themselves out with
// variables project onto the canvas correctly.
//
// Provenance keeps surgical patching sound:
//   · literal statements  → fully editable (patched in place, byte-surgical)
//   · computed statements → shown at their evaluated values, LOCKED (origin
//     "computed"); editing them would bake expressions into literals
//   · expanded statements → loop/macro instances, LOCKED (origin "generated");
//     they have no 1:1 source statement to patch
// Everything the canvas cannot model is skipped and preserved byte-for-byte.

import { argName, argNumber, argString, escapeString, num } from "./args.js";
import { CONSTANTS, ExprError, evalExpr, evalTuple, parseExpr, type Env } from "./expr.js";
import { docSize, emptyDoc } from "./model.js";
import { allEntityDefs, entityDefByCtor, defFor, verbDef } from "./registry.js";
import { formatInterp } from "./expr.js";
import { lexTokens, parseScript, type Arg, type CallStatement, type DefStatement, type Statement } from "./script.js";
import {
  CANVAS_SIZES, MANIC_TEMPLATES,
  type CanvasFormat, type ManicTemplate, type SceneAction, type SceneDoc, type SceneEntity, type SceneStep, type StepMode,
} from "./types.js";

export const SCENE_BEGIN = "// BEGIN WORKBENCH CANVAS";
export const SCENE_END = "// END WORKBENCH CANVAS";

/** Cap on loop/macro-expanded entities per file (sketch stays responsive). */
const GENERATED_CAP = 4000;
const MACRO_DEPTH = 300;
const MAX_ITERS = 100_000;

// --- Serialize ---------------------------------------------------------------

export interface SerializeOptions {
  includeCanvas?: boolean;
  includeTemplate?: boolean;
}

export function serializeScene(doc: SceneDoc, options: SerializeOptions = {}): string {
  const lines: string[] = [SCENE_BEGIN, "// Scene built visually. Every line is ordinary Manic — edit freely."];
  if (options.includeCanvas !== false) {
    const size = docSize(doc);
    lines.push(`canvas(${size.width}, ${size.height});`);
  }
  if (options.includeTemplate !== false) lines.push(`template("${doc.template}");`);
  for (const entity of doc.entities) {
    lines.push("");
    lines.push(...entityLines(entity));
  }
  const names = new Set<string>();
  for (const step of doc.steps) {
    if (step.actions.length === 0) continue;
    lines.push("");
    lines.push(...stepLines(step, names));
  }
  lines.push(SCENE_END);
  return lines.join("\n");
}

/** Full canonical file text for a doc (used by starters replacing a file). */
export function serializeSceneFile(doc: SceneDoc): string {
  const size = docSize(doc);
  const lines: string[] = [`canvas(${size.width}, ${size.height});`, `template("${doc.template}");`];
  for (const entity of doc.entities) {
    lines.push("");
    lines.push(...entityLines(entity));
  }
  const names = new Set<string>();
  for (const step of doc.steps) {
    if (step.actions.length === 0) continue;
    lines.push("");
    lines.push(...stepLines(step, names));
  }
  return `${lines.join("\n")}\n`;
}

function entityLines(entity: SceneEntity): string[] {
  const def = defFor(entity);
  const out = [def.ctorLine(entity), ...def.extraLines(entity)];
  const id = entity.id;
  if (!def.colorInCtor) out.push(`color(${id}, ${entity.color});`);
  if (entity.opacity !== 1) out.push(`opacity(${id}, ${num(entity.opacity)});`);
  if (entity.rotation !== 0) out.push(`rot(${id}, ${num(entity.rotation)});`);
  if (entity.hue) {
    const parts = [num(entity.hue.deg)];
    if (entity.hue.s !== null) parts.push(num(entity.hue.s));
    if (entity.hue.l !== null) parts.push(num(entity.hue.l));
    out.push(`hue(${id}, ${parts.join(", ")});`);
  }
  if (entity.z !== undefined) out.push(`z(${id}, ${num(entity.z)});`);
  if (entity.glow !== undefined) out.push(`glow(${id}, ${num(entity.glow)});`);
  if (entity.sticky) out.push(`sticky(${id});`);
  if (entity.dashed) {
    const parts = [entity.dashed.dash, entity.dashed.gap].filter((part): part is number => part !== null).map(num);
    out.push(`dashed(${id}${parts.length ? `, ${parts.join(", ")}` : ""});`);
  }
  for (const tag of entity.tags ?? []) out.push(`tag(${id}, ${tag});`);
  if (entity.reveal === "fade") out.push(`hidden(${id});`);
  if (entity.reveal === "grow") out.push(`hidden(${id}, center);`);
  if (entity.untraced) out.push(`untraced(${id});`);
  return out;
}

function stepLines(step: SceneStep, usedNames: Set<string>): string[] {
  let name = step.name.trim() || "Step";
  if (usedNames.has(name)) {
    let index = 2;
    while (usedNames.has(`${name} ${index}`)) index += 1;
    name = `${name} ${index}`;
  }
  usedNames.add(name);
  const actions = step.actions.map((action) => actionLine(action));
  if (step.mode === "together") {
    return [`step("${escapeString(name)}") {`, ...actions.map((line) => `  ${line}`), "}"];
  }
  const wrapper = step.mode === "sequence" ? "seq {" : `stagger(${num(step.gap)}) {`;
  return [
    `step("${escapeString(name)}") {`,
    `  ${wrapper}`,
    ...actions.map((line) => `    ${line}`),
    "  }",
    "}",
  ];
}

function actionLine(action: SceneAction): string {
  const def = verbDef(action.verb);
  if (!def) throw new Error(`Unknown verb "${action.verb}"`);
  return def.serialize(action);
}

// --- Source splicing -----------------------------------------------------------

export interface SceneBlock { text: string; start: number; end: number; }

export function extractSceneBlock(source: string): SceneBlock | null {
  const start = source.indexOf(SCENE_BEGIN);
  if (start === -1) return null;
  const endMarker = source.indexOf(SCENE_END, start);
  if (endMarker === -1) return null;
  const end = endMarker + SCENE_END.length;
  return { text: source.slice(start, end), start, end };
}

/** Replace (or append) the scene block, leaving every other line untouched. */
export function applySceneToSource(source: string, doc: SceneDoc): string {
  const block = extractSceneBlock(source);
  const outside = block ? source.slice(0, block.start) + source.slice(block.end) : source;
  const options: SerializeOptions = {
    includeCanvas: !/(^|\n)\s*canvas\s*\(/u.test(outside),
    includeTemplate: !/(^|\n)\s*template\s*\(/u.test(outside),
  };
  const text = serializeScene(doc, options);
  if (block) return source.slice(0, block.start) + text + source.slice(block.end);
  const head = source.trimEnd();
  return head ? `${head}\n\n${text}\n` : `${text}\n`;
}

// --- Read: types -----------------------------------------------------------

export type SceneRead =
  | { status: "none" }
  | { status: "ok"; doc: SceneDoc; warnings: string[] }
  | { status: "unsupported"; reasons: string[] };

export interface Span { start: number; end: number; }
/** How the step was written: a named step block, an anonymous par/seq/stagger, or a bare verb. */
export type StepForm = "step" | "anon" | "bare";

export interface AnchorExpr {
  xSrc: string | null;
  ySrc: string | null;
  xOld: number;
  yOld: number;
}

export interface SceneMeta {
  /** Statements belonging to each patchable entity (literal AND computed), in file order. */
  entitySpans: Map<string, Span[]>;
  /** Computed entities: the anchor point's original expressions, for delta-preserving writes. */
  anchors: Map<string, AnchorExpr>;
  /** One per doc.steps entry; `locked` steps (computed/generated) are never patched. */
  steps: { span: Span; form: StepForm; locked: boolean }[];
  canvasSpan: Span | null;
  templateSpan: Span | null;
  titleSpan: Span | null;
}

export interface SourceScene {
  doc: SceneDoc;
  /** Human-readable notes for statements the canvas cannot model (preserved as-is). */
  skipped: string[];
  meta: SceneMeta;
}

/** Read the scene out of a fenced block (strict; legacy block API). */
export function readScene(source: string): SceneRead {
  const block = extractSceneBlock(source);
  if (!block) return { status: "none" };
  const outside = source.slice(0, block.start) + source.slice(block.end);
  const read = parseSceneBlock(block.text);
  if (read.status !== "ok") return read;
  const setup = readSetup(outside);
  if (setup.format && !blockDeclares(block.text, "canvas")) read.doc.format = setup.format;
  if (setup.template && !blockDeclares(block.text, "template")) read.doc.template = setup.template;
  return read;
}

function blockDeclares(blockText: string, name: string): boolean {
  return new RegExp(`(^|\\n)\\s*${name}\\s*\\(`, "u").test(blockText);
}

function readSetup(source: string): { format: CanvasFormat | null; template: ManicTemplate | null } {
  const { statements } = parseScript(source);
  let format: CanvasFormat | null = null;
  let template: ManicTemplate | null = null;
  for (const statement of statements) {
    if (statement.kind !== "call") continue;
    if (statement.name === "canvas") format = parseCanvasArgs(statement.args) ?? format;
    if (statement.name === "template") template = parseTemplateArg(statement.args) ?? template;
  }
  return { format, template };
}

export function parseSceneBlock(blockText: string): SceneRead {
  const inner = blockText.replace(SCENE_BEGIN, "").replace(SCENE_END, "");
  const { doc, reasons, warnings, targets } = parseStatements(inner);
  for (const step of doc.steps) {
    for (const action of step.actions) {
      if (action.target && !targets.has(action.target)) {
        reasons.push(`\`${action.verb}\` targets unknown entity \`${action.target}\`.`);
      }
    }
  }
  if (reasons.length > 0) return { status: "unsupported", reasons };
  return { status: "ok", doc, warnings };
}

/** Project a whole .manic file onto the canvas document. */
export function readSceneSource(source: string): SourceScene {
  const { doc, reasons, targets, meta } = parseStatements(source, true);
  let unknownTargets = 0;
  const targetKnown = (target: string): boolean => {
    if (targets.has(target)) return true;
    const dot = target.indexOf(".");
    return dot > 0 && targets.has(target.slice(0, dot)); // children like cap.w0 / eq.label
  };
  for (const step of doc.steps) {
    for (const action of step.actions) {
      if (action.target && !targetKnown(action.target)) unknownTargets += 1;
    }
  }
  const notes = aggregateNotes(reasons);
  if (unknownTargets > 0) {
    notes.push(`${unknownTargets} beat${unknownTargets === 1 ? "" : "s"} target things the canvas doesn't model (kit parts, unsupported entities) — kept as written.`);
  }
  return { doc, skipped: notes, meta };
}

/** Collapse repeated `name`-is-not-supported notes into counted lines. */
function aggregateNotes(reasons: string[]): string[] {
  const counts = new Map<string, number>();
  const rest: string[] = [];
  const pattern = /^`([A-Za-z0-9_]+)` is not yet supported by the canvas/u;
  for (const note of reasons) {
    const match = pattern.exec(note);
    if (match) counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
    else if (!rest.includes(note)) rest.push(note);
  }
  const grouped = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `\`${name}\` isn't canvas vocabulary yet${count > 1 ? ` (×${count})` : ""} — kept as written.`);
  return [...grouped, ...rest];
}

// --- Read: the evaluation driver ---------------------------------------------

/** Shared modifiers every entity supports; kind-specific ones live on entity defs. */
const SHARED_MODIFIERS = new Set(["color", "opacity", "rot", "hidden", "untraced", "hue", "tag", "z", "glow", "sticky", "dashed"]);
const STEP_BLOCKS = new Set(["step", "par", "seq", "stagger"]);

interface Sink {
  doc: SceneDoc;
  reasons: string[];
  warnings: string[];
  meta: SceneMeta;
  entityById: Map<string, SceneEntity>;
  /** Entity ids + tags — valid verb targets. */
  targets: Set<string>;
  lenient: boolean;
  autoStep: number;
  generatedCount: number;
  macros: Map<string, DefStatement>;
}

interface Ctx {
  env: Env;
  /** Inside a for-loop or macro expansion: statements have no 1:1 source. */
  generated: boolean;
  depth: number;
  /** The loop/macro statement that generates this content (for jump-to-source). */
  originSpan?: Span;
}

interface ParsedStatements {
  doc: SceneDoc;
  reasons: string[];
  warnings: string[];
  targets: Set<string>;
  meta: SceneMeta;
}

function parseStatements(inner: string, lenient = false): ParsedStatements {
  const { statements, unsupported } = parseScript(inner);
  const sink: Sink = {
    doc: emptyDoc(),
    reasons: unsupported.map((raw) => `Statement not yet supported by the canvas: ${clip(raw)}`),
    warnings: [],
    meta: { entitySpans: new Map(), anchors: new Map(), steps: [], canvasSpan: null, templateSpan: null, titleSpan: null },
    entityById: new Map(),
    targets: new Set(),
    lenient,
    autoStep: 0,
    generatedCount: 0,
    macros: new Map(),
  };

  // The engine applies canvas before the computation layer: prescan it, and
  // keep the file's EXACT dimensions (cx/w/… must match the engine's numbers).
  for (const statement of statements) {
    if (statement.kind === "call" && statement.name === "canvas") {
      const format = parseCanvasArgs(statement.args);
      if (format) sink.doc.format = format;
      const exact = parseCanvasSize(statement.args);
      if (exact) {
        const bucket = CANVAS_SIZES[sink.doc.format];
        if (exact.width !== bucket.width || exact.height !== bucket.height) sink.doc.size = exact;
      }
    }
  }
  const size = docSize(sink.doc);
  const env: Env = new Map(Object.entries(CONSTANTS));
  env.set("w", size.width);
  env.set("h", size.height);
  env.set("cx", size.width / 2);
  env.set("cy", size.height / 2);

  processStatements(statements, { env, generated: false, depth: 0 }, sink);
  return { doc: sink.doc, reasons: sink.reasons, warnings: sink.warnings, targets: sink.targets, meta: sink.meta };
}

function processStatements(statements: Statement[], ctx: Ctx, sink: Sink): void {
  for (const statement of statements) {
    switch (statement.kind) {
      case "let": {
        try {
          ctx.env.set(statement.name, evalExpr(statement.expr, ctx.env));
        } catch (error) {
          sink.reasons.push(`\`let ${statement.name}\` could not be evaluated (${message(error)}) — kept as written.`);
        }
        break;
      }
      case "def":
        sink.macros.set(statement.name, statement);
        break;
      case "if": {
        try {
          let taken = false;
          for (const branch of statement.branches) {
            if (evalExpr(branch.cond, ctx.env) !== 0) {
              processStatements(branch.body, { ...ctx, env: new Map(ctx.env) }, sink);
              taken = true;
              break;
            }
          }
          if (!taken && statement.elseBody) {
            processStatements(statement.elseBody, { ...ctx, env: new Map(ctx.env) }, sink);
          }
        } catch (error) {
          sink.reasons.push(`\`if\` condition could not be evaluated (${message(error)}) — kept as written.`);
        }
        break;
      }
      case "for": {
        try {
          const from = Math.trunc(evalExpr(statement.from, ctx.env));
          const to = Math.trunc(evalExpr(statement.to, ctx.env));
          if (to - from > MAX_ITERS) throw new ExprError("range too large");
          for (let index = from; index < to; index += 1) {
            if (sink.generatedCount > GENERATED_CAP) {
              sink.reasons.push(`Loop over \`${statement.variable}\` is too large to sketch (over ${GENERATED_CAP} generated entities) — kept as written.`);
              break;
            }
            const child = new Map(ctx.env);
            child.set(statement.variable, index);
            processStatements(statement.body, { env: child, generated: true, depth: ctx.depth, originSpan: ctx.originSpan ?? span(statement) }, sink);
          }
        } catch (error) {
          sink.reasons.push(`\`for ${statement.variable}\` could not be expanded (${message(error)}) — kept as written.`);
        }
        break;
      }
      case "call":
        processCall(statement, ctx, sink);
        break;
    }
  }
}

function processCall(statement: CallStatement, ctx: Ctx, sink: Sink): void {
  const name = statement.name;
  if (sink.lenient && (name === "title" || name === "masthead")) {
    sink.meta.titleSpan ??= span(statement);
    return;
  }
  if (name === "canvas") {
    if (!parseCanvasArgs(statement.args)) sink.warnings.push(`Unrecognized canvas size kept as ${sink.doc.format}.`);
    sink.meta.canvasSpan = span(statement);
    return;
  }
  if (name === "template") {
    const template = parseTemplateArg(statement.args);
    if (template) sink.doc.template = template;
    else sink.warnings.push("Unrecognized template kept as black.");
    sink.meta.templateSpan = span(statement);
    return;
  }

  // Macro call → expand its body with parameters bound.
  const macro = sink.macros.get(name);
  if (macro && !statement.block) {
    if (ctx.depth >= MACRO_DEPTH) {
      sink.reasons.push(`Macro \`${name}\` recursed too deep — kept as written.`);
      return;
    }
    const resolved = resolveArgs(statement.args, ctx.env, sink);
    if (!resolved) {
      sink.reasons.push(`Macro \`${name}\` arguments could not be evaluated: ${clip(statement.raw)}`);
      return;
    }
    const child: Env = new Map(ctx.env);
    for (let index = 0; index < macro.params.length; index += 1) {
      const arg = resolved.args[index];
      child.set(macro.params[index], arg && arg.type === "number" ? arg.value : 0);
    }
    processStatements(macro.body, { env: child, generated: true, depth: ctx.depth + 1, originSpan: ctx.originSpan ?? span(statement) }, sink);
    return;
  }

  const resolved = resolveArgs(statement.args, ctx.env, sink);
  if (!resolved) {
    // 3D points / unresolvable args: report by NAME when the builtin itself is
    // outside the canvas vocabulary (the usual case for the 3D kits).
    const known = entityDefByCtor(name) || verbDef(name) || isModifierName(name) || STEP_BLOCKS.has(name);
    sink.reasons.push(known
      ? `Arguments could not be evaluated: ${clip(statement.raw)}`
      : `\`${name}\` is not yet supported by the canvas: ${clip(statement.raw)}`);
    return;
  }
  const literalStatement: CallStatement = { ...statement, args: resolved.args };
  const computed = resolved.computed;

  const ctorDef = entityDefByCtor(name);
  if (ctorDef && !statement.block) {
    const entity = ctorDef.parseArgs(literalStatement);
    if (!entity) {
      sink.reasons.push(`Arguments not yet supported by the canvas: ${clip(statement.raw)}`);
      return;
    }
    if (sink.entityById.has(entity.id)) {
      sink.reasons.push(`Duplicate entity id \`${entity.id}\` — the second declaration is kept as written.`);
      return;
    }
    if (ctx.generated) {
      entity.origin = "generated";
      const idArg = statement.args[0];
      entity.genKey = idArg && idArg.type === "name" ? idArg.value : entity.id;
      entity.src = ctx.originSpan ?? span(statement);
      sink.generatedCount += 1;
    } else {
      sink.meta.entitySpans.set(entity.id, [span(statement)]);
      if (computed) {
        entity.origin = "computed";
        entity.src = span(statement);
        const anchor = captureAnchor(ctorDef.anchorArgIndex, statement, literalStatement);
        if (anchor) sink.meta.anchors.set(entity.id, anchor);
      }
    }
    sink.entityById.set(entity.id, entity);
    sink.targets.add(entity.id);
    sink.doc.entities.push(entity);
    return;
  }

  if (isModifierName(name)) {
    applyModifier(literalStatement, computed && !ctx.generated, ctx.generated, statement, sink);
    return;
  }

  if (STEP_BLOCKS.has(name) && statement.block) {
    const isStep = name === "step";
    const stepName = isStep ? (argString(statement.args, 0) ?? "Step") : `Step ${(sink.autoStep += 1)}`;
    const blockKind = isStep ? "par" : name;
    const gapArgs = isStep ? [] : statement.args;
    const step = buildStep(stepName, blockKind, gapArgs, statement.block, ctx, sink);
    if (!step) return;
    if (ctx.generated) step.step.origin = "generated";
    else if (step.computed) step.step.origin = "computed";
    sink.doc.steps.push(step.step);
    sink.meta.steps.push({
      span: ctx.generated ? { start: 0, end: 0 } : span(statement),
      form: isStep ? "step" : "anon",
      locked: ctx.generated || step.computed,
    });
    return;
  }

  const verb = verbDef(name);
  if (verb && !statement.block) {
    const action = verb.parse(literalStatement);
    if (!action) {
      sink.reasons.push(`\`${name}\` arguments are not yet supported by the canvas: ${clip(statement.raw)}`);
      return;
    }
    sink.autoStep += 1;
    const step: SceneStep = { name: `Beat ${sink.autoStep}`, mode: "together", gap: 0.15, actions: [action] };
    if (ctx.generated) step.origin = "generated";
    else if (computed) step.origin = "computed";
    sink.doc.steps.push(step);
    sink.meta.steps.push({
      span: ctx.generated ? { start: 0, end: 0 } : span(statement),
      form: "bare",
      locked: ctx.generated || computed,
    });
    return;
  }

  sink.reasons.push(`\`${name}\` is not yet supported by the canvas: ${clip(statement.raw)}`);
}

interface BuiltStep { step: SceneStep; computed: boolean; }

function buildStep(name: string, blockKind: string, blockArgs: Arg[], children: Statement[], ctx: Ctx, sink: Sink): BuiltStep | null {
  // A step whose single child is a seq/stagger wrapper carries the mode.
  if (blockKind === "par" && children.length === 1) {
    const only = children[0];
    if (only.kind === "call" && (only.name === "seq" || only.name === "stagger") && only.block) {
      return buildStep(name, only.name, only.args, only.block, ctx, sink);
    }
  }
  let mode: StepMode = "together";
  let gap = 0.15;
  let computed = false;
  if (blockKind === "seq") mode = "sequence";
  if (blockKind === "stagger") {
    mode = "stagger";
    const resolved = resolveArgs(blockArgs, ctx.env, sink);
    const gapValue = resolved ? argNumber(resolved.args, 0) : null;
    if (gapValue !== null) gap = gapValue;
    computed ||= resolved?.computed ?? false;
  }
  const flat = flattenActions(children, ctx, sink);
  computed ||= flat.computed;
  return { step: { name, mode, gap, actions: flat.actions }, computed };
}

/** Flatten a timeline block's children into actions, expanding for/if/macros. */
function flattenActions(statements: Statement[], ctx: Ctx, sink: Sink): { actions: SceneAction[]; computed: boolean } {
  const actions: SceneAction[] = [];
  let computed = false;
  const walk = (list: Statement[], env: Env, generated: boolean, depth: number): void => {
    for (const child of list) {
      if (child.kind === "let") {
        try { env.set(child.name, evalExpr(child.expr, env)); }
        catch (error) { sink.reasons.push(`\`let ${child.name}\` could not be evaluated (${message(error)}) — kept as written.`); }
        continue;
      }
      if (child.kind === "for") {
        try {
          const from = Math.trunc(evalExpr(child.from, env));
          const to = Math.trunc(evalExpr(child.to, env));
          if (to - from > MAX_ITERS) throw new ExprError("range too large");
          for (let index = from; index < to; index += 1) {
            const childEnv = new Map(env);
            childEnv.set(child.variable, index);
            walk(child.body, childEnv, true, depth);
          }
          computed = true;
        } catch (error) {
          sink.reasons.push(`\`for ${child.variable}\` could not be expanded (${message(error)}) — kept as written.`);
        }
        continue;
      }
      if (child.kind === "if") {
        try {
          let taken = false;
          for (const branch of child.branches) {
            if (evalExpr(branch.cond, env) !== 0) { walk(branch.body, new Map(env), generated, depth); taken = true; break; }
          }
          if (!taken && child.elseBody) walk(child.elseBody, new Map(env), generated, depth);
          computed = true;
        } catch (error) {
          sink.reasons.push(`\`if\` condition could not be evaluated (${message(error)}) — kept as written.`);
        }
        continue;
      }
      if (child.kind === "def") {
        sink.macros.set(child.name, child);
        continue;
      }
      const macro = sink.macros.get(child.name);
      if (macro && !child.block) {
        if (depth >= MACRO_DEPTH) { sink.reasons.push(`Macro \`${child.name}\` recursed too deep — kept as written.`); continue; }
        const resolved = resolveArgs(child.args, env, sink);
        if (!resolved) { sink.reasons.push(`Macro \`${child.name}\` arguments could not be evaluated: ${clip(child.raw)}`); continue; }
        const macroEnv: Env = new Map(env);
        for (let index = 0; index < macro.params.length; index += 1) {
          const arg = resolved.args[index];
          macroEnv.set(macro.params[index], arg && arg.type === "number" ? arg.value : 0);
        }
        walk(macro.body, macroEnv, true, depth + 1);
        computed = true;
        continue;
      }
      if (child.block) {
        if (child.name === "par" || child.name === "seq" || child.name === "stagger" || child.name === "step") {
          // Nested timing blocks: flatten their beats for display; the exact
          // nested timing can't live in the flat step model, so the step locks.
          walk(child.block, new Map(env), generated, depth);
          computed = true;
          continue;
        }
        sink.reasons.push(`Nested \`${child.name}\` blocks are not yet supported by the canvas: ${clip(child.raw)}`);
        continue;
      }
      const resolved = resolveArgs(child.args, env, sink);
      if (!resolved) { sink.reasons.push(`Arguments could not be evaluated: ${clip(child.raw)}`); continue; }
      computed ||= resolved.computed || generated;
      const verb = verbDef(child.name);
      const action = verb && verb.parse({ ...child, args: resolved.args });
      if (action) actions.push(action);
      else sink.reasons.push(`\`${child.name}\` is not yet supported by the canvas: ${clip(child.raw)}`);
    }
  };
  walk(statements, new Map(ctx.env), ctx.generated, ctx.depth);
  return { actions, computed };
}

/** Resolve expression arguments to literals; null when evaluation fails. */
function resolveArgs(args: Arg[], env: Env, sink: Sink): { args: Arg[]; computed: boolean } | null {
  let computed = false;
  const out: Arg[] = [];
  for (const arg of args) {
    if (arg.type === "expr") {
      try {
        const values = evalTuple(arg.node, env).map((value) => roundish(value));
        if (values.length === 1) out.push({ type: "number", value: values[0] });
        else if (values.length === 2) out.push({ type: "point", x: values[0], y: values[1] });
        else return null; // 3D points aren't canvas vocabulary yet
        computed = true;
      } catch {
        return null;
      }
    } else if (arg.type === "name") {
      if (arg.value.includes("{")) {
        try {
          out.push({ type: "name", value: interpolateName(arg.value, env) });
          computed = true;
        } catch {
          return null;
        }
      } else if (env.has(arg.value)) {
        out.push({ type: "number", value: roundish(env.get(arg.value)!) });
        computed = true;
      } else {
        out.push(arg);
      }
    } else {
      out.push(arg);
    }
  }
  void sink;
  return { args: out, computed };
}

function interpolateName(raw: string, env: Env): string {
  let out = "";
  let index = 0;
  while (index < raw.length) {
    if (raw[index] === "{") {
      let depth = 0;
      let scan = index;
      while (scan < raw.length) {
        if (raw[scan] === "{") depth += 1;
        if (raw[scan] === "}") { depth -= 1; if (depth === 0) break; }
        scan += 1;
      }
      const inner = raw.slice(index + 1, scan);
      out += formatInterp(evalExpr(parseExpr(lexTokens(inner)), env));
      index = scan + 1;
    } else {
      out += raw[index];
      index += 1;
    }
  }
  return out;
}

function roundish(value: number): number {
  return Math.abs(value - Math.round(value)) < 1e-9 ? Math.round(value) : Math.round(value * 100) / 100;
}

/** The anchor point's per-component source text, when the ctor used expressions. */
function captureAnchor(anchorIndex: number | undefined, original: CallStatement, literal: CallStatement): AnchorExpr | null {
  if (anchorIndex === undefined) return null;
  const raw = original.args[anchorIndex];
  const resolved = literal.args[anchorIndex];
  if (!raw || raw.type !== "expr" || !resolved || resolved.type !== "point") return null;
  const inner = raw.src.trim().replace(/^\(/u, "").replace(/\)$/u, "");
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index <= inner.length; index += 1) {
    const char = inner[index];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (index === inner.length || (char === "," && depth === 0)) {
      parts.push(inner.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (parts.length !== 2) return null;
  const literalPart = (text: string) => /^-?\d+(\.\d+)?$/u.test(text);
  return {
    xSrc: literalPart(parts[0]) ? null : parts[0],
    ySrc: literalPart(parts[1]) ? null : parts[1],
    xOld: resolved.x,
    yOld: resolved.y,
  };
}

/** `cx - 140`-style component: keep the expression, append the user's delta. */
function anchorComponent(src: string | null, oldValue: number, newValue: number): string {
  if (src === null) return num(newValue);
  const delta = newValue - oldValue;
  if (Math.abs(delta) < 0.005) return src;
  return `${src} ${delta > 0 ? "+" : "-"} ${num(Math.abs(delta))}`;
}

function span(statement: Statement): Span {
  return { start: statement.start, end: statement.end };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isModifierName(name: string): boolean {
  if (SHARED_MODIFIERS.has(name)) return true;
  return allEntityDefs().some((def) => Object.hasOwn(def.modifiers, name));
}

function applyModifier(statement: CallStatement, computed: boolean, generated: boolean, original: CallStatement, sink: Sink): void {
  const id = argName(statement.args, 0);
  const entity = id ? sink.entityById.get(id) : undefined;
  if (!entity) {
    sink.warnings.push(`Modifier on unknown entity ignored: ${clip(original.raw)}`);
    return;
  }
  const name = statement.name;
  let applied = false;
  if (SHARED_MODIFIERS.has(name)) {
    applied = applySharedModifier(name, entity, statement, sink);
  } else {
    const def = defFor(entity);
    const handler = def.modifiers[name];
    if (!handler) {
      sink.reasons.push(`\`${name}\` does not apply to a ${entity.kind} on the canvas yet: ${clip(original.raw)}`);
      return;
    }
    applied = handler(entity, statement);
  }
  if (!applied) {
    sink.reasons.push(`\`${name}\` arguments are not yet supported by the canvas: ${clip(original.raw)}`);
    return;
  }
  if (generated || entity.origin === "generated") return; // expansion content is locked
  if (computed && !entity.origin) {
    // A variable-driven modifier marks the entity (badge), but stays editable:
    // regenerating writes evaluated literals for this modifier.
    entity.origin = "computed";
    entity.src = sink.meta.entitySpans.get(entity.id)?.[0] ?? span(statement);
  }
  sink.meta.entitySpans.get(entity.id)?.push(span(statement));
}

function applySharedModifier(name: string, entity: SceneEntity, statement: CallStatement, sink: Sink): boolean {
  switch (name) {
    case "color": {
      const color = argName(statement.args, 1);
      if (!color) return false;
      entity.color = color;
      return true;
    }
    case "opacity": {
      const value = argNumber(statement.args, 1);
      if (value === null) return false;
      entity.opacity = value;
      return true;
    }
    case "rot": {
      const deg = argNumber(statement.args, 1);
      if (deg === null) return false;
      entity.rotation = deg;
      return true;
    }
    case "hue": {
      const deg = argNumber(statement.args, 1);
      if (deg === null) return false;
      entity.hue = { deg, s: argNumber(statement.args, 2), l: argNumber(statement.args, 3) };
      return true;
    }
    case "z": {
      const value = argNumber(statement.args, 1);
      if (value === null) return false;
      entity.z = value;
      return true;
    }
    case "glow": {
      const value = argNumber(statement.args, 1);
      if (value === null) return false;
      entity.glow = value;
      return true;
    }
    case "sticky":
      entity.sticky = true;
      return true;
    case "dashed":
      entity.dashed = { dash: argNumber(statement.args, 1), gap: argNumber(statement.args, 2) };
      return true;
    case "tag": {
      const tag = argName(statement.args, 1);
      if (!tag) return false;
      entity.tags = [...(entity.tags ?? []), tag];
      sink.targets.add(tag);
      return true;
    }
    case "hidden": {
      const from = argName(statement.args, 1);
      if (from && from !== "center") {
        sink.reasons.push(`hidden(${entity.id}, ${from}) reveal style is not yet supported by the canvas.`);
      }
      entity.reveal = from === "center" ? "grow" : "fade";
      return true;
    }
    case "untraced":
      entity.untraced = true;
      return true;
    default:
      return false;
  }
}

// --- Surgical write-back -----------------------------------------------------

interface SourceEdit { start: number; end: number; text: string; }

/**
 * Write `next` back into `source` by replacing only the statements that
 * changed since `previous` was read. Comments, blank lines, computation-layer
 * code, locked (computed/generated) content, and unsupported vocabulary stay
 * byte-for-byte intact.
 */
export function patchSceneSource(source: string, previous: SourceScene, next: SceneDoc): string {
  const { doc: prevDoc, meta } = previous;
  const edits: SourceEdit[] = [];
  const appends: string[] = [];

  // canvas(...) / template(...)
  const setupInserts: string[] = [];
  const prevSize = docSize(prevDoc);
  const nextSize = docSize(next);
  if (prevSize.width !== nextSize.width || prevSize.height !== nextSize.height) {
    const text = `canvas(${nextSize.width}, ${nextSize.height});`;
    if (meta.canvasSpan) edits.push({ ...meta.canvasSpan, text });
    else setupInserts.push(text);
  }
  if (next.template !== prevDoc.template) {
    const text = `template("${next.template}");`;
    if (meta.templateSpan) edits.push({ ...meta.templateSpan, text });
    else setupInserts.push(text);
  }
  if (setupInserts.length > 0) {
    const at = meta.titleSpan?.end ?? meta.canvasSpan?.end ?? 0;
    const block = setupInserts.join("\n");
    edits.push({ start: at, end: at, text: at === 0 ? `${block}\n` : `\n${block}` });
  }

  // Entities: literal AND computed ones are patchable (computed positions keep
  // their expressions via delta-append); only generated instances are locked.
  const prevEntities = prevDoc.entities.filter((entity) => entity.origin !== "generated");
  const nextEntities = next.entities.filter((entity) => entity.origin !== "generated");
  const prevIds = new Set(prevEntities.map((entity) => entity.id));
  const nextIds = new Set(nextEntities.map((entity) => entity.id));
  const renames = new Map<string, string>();
  prevEntities.forEach((old, index) => {
    if (nextIds.has(old.id)) return;
    const candidate = nextEntities[index];
    if (candidate && candidate.kind === old.kind && !prevIds.has(candidate.id)) renames.set(old.id, candidate.id);
  });
  const nextById = new Map(nextEntities.map((entity) => [entity.id, entity]));

  for (const old of prevEntities) {
    const newId = nextIds.has(old.id) ? old.id : renames.get(old.id);
    const spans = meta.entitySpans.get(old.id) ?? [];
    if (!newId) {
      for (const one of spans) edits.push(deletion(source, one));
      continue;
    }
    const nextEntity = nextById.get(newId)!;
    if (JSON.stringify(nextEntity) === JSON.stringify(old)) continue;
    const lines = entityLines(nextEntity);
    const anchor = meta.anchors.get(old.id);
    if (anchor) lines[0] = preserveAnchor(lines[0], nextEntity, anchor);
    const text = lines.join("\n");
    if (spans.length > 0) {
      edits.push({ ...spans[0], text });
      for (const one of spans.slice(1)) edits.push(deletion(source, one));
    } else {
      appends.push(text);
    }
  }
  const renameTargets = new Set(renames.values());
  for (const entity of nextEntities) {
    if (!prevIds.has(entity.id) && !renameTargets.has(entity.id)) appends.push(entityLines(entity).join("\n"));
  }

  // Steps: patch per index over the PATCHABLE sublists (locked steps are
  // identical in prev/next — the UI cannot edit them).
  const prevSteps: { step: SceneStep; span: Span; form: StepForm }[] = [];
  prevDoc.steps.forEach((step, index) => {
    const entry = meta.steps[index];
    if (entry && !entry.locked) prevSteps.push({ step, span: entry.span, form: entry.form });
  });
  const nextSteps = next.steps.filter((step) => !step.origin);
  const common = Math.min(prevSteps.length, nextSteps.length);
  for (let index = 0; index < common; index += 1) {
    if (JSON.stringify(prevSteps[index].step) === JSON.stringify(nextSteps[index])) continue;
    if (nextSteps[index].actions.length === 0) edits.push(deletion(source, prevSteps[index].span));
    else edits.push({ ...prevSteps[index].span, text: stepSourceText(nextSteps[index], prevSteps[index].form) });
  }
  for (let index = nextSteps.length; index < prevSteps.length; index += 1) {
    edits.push(deletion(source, prevSteps[index].span));
  }
  for (let index = prevSteps.length; index < nextSteps.length; index += 1) {
    if (nextSteps[index].actions.length > 0) appends.push(stepSourceText(nextSteps[index], "step"));
  }

  let result = applyEdits(source, edits);
  if (appends.length > 0) result = `${result.trimEnd()}\n\n${appends.join("\n\n")}\n`;
  return result;
}

/** Swap the regenerated ctor's literal anchor point for the original
 * expressions, appending only the user's delta: `(cx, 190)` → `(cx - 140, 210)`. */
function preserveAnchor(ctorLine: string, entity: SceneEntity, anchor: AnchorExpr): string {
  const at = entity as unknown as { x?: number; y?: number };
  if (typeof at.x !== "number" || typeof at.y !== "number") return ctorLine;
  const literal = `(${num(at.x)}, ${num(at.y)})`;
  const preserved = `(${anchorComponent(anchor.xSrc, anchor.xOld, at.x)}, ${anchorComponent(anchor.ySrc, anchor.yOld, at.y)})`;
  const index = ctorLine.indexOf(literal);
  if (index === -1) return ctorLine;
  return ctorLine.slice(0, index) + preserved + ctorLine.slice(index + literal.length);
}

function stepSourceText(step: SceneStep, form: StepForm): string {
  const syntheticName = /^(Beat|Step) \d+$/u.test(step.name);
  if (form === "bare" && step.actions.length === 1 && step.mode === "together" && syntheticName) {
    return actionLine(step.actions[0]);
  }
  if (form !== "step" && syntheticName) {
    // Keep hand-written anonymous blocks anonymous.
    const wrapper = step.mode === "together" ? "par {" : step.mode === "sequence" ? "seq {" : `stagger(${num(step.gap)}) {`;
    return [wrapper, ...step.actions.map((action) => `  ${actionLine(action)}`), "}"].join("\n");
  }
  return stepLines(step, new Set()).join("\n");
}

/** Delete a statement plus the line it leaves empty. */
function deletion(source: string, target: Span): SourceEdit {
  let { start, end } = target;
  while (end < source.length && (source[end] === " " || source[end] === "\t")) end += 1;
  const lineStart = source.lastIndexOf("\n", start - 1) + 1;
  if (/^[ \t]*$/u.test(source.slice(lineStart, start)) && source[end] === "\n") {
    start = lineStart;
    end += 1;
  }
  return { start, end, text: "" };
}

function applyEdits(source: string, edits: SourceEdit[]): string {
  const ordered = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
  let result = source;
  let lastStart = source.length + 1;
  for (const edit of ordered) {
    const end = Math.min(edit.end, lastStart);
    if (edit.start > end) continue;
    result = result.slice(0, edit.start) + edit.text + result.slice(end);
    lastStart = edit.start;
  }
  return result;
}

// --- canvas/template args ------------------------------------------------------

function parseCanvasArgs(args: Arg[]): CanvasFormat | null {
  const preset = argString(args, 0) ?? argName(args, 0);
  if (preset) {
    if (preset === "16:9" || preset === "landscape" || preset === "1080p" || preset === "4k" || preset === "4:3") return "16:9";
    if (preset === "square" || preset === "1:1") return "square";
    if (preset === "portrait" || preset === "9:16" || preset === "4:5") return "portrait";
    return null;
  }
  const width = argNumber(args, 0);
  const height = argNumber(args, 1);
  if (width === null || height === null) return null;
  for (const [format, size] of Object.entries(CANVAS_SIZES) as [CanvasFormat, { width: number; height: number }][]) {
    if (size.width === width && size.height === height) return format;
  }
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.05) return "square";
  return ratio > 1 ? "16:9" : "portrait";
}

/** The file's exact canvas dimensions, when determinable. */
function parseCanvasSize(args: Arg[]): { width: number; height: number } | null {
  const width = argNumber(args, 0);
  const height = argNumber(args, 1);
  if (width !== null && height !== null) return { width, height };
  const preset = argString(args, 0) ?? argName(args, 0);
  if (preset === "1080p") return { width: 1920, height: 1080 };
  if (preset === "4k") return { width: 3840, height: 2160 };
  if (preset === "4:3") return { width: 1280, height: 960 };
  if (preset === "4:5") return { width: 864, height: 1080 };
  return null; // canonical bucket size applies
}

function parseTemplateArg(args: Arg[]): ManicTemplate | null {
  const raw = argString(args, 0) ?? argName(args, 0);
  if (!raw) return null;
  const aliases: Record<string, ManicTemplate> = {
    monochrome: "mono", blackwhite: "mono", "black-white": "mono", bw: "mono",
    blank: "plain", clean: "plain",
  };
  const canonical = aliases[raw] ?? raw;
  return (MANIC_TEMPLATES as readonly string[]).includes(canonical) ? canonical as ManicTemplate : null;
}

function clip(raw: string): string {
  const flat = raw.replaceAll(/\s+/gu, " ").trim();
  return flat.length > 72 ? `${flat.slice(0, 69)}…` : flat;
}
