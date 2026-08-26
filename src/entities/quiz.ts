// Creator quiz and timing workflow. Native Preview owns generated pixels and
// playback; Canvas owns the editable question, answers, timing, and regions.

import { argName, argNumber, argPoint, argString, escapeString, latexLiteral, num, pt } from "../args.js";
import { registerEntity, type Box } from "../registry.js";
import type {
  CountdownEntity, CreatorSafe, QuizDensity, QuizEntity, QuizLabels, QuizLayout,
  QuizMotion, QuizPace, QuizReveal, QuizSkin, QuizTiming, SceneDoc, TimerLook,
  TimerStyle, TimingEntity, TimingPhase,
} from "../types.js";
import { baseEntity } from "./base.js";
import { publishingSafeBox } from "./publishing.js";

const textLiteral = (value: string): string => `"${escapeString(value)}"`;
const SKINS: QuizSkin[] = ["studio", "badge", "minimal", "glass", "plain"];
const REVEALS: QuizReveal[] = ["type", "fade", "rise", "pop", "cut"];
const LAYOUTS: QuizLayout[] = ["auto", "stack", "grid", "media-first"];
const DENSITIES: QuizDensity[] = ["compact", "comfortable", "spacious"];
const LABELS: QuizLabels[] = ["letters", "numbers", "none"];
const LOOKS: TimerLook[] = ["ring", "bar", "number", "segments", "ticks", "pulse", "none"];
const PACES: QuizPace[] = ["quick", "balanced", "calm", "dramatic"];
const MOTIONS: QuizMotion[] = ["calm", "studio", "punch", "cut"];
const SAFES: CreatorSafe[] = ["shorts", "reels", "tiktok", "clean"];

export function defaultTimerStyle(look: TimerLook = "ring"): TimerStyle {
  return { look, position: "auto", number: "inside", direction: "drain", finish: "fade", font: "mono", size: 1, thickness: 1, color: null, track: null, label: "" };
}

export function timingPreset(pace: QuizPace): QuizTiming {
  const values: Record<QuizPace, [number, number, number, number, number, number]> = {
    quick: [.7, .7, 3, .5, 2.1, .045], balanced: [1.4, 1.2, 5, .8, 3.6, .065],
    calm: [1.8, 1.6, 7, 1, 3.6, .09], dramatic: [1.1, 1.4, 5, .9, 3.6, .075],
  };
  const [ask, options, think, reveal, hold, stagger] = values[pace];
  return { pace, ask, options, think, reveal, hold, stagger };
}

export function effectiveQuizTiming(entity: QuizEntity): QuizTiming {
  if (entity.timing) return entity.timing;
  const out = timingPreset(entity.pace);
  if (entity.seconds !== null) out.think = entity.seconds;
  return out;
}

export function workflowDuration(entity: QuizEntity | CountdownEntity | TimingEntity): number {
  if (entity.kind === "quiz") {
    const timing = effectiveQuizTiming(entity);
    return timing.ask + timing.options + timing.think + timing.reveal + timing.hold;
  }
  if (entity.kind === "countdown") return entity.seconds;
  return entity.phases.reduce((sum, phase) => sum + phase.duration, 0);
}

function alias<T extends string>(value: string, table: Record<string, T>): T | null {
  return table[value.trim().toLowerCase()] ?? null;
}

function safeValue(value: string): CreatorSafe | null {
  return alias(value, { shorts: "shorts", short: "shorts", youtube: "shorts", reels: "reels", reel: "reels", instagram: "reels", tiktok: "tiktok", tt: "tiktok", clean: "clean", none: "clean", canvas: "clean" });
}

function lookValue(value: string): TimerLook | null {
  return alias(value, { ring: "ring", circle: "ring", bar: "bar", progress: "bar", line: "bar", number: "number", digit: "number", digits: "number", segments: "segments", segment: "segments", blocks: "segments", ticks: "ticks", tick: "ticks", radial: "ticks", pulse: "pulse", beat: "pulse", none: "none", off: "none", hidden: "none" });
}

