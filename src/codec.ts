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

import { argName, argNumber, argPoint, argPoint3, argString, escapeString, num, pt, pt3 } from "./args.js";
import { CATALOG } from "./catalog.js";
import { CONSTANTS, ExprError, evalExpr, evalTuple, parseExpr, type Env } from "./expr.js";
import { docSize, emptyDoc, entityReferences, referenceIds, stepActions } from "./model.js";
import { allEntityDefs, entityDefByCtor, defFor, isAuthorOnly, verbDef } from "./registry.js";
import { finish3SpecText, parseFinish3Spec, threePointReferences } from "./entities/three.js";
import { formatInterp } from "./expr.js";
import { lexTokens, parseScript, type Arg, type CallStatement, type DefStatement, type IfStatement, type Statement } from "./script.js";
import {
  CANVAS_SIZES, MANIC_TEMPLATES,
  type CanvasFormat, type ManicTemplate, type SceneAction, type SceneDoc, type SceneEntity, type SceneStep, type StepMode, type TimedItem, type TimedSegment, type TimingEntity, type VoiceConfig, type VoiceService, type VoiceTone,
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
  if (doc.title?.trim()) lines.push(`title("${escapeString(doc.title.trim())}");`);
  if (options.includeCanvas !== false) {
    const size = docSize(doc);
    lines.push(`canvas(${size.width}, ${size.height});`);
  }
  if (options.includeTemplate !== false) lines.push(`template("${doc.template}");`);
  if (doc.voice) lines.push(voiceLine(doc.voice));
  for (const entity of doc.entities) {
    lines.push("");
    lines.push(...entityLines(entity));
  }
  for (const entity of doc.entities) {
    const relations = relationLines(entity);
    if (relations.length > 0) { lines.push(""); lines.push(...relations); }
  }
  const names = new Set<string>();
  for (const step of doc.steps) {
    if (!step.timed && step.actions.length === 0) continue;
    lines.push("");
    lines.push(...stepLines(step, names));
  }
  lines.push(SCENE_END);
  return lines.join("\n");
}

/** Full canonical file text for a doc (used by starters replacing a file). */
export function serializeSceneFile(doc: SceneDoc): string {
  const size = docSize(doc);
  const lines: string[] = [
    ...(doc.title?.trim() ? [`title("${escapeString(doc.title.trim())}");`] : []),
    `canvas(${size.width}, ${size.height});`,
    `template("${doc.template}");`,
    ...(doc.voice ? [voiceLine(doc.voice)] : []),
  ];
  for (const entity of doc.entities) {
    lines.push("");
    lines.push(...entityLines(entity));
  }
  for (const entity of doc.entities) {
    const relations = relationLines(entity);
    if (relations.length > 0) { lines.push(""); lines.push(...relations); }
  }
  const names = new Set<string>();
  for (const step of doc.steps) {
    if (!step.timed && step.actions.length === 0) continue;
    lines.push("");
    lines.push(...stepLines(step, names));
  }
  return `${lines.join("\n")}\n`;
}

function entityLines(entity: SceneEntity, options: { includeColor?: boolean } = {}): string[] {
  const def = defFor(entity);
  const out = [entity.copyOf ? `copy(${entity.id}, ${entity.copyOf});` : def.ctorLine(entity), ...def.extraLines(entity)];
  const id = entity.id;
  const colorInCtor = typeof def.colorInCtor === "function" ? def.colorInCtor(entity) : def.colorInCtor;
  if (!colorInCtor && options.includeColor !== false && !entity.nativePaint) out.push(`color(${id}, ${entity.color});`);
  if (entity.opacity !== (def.defaultOpacity ?? 1)) out.push(`opacity(${id}, ${num(entity.opacity)});`);
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
  if (entity.gradient) {
    const mode = entity.gradient.mode === "auto" ? ""
      : entity.gradient.mode === "linear" ? `, ${num(entity.gradient.angle)}`
        : entity.gradient.mode === "speed" || entity.gradient.mode === "curvature" ? `, "${entity.gradient.mode}"`
          : `, ${entity.gradient.mode}`;
    out.push(`gradient(${id}, ${entity.gradient.stops.join(", ")}${mode});`);
  }
  if (entity.plate !== undefined) out.push(`plate(${id}, ${num(entity.plate)});`);
  if (entity.cursor) out.push(`cursor(${id});`);
  if (entity.clip) out.push(`clip(${id}, ${entity.clip});`);
  if (entity.mask) out.push(`mask(${id}, ${entity.mask});`);
  if (entity.pin3) {
    const target = entity.pin3.target ?? (entity.pin3.at ? pt3(entity.pin3.at.x, entity.pin3.at.y, entity.pin3.at.z) : pt3(0, 0, 0));
    if (entity.pin3.form === "label3") out.push(`label3(${id}, ${target}${entity.pin3.worldHeight === null ? "" : `, ${num(entity.pin3.worldHeight)}`});`);
    else out.push(`pin3(${id}, ${target}${entity.pin3.offset.x === 0 && entity.pin3.offset.y === 0 ? "" : `, ${pt(entity.pin3.offset.x, entity.pin3.offset.y)}`});`);
  }
  if (entity.thickness3 !== undefined && entity.thickness3 !== 0) out.push(`thick(${id}, ${num(entity.thickness3)});`);
  if (entity.finish3) out.push(`finish3(${id}, "${finish3SpecText(entity.finish3)}");`);
  for (const tag of entity.tags ?? []) out.push(`tag(${id}, ${tag});`);
  if (entity.reveal === "fade") out.push(`hidden(${id});`);
  if (entity.reveal === "grow") out.push(`hidden(${id}, center);`);
  if (entity.untraced) out.push(`untraced(${id});`);
  if (entity.savedState) out.push(`savestate(${id});`);
  return out;
}

/** Relations are emitted after all entity declarations so dependencies exist. */
function relationLines(entity: SceneEntity): string[] {
  const out: string[] = [];
  if (entity.kind === "parameter") {
    for (const binding of entity.bindings) {
      if (binding.formulas.length > 0) out.push(`bind(${entity.id}, ${binding.target}, ${binding.property}, ${binding.formulas.map((formula) => `"${escapeString(formula)}"`).join(", ")});`);
      else out.push(`bind(${entity.id}, ${binding.target}, ${binding.property}, ${num(binding.from ?? 0)}, ${num(binding.to ?? 1)});`);
    }
  }
  if (entity.morph2) out.push(`morph(${entity.id}, ${entity.morph2.target}${entity.morph2.spin === null ? "" : `, ${num(entity.morph2.spin)}`});`);
  if (entity.morph3) out.push(`morph3(${entity.id}, ${entity.morph3.target}${entity.morph3.spin === null ? "" : `, ${num(entity.morph3.spin)}`});`);
  if (entity.follow3) out.push(`follow3(${entity.id}, ${entity.follow3.target}${entity.follow3.offset.x === 0 && entity.follow3.offset.y === 0 && entity.follow3.offset.z === 0 ? "" : `, ${pt3(entity.follow3.offset.x, entity.follow3.offset.y, entity.follow3.offset.z)}`});`);
  return out;
}

