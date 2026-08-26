// The extension points. An entity kind or a verb is one self-contained
// definition registered here; the codec, timeline, stage, inspector, story
// panel, and toolbar are generic drivers over these registries.

import type { CallStatement } from "./script.js";
import type { CanvasRepresentation, EaseName, SceneAction, SceneDoc, SceneEntity } from "./types.js";

export interface EntityParseContext {
  /** Numeric computation-layer values visible where the constructor was authored. */
  variables: Readonly<Record<string, number>>;
}

export interface Box { x: number; y: number; width: number; height: number; }
export interface Handle { name: string; x: number; y: number; }
export interface StoryTargetSpec { id: string; label: string; kind: SceneEntity["kind"]; verbs?: readonly string[]; }

export type FieldInput = "text" | "textarea" | "number" | "point" | "point-list" | "point3" | "range" | "select" | "checkbox" | "color" | "latex" | "entity" | "entities" | "parameter" | "latex-list";

/** Dependency-aware geometry supplied by the scene model. */
export interface GeometryContext {
  doc: SceneDoc;
  /** Resolve an entity id, a tag, or a registered virtual child id to a union box. */
  bounds(ref: string): Box | null;
  /** Resolve a concrete entity id (tags and virtual children intentionally excluded). */
  entity(ref: string): SceneEntity | undefined;
}

/** A declarative inspector field over an entity property. */
export interface FieldSpec {
  key: string;
  label: string;
  input: FieldInput;
  min?: number;
  max?: number;
  step?: number;
  /** Range readout suffix. Omit for px; use an empty string for unitless values. */
  unit?: string;
  options?: readonly string[];
  /** number input: empty clears to null (engine default). */
  nullable?: boolean;
  hint?: string;
  /** Restrict a dynamic entity picker to these scene kinds. */
  entityKinds?: readonly string[];
  /** Restrict an entity picker to constructors with this many required,
   * bare-name-safe numeric catalog parameters. */
  entityMinNumericParams?: number;
  /** When this reference changes, reset these dependent parameter properties
   * from the new constructor's safe numeric signature. */
  resetParameterKeys?: readonly string[];
  /** Parameter picker: read numeric constructor parameters from this entity-reference property. */
  parameterSourceKey?: string;
  includeTags?: boolean;
  includeChildren?: boolean;
  /** For logical parents with no native root, offer only their addressable children. */
  childrenOnlyKinds?: readonly string[];
  /** Multi-reference fields cannot remove choices below this count. */
  minItems?: number;
  /** Native constructors such as repeat resolve their dependency immediately,
   * so only source objects declared before the owner are valid choices. */
  referencesEarlierOnly?: boolean;
  readonly?: boolean;
  /** Keep dense constructor schemas progressive: show this control only when
   * another property has one of the named values. */
  visibleWhen?: { key: string; equals: unknown | readonly unknown[] };
}

// --- Entities ---------------------------------------------------------------