function paceValue(value: string): QuizPace | null {
  return alias(value, { quick: "quick", fast: "quick", balanced: "balanced", default: "balanced", normal: "balanced", calm: "calm", slow: "calm", dramatic: "dramatic", drama: "dramatic" });
}

function parseNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTimerStyle(base: TimerStyle, spec: string): TimerStyle | null {
  const out = { ...base };
  for (const token of spec.split(/\s+/u).filter(Boolean)) {
    const split = token.indexOf("=");
    const rawKey = split < 0 ? "" : token.slice(0, split), value = split < 0 ? token : token.slice(split + 1);
    const key = rawKey.toLowerCase();
    if (!key || ["look", "timer", "style"].includes(key)) { const look = lookValue(value); if (!look) return null; out.look = look; }
    else if (key === "position" || key === "pos") { const next = alias(value, { auto: "auto", header: "header", top: "header", media: "media", figure: "media", below: "below", bottom: "below", choices: "below" }); if (!next) return null; out.position = next; }
    else if (key === "number" || key === "digit") { const next = alias(value, { inside: "inside", in: "inside", on: "inside", outside: "outside", out: "outside", none: "none", off: "none", hidden: "none" }); if (!next) return null; out.number = next; }
    else if (key === "direction" || key === "dir") { const next = alias(value, { drain: "drain", down: "drain", countdown: "drain", fill: "fill", up: "fill", countup: "fill" }); if (!next) return null; out.direction = next; }
    else if (key === "finish" || key === "end") { const next = alias(value, { fade: "fade", hide: "fade", hold: "hold", stay: "hold", flash: "flash", pulse: "pulse", pop: "pulse" }); if (!next) return null; out.finish = next; }
    else if (key === "font" || key === "digits") { const next = alias(value, { mono: "mono", monospace: "mono", display: "display", bold: "display" }); if (!next) return null; out.font = next; }
    else if (key === "size") { const sizes: Record<string, number> = { small: .78, sm: .78, medium: 1, md: 1, normal: 1, large: 1.28, lg: 1.28 }; const numeric = sizes[value.toLowerCase()] ?? parseNumber(value); if (numeric === null) return null; out.size = Math.max(.5, Math.min(2, numeric)); }
    else if (key === "thickness" || key === "stroke") { const numeric = parseNumber(value); if (numeric === null) return null; out.thickness = Math.max(.4, Math.min(3, numeric)); }
    else if (["color", "colour", "accent"].includes(key)) out.color = value;
    else if (["track", "trackcolor", "trackcolour"].includes(key)) out.track = value;
    else if (key === "label") out.label = value.replaceAll("_", " ");
    else return null;
  }
  return out.look === "number" && out.number === "none" ? null : out;
}

function timerStyleSpec(style: TimerStyle): string {
  const parts = [`look=${style.look}`, `position=${style.position}`, `number=${style.number}`, `direction=${style.direction}`, `size=${num(style.size)}`, `thickness=${num(style.thickness)}`];
  if (style.color) parts.push(`color=${style.color}`);
  if (style.track) parts.push(`track=${style.track}`);
  if (style.label) parts.push(`label=${style.label.trim().replaceAll(/\s+/gu, "_")}`);
  parts.push(`font=${style.font}`, `finish=${style.finish}`);
  return parts.join(" ");
}

function timerStyleIsDefault(style: TimerStyle, look: TimerLook = "ring"): boolean {
  return JSON.stringify(style) === JSON.stringify(defaultTimerStyle(look));
}