function stepLines(step: SceneStep, usedNames: Set<string>): string[] {
  if (step.timed) return timedStepLines(step);
  const timelineActions = step.actions.filter((action) => verbDef(action.verb)?.placement === "timeline");
  if (timelineActions.length > 0) {
    if (step.actions.length !== 1) throw new Error(`${timelineActions[0].verb} must remain a standalone timeline event.`);
    return [actionLine(timelineActions[0])];
  }
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

function timedStepLines(step: SceneStep): string[] {
  const timed = step.timed;
  if (!timed) return [];
  const lines = [`timed(${timed.controller}) {`];
  for (const phase of timed.phases) {
    lines.push(`  during("${escapeString(phase.name)}") {`);
    for (const segment of phase.segments) {
      const body = segment.items.flatMap(timedItemLines);
      if (segment.wrapped) {
        const wrapper = segment.mode === "together" ? "par {" : segment.mode === "sequence" ? "seq {" : `stagger(${num(segment.gap)}) {`;
        lines.push(`    ${wrapper}`, ...body.flatMap((line) => indentLines(line, 6)), "    }");
      } else {
        lines.push(...body.flatMap((line) => indentLines(line, 4)));
      }
    }
    lines.push("  }");
  }
  lines.push("}");
  return lines;
}

function timedItemLines(item: TimedItem): string[] {
  return item.kind === "action" ? [actionLine(item.action)] : item.raw.trim().split("\n").map((line) => line.trimEnd());
}

function indentLines(line: string, spaces: number): string[] {
  const prefix = " ".repeat(spaces);
  return line.split("\n").map((part) => `${prefix}${part.trimStart()}`);
}

function actionLine(action: SceneAction): string {
  const def = verbDef(action.verb);
  if (!def) throw new Error(`Unknown verb "${action.verb}"`);
  return def.serialize(action);
}

function voiceLine(voice: VoiceConfig): string {
  const args: string[] = [voice.service];
  if (voice.voice !== null || voice.tone !== null || voice.language !== null) args.push(voice.voice ?? "");
  if (voice.tone !== null) args.push(voice.tone);
  else if (voice.language !== null) args.push(voice.language);
  if (voice.tone !== null && voice.language !== null) args.push(voice.language);
  return `voice(${args.map((value) => `"${escapeString(value)}"`).join(", ")});`;
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
export type StepForm = "step" | "anon" | "bare" | "timed";

export interface AnchorExpr {
  xSrc: string | null;
  ySrc: string | null;
  xOld: number;
  yOld: number;
}

export interface ConditionalBranchMeta {
  kind: "if" | "else-if" | "else";
  /** Exact authored expression. Null for `else`. */
  condition: string | null;
  /** Exact expression span, allowing a surgical condition edit. */
  conditionSpan: Span | null;
  /** Direct statements authored in this branch, including unsupported ones. */
  statementCount: number;
  /** Number of evaluations that selected this branch. */
  selected: number;
  /** Canvas entities affected or created while this branch was selected. */
  entityIds: string[];
  /** Story cards produced by, or containing actions from, this branch. */
  stepIndexes: number[];
}

export interface ConditionalMeta {
  /** Stable within one source projection; based on the `if` source offset. */
  id: string;
  span: Span;
  evaluations: number;
  unresolved: number;
  branches: ConditionalBranchMeta[];
}

export interface SceneMeta {
  /** Statements belonging to each patchable entity (literal AND computed), in file order. */
  entitySpans: Map<string, Span[]>;
  /** Modifier names explicitly authored for each entity (keeps patching from materialising defaults). */
  entityModifiers: Map<string, Set<string>>;
  /** Computed entities: the anchor point's original expressions, for delta-preserving writes. */
  anchors: Map<string, AnchorExpr>;
  /** Whole conditional groups, including inactive branches. */
  conditionals: ConditionalMeta[];
  /** One per doc.steps entry; `locked` steps (computed/generated) are never patched. */
  steps: { span: Span; form: StepForm; locked: boolean }[];
  canvasSpan: Span | null;
  templateSpan: Span | null;
  titleSpan: Span | null;
  voiceSpan: Span | null;
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
    for (const action of stepActions(step)) {
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
    if (target === "none") return true;
    if (targets.has(target)) return true;
    const dot = target.indexOf(".");
    return dot > 0 && targets.has(target.slice(0, dot)); // children like cap.w0 / eq.label
  };
  for (const step of doc.steps) {
    for (const action of stepActions(step)) {
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
const SHARED_MODIFIERS = new Set(["color", "opacity", "rot", "hidden", "untraced", "hue", "tag", "z", "glow", "sticky", "dashed", "savestate", "gradient", "plate", "cursor", "clip", "mask", "morph", "pin3", "label3", "follow3", "thick", "finish3", "morph3"]);
const ENTITY3_KINDS = new Set(["camera3", "grid3", "line3", "arrow3", "curve3", "point3", "cloud3", "axes3", "frame3", "cube3", "sphere3", "prism3", "pyramid3", "midpoint3", "cross3", "link3", "model3", "assembly3", "extrude3", "revolve3", "tube3", "project3", "projectpath3", "surface3", "domainsurface", "param3", "implicit3", "heightmap3", "contour3", "slice3", "tangentplane3", "gradient3", "vectorfield3", "volume3", "trajectory3", "descend3", "linmap3", "eigen3", "collection3", "collection3data", "child3", "links3", "links3data", "pieces3", "ring3", "trail3", "historyplot3", "randomwalk3", "lsystem3", "tree3", "hilbert3", "molecule3"]);
const STEP_BLOCKS = new Set(["step", "par", "seq", "stagger"]);
const TIMED_BLOCKS = new Set(["timed", "during"]);
const VARIADIC_LITERAL_NAMES = Array.from({ length: 256 }, (_unused, index) => index);
const LITERAL_NAME_ARGS: Readonly<Record<string, readonly number[]>> = {
  grid: [0],
  point: [0], segment: [0, 1, 2], midpoint: [0, 1, 2], centroid: [0, 1, 2, 3],
  circumcenter: [0, 1, 2, 3], incenter: [0, 1, 2, 3], orthocenter: [0, 1, 2, 3],
  foot: [0, 1, 2, 3], meet: [0, 1, 2, 3, 4], reflect: [0, 1, 2, 3], bisector: [0, 1, 2, 3],
  rotpoint: [0, 1, 2], between: [0, 1, 2], anglepoint: [0, 1, 2],
  linecircle: [0, 1, 2, 3, 4], circlecircle: [0, 1, 2, 3, 4],
  circumcircle: [0, 1, 2, 3], incircle: [0, 1, 2, 3], circle2: [0, 1, 2],
  fullline: [0, 1, 2], commontangent: [0, 1, 2, 3, 4], ellipse: [0], parabola: [0], hyperbola: [0],
  axes3: [0], frame3: [0], cube3: [0], sphere3: [0], prism3: [0], pyramid3: [0], cross3: [0],
  midpoint3: [0, 1, 2], link3: [0, 1, 2], label3: [0, 1], pin3: [0, 1],
  model3: [0], assembly3: [0], extrude3: [0, 1], revolve3: [0], tube3: [0, 1], project3: [0, 1], projectpath3: [0, 1], finish3: [0],
  surface3: [0], domainsurface: [0], param3: [0], implicit3: [0], heightmap3: [0, 1], contour3: [0, 1], slice3: [0, 1, 2], tangentplane3: [0, 1], gradient3: [0, 1], vectorfield3: [0], volume3: [0, 1], trajectory3: [0], descend3: [0, 1], linmap3: [0], eigen3: [0],
  collection3: [0], collection3data: [0], child3: [0, 1], links3: [0, 1, 2], links3data: [0, 1], pieces3: [0, 1], ring3: [0, 1], trail3: [0, 1], historyplot: [0, 1, 3], historyplot3: [0, 1, 3], randomwalk3: [0], lsystem3: [0], tree3: [0], hilbert3: [0], attach3: [0, 1], follow3: [0, 1],
  move3: [0], shift3: [0], rotate3: [0], grow3: [0], turn3: [0, 1, 2], become3: [0, 1], travel3: [0, 1],
  drift3: [0], chain3: [0], advect3: [0, 1], followshot3: [0], view3: [0], present3: [0, 1],
  parameter: [0], bind: [0, 1, 2], morph: [0, 1],
  turn: [0, 1], roll: [0, 1], flow: [0, 2, 3], become: [0, 1], attach: [0, 1],
  oscillate: [0, 1], shake: [0], followshot: [0],
  copy: [0, 1], slidex: [0], slidey: [0], groupscale: [0], dock: [0, 1, 2], arrange: [0, 1], surround: [0, 1],
  grow: [0, 1], blink: [0], wiggle: [0], circumscribe: [0, 1], passflash: [0, 1], spotlight: [0], spiralin: [0],
  rotate: [0], savestate: [0], set: [0, 1], swap: [0, 1], transform: [0], deform: [0], restore: [0, 1],
  sliders: [0, 5], setsliders: [0], loupe: [0, 6, 7], wander: [0],
  array: [0], pointer: [0, 1], caret: [0, 3], stack: [0], queue: [0], list: [0, 3],
  compare: [0, 3], pointat: [0, 1], push: [0], pop: [0], enqueue: [0], dequeue: [0], insert: [0], remove: [0],
  hashmap: [0], put: [0], get: [0], graph: [0, 3], bfs: [0, 1], dfs: [0, 1], dijkstra: [0, 1],
  histogram: [0, 6], covariance: [0, 4], bayes: [0], hypothesis: [0], bellcurve: [0, 5], gaussian: [0, 5],
  summary: [0, 4], correlation: [0, 4], skew: [0, 6], boxplot: [0, 4], distribution: [0, 5],
  confidence: [0], montecarlo: [0], randomwalk: [0], lln: [0], clt: [0, 7],
  network: [0], activation: [0, 2], tensor: [0, 4], digit: [0, 4], kernel: [0, 4],
  convolve: [0, 1, 2, 7], pool: [0, 1, 3], tokenize: [0, 3], embedding: [0, 1, 4], transformer: [0, 1],
  logits: [0, 1], attention: [0], topk: [0, 1], forward: [0], feed: [0, 1], loss: [0, 2], backward: [0],
  checkpoint: [0, 1], update: [0], scan: [0], encode: [0], sample: [0], attend: [0],
  refract: [0], lens: [0], prism: [0], achromat: [0], lenssystem: [0], rayfan: [0], spotdiagram: [0], fieldspot: [0],
  freekick:[0],pendulum:[0],spring:[0],doublependulum:[0],springpendulum:[0],kapitza:[0],cartpendulum:[0],comparependulum:[0],verticalspring:[0],springincline:[0],bungee:[0],resonance:[0],doublespring:[0],seriesparallel:[0],carsuspension:[0],piston:[0],molecule:[0],robotarm:[0],pulley:[0],pulleyscale:[0],blocktackle:[0],compoundpulley:[0],ramp:[0],dropmass:[0],inclinepulley:[0],doubleincline:[0],inclinebumper:[0],springchain:[0],looptrack:[0],collideblocks:[0],bulletblock:[0],newtonscradle:[0],gas:[0],species:[0,1,2,3],rule:[0],speeds:[0],dominos:[0],dominopath:[0],stringwave:[0],raft:[0],brachistochrone:[0],swing:[0],forces:[0],phase:[0],well:[0],timegraph:[0],energygraph:[0],
  architecture:[0],flowchart:[0,1],c4:[0,1],node:[0,1],cluster:[0,1],connect:[0,1,2,3,4,5],annotate:[0],message:[0,1],request:[0,1],route:[0,1],hotpath:[0],
  circuit:[0],probe:[0],current:[0,2,3],scope:[0],cut:[0,1],reconnect:[0,1],
  neighbors:[0],setcell:[0,3],walls:[0],evolve:[0],collapse:[0],gridbfs:[0,3],gridastar:[0,3],
  racechart:[0],racedata:[0],raceseries:[0],raceline:[0],racepanel:[0],race:[0],
  livehistogram:[0,7],stream:[0,1],emit:[0,1,2],advect:[0,1],branch:[0,1],collect:[0,1,2],observe:[0,1,2],
  balance:[0],supply:[0],limiting:[0],solve:[0],react:[0],
  lewis:[0],octet:[0],resonate:[0],levels:[0],emission:[0,1],drop:[0],
  cell:[0],discharge:[0],lattice:[0],dissolve:[0],newman:[0],profile:[0,1],
  vibration:[0],irspectrum:[0,1],molecule3:[0],
  trail: [0, 1, 2], sweep: [0, 1, 2, 4],
  union: [0, 1, 2, 3], intersect: [0, 1, 2, 3], intersection: [0, 1, 2, 3], difference: [0, 1, 2, 3], subtract: [0, 1, 2, 3], exclusion: [0, 1, 2, 3], xor: [0, 1, 2, 3],
  regions: VARIADIC_LITERAL_NAMES, spantree: VARIADIC_LITERAL_NAMES, dual: VARIADIC_LITERAL_NAMES,
  creator: [0], socials: [0], endcard: [0], safezone: [0, 1], figure: [0],
  quiz: [0], option: [0, 2], timing: [0], timerstyle: [0], countdown: [0], explain: [0], run: [0], timed: [0], during: [0],
};

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
  conditionalEntitySets: Map<string, Set<string>>;
  conditionalStepSets: Map<string, Set<number>>;
}

interface Ctx {
  env: Env;
  /** Inside a for-loop or macro expansion: statements have no 1:1 source. */
  generated: boolean;
  depth: number;
  /** The loop/macro statement that generates this content (for jump-to-source). */
  originSpan?: Span;
  /** Selected source branches enclosing the current statement. */
  branches?: BranchSelection[];
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
    meta: { entitySpans: new Map(), entityModifiers: new Map(), anchors: new Map(), conditionals: [], steps: [], canvasSpan: null, templateSpan: null, titleSpan: null, voiceSpan: null },
    entityById: new Map(),
    targets: new Set(),
    lenient,
    autoStep: 0,
    generatedCount: 0,
    macros: new Map(),
    conditionalEntitySets: new Map(),
    conditionalStepSets: new Map(),
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

  registerConditionals(statements, sink);
  processStatements(statements, { env, generated: false, depth: 0 }, sink);
  // Native pairing is syntactic: an inactive responsive branch still owns a
  // Speak statement, so inspect the source tree rather than only projected beats.
  const hasSpeak = containsCall(statements, "speak");
  if (hasSpeak && !sink.doc.voice) sink.reasons.push("`speak(...)` needs one global `voice(...)` declaration — kept as written.");
  if (!hasSpeak && sink.doc.voice) sink.reasons.push("`voice(...)` has no matching `speak(...)` beat — kept as written.");
  for (const entity of sink.doc.entities) {
    for (const dependency of entityReferences(entity)) {
      if (!sink.targets.has(dependency)) {
        sink.reasons.push(`\`${entity.id}\` depends on missing entity or group \`${dependency}\` — kept as written.`);
      }
    }
  }
  return { doc: sink.doc, reasons: sink.reasons, warnings: sink.warnings, targets: sink.targets, meta: sink.meta };
}

function containsCall(statements: readonly Statement[], name: string): boolean {
  for (const statement of statements) {
    if (statement.kind === "call") {
      if (statement.name === name) return true;
      if (statement.block && containsCall(statement.block, name)) return true;
    } else if (statement.kind === "if") {
      if (statement.branches.some((branch) => containsCall(branch.body, name))) return true;
      if (statement.elseBody && containsCall(statement.elseBody, name)) return true;
    } else if ((statement.kind === "for" || statement.kind === "def") && containsCall(statement.body, name)) return true;
  }
  return false;
}

function registerConditionals(statements: readonly Statement[], sink: Sink): void {
  for (const statement of statements) {
    if (statement.kind === "if") {
      ensureConditional(statement, sink);
      for (const branch of statement.branches) registerConditionals(branch.body, sink);
      if (statement.elseBody) registerConditionals(statement.elseBody, sink);
    } else if (statement.kind === "for" || statement.kind === "def") {
      registerConditionals(statement.body, sink);
    } else if (statement.kind === "call" && statement.block) {
      registerConditionals(statement.block, sink);
    }
  }
}

function ensureConditional(statement: IfStatement, sink: Sink): ConditionalMeta {
  const id = `if:${statement.start}`;
  const existing = sink.meta.conditionals.find((conditional) => conditional.id === id);
  if (existing) return existing;
  const branches: ConditionalBranchMeta[] = statement.branches.map((branch, index) => ({
    kind: index === 0 ? "if" : "else-if",
    condition: branch.condSrc,
    conditionSpan: { start: branch.condStart, end: branch.condEnd },
    statementCount: branch.body.length,
    selected: 0,
    entityIds: [],
    stepIndexes: [],
  }));
  if (statement.elseBody) {
    branches.push({
      kind: "else", condition: null, conditionSpan: null,
      statementCount: statement.elseBody.length, selected: 0, entityIds: [], stepIndexes: [],
    });
  }
  const conditional: ConditionalMeta = {
    id,
    span: span(statement),
    evaluations: 0,
    unresolved: 0,
    branches,
  };
  sink.meta.conditionals.push(conditional);
  return conditional;
}

function recordConditionalSelections(selections: readonly BranchSelection[], stepIndex: number, sink: Sink): void {
  for (const selection of selections) {
    const conditional = sink.meta.conditionals.find((candidate) => candidate.id === selection.conditionalId);
    const branch = conditional?.branches[selection.branchIndex];
    if (!branch) continue;
    const key = `${selection.conditionalId}:${selection.branchIndex}`;
    let seen = sink.conditionalStepSets.get(key);
    if (!seen) { seen = new Set(); sink.conditionalStepSets.set(key, seen); }
    if (!seen.has(stepIndex)) { seen.add(stepIndex); branch.stepIndexes.push(stepIndex); }
  }
}

function recordConditionalEntity(selections: readonly BranchSelection[] | undefined, entityId: string, sink: Sink): void {
  if (!selections) return;
  for (const selection of selections) {
    const conditional = sink.meta.conditionals.find((candidate) => candidate.id === selection.conditionalId);
    const branch = conditional?.branches[selection.branchIndex];
    if (!branch) continue;
    const key = `${selection.conditionalId}:${selection.branchIndex}`;
    let seen = sink.conditionalEntitySets.get(key);
    if (!seen) { seen = new Set(); sink.conditionalEntitySets.set(key, seen); }
    if (!seen.has(entityId)) { seen.add(entityId); branch.entityIds.push(entityId); }
  }
}

function recordConditionalTarget(selections: readonly BranchSelection[] | undefined, target: string | null, sink: Sink): void {
  if (!selections || !target) return;
  const direct = sink.entityById.get(target);
  if (direct) { recordConditionalEntity(selections, direct.id, sink); return; }
  for (const entity of sink.doc.entities) {
    if (entity.tags?.includes(target) || referenceIds(entity).includes(target)) recordConditionalEntity(selections, entity.id, sink);
  }
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
        const conditional = ensureConditional(statement, sink);
        conditional.evaluations += 1;
        try {
          let taken = false;
          for (let branchIndex = 0; branchIndex < statement.branches.length; branchIndex += 1) {
            const branch = statement.branches[branchIndex];
            if (evalExpr(branch.cond, ctx.env) !== 0) {
              conditional.branches[branchIndex].selected += 1;
              processStatements(branch.body, { ...ctx, env: new Map(ctx.env), branches: [...(ctx.branches ?? []), { conditionalId: conditional.id, branchIndex }] }, sink);
              taken = true;
              break;
            }
          }
          if (!taken && statement.elseBody) {
            const branchIndex = conditional.branches.length - 1;
            conditional.branches[branchIndex].selected += 1;
            processStatements(statement.elseBody, { ...ctx, env: new Map(ctx.env), branches: [...(ctx.branches ?? []), { conditionalId: conditional.id, branchIndex }] }, sink);
          }
        } catch (error) {
          conditional.unresolved += 1;
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
            processStatements(statement.body, { env: child, generated: true, depth: ctx.depth, originSpan: ctx.originSpan ?? span(statement), branches: ctx.branches }, sink);
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
  if (name === "title") {
    const title = argString(statement.args, 0);
    if (title !== null && statement.args.length === 1) sink.doc.title = title;
    else sink.warnings.push("Unrecognized title kept as written.");
    sink.meta.titleSpan ??= span(statement);
    return;
  }
  if (sink.lenient && name === "masthead") {
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
  if (name === "voice") {
    if (sink.doc.voice) {
      sink.reasons.push(`Only one global \`voice(...)\` declaration is allowed: ${clip(statement.raw)}`);
    } else {
      const voice = parseVoiceArgs(statement.args);
      if (voice) sink.doc.voice = voice;
      else sink.reasons.push(`\`voice\` arguments are not supported: ${clip(statement.raw)}`);
    }
    sink.meta.voiceSpan ??= span(statement);
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
    processStatements(macro.body, { env: child, generated: true, depth: ctx.depth + 1, originSpan: ctx.originSpan ?? span(statement), branches: ctx.branches }, sink);
    return;
  }

  const resolved = resolveArgs(statement.args, ctx.env, sink, new Set(LITERAL_NAME_ARGS[name] ?? []));
  if (!resolved) {
    // 3D points / unresolvable args: report by NAME when the builtin itself is
    // outside the canvas vocabulary (the usual case for the 3D kits).
    const known = entityDefByCtor(name) || verbDef(name) || isModifierName(name) || STEP_BLOCKS.has(name) || TIMED_BLOCKS.has(name);
    sink.reasons.push(known
      ? `Arguments could not be evaluated: ${clip(statement.raw)}`
      : `\`${name}\` is not yet supported by the canvas: ${clip(statement.raw)}`);
    return;
  }
  const literalStatement: CallStatement = { ...statement, args: resolved.args };
  const computed = resolved.computed;

  // `copy(new, src)` keeps the source's concrete entity adapter so Canvas can
  // render and style the duplicate honestly. `copyOf` changes only how the
  // constructor line is written; constructor-owned geometry remains locked to
  // the native snapshot and motion belongs in Story.
  if (name === "copy" && !statement.block) {
    const id = argName(literalStatement.args, 0), sourceId = argName(literalStatement.args, 1);
    const source = sourceId ? sink.entityById.get(sourceId) : undefined;
    if (!id || !sourceId || !source || literalStatement.args.length !== 2) {
      sink.reasons.push(`\`copy\` needs a fresh id and an earlier Canvas entity: ${clip(statement.raw)}`);
      return;
    }
    if (sink.entityById.has(id)) {
      sink.reasons.push(`Duplicate entity id \`${id}\` — the copy is kept as written.`);
      return;
    }
    const entity = JSON.parse(JSON.stringify(source)) as SceneEntity;
    entity.id = id;
    entity.copyOf = sourceId;
    delete entity.tags;
    delete entity.origin;
    delete entity.genKey;
    delete entity.src;
    if (ctx.generated) {
      entity.origin = "generated";
      const idArg = statement.args[0];
      entity.genKey = idArg && idArg.type === "name" ? idArg.value : entity.id;
      entity.src = ctx.originSpan ?? span(statement);
      sink.generatedCount += 1;
    } else {
      sink.meta.entitySpans.set(entity.id, [span(statement)]);
      if (computed) { entity.origin = "computed"; entity.src = span(statement); }
    }
    sink.entityById.set(entity.id, entity);
    sink.targets.add(entity.id);
    for (const ref of referenceIds(entity)) sink.targets.add(ref);
    sink.doc.entities.push(entity);
    recordConditionalEntity(ctx.branches, entity.id, sink);
    return;
  }

  const ctorDef = entityDefByCtor(name);
  // Some native names are deliberately overloaded. `timing(q, "...")`
  // modifies an existing quiz, while `timing(clock, "main=6")` constructs a
  // fresh generic controller. Prefer the modifier only when its target already
  // exists; otherwise fall through to the constructor definition.
  const overloadId = argName(literalStatement.args, 0);
  const overloadTarget = overloadId
    ? sink.entityById.has(overloadId) || sink.doc.entities.some((candidate) => referenceIds(candidate).includes(overloadId))
    : false;
  if (ctorDef && isModifierName(name) && overloadTarget) {
    applyModifier(literalStatement, computed && !ctx.generated, ctx.generated, statement, sink);
    recordConditionalTarget(ctx.branches, overloadId, sink);
    return;
  }
  if (ctorDef && (!statement.block || ctorDef.acceptsBlock)) {
    const entity = ctorDef.parseArgs(literalStatement, sink.doc, { variables: Object.fromEntries(ctx.env) });
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
    for (const ref of referenceIds(entity)) sink.targets.add(ref);
    sink.doc.entities.push(entity);
    recordConditionalEntity(ctx.branches, entity.id, sink);
    return;
  }

  if (isModifierName(name)) {
    applyModifier(literalStatement, computed && !ctx.generated, ctx.generated, statement, sink);
    recordConditionalTarget(ctx.branches, argName(literalStatement.args, 0), sink);
    return;
  }

  if (name === "timed" && statement.block) {
    const built = buildTimedStep(literalStatement, statement, ctx, sink, computed);
    if (!built) return;
    const stepIndex = sink.doc.steps.length;
    sink.doc.steps.push(built);
    recordConditionalSelections(ctx.branches ?? [], stepIndex, sink);
    sink.meta.steps.push({
      span: ctx.generated ? { start: 0, end: 0 } : span(statement),
      form: "timed",
      locked: ctx.generated || built.origin !== undefined,
    });
    return;
  }
  if (name === "during") {
    sink.reasons.push(`\`during\` belongs directly inside a \`timed(clock)\` Story composition: ${clip(statement.raw)}`);
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
    const stepIndex = sink.doc.steps.length;
    sink.doc.steps.push(step.step);
    recordConditionalSelections([...(ctx.branches ?? []), ...step.conditionalSelections], stepIndex, sink);
    sink.meta.steps.push({
      span: ctx.generated ? { start: 0, end: 0 } : span(statement),
      form: isStep ? "step" : "anon",
      locked: ctx.generated || step.computed,
    });
    return;
  }

  const verb = verbDef(name);
  if (verb && !statement.block) {
    const action = verb.parse(literalStatement, sink.doc);
    if (!action) {
      sink.reasons.push(`\`${name}\` arguments are not yet supported by the canvas: ${clip(statement.raw)}`);
      return;
    }
    if (!actionTargetSupported(action, sink)) {
      sink.reasons.push(`\`${name}\` target is not yet supported by the canvas: ${clip(statement.raw)}`);
      return;
    }
    normalizeInferredDuration(action, sink);
    sink.autoStep += 1;
    const step: SceneStep = { name: `Beat ${sink.autoStep}`, mode: "together", gap: 0.15, actions: [action] };
    if (ctx.generated) step.origin = "generated";
    else if (computed) step.origin = "computed";
    const stepIndex = sink.doc.steps.length;
    sink.doc.steps.push(step);
    recordConditionalSelections(ctx.branches ?? [], stepIndex, sink);
    sink.meta.steps.push({
      span: ctx.generated ? { start: 0, end: 0 } : span(statement),
      form: "bare",
      locked: ctx.generated || computed,
    });
    return;
  }

  sink.reasons.push(`\`${name}\` is not yet supported by the canvas: ${clip(statement.raw)}`);
}

interface BranchSelection { conditionalId: string; branchIndex: number; }
interface BuiltStep { step: SceneStep; computed: boolean; conditionalSelections: BranchSelection[]; }

function buildTimedStep(literal: CallStatement, original: CallStatement, ctx: Ctx, sink: Sink, computedController: boolean): SceneStep | null {
  const controller = argName(literal.args, 0);
  const timing = controller ? sink.entityById.get(controller) : null;
  if (!controller || literal.args.length !== 1 || timing?.kind !== "timing" || !original.block) {
    sink.reasons.push(`\`timed\` needs one generic timing controller already known to Canvas: ${clip(original.raw)}`);
    return null;
  }
  const available = new Set(timing.phases.map((phase) => phase.name.toLowerCase()));
  const used = new Set<string>();
  const phases: NonNullable<SceneStep["timed"]>["phases"] = [];
  let computed = computedController;
  for (const phaseStatement of original.block) {
    if (phaseStatement.kind !== "call" || phaseStatement.name !== "during" || !phaseStatement.block) {
      sink.reasons.push(`\`timed(${controller})\` accepts only \`during("phase") { ... }\` children: ${clip(phaseStatement.raw)}`);
      return null;
    }
    const resolved = resolveArgs(phaseStatement.args, ctx.env, sink, new Set([0]));
    const phaseName = resolved ? (argString(resolved.args, 0) ?? argName(resolved.args, 0))?.toLowerCase() : null;
    if (!phaseName || resolved!.args.length !== 1 || !available.has(phaseName) || used.has(phaseName)) {
      sink.reasons.push(`\`during\` must name one unused phase from ${[...available].join(", ")}: ${clip(phaseStatement.raw)}`);
      return null;
    }
    used.add(phaseName);
    computed ||= resolved!.computed;
    const parsed = timedSegments(phaseStatement.block, ctx, sink);
    computed ||= parsed.computed;
    phases.push({ name: phaseName, segments: parsed.segments.length > 0 ? parsed.segments : [{ mode: "sequence", gap: .15, wrapped: false, items: [] }] });
  }
  const step: SceneStep = { name: `Timed · ${controller}`, mode: "sequence", gap: .15, actions: [], timed: { controller, phases } };
  if (ctx.generated) step.origin = "generated";
  else if (computed) step.origin = "computed";
  return step;
}

function timedSegments(statements: Statement[], ctx: Ctx, sink: Sink): { segments: TimedSegment[]; computed: boolean } {
  const segments: TimedSegment[] = [];
  let direct: TimedItem[] = [];
  let computed = false;
  const flush = () => {
    if (direct.length > 0) segments.push({ mode: "sequence", gap: .15, wrapped: false, items: direct });
    direct = [];
  };
  for (const statement of statements) {
    if (statement.kind === "call" && statement.block && ["par", "seq", "stagger"].includes(statement.name)) {
      flush();
      let mode: StepMode = statement.name === "par" ? "together" : statement.name === "seq" ? "sequence" : "stagger";
      let gap = .15;
      if (mode === "stagger") {
        const resolved = resolveArgs(statement.args, ctx.env, sink);
        const value = resolved ? argNumber(resolved.args, 0) : null;
        if (value === null) {
          segments.push({ mode: "sequence", gap: .15, wrapped: false, items: [{ kind: "source", raw: statement.raw }] });
          continue;
        }
        gap = value;
        computed ||= resolved!.computed;
      }
      const items: TimedItem[] = [];
      for (const child of statement.block) {
        const parsed = timedItem(child, ctx, sink);
        items.push(parsed.item);
        computed ||= parsed.computed;
      }
      segments.push({ mode, gap, wrapped: true, items });
      continue;
    }
    const parsed = timedItem(statement, ctx, sink);
    direct.push(parsed.item);
    computed ||= parsed.computed;
  }
  flush();
  return { segments, computed };
}

function timedItem(statement: Statement, ctx: Ctx, sink: Sink): { item: TimedItem; computed: boolean } {
  if (statement.kind !== "call" || statement.block) return { item: { kind: "source", raw: statement.raw }, computed: statement.kind !== "call" };
  const resolved = resolveArgs(statement.args, ctx.env, sink, new Set(LITERAL_NAME_ARGS[statement.name] ?? []));
  if (!resolved) return { item: { kind: "source", raw: statement.raw }, computed: false };
  const verb = verbDef(statement.name);
  const action = verb?.parse({ ...statement, args: resolved.args }, sink.doc);
  const targetKnown = !action?.target || sink.targets.has(action.target) || (action.target.includes(".") && sink.targets.has(action.target.slice(0, action.target.indexOf("."))));
  if (!verb || !action || verb.placement === "timeline" || !targetKnown || !actionTargetSupported(action, sink)) {
    return { item: { kind: "source", raw: statement.raw }, computed: resolved.computed };
  }
  normalizeInferredDuration(action, sink);
  return { item: { kind: "action", action }, computed: resolved.computed };
}

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
  return { step: { name, mode, gap, actions: flat.actions }, computed, conditionalSelections: flat.conditionalSelections };
}

/** Flatten a timeline block's children into actions, expanding for/if/macros. */
function flattenActions(statements: Statement[], ctx: Ctx, sink: Sink): { actions: SceneAction[]; computed: boolean; conditionalSelections: BranchSelection[] } {
  const actions: SceneAction[] = [];
  const conditionalSelections: BranchSelection[] = [...(ctx.branches ?? [])];
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
        const conditional = ensureConditional(child, sink);
        conditional.evaluations += 1;
        try {
          let taken = false;
          for (let branchIndex = 0; branchIndex < child.branches.length; branchIndex += 1) {
            const branch = child.branches[branchIndex];
            if (evalExpr(branch.cond, env) !== 0) {
              conditional.branches[branchIndex].selected += 1;
              conditionalSelections.push({ conditionalId: conditional.id, branchIndex });
              walk(branch.body, new Map(env), generated, depth);
              taken = true;
              break;
            }
          }
          if (!taken && child.elseBody) {
            const branchIndex = conditional.branches.length - 1;
            conditional.branches[branchIndex].selected += 1;
            conditionalSelections.push({ conditionalId: conditional.id, branchIndex });
            walk(child.elseBody, new Map(env), generated, depth);
          }
          computed = true;
        } catch (error) {
          conditional.unresolved += 1;
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
      const resolved = resolveArgs(child.args, env, sink, new Set(LITERAL_NAME_ARGS[child.name] ?? []));
      if (!resolved) { sink.reasons.push(`Arguments could not be evaluated: ${clip(child.raw)}`); continue; }
      computed ||= resolved.computed || generated;
      const verb = verbDef(child.name);
      const action = verb && verb.parse({ ...child, args: resolved.args }, sink.doc);
      if (action && verb?.placement === "timeline") sink.reasons.push(`\`${child.name}\` is a top-level timeline event and cannot appear inside a step: ${clip(child.raw)}`);
      else if (action && actionTargetSupported(action, sink)) { normalizeInferredDuration(action, sink); actions.push(action); }
      else if (action) sink.reasons.push(`\`${child.name}\` target is not yet supported by the canvas: ${clip(child.raw)}`);
      else sink.reasons.push(`\`${child.name}\` is not yet supported by the canvas: ${clip(child.raw)}`);
    }
  };
  walk(statements, new Map(ctx.env), ctx.generated, ctx.depth);
  return {
    actions,
    computed,
    conditionalSelections: conditionalSelections.filter((selection, index, all) => all.findIndex((candidate) => candidate.conditionalId === selection.conditionalId && candidate.branchIndex === selection.branchIndex) === index),
  };
}

/** Resolve expression arguments to literals; null when evaluation fails. */
function resolveArgs(args: Arg[], env: Env, sink: Sink, literalNames: ReadonlySet<number> = new Set()): { args: Arg[]; computed: boolean } | null {
  let computed = false;
  const out: Arg[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.type === "expr") {
      try {
        const values = evalTuple(arg.node, env).map((value) => roundish(value));
        if (values.length === 1) out.push({ type: "number", value: values[0] });
        else if (values.length === 2) out.push({ type: "point", x: values[0], y: values[1] });
        else if (values.length === 3) out.push({ type: "point3", x: values[0], y: values[1], z: values[2] });
        else return null;
        computed = true;
      } catch {
        return null;
      }
    } else if (arg.type === "name") {
      if (arg.value.includes("{")) {
        try {
          const value = interpolateName(arg.value, env);
          if (literalNames.has(index) || !env.has(value)) out.push({ type: "name", value });
          else out.push({ type: "number", value: roundish(env.get(value)!) });
          computed = true;
        } catch {
          return null;
        }
      } else if (!literalNames.has(index) && env.has(arg.value)) {
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

function parseVoiceArgs(args: readonly Arg[]): VoiceConfig | null {
  if (args.length < 1 || args.length > 4) return null;
  const values = args.map((arg) => argString([arg], 0) ?? argName([arg], 0));
  if (values.some((value) => value === null)) return null;
  const [serviceRaw, voice = null, third = null, fourth = null] = values as [string, string | null, string | null, string | null];
  const service = serviceRaw.toLowerCase() as VoiceService;
  if (!["gtts", "cartesia", "elevenlabs"].includes(service)) return null;
  const tones = new Set<VoiceTone>(["normal", "slow", "fast"]);
  let tone: VoiceTone | null = null, language: string | null = null;
  if (fourth !== null) {
    if (!tones.has(third as VoiceTone)) return null;
    tone = third as VoiceTone;
    language = fourth;
  } else if (third !== null) {
    if (tones.has(third as VoiceTone)) tone = third as VoiceTone;
    else language = third;
  }
  if (service === "gtts" && tone === "fast") return null;
  return { service, voice: voice || null, tone, language };
}

/** Keep Story duration chips honest for optional-duration native workflows. */
function normalizeInferredDuration(action: SceneAction, sink: Sink): void {
  const entity = action.target ? sink.entityById.get(action.target) ?? null : null;
  if (action.verb === "run" && action.values?.length && entity?.kind !== "grid") {
    action.dur = action.values[0];
    action.values = undefined;
    action.durationExplicit = true;
  }
  if (action.durationExplicit !== false || !action.target) return;
  const verb = verbDef(action.verb);
  if (verb) action.dur = Math.max(.01, verb.beatDur(action, entity, sink.doc));
}

/** `run` is honest only for workflow entities currently represented by Canvas. */
function actionTargetSupported(action: SceneAction, sink: Sink): boolean {
  const direct = sink.entityById.get(action.target);
  if (direct && isAuthorOnly(direct) && !verbDef(action.verb)?.allowAuthorOnlyTargets) return false;
  const optionalTarget = verbDef(action.verb)?.ui.optionalTarget;
  if (optionalTarget && action.target) return Boolean(direct && optionalTarget.kinds.includes(direct.kind));
  if (action.verb === "setsliders") {
    return direct?.kind === "sliders" && action.values?.length === Math.round(direct.count);
  }
  if (action.verb !== "run") return true;
  if (!direct || !verbDef("run")?.appliesTo(direct.kind)) return false;
  return direct.kind === "grid" || !action.values?.length || action.durationExplicit === false;
}

function isModifierName(name: string): boolean {
  if (SHARED_MODIFIERS.has(name)) return true;
  return allEntityDefs().some((def) => Object.hasOwn(def.modifiers, name));
}

function applyModifier(statement: CallStatement, computed: boolean, generated: boolean, original: CallStatement, sink: Sink): void {
  const id = argName(statement.args, 0);
  let entity = id ? sink.entityById.get(id) : undefined;
  let virtual = false;
  if (!entity && id) {
    entity = sink.doc.entities.find((candidate) => referenceIds(candidate).includes(id));
    virtual = entity !== undefined;
  }
  if (!entity && id && SHARED_MODIFIERS.has(statement.name)) {
    const tagged = sink.doc.entities.filter((candidate) => candidate.tags?.includes(id));
    if (tagged.length > 0) {
      const applied = tagged.every((candidate) => applySharedModifier(statement.name, candidate, statement, sink));
      if (!applied) sink.reasons.push(`\`${statement.name}\` does not apply to every member of tag ${id}: ${clip(original.raw)}`);
      return;
    }
  }
  if (!entity) {
    sink.warnings.push(`Modifier on unknown entity ignored: ${clip(original.raw)}`);
    return;
  }
  const name = statement.name;
  let applied = false;
  if (virtual && id) {
    applied = defFor(entity).applyReferenceModifier?.(entity, id, statement) ?? false;
  } else if (SHARED_MODIFIERS.has(name)) {
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
  for (const ref of referenceIds(entity)) sink.targets.add(ref);
  if (generated || entity.origin === "generated") return; // expansion content is locked
  if (computed && !entity.origin) {
    // A variable-driven modifier marks the entity (badge), but stays editable:
    // regenerating writes evaluated literals for this modifier.
    entity.origin = "computed";
    entity.src = sink.meta.entitySpans.get(entity.id)?.[0] ?? span(statement);
  }
  sink.meta.entitySpans.get(entity.id)?.push(span(statement));
  const modifiers = sink.meta.entityModifiers.get(entity.id) ?? new Set<string>();
  modifiers.add(name);
  sink.meta.entityModifiers.set(entity.id, modifiers);
}

function applySharedModifier(name: string, entity: SceneEntity, statement: CallStatement, sink: Sink): boolean {
  if (isAuthorOnly(entity)) return false;
  switch (name) {
    case "color": {
      const color = argName(statement.args, 1);
      if (!color) return false;
      entity.color = color;
      if (entity.nativePaint) entity.nativePaint = false;
      return true;
    }
    case "opacity": {
      const value = argNumber(statement.args, 1);
      if (value === null) return false;
      entity.opacity = value;
      return true;
    }
    case "rot": {
      if (ENTITY3_KINDS.has(entity.kind)) return false;
      const deg = argNumber(statement.args, 1);
      if (deg === null) return false;
      entity.rotation = deg;
      return true;
    }
    case "savestate": {
      if (statement.args.length !== 1) return false;
      entity.savedState = true;
      return true;
    }
    case "hue": {
      const deg = argNumber(statement.args, 1);
      if (deg === null) return false;
      entity.hue = { deg, s: argNumber(statement.args, 2), l: argNumber(statement.args, 3) };
      return true;
    }
    case "z": {
      if (ENTITY3_KINDS.has(entity.kind)) return false;
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
      if (ENTITY3_KINDS.has(entity.kind)) return false;
      entity.sticky = true;
      return true;
    case "dashed":
      if (ENTITY3_KINDS.has(entity.kind)) return false;
      entity.dashed = { dash: argNumber(statement.args, 1), gap: argNumber(statement.args, 2) };
      return true;
    case "gradient": {
      const fillGradient = ["circle", "rect", "dot", "polygon", "particles", "boolean", "sector", "annulus"].includes(entity.kind);
      const pathGradient = ["line", "arrow", "link", "framebox", "brace", "bracelabel", "bracetext", "support", "plot", "deriv", "accum", "tangent", "lsystem", "invertpath", "reflectpath", "svg", "arc"].includes(entity.kind);
      const genericGradient = entity.kind === "repeat";
      if (!fillGradient && !pathGradient && !genericGradient) return false;
      const palette = new Set(CATALOG.colors);
      const stops: string[] = [];
      let index = 1;
      while (index < statement.args.length) {
        const color = argName(statement.args, index);
        if (!color || (!palette.has(color) && !/^#[0-9a-f]{3,8}$/iu.test(color))) break;
        stops.push(color);
        index += 1;
      }
      if (stops.length < 2) return false;
      const modeArg = statement.args[index];
      if (!modeArg) entity.gradient = { stops, mode: "auto", angle: 90 };
      else if (modeArg.type === "number" && index === statement.args.length - 1) entity.gradient = { stops, mode: "linear", angle: modeArg.value };
      else if (modeArg.type === "name" && modeArg.value === "radial" && fillGradient && index === statement.args.length - 1) entity.gradient = { stops, mode: "radial", angle: 90 };
      else if (modeArg.type === "name" && modeArg.value === "along" && pathGradient && index === statement.args.length - 1) entity.gradient = { stops, mode: "along", angle: 90 };
      else if (modeArg.type === "string" && (modeArg.value === "speed" || modeArg.value === "curvature") && pathGradient && index === statement.args.length - 1) entity.gradient = { stops, mode: modeArg.value, angle: 90 };
      else return false;
      return true;
    }
    case "plate": {
      if (entity.kind !== "text" && entity.kind !== "label") return false;
      const amount = argNumber(statement.args, 1);
      entity.plate = Math.max(0, Math.min(1, amount ?? 0.55));
      return true;
    }
    case "cursor":
      if (entity.kind !== "text" && entity.kind !== "label") return false;
      entity.cursor = true;
      return true;
    case "clip": {
      if (["caption", "mathparts", "particles"].includes(entity.kind) || ENTITY3_KINDS.has(entity.kind)) return false;
      const region = argName(statement.args, 1);
      if (!region) return false;
      entity.clip = region;
      return true;
    }
    case "mask": {
      if (["caption", "mathparts", "particles"].includes(entity.kind) || ENTITY3_KINDS.has(entity.kind)) return false;
      const region = argName(statement.args, 1);
      if (!region) return false;
      entity.mask = region;
      return true;
    }
    case "morph": {
      if (ENTITY3_KINDS.has(entity.kind) || ["caption", "mathparts", "particles", "parameter"].includes(entity.kind)) return false;
      const target = argName(statement.args, 1);
      const spin = argNumber(statement.args, 2);
      if (!target || target === entity.id || statement.args.length > 3 || (statement.args.length > 2 && spin === null)) return false;
      const targetEntity = sink.entityById.get(target);
      if (targetEntity && ENTITY3_KINDS.has(targetEntity.kind)) return false;
      entity.morph2 = { target, spin };
      return true;
    }
    case "pin3":
    case "label3": {
      if (!["text", "equation", "label"].includes(entity.kind)) return false;
      const at = argPoint3(statement.args, 1);
      const target = at ? null : argName(statement.args, 1);
      if (!at && !target) return false;
      if (name === "label3") {
        const worldHeight = argNumber(statement.args, 2);
        if (statement.args.length > 3 || (statement.args.length > 2 && worldHeight === null)) return false;
        entity.pin3 = { at, target, offset: { x: 0, y: 0 }, worldHeight: worldHeight === null ? null : Math.max(.001, worldHeight), form: "label3" };
      } else {
        const offsetArg = argPoint(statement.args, 2);
        if (statement.args.length > 3 || (statement.args.length > 2 && !offsetArg)) return false;
        entity.pin3 = { at, target, offset: offsetArg ?? { x: 0, y: 0 }, worldHeight: null, form: "pin3" };
      }
      return true;
    }
    case "follow3": {
      if (!ENTITY3_KINDS.has(entity.kind) || entity.kind === "camera3") return false;
      const target = argName(statement.args, 1), offset = argPoint3(statement.args, 2);
      if (!target || target === entity.id || !threePointReferences(sink.doc).includes(target) || statement.args.length > 3 || (statement.args.length === 3 && !offset)) return false;
      entity.follow3 = { target, offset: offset ?? { x: 0, y: 0, z: 0 } };
      return true;
    }
    case "thick": {
      if (!["line3", "arrow3", "curve3", "link3", "cube3", "sphere3", "prism3", "pyramid3", "midpoint3", "point3", "model3", "extrude3", "revolve3", "tube3", "project3", "projectpath3", "surface3", "domainsurface", "param3", "implicit3", "heightmap3", "contour3", "slice3", "tangentplane3", "gradient3", "vectorfield3", "trajectory3", "descend3", "linmap3", "collection3", "collection3data", "child3", "links3", "links3data", "ring3", "trail3", "historyplot3", "randomwalk3", "lsystem3", "hilbert3"].includes(entity.kind)) return false;
      const radius = argNumber(statement.args, 1);
      if (radius === null) return false;
      entity.thickness3 = radius;
      return true;
    }
    case "finish3": {
      if (!ENTITY3_KINDS.has(entity.kind) || ["camera3", "axes3", "frame3", "cross3", "assembly3", "volume3", "eigen3", "pieces3", "tree3"].includes(entity.kind)) return false;
      const raw = argString(statement.args, 1);
      if (raw === null || statement.args.length !== 2) return false;
      const finish = parseFinish3Spec(raw);
      if (!finish) return false;
      entity.finish3 = finish;
      return true;
    }
    case "morph3": {
      if (entity.kind !== "curve3") return false;
      const target = argName(statement.args, 1);
      const spin = argNumber(statement.args, 2);
      const targetEntity = target ? sink.entityById.get(target) : undefined;
      if (!target || targetEntity?.kind !== "curve3" || statement.args.length > 3 || (statement.args.length > 2 && spin === null)) return false;
      entity.morph3 = { target, spin };
      return true;
    }
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

/** Replace only one authored `if` / `else if` expression. The full expression
 * grammar is accepted; braces and branch bodies remain byte-identical. */
export function patchConditionalCondition(source: string, scene: SourceScene, conditionalId: string, branchIndex: number, expression: string): string {
  const conditional = scene.meta.conditionals.find((candidate) => candidate.id === conditionalId);
  const branch = conditional?.branches[branchIndex];
  if (!conditional || !branch?.conditionSpan) throw new ExprError("conditional branch is not editable");
  const next = expression.trim();
  if (!next) throw new ExprError("condition cannot be empty");
  parseExpr(lexTokens(next));
  const { start, end } = branch.conditionSpan;
  return `${source.slice(0, start)}${next}${source.slice(end)}`;
}

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

  // title(...) / canvas(...) / template(...) / voice(...)
  const setupInserts: string[] = [];
  if ((next.title ?? "") !== (prevDoc.title ?? "")) {
    const value = next.title?.trim() ?? "";
    if (meta.titleSpan) {
      edits.push(value
        ? { ...meta.titleSpan, text: `title("${escapeString(value)}");` }
        : deletion(source, meta.titleSpan));
    } else if (value) setupInserts.push(`title("${escapeString(value)}");`);
  }
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
  if (JSON.stringify(next.voice ?? null) !== JSON.stringify(prevDoc.voice ?? null)) {
    if (meta.voiceSpan) edits.push(next.voice ? { ...meta.voiceSpan, text: voiceLine(next.voice) } : deletion(source, meta.voiceSpan));
    else if (next.voice) setupInserts.push(voiceLine(next.voice));
  }
  if (setupInserts.length > 0) {
    const at = meta.templateSpan?.end ?? meta.canvasSpan?.end ?? meta.titleSpan?.end ?? 0;
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
    const colorWasExplicit = meta.entityModifiers.get(old.id)?.has("color") ?? false;
    const lines = entityLines(nextEntity, { includeColor: colorWasExplicit || nextEntity.color !== old.color });
    const anchor = meta.anchors.get(old.id);
    if (anchor) lines[0] = preserveAnchor(lines[0], nextEntity, anchor);
    const relations = relationLines(nextEntity);
    const text = lines.join("\n");
    if (spans.length > 0) {
      edits.push({ ...spans[0], text });
      for (const one of spans.slice(1)) edits.push(deletion(source, one));
      if (relations.length > 0) appends.push(relations.join("\n"));
    } else {
      appends.push([...lines, ...relations].join("\n"));
    }
  }
  const renameTargets = new Set(renames.values());
  for (const entity of nextEntities) {
    if (!prevIds.has(entity.id) && !renameTargets.has(entity.id)) appends.push([...entityLines(entity), ...relationLines(entity)].join("\n"));
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
    if (!nextSteps[index].timed && nextSteps[index].actions.length === 0) edits.push(deletion(source, prevSteps[index].span));
    else edits.push({ ...prevSteps[index].span, text: stepSourceText(nextSteps[index], prevSteps[index].form) });
  }
  for (let index = nextSteps.length; index < prevSteps.length; index += 1) {
    edits.push(deletion(source, prevSteps[index].span));
  }
  for (let index = prevSteps.length; index < nextSteps.length; index += 1) {
    if (nextSteps[index].timed || nextSteps[index].actions.length > 0) appends.push(stepSourceText(nextSteps[index], nextSteps[index].timed ? "timed" : "step"));
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
  if (step.timed || form === "timed") return timedStepLines(step).join("\n");
  if (step.actions.length === 1 && verbDef(step.actions[0].verb)?.placement === "timeline") return actionLine(step.actions[0]);
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