export interface EntityDef<E extends SceneEntity = SceneEntity> {
  kind: E["kind"];
  /** The manic constructor name. */
  ctor: string;
  /** Native spellings that parse through this definition but stay out of the
   * Add toolbar; Language still indexes each spelling independently. */
  aliases?: readonly string[];
  /** Toolbar group label. */
  group: string;
  label: string;
  icon: string;
  order: number;
  hint: string;
  /** Fidelity claimed by the authoring Canvas for this entity. */
  fidelity?: CanvasRepresentation;
  /** The ctor carries the color argument, so no `color(id, …)` line is emitted. */
  colorInCtor?: boolean | ((entity: E) => boolean);
  /** Native constructor opacity when it is not the ordinary fully-opaque 1. */
  defaultOpacity?: number;
  /** The constructor owns a semantic formula block (`cloud`, `cloud3`, `shader`). */
  acceptsBlock?: boolean;
  /** Which ctor argument is the anchor point — enables expression-preserving
   * position edits (`(cx, 190)` dragged → `(cx - 140, 210)`). */
  anchorArgIndex?: number;
  create(id: string, x: number, y: number, doc?: SceneDoc, selectedId?: string): E;
  /** Dependency constructors can disable their toolbar button until valid targets exist. */
  canCreate?(doc: SceneDoc): boolean;
  /** Visible recovery guidance when canCreate blocks. */
  createBlockedReason?: string;
  /** Parse the ctor statement's arguments (base fields come defaulted). Null = unsupported shape. */
  parseArgs(stmt: CallStatement, doc?: SceneDoc, context?: EntityParseContext): E | null;
  ctorLine(entity: E): string;
  /** Kind-specific modifier lines (size/align/…); shared ones are emitted by the codec. */
  extraLines(entity: E): string[];
  /** Kind-specific modifiers this def claims: name → apply (false = bad args). */
  modifiers: Record<string, (entity: E, stmt: CallStatement) => boolean>;
  anchor(entity: E, ctx?: GeometryContext): { x: number; y: number };
  translate(entity: E, dx: number, dy: number): void;
  bounds(entity: E, ctx?: GeometryContext): Box;
  handles(entity: E, ctx?: GeometryContext): Handle[];
  dragHandle(entity: E, handle: string, px: number, py: number): void;
  /** Declarative inspector fields for the kind-specific properties. */
  fields: FieldSpec[];
  /** False for geometry wholly derived from another entity (link/framebox/particles). */
  movable?: boolean;
  /** Source declaration or authoring guide with no native drawable id. Hides
   * visual styling/features and excludes the logical record from Story targets. */
  authorOnly?: boolean;
  /** Some overloaded constructors create a drawable root in one form and only
   * addressable children in another (for example the two native `tangent` forms). */
  authorOnlyWhen?(entity: E): boolean;
  /** False when the engine derives the id (label(target, …) → target.label). */
  renameable?: boolean;
  /** Direct entity/tag references owned by this entity. */
  references?(entity: E): string[];
  /** Rewrite references when another entity is renamed. */
  /** Rewrite a referenced id. `sourceKind` is supplied for whole-entity renames
   * so soft typed relationships can ignore an unrelated entity with that id. */
  replaceReference?(entity: E, from: string, to: string, sourceKind?: SceneEntity["kind"]): void;
  /** Addressable engine children represented by this logical entity. */
  referenceIds?(entity: E): string[];
  /** Native children that may be targeted directly from Story. */
  storyTargets?(entity: E): readonly StoryTargetSpec[];
  /** Bounds for an addressable engine child such as `eq.0`. */
  referenceBounds?(entity: E, ref: string, ctx?: GeometryContext): Box | null;
  /** Apply a modifier aimed at a virtual child. */
  applyReferenceModifier?(entity: E, ref: string, stmt: CallStatement): boolean;
}

const entityDefs: EntityDef[] = [];
const entityByKind = new Map<string, EntityDef>();
const entityByCtor = new Map<string, EntityDef>();

export function registerEntity<E extends SceneEntity>(def: EntityDef<E>): void {
  const wide = def as unknown as EntityDef;
  entityDefs.push(wide);
  entityByKind.set(def.kind, wide);
  entityByCtor.set(def.ctor, wide);
  for (const alias of def.aliases ?? []) entityByCtor.set(alias, wide);
}

export function isAuthorOnly(entity: SceneEntity): boolean {
  const def = defFor(entity);
  return def.authorOnly === true || def.authorOnlyWhen?.(entity) === true;
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
  flash(start: number, end: number, color: string, ease: EaseName): void;
  wordFx(fx: WordFx): void;
}