function parseQuizSpec(spec: string | null): Omit<QuizEntity, keyof ReturnType<typeof baseEntity> | "kind" | "id" | "question" | "options" | "explanation" | "explanationSource" | "timing" | "timerStyle"> | null {
  let skin: QuizSkin = "studio", questionReveal: QuizReveal = "type", layout: QuizLayout = "auto", density: QuizDensity = "comfortable", labels: QuizLabels = "letters", timerLook: TimerLook = "ring", pace: QuizPace = "balanced", seconds: number | null = null, motion: QuizMotion = "studio", safe: CreatorSafe = "shorts", accent: string | null = null;
  for (const token of (spec ?? "").split(/\s+/u).filter(Boolean)) {
    const split = token.indexOf("=");
    const rawKey = split < 0 ? "" : token.slice(0, split), value = split < 0 ? token : token.slice(split + 1), key = rawKey.toLowerCase();
    if (!key) {
      const reveal = alias(value, { type: "type", typewriter: "type", fade: "fade", fadein: "fade", rise: "rise", slide: "rise", slideup: "rise", pop: "pop", grow: "pop", wordpop: "pop", cut: "cut", instant: "cut", show: "cut", none: "cut" });
      const nextSkin = alias(value, { studio: "studio", default: "studio", clean: "studio", badge: "badge", bold: "badge", card: "badge", minimal: "minimal", editorial: "minimal", simple: "minimal", glass: "glass", neon: "glass", reels: "glass", plain: "plain", flat: "plain", basic: "plain" });
      if (reveal) questionReveal = reveal; else if (nextSkin) skin = nextSkin; else return null;
    } else if (key === "skin" || key === "style") { const next = alias(value, { studio: "studio", default: "studio", clean: "studio", badge: "badge", bold: "badge", card: "badge", minimal: "minimal", editorial: "minimal", simple: "minimal", glass: "glass", neon: "glass", reels: "glass", plain: "plain", flat: "plain", basic: "plain" }); if (!next) return null; skin = next; }
    else if (key === "reveal") { const next = alias(value, { type: "type", typewriter: "type", fade: "fade", fadein: "fade", rise: "rise", slide: "rise", slideup: "rise", pop: "pop", grow: "pop", wordpop: "pop", cut: "cut", instant: "cut", show: "cut", none: "cut" }); if (!next) return null; questionReveal = next; }
    else if (key === "layout") { const next = alias(value, { auto: "auto", stack: "stack", column: "stack", grid: "grid", "media-first": "media-first", media: "media-first", visual: "media-first" }); if (!next) return null; layout = next; }
    else if (key === "density") { const next = alias(value, { compact: "compact", tight: "compact", comfortable: "comfortable", normal: "comfortable", spacious: "spacious", airy: "spacious" }); if (!next) return null; density = next; }
    else if (["labels", "label", "indices"].includes(key)) { const next = alias(value, { letters: "letters", letter: "letters", alpha: "letters", abcd: "letters", numbers: "numbers", number: "numbers", numeric: "numbers", "1234": "numbers", none: "none", off: "none", hidden: "none" }); if (!next) return null; labels = next; }
    else if (key === "timer") { const next = lookValue(value); if (!next) return null; timerLook = next; }
    else if (key === "pace" || key === "timing") { const next = paceValue(value); if (!next) return null; pace = next; }
    else if (key === "seconds" || key === "think") { const next = parseNumber(value); if (next === null || next <= 0) return null; seconds = next; }
    else if (key === "motion") { const next = alias(value, { calm: "calm", soft: "calm", studio: "studio", default: "studio", punch: "punch", energetic: "punch", cut: "cut", none: "cut" }); if (!next) return null; motion = next; }
    else if (key === "safe" || key === "platform") { const next = safeValue(value); if (!next) return null; safe = next; }
    else if (key === "accent") accent = value;
    else return null;
  }
  return { skin, questionReveal, layout, density, labels, timerLook, pace, seconds, motion, safe, accent };
}

