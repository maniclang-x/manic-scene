// Deterministic playback: a generic driver that compiles the scene's steps
// into per-entity keyframes by delegating each action to its verb definition.
// Mirrors manic's model — constructors set the state at t=0, verbs tween
// properties, steps play in order — so what the editor plays is an honest
// approximation of what the engine renders.

import { entityAnchor } from "./model.js";
import { verbDef, wordCount, type BaseProp, type VerbApplyCtx, type WordFx } from "./registry.js";
import type { EaseName, SceneDoc, SceneEntity } from "./types.js";

export interface WordsFrame {
  /** karaoke: highest word index already highlighted (-1 = none). */
  highlightUpTo: number;
  highlightColor: string | null;
  /** wordpop: per-word pop progress 0..1; null = no pop effect. */
  pop: number[] | null;
}

export interface EntityFrame {
  x: number;
  y: number;
  opacity: number;
  scale: number;
  rotation: number;
  /** 0..1 stroke trace progress (untraced → draw). */
  draw: number;
  /** 0..1 typewriter progress (type). */
  type: number;
  /** Transient color flash. */
  flash: { color: string; amount: number } | null;
  /** Extra channels written by verbs (e.g. `to(id, hue, …)` → aux.hue). */
  aux: Record<string, number>;
  /** Caption word effects. */
  words: WordsFrame | null;
}

export interface StepWindow { name: string; start: number; end: number; }

export interface CompiledScene {
  duration: number;
  steps: StepWindow[];
  sample(time: number): Map<string, EntityFrame>;
}

interface Keyframe { t: number; v: number; ease: EaseName | "hold"; }
interface FlashWindow { start: number; end: number; color: string; }

interface EntityTracks {
  entity: SceneEntity;
  props: Record<BaseProp, Keyframe[]>;
  aux: Map<string, Keyframe[]>;
  flashes: FlashWindow[];
  wordfx: WordFx[];
}

export function compileScene(doc: SceneDoc): CompiledScene {
  const tracks = new Map<string, EntityTracks>();
  const typed = new Set<string>();
  for (const step of doc.steps) {
    for (const action of step.actions) if (action.verb === "type") typed.add(action.target);
  }
  for (const entity of doc.entities) {
    const anchor = entityAnchor(entity);
    tracks.set(entity.id, {
      entity,
      props: {
        x: [{ t: 0, v: anchor.x, ease: "hold" }],
        y: [{ t: 0, v: anchor.y, ease: "hold" }],
        opacity: [{ t: 0, v: entity.reveal === "none" ? entity.opacity : 0, ease: "hold" }],
        scale: [{ t: 0, v: entity.reveal === "grow" ? 0 : 1, ease: "hold" }],
        rotation: [{ t: 0, v: entity.rotation, ease: "hold" }],
        draw: [{ t: 0, v: entity.untraced ? 0 : 1, ease: "hold" }],
        type: [{ t: 0, v: typed.has(entity.id) ? 0 : 1, ease: "hold" }],
      },
      aux: new Map(),
      flashes: [],
      wordfx: [],
    });
  }

  const steps: StepWindow[] = [];
  let cursor = 0;
  for (const step of doc.steps) {
    if (step.actions.length === 0) continue;
    let offset = 0;
    let stepEnd = cursor;
    for (const action of step.actions) {
      const verb = verbDef(action.verb);
      if (!verb) continue;
      const track = action.target ? tracks.get(action.target) : undefined;
      const beat = Math.max(0.01, verb.beatDur(action, track?.entity ?? null));
      const start = cursor + offset;
      const end = start + beat;
      stepEnd = Math.max(stepEnd, end);
      if (step.mode === "sequence") offset += beat;
      else if (step.mode === "stagger") offset += Math.max(0, step.gap);
      if (track) verb.apply(applyCtx(track), action, start, end);
    }
    steps.push({ name: step.name, start: cursor, end: stepEnd });
    cursor = stepEnd;
  }

  for (const track of tracks.values()) {
    for (const list of Object.values(track.props)) list.sort(byTime);
    for (const list of track.aux.values()) list.sort(byTime);
  }

  return {
    duration: cursor,
    steps,
    sample(time: number): Map<string, EntityFrame> {
      const frame = new Map<string, EntityFrame>();
      for (const [id, track] of tracks) {
        const flash = track.flashes.find((window) => time >= window.start && time <= window.end) ?? null;
        const aux: Record<string, number> = {};
        for (const [name, list] of track.aux) aux[name] = valueAt(list, time);
        frame.set(id, {
          x: valueAt(track.props.x, time),
          y: valueAt(track.props.y, time),
          opacity: valueAt(track.props.opacity, time),
          scale: valueAt(track.props.scale, time),
          rotation: valueAt(track.props.rotation, time),
          draw: valueAt(track.props.draw, time),
          type: valueAt(track.props.type, time),
          flash: flash
            ? { color: flash.color, amount: triangle((time - flash.start) / Math.max(0.01, flash.end - flash.start)) }
            : null,
          aux,
          words: wordsFrame(track, time),
        });
      }
      return frame;
    },
  };
}