/** How the story panel's action editor renders this verb's inputs. */
export interface VerbUi {
  durLabel: string;
  hideDur?: boolean;
  durMin?: number;
  amount?: { label: string; step: number; min?: number; max?: number | ((entity: SceneEntity | null, doc: SceneDoc, action: SceneAction) => number | undefined) };
  /** Additional numeric fields, stored in `action.values` by index. */
  numbers?: readonly { label: string; step: number; min?: number; max?: number | ((entity: SceneEntity | null, doc: SceneDoc, action: SceneAction) => number | undefined); initial?: number; visibleWhenKinds?: readonly string[] }[];
  /** A compact variable-length numeric vector stored in `action.values`. */
  numberList?: { label: string; step: number; min?: number; max?: number; countFromTarget?: string };
  /** Multiple independently editable numeric vectors stored in `action.valueLists`. */
  numberLists?: readonly { label: string; step: number; min?: number; max?: number; initial?: number; countFromTarget?: string }[];
  point?: "absolute" | "delta";
  /** Optional prefix for the two point controls (for example matrix Origin). */
  pointLabel?: string;
  /** Point input that may instead follow a named entity (`turn` pivot). */
  pointOrEntity?: { label: string };
  /** A world-space XYZ tuple stored in `action.values` from `offset`. */
  point3?: { label: string; offset?: number; visibleWhen?: { field: "prop" | "text"; equals: string } };
  /** A world-space XYZ tuple or entity relationship; the entity lives in `action.ref`. */
  point3OrEntity?: { label: string; offset?: number; accept?: (kind: string) => boolean; includeChildren?: boolean };
  /** Label the primary action relationship more precisely than "Target". */
  targetLabel?: string;
  /** Primary target may be a native `tag` group as well as one entity id. */
  targetTags?: boolean;
  /** For verbs that already use `ref`, keep the point/entity alternative in refs[0]. */
  pointOrEntityRef?: "ref" | "refs0";
  colorArg?: boolean;
  propOptions?: readonly string[] | ((entity: SceneEntity) => readonly string[]);
  /** A second entity/path relationship owned by the action. */
  entityArg?: { label: string; kinds?: readonly string[]; accept?: (kind: string) => boolean; allowNone?: boolean; allowTags?: boolean; includeChildren?: boolean; concreteChildrenOnly?: boolean };
  /** Permit the primary target selector to emit the native release sentinel. */
  targetNone?: boolean;
  /** Extra finite choices stored in generic action fields. */
  choices?: readonly { label: string; field: "prop" | "text"; options: readonly string[] | ((entity: SceneEntity | null) => readonly string[]) }[];
  /** Further ordered entity references after the primary target (`cycle`). */
  entityList?: { label: string; min: number };
  /** A LaTeX payload (rewrite). */
  latexArg?: { label: string };
  /** A plain-words payload (say/section). */
  wordsArg?: { label: string };
  /** Multiple ordered plain-text payloads stored in `action.texts`. */
  wordsArgs?: readonly { label: string; hint?: string }[];
  /** A targetless beat may optionally update one entity as well (speak/caption). */
  optionalTarget?: { label: string; noneLabel: string; kinds: readonly string[] };
  /** Editing words recomputes the action's inferred, non-authored duration. */
  autoDurationFromWords?: boolean;
  /** Show the document's one global voice declaration with this beat. */
  voiceConfig?: boolean;
  /** Ordered formula strings stored in `action.texts`. */
  formulaArgs?: readonly { label: string; hint?: string }[];
}

export interface VerbDef {
  name: string;
  label: string;
  hint: string;
  order: number;
  defaultDur: number;
  hasEase: boolean;
  targetless?: boolean;
  /** Some native verbs intentionally address a logical generated family/tag
   * (for example frame3 in present3 or view3) rather than a drawable root. */
  allowAuthorOnlyTargets?: boolean;
  /** Generated Story targets must resolve to a concrete native 3D entity, not
   * merely a broadcast tag such as pieces.row0. */
  concreteStoryTargetsOnly?: boolean;
  /** Timeline controls such as section/mark cannot be nested inside a step. */
  placement?: "beat" | "timeline";
  /** Additional document-level prerequisite for offering this beat. */
  canAdd?(doc: SceneDoc, selected: SceneEntity | null): boolean;
  /** Friendlier message when canAdd blocks (default: "needs more scene context"). */
  addBlockedReason?: string;
  /** UI creation default duration (corpus-tuned); parse fallback stays `defaultDur`. */
  createDur?: number;
  ui: VerbUi;
  appliesTo(kind: string): boolean;
  create(target: string): SceneAction;
  parse(stmt: CallStatement, doc?: SceneDoc): SceneAction | null;
  /** Fill document-dependent defaults after secondary relationships are selected. */
  completeAction?(action: SceneAction, doc: SceneDoc): void;
  serialize(action: SceneAction): string;
  /** Real beat length on the timeline (karaoke/wordpop derive it from word count). */
  beatDur(action: SceneAction, entity: SceneEntity | null, doc?: SceneDoc): number;
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

/** Relational creation rule: prefer the CURRENT SELECTION, else the most
 * recently added candidate — never silently the first entity in the file. */
export function preferReference(
  doc: SceneDoc | undefined,
  selectedId: string | undefined,
  predicate: (entity: SceneEntity) => boolean = () => true,
): SceneEntity | undefined {
  const pool = doc?.entities.filter((entity) => entity.origin !== "generated" && predicate(entity)) ?? [];
  return pool.find((entity) => entity.id === selectedId) ?? pool.at(-1);
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}