function quizSpec(entity: QuizEntity): string {
  const parts: string[] = [];
  if (entity.skin !== "studio") parts.push(`skin=${entity.skin}`);
  if (entity.questionReveal !== "type") parts.push(`reveal=${entity.questionReveal}`);
  if (entity.layout !== "auto") parts.push(`layout=${entity.layout}`);
  if (entity.density !== "comfortable") parts.push(`density=${entity.density}`);
  if (entity.labels !== "letters") parts.push(`labels=${entity.labels}`);
  if (entity.timerLook !== "ring") parts.push(`timer=${entity.timerLook}`);
  if (entity.pace !== "balanced") parts.push(`pace=${entity.pace}`);
  if (entity.seconds !== null) parts.push(`seconds=${num(entity.seconds)}`);
  if (entity.motion !== "studio") parts.push(`motion=${entity.motion}`);
  if (entity.safe !== "shorts") parts.push(`safe=${entity.safe}`);
  if (entity.accent) parts.push(`accent=${entity.accent}`);
  return parts.join(" ");
}

function parseQuizTiming(entity: QuizEntity, spec: string): QuizTiming | null {
  let out = { ...effectiveQuizTiming(entity) };
  for (const token of spec.split(/\s+/u).filter(Boolean)) {
    const split = token.indexOf("=");
    const key = split < 0 ? "" : token.slice(0, split).toLowerCase(), value = split < 0 ? token : token.slice(split + 1);
    if (!key || key === "pace" || key === "preset") { const pace = paceValue(value); if (!pace) return null; out = timingPreset(pace); }
  }
  for (const token of spec.split(/\s+/u).filter(Boolean)) {
    const split = token.indexOf("=");
    const key = split < 0 ? "" : token.slice(0, split).toLowerCase(), value = split < 0 ? token : token.slice(split + 1);
    if (!key || key === "pace" || key === "preset") continue;
    const amount = parseNumber(value); if (amount === null) return null;
    if (key === "ask" || key === "question") out.ask = amount;
    else if (key === "options" || key === "answers") out.options = amount;
    else if (["think", "seconds", "countdown"].includes(key)) out.think = amount;
    else if (key === "reveal" || key === "answer") out.reveal = amount;
    else if (key === "hold" || key === "endhold") out.hold = amount;
    else if (key === "stagger") out.stagger = amount;
    else return null;
  }
  return out.ask >= 0 && out.options > 0 && out.think > 0 && out.reveal >= 0 && out.hold >= 0 && out.stagger >= 0 ? out : null;
}

function timingSpec(timing: QuizTiming): string {
  return `${timing.pace} ask=${num(timing.ask)} options=${num(timing.options)} think=${num(timing.think)} reveal=${num(timing.reveal)} hold=${num(timing.hold)} stagger=${num(timing.stagger)}`;
}

export interface QuizRegions { header: Box; media: Box; choices: Box; timer: Box; footer: Box; }

function subbox(box: Box, x0: number, y0: number, x1: number, y1: number): Box {
  return { x: box.x + box.width * x0, y: box.y + box.height * y0, width: box.width * (x1 - x0), height: box.height * (y1 - y0) };
}

export function quizRegions(entity: QuizEntity, doc?: SceneDoc): QuizRegions {
  const safe = publishingSafeBox(doc, entity.safe), size = doc?.size ?? (doc?.format === "portrait" ? { width: 720, height: 1280 } : doc?.format === "square" ? { width: 720, height: 720 } : { width: 1280, height: 720 });
  const tall = size.height / size.width >= 1.34, mediaEnd = entity.layout === "media-first" ? .48 : .43;
  return tall ? {
    header: subbox(safe, 0, 0, 1, .17), media: subbox(safe, .04, .19, .96, mediaEnd), choices: subbox(safe, 0, mediaEnd + .02, 1, .76), timer: subbox(safe, .12, .78, .88, .88), footer: subbox(safe, 0, .91, 1, 1),
  } : {
    header: subbox(safe, 0, 0, .46, .34), media: subbox(safe, 0, .38, .46, .88), choices: subbox(safe, .52, .02, 1, .74), timer: subbox(safe, .56, .77, .96, .88), footer: subbox(safe, 0, .92, 1, 1),
  };
}

