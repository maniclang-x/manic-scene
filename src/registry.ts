// The extension points. An entity kind or a verb is one self-contained
// definition registered here; the codec, timeline, stage, inspector, story
// panel, and toolbar are generic drivers over these registries.

import type { CallStatement } from "./script.js";
import type { EaseName, SceneAction, SceneEntity } from "./types.js";

export interface Box { x: number; y: number; width: number; height: number; }
export interface Handle { name: string; x: number; y: number; }

export type FieldInput = "text" | "textarea" | "number" | "range" | "select" | "checkbox" | "color" | "latex";

/** A declarative inspector field over an entity property. */
export interface FieldSpec {
  key: string;
  label: string;
  input: FieldInput;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly string[];
  /** number input: empty clears to null (engine default). */
  nullable?: boolean;
  hint?: string;
}

// --- Entities ---------------------------------------------------------------

export interface EntityDef<E extends SceneEntity = SceneEntity> {
  kind: E["kind"];
  /** The manic constructor name. */
  ctor: string;
  /** Toolbar group label. */
  group: string;
  label: string;
  icon: string;
  order: number;
  hint: string;
  /** The ctor carries the color argument, so no `color(id, …)` line is emitted. */
  colorInCtor?: boolean;
  /** Which ctor argument is the anchor point — enables expression-preserving
   * position edits (`(cx, 190)` dragged → `(cx - 140, 210)`). */
  anchorArgIndex?: number;
  create(id: string, x: number, y: number): E;
  /** Parse the ctor statement's arguments (base fields come defaulted). Null = unsupported shape. */
  parseArgs(stmt: CallStatement): E | null;
  ctorLine(entity: E): string;
  /** Kind-specific modifier lines (size/align/…); shared ones are emitted by the codec. */
  extraLines(entity: E): string[];
  /** Kind-specific modifiers this def claims: name → apply (false = bad args). */
  modifiers: Record<string, (entity: E, stmt: CallStatement) => boolean>;
  anchor(entity: E): { x: number; y: number };
  translate(entity: E, dx: number, dy: number): void;
  bounds(entity: E): Box;
  handles(entity: E): Handle[];
  dragHandle(entity: E, handle: string, px: number, py: number): void;
  /** Declarative inspector fields for the kind-specific properties. */
  fields: FieldSpec[];
}

const entityDefs: EntityDef[] = [];
const entityByKind = new Map<string, EntityDef>();
const entityByCtor = new Map<string, EntityDef>();

export function registerEntity<E extends SceneEntity>(def: EntityDef<E>): void {
  const wide = def as unknown as EntityDef;
  entityDefs.push(wide);
  entityByKind.set(def.kind, wide);
  entityByCtor.set(def.ctor, wide);
}

export function allEntityDefs(): readonly EntityDef[] {
  return [...entityDefs].sort((a, b) => a.order - b.order);
}

export function entityDef(kind: string): EntityDef | undefined {
  return entityByKind.get(kind);
}

export function entityDefByCtor(ctor: string): EntityDef | undefined {
  return entityByCtor.get(ctor);
}

export function defFor(entity: SceneEntity): EntityDef {
  const def = entityByKind.get(entity.kind);
  if (!def) throw new Error(`No entity definition registered for kind "${entity.kind}"`);
  return def;
}

// --- Verbs -------------------------------------------------------------------

export type BaseProp = "x" | "y" | "opacity" | "scale" | "rotation" | "draw" | "type";

/** Per-word effect windows (caption verbs) sampled by the timeline. */
export interface WordFx {
  kind: "karaoke" | "wordpop";
  start: number;
  delay: number;
  color: string | null;
}

/** What a verb's timeline apply() can do — the whole surface for new verbs. */
export interface VerbApplyCtx {
  entity: SceneEntity;
  tween(prop: BaseProp, start: number, end: number, target: number, ease: EaseName): void;
  valueAt(prop: BaseProp, time: number): number;
  auxTween(name: string, start: number, end: number, target: number, ease: EaseName, initial: number): void;
  flash(start: number, end: number, color: string): void;
  wordFx(fx: WordFx): void;
}

/** How the story panel's action editor renders this verb's inputs. */
export interface VerbUi {
  durLabel: string;
  amount?: { label: string; step: number };
  point?: "absolute" | "delta";
  colorArg?: boolean;
  propOptions?: readonly string[];
  /** A LaTeX payload (rewrite). */
  latexArg?: { label: string };
  /** A plain-words payload (say/section). */
  wordsArg?: { label: string };
}

export interface VerbDef {
  name: string;
  label: string;
  hint: string;
  order: number;
  defaultDur: number;
  hasEase: boolean;
  targetless?: boolean;
  ui: VerbUi;
  appliesTo(kind: string): boolean;
  create(target: string): SceneAction;
  parse(stmt: CallStatement): SceneAction | null;
  serialize(action: SceneAction): string;
  /** Real beat length on the timeline (karaoke/wordpop derive it from word count). */
  beatDur(action: SceneAction, entity: SceneEntity | null): number;
  apply(ctx: VerbApplyCtx, action: SceneAction, start: number, end: number): void;
  /** Side-effects on the target when the story adds this beat (show → hidden, draw → untraced). */
  onAdd?(entity: SceneEntity): void;
}

const verbDefs = new Map<string, VerbDef>();

export function registerVerb(def: VerbDef): void {
  verbDefs.set(def.name, def);
}

export function verbDef(name: string): VerbDef | undefined {
  return verbDefs.get(name);
}

export function allVerbDefs(): readonly VerbDef[] {
  return [...verbDefs.values()].sort((a, b) => a.order - b.order);
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}