function applyCtx(track: EntityTracks): VerbApplyCtx {
  return {
    entity: track.entity,
    tween(prop, start, end, target, ease) {
      const list = track.props[prop];
      list.push({ t: start, v: valueAt(list, start), ease: "hold" });
      list.push({ t: end, v: target, ease });
    },
    valueAt: (prop, time) => valueAt(track.props[prop], time),
    auxTween(name, start, end, target, ease, initial) {
      let list = track.aux.get(name);
      if (!list) {
        list = [{ t: 0, v: initial, ease: "hold" }];
        track.aux.set(name, list);
      }
      list.push({ t: start, v: valueAt(list, start), ease: "hold" });
      list.push({ t: end, v: target, ease });
    },
    flash(start, end, color) { track.flashes.push({ start, end, color }); },
    wordFx(fx) { track.wordfx.push(fx); },
  };
}

function wordsFrame(track: EntityTracks, time: number): WordsFrame | null {
  if (track.entity.kind !== "caption" || track.wordfx.length === 0) return null;
  const words = wordCount(track.entity.text);
  let highlightUpTo = -1;
  let highlightColor: string | null = null;
  let pop: number[] | null = null;
  for (const fx of track.wordfx) {
    if (fx.kind === "karaoke") {
      if (time >= fx.start) {
        highlightUpTo = Math.max(highlightUpTo, Math.min(words - 1, Math.floor((time - fx.start) / Math.max(0.01, fx.delay))));
        highlightColor = fx.color;
      }
    } else {
      pop ??= new Array<number>(words).fill(0);
      for (let index = 0; index < words; index += 1) {
        const at = fx.start + index * fx.delay;
        pop[index] = Math.max(pop[index], clamp01((time - at) / 0.16));
      }
    }
  }
  return { highlightUpTo, highlightColor, pop };
}

function byTime(a: Keyframe, b: Keyframe): number {
  return a.t - b.t;
}

function valueAt(list: Keyframe[], time: number): number {
  let previous = list[0];
  let next: Keyframe | null = null;
  for (const key of list) {
    if (key.t <= time && key.t >= previous.t) previous = key;
    if (key.t > time && (next === null || key.t < next.t)) next = key;
  }
  if (!next || next.ease === "hold" || next.t === previous.t) return previous.v;
  const u = clamp01((time - previous.t) / (next.t - previous.t));
  return previous.v + (next.v - previous.v) * applyEase(next.ease, u);
}

function triangle(u: number): number {
  const clamped = clamp01(u);
  return clamped < 0.5 ? clamped * 2 : 2 - clamped * 2;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function applyEase(ease: EaseName, u: number): number {
  switch (ease) {
    case "linear": return u;
    case "in": return u * u * u;
    case "out": return 1 - (1 - u) ** 3;
    case "overshoot": {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2;
    }
    case "bounce": {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (u < 1 / d1) return n1 * u * u;
      if (u < 2 / d1) { const v = u - 1.5 / d1; return n1 * v * v + 0.75; }
      if (u < 2.5 / d1) { const v = u - 2.25 / d1; return n1 * v * v + 0.9375; }
      const v = u - 2.625 / d1;
      return n1 * v * v + 0.984375;
    }
    case "elastic": {
      if (u === 0 || u === 1) return u;
      const c4 = (2 * Math.PI) / 3;
      return 2 ** (-10 * u) * Math.sin((u * 10 - 0.75) * c4) + 1;
    }
    case "smooth":
    default:
      return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
  }
}