export function quizOptionBoxes(entity: QuizEntity, doc?: SceneDoc): Box[] {
  const choices = quizRegions(entity, doc).choices, count = Math.max(1, entity.options.length);
  const gapX = choices.width * .03, gapY = choices.height * .04;
  const stack = entity.layout === "stack" || (entity.layout !== "grid" && count <= 3);
  if (stack) {
    const height = Math.min(choices.height * .23, (choices.height - gapY * (count - 1)) / count);
    const total = count * height + (count - 1) * gapY, y0 = choices.y + (choices.height - total) / 2;
    return entity.options.map((_option, index) => ({ x: choices.x + choices.width * .03, y: y0 + index * (height + gapY), width: choices.width * .94, height }));
  }
  const rows = Math.ceil(count / 2), width = (choices.width - gapX) / 2, height = Math.min(choices.height * .28, (choices.height - gapY * (rows - 1)) / rows);
  const total = rows * height + (rows - 1) * gapY, y0 = choices.y + (choices.height - total) / 2;
  return entity.options.map((_option, index) => {
    const row = Math.floor(index / 2), single = count % 2 === 1 && row === rows - 1, col = index % 2;
    return { x: single ? choices.x + (choices.width - width) / 2 : choices.x + col * (width + gapX), y: y0 + row * (height + gapY), width, height };
  });
}

function quizDefaults(id: string): QuizEntity {
  return { ...baseEntity(id, "fg"), kind: "quiz", question: "What should the viewer decide?", skin: "studio", questionReveal: "type", layout: "auto", density: "comfortable", labels: "letters", timerLook: "ring", pace: "balanced", seconds: null, motion: "studio", safe: "shorts", accent: null, options: [{ text: "First answer", correct: false }, { text: "Correct answer", correct: true }], explanation: "", explanationSource: "", timing: null, timerStyle: null };
}

registerEntity<QuizEntity>({
  kind: "quiz", ctor: "quiz", group: "Publishing", label: "Quiz", icon: "?", order: 63,
  hint: "Responsive question, answer cards, timer, reveal, and explanation", movable: false,
  create: (id) => quizDefaults(id),
  parseArgs(stmt) {
    const id = argName(stmt.args, 0), question = argString(stmt.args, 1), parsed = parseQuizSpec(argString(stmt.args, 2));
    if (!id || question === null || stmt.args.length > 3 || !parsed) return null;
    return { ...quizDefaults(id), question, ...parsed, options: [] };
  },
  ctorLine(entity) { const spec = quizSpec(entity); return `quiz(${entity.id}, ${latexLiteral(entity.question)}${spec ? `, ${textLiteral(spec)}` : ""});`; },
  extraLines(entity) {
    const lines = entity.options.map((option) => `option(${entity.id}, ${latexLiteral(option.text)}${option.correct ? ", correct" : ""});`);
    if (entity.explanation) lines.push(`explain(${entity.id}, ${latexLiteral(entity.explanation)}${entity.explanationSource ? `, ${latexLiteral(entity.explanationSource)}` : ""});`);
    if (entity.timing) lines.push(`timing(${entity.id}, ${textLiteral(timingSpec(entity.timing))});`);
    if (entity.timerStyle) lines.push(`timerstyle(${entity.id}, ${textLiteral(timerStyleSpec(entity.timerStyle))});`);
    return lines;
  },
  modifiers: {
    option(entity, stmt) {
      const id = argName(stmt.args, 0), text = argString(stmt.args, 1), correct = argName(stmt.args, 2) === "correct";
      if (id !== entity.id || text === null || stmt.args.length > 3 || entity.options.length >= 6 || (correct && entity.options.some((option) => option.correct)) || (entity.layout === "stack" && entity.options.length >= 4)) return false;
      entity.options.push({ text, correct }); return true;
    },
    explain(entity, stmt) {
      const id = argName(stmt.args, 0), explanation = argString(stmt.args, 1), source = argString(stmt.args, 2);
      if (id !== entity.id || explanation === null || stmt.args.length > 3 || (stmt.args.length === 3 && source === null)) return false;
      entity.explanation = explanation; entity.explanationSource = source ?? ""; return true;
    },
    timing(entity, stmt) {
      const id = argName(stmt.args, 0), spec = argString(stmt.args, 1);
      if (id !== entity.id || spec === null || stmt.args.length !== 2) return false;
      const timing = parseQuizTiming(entity, spec); if (!timing) return false; entity.timing = timing; return true;
    },
    timerstyle(entity, stmt) {
      const id = argName(stmt.args, 0), spec = argString(stmt.args, 1);
      if (id !== entity.id || spec === null || stmt.args.length !== 2) return false;
      const style = parseTimerStyle(entity.timerStyle ?? defaultTimerStyle(entity.timerLook), spec); if (!style) return false; entity.timerStyle = style; return true;
    },
  },
  referenceIds(entity) {
    const refs = [`${entity.id}.parts`, `${entity.id}.question`, `${entity.id}.q`, `${entity.id}.options`, `${entity.id}.timer`];
    entity.options.forEach((_option, index) => refs.push(`${entity.id}.option.${String.fromCharCode(97 + index)}`, `${entity.id}.c${index}`, `${entity.id}.t${index}`));
    if (entity.options.some((option) => option.correct)) refs.push(`${entity.id}.option.correct`);
    if (entity.explanation) refs.push(`${entity.id}.explanation`, `${entity.id}.explain`);
    if (entity.explanationSource) refs.push(`${entity.id}.source`);
    return refs;
  },
  referenceBounds(entity, ref, ctx) {
    const regions = quizRegions(entity, ctx?.doc), cards = quizOptionBoxes(entity, ctx?.doc);
    if ([`${entity.id}.parts`, entity.id].includes(ref)) return { x: Math.min(regions.header.x, regions.choices.x), y: Math.min(regions.header.y, regions.choices.y), width: Math.max(regions.header.x + regions.header.width, regions.choices.x + regions.choices.width) - Math.min(regions.header.x, regions.choices.x), height: regions.timer.y + regions.timer.height - Math.min(regions.header.y, regions.choices.y) };
    if ([`${entity.id}.question`, `${entity.id}.q`].includes(ref)) return regions.header;
    if (ref === `${entity.id}.options`) return regions.choices;
    if (ref === `${entity.id}.timer` || ref === `${entity.id}.explanation` || ref === `${entity.id}.explain` || ref === `${entity.id}.source`) return regions.timer;
    const match = ref.match(new RegExp(`^${entity.id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\.(?:option\\.([a-f])|[ct](\\d+))$`, "u"));
    const index = match?.[1] ? match[1].charCodeAt(0) - 97 : match?.[2] ? Number(match[2]) : -1;
    return cards[index] ?? null;
  },
  anchor(entity, ctx) { const region = quizRegions(entity, ctx?.doc).header; return { x: region.x + region.width / 2, y: region.y + region.height / 2 }; },
  translate() {}, bounds(entity, ctx) { const regions = quizRegions(entity, ctx?.doc); return { x: Math.min(regions.header.x, regions.choices.x), y: Math.min(regions.header.y, regions.choices.y), width: Math.max(regions.header.x + regions.header.width, regions.choices.x + regions.choices.width) - Math.min(regions.header.x, regions.choices.x), height: regions.timer.y + regions.timer.height - Math.min(regions.header.y, regions.choices.y) }; },
  handles: () => [], dragHandle() {},
  fields: [
    { key: "question", label: "Question", input: "textarea" }, { key: "skin", label: "Skin", input: "select", options: SKINS }, { key: "questionReveal", label: "Question reveal", input: "select", options: REVEALS },
    { key: "layout", label: "Answer layout", input: "select", options: LAYOUTS }, { key: "density", label: "Card density", input: "select", options: DENSITIES }, { key: "labels", label: "Answer labels", input: "select", options: LABELS },
    { key: "timerLook", label: "Timer look", input: "select", options: LOOKS }, { key: "pace", label: "Pace", input: "select", options: PACES }, { key: "seconds", label: "Think seconds", input: "number", nullable: true, min: .1, step: .1, hint: "Empty uses the selected pace." },
    { key: "motion", label: "Motion style", input: "select", options: MOTIONS }, { key: "safe", label: "Safe-area profile", input: "select", options: SAFES }, { key: "accent", label: "Accent", input: "color", nullable: true },
  ],
});

function parsePhases(spec: string): TimingPhase[] | null {
  const phases: TimingPhase[] = [];
  for (const token of spec.split(/\s+/u).filter(Boolean)) {
    const split = token.indexOf("="); if (split <= 0) return null;
    let name = token.slice(0, split).toLowerCase(), duration = parseNumber(token.slice(split + 1));
    if (!/^[a-z_][a-z0-9_-]*$/u.test(name) || duration === null || duration <= 0) return null;
    if (name === "duration" || name === "total") { if (phases.length > 0) return null; name = "main"; }
    if (phases.some((phase) => phase.name === name)) return null;
    phases.push({ name, duration });
  }
  return phases.length > 0 && phases.length <= 32 ? phases : null;
}

function timingBounds(entity: TimingEntity, doc?: SceneDoc): Box {
  const size = doc?.size ?? (doc?.format === "portrait" ? { width: 720, height: 1280 } : doc?.format === "square" ? { width: 720, height: 720 } : { width: 1280, height: 720 });
  const ui = Math.max(.55, Math.min(1.45, Math.min(size.width, size.height) / 1080));
  const width = Math.max(260 * ui, Math.min(560 * ui, size.width * .36)), height = 150 * ui;
  const center = entity.responsive ? { x: size.width - 90 * ui, y: 90 * ui } : entity;
  return { x: center.x - width / 2, y: center.y - height / 2, width, height };
}

registerEntity<TimingEntity>({
  kind: "timing", ctor: "timing", group: "Publishing", label: "Timing controller", icon: "◷", order: 64,
  hint: "Named phases with an optional native clock and run playback", anchorArgIndex: 1,
  create(id, x, y) { return { ...baseEntity(id, "fg"), kind: "timing", x, y, responsive: false, phases: [{ name: "main", duration: 6 }], timerStyle: defaultTimerStyle() }; },
  parseArgs(stmt, doc) {
    const id = argName(stmt.args, 0); if (!id) return null;
    const at = argPoint(stmt.args, 1), specIndex = at ? 2 : 1, spec = argString(stmt.args, specIndex), phases = spec === null ? null : parsePhases(spec);
    if (!phases || stmt.args.length !== specIndex + 1) return null;
    const size = doc?.size ?? (doc?.format === "portrait" ? { width: 720, height: 1280 } : doc?.format === "square" ? { width: 720, height: 720 } : { width: 1280, height: 720 }), ui = Math.max(.55, Math.min(1.45, Math.min(size.width, size.height) / 1080));
    return { ...baseEntity(id, "fg"), kind: "timing", x: at?.x ?? size.width - 90 * ui, y: at?.y ?? 90 * ui, responsive: !at, phases, timerStyle: defaultTimerStyle() };
  },
  ctorLine(entity) { return `timing(${entity.id}${entity.responsive ? "" : `, ${pt(entity.x, entity.y)}`}, ${textLiteral(entity.phases.map((phase) => `${phase.name}=${num(phase.duration)}`).join(" "))});`; },
  extraLines(entity) { return timerStyleIsDefault(entity.timerStyle) ? [] : [`timerstyle(${entity.id}, ${textLiteral(timerStyleSpec(entity.timerStyle))});`]; },
  modifiers: { timerstyle(entity, stmt) { const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1), specIndex = at ? 2 : 1, spec = argString(stmt.args, specIndex); if (id !== entity.id || spec === null || stmt.args.length !== specIndex + 1) return false; const style = parseTimerStyle(entity.timerStyle, spec); if (!style) return false; if (at) { entity.x = at.x; entity.y = at.y; entity.responsive = false; } entity.timerStyle = style; return true; } },
  referenceIds: (entity) => [`${entity.id}.parts`, `${entity.id}.timer`],
  referenceBounds: (entity, ref, ctx) => [`${entity.id}.parts`, `${entity.id}.timer`].includes(ref) ? timingBounds(entity, ctx?.doc) : null,
  anchor(entity, ctx) { const box = timingBounds(entity, ctx?.doc); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, translate(entity, dx, dy) { entity.x += dx; entity.y += dy; entity.responsive = false; },
  bounds: (entity, ctx) => timingBounds(entity, ctx?.doc), handles: () => [], dragHandle() {},
  fields: [{ key: "responsive", label: "Responsive top-right position", input: "checkbox" }],
});

function countdownBounds(entity: CountdownEntity, doc?: SceneDoc): Box {
  const size = doc?.size ?? (doc?.format === "portrait" ? { width: 720, height: 1280 } : doc?.format === "square" ? { width: 720, height: 720 } : { width: 1280, height: 720 });
  const ui = Math.max(.55, Math.min(1.45, Math.min(size.width, size.height) / 1080));
  return { x: entity.x - size.width * .34, y: entity.y - 90 * ui, width: size.width * .68, height: 180 * ui };
}

registerEntity<CountdownEntity>({
  kind: "countdown", ctor: "countdown", group: "Publishing", label: "Countdown", icon: "◴", order: 65,
  hint: "Standalone native timer widget played with Run", anchorArgIndex: 1,
  create(id, x, y) { return { ...baseEntity(id, "fg"), kind: "countdown", x, y, seconds: 5, timerStyle: defaultTimerStyle() }; },
  parseArgs(stmt, doc) {
    const id = argName(stmt.args, 0); if (!id || stmt.args.length > 4) return null;
    const size = doc?.size ?? (doc?.format === "portrait" ? { width: 720, height: 1280 } : doc?.format === "square" ? { width: 720, height: 720 } : { width: 1280, height: 720 });
    const at = argPoint(stmt.args, 1) ?? { x: size.width / 2, y: size.height / 2 }, seconds = argNumber(stmt.args, 2) ?? 5, spec = argString(stmt.args, 3);
    if ((stmt.args.length >= 2 && !argPoint(stmt.args, 1)) || (stmt.args.length >= 3 && argNumber(stmt.args, 2) === null) || (stmt.args.length === 4 && spec === null)) return null;
    const style = spec === null ? defaultTimerStyle() : parseTimerStyle(defaultTimerStyle(), spec); if (!style) return null;
    return { ...baseEntity(id, "fg"), kind: "countdown", x: at.x, y: at.y, seconds: Math.max(1, seconds), timerStyle: style };
  },
  ctorLine(entity) { return `countdown(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.seconds)}${timerStyleIsDefault(entity.timerStyle) ? "" : `, ${textLiteral(timerStyleSpec(entity.timerStyle))}`});`; },
  extraLines: () => [], modifiers: {}, referenceIds: (entity) => [`${entity.id}.parts`, `${entity.id}.timer`],
  referenceBounds: (entity, ref, ctx) => [`${entity.id}.parts`, `${entity.id}.timer`].includes(ref) ? countdownBounds(entity, ctx?.doc) : null,
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate(entity, dx, dy) { entity.x += dx; entity.y += dy; }, bounds: (entity, ctx) => countdownBounds(entity, ctx?.doc), handles: () => [], dragHandle() {},
  fields: [{ key: "seconds", label: "Seconds", input: "number", min: 1, step: .5 }],
});

export { parseTimerStyle, timerStyleSpec };
