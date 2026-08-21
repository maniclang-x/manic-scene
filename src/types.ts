// Pure types for the scene document. Behavior (parse/serialize/render hints/
// timeline) lives in registry definitions — adding a new entity kind or verb
// never edits the codec or timeline drivers.

export type CanvasFormat = "16:9" | "square" | "portrait";

export interface CanvasSize { width: number; height: number; }

export const CANVAS_SIZES: Record<CanvasFormat, CanvasSize> = {
  "16:9": { width: 1280, height: 720 },
  square: { width: 720, height: 720 },
  portrait: { width: 720, height: 1280 },
};

export const MANIC_TEMPLATES = ["black", "mono", "plain", "terminal", "paper", "blueprint", "shorts"] as const;
export type ManicTemplate = (typeof MANIC_TEMPLATES)[number];

/** Canonical easing names; parse also accepts engine aliases (inout/back/spring). */
export const EASINGS = ["smooth", "linear", "in", "out", "overshoot", "bounce", "elastic"] as const;
export type EaseName = (typeof EASINGS)[number];

/** How the entity starts and is revealed by `show`: manic's `hidden(id[, from])`. */
export type Reveal = "none" | "fade" | "grow";

/** manic shapes default to filled + outlined; `outlined`/`filled` are the exclusive modes. */
export type PaintMode = "default" | "outlined" | "filled";

/** `hue(id, deg, [sat], [light])` — kept literal for exact round-trips. */
export interface HueSpec { deg: number; s: number | null; l: number | null; }

export interface EntityBase {
  id: string;
  color: string;
  opacity: number;
  rotation: number;
  reveal: Reveal;
  untraced: boolean;
  hue: HueSpec | null;
  /** `tag(id, name)` group tags (verbs may broadcast over them). */
  tags?: string[];
  /** Provenance: "computed" = variable-driven values (locked); "generated" = loop/macro instance (locked). Absent = literal, fully editable. */
  origin?: "computed" | "generated";
  /** Generated entities: the source id pattern (e.g. `rc{i}`) for grouping. */
  genKey?: string;
  /** Locked entities: the source offset of the statement (ctor, or the loop) that made them. */
  src?: { start: number; end: number };
  /** Draw order (higher = on top). */
  z?: number;
  /** Neon halo intensity. */
  glow?: number;
  /** Pinned to screen coordinates (HUD) while the camera moves. */
  sticky?: boolean;
  /** Dashed stroke: dash/gap px (null = engine defaults). */
  dashed?: { dash: number | null; gap: number | null };
}

export interface TextEntity extends EntityBase {
  kind: "text";
  x: number; y: number;
  text: string;
  size: number;
  bold: boolean;
  display: boolean;
  align: "left" | "center" | "right";
  leading: number;
  wrap: number | null;
  vertical: boolean;
}

/** LaTeX math, typeset by the engine (RaTeX); the canvas sketches it with KaTeX. */
export interface EquationEntity extends EntityBase {
  kind: "equation";
  x: number; y: number;
  latex: string;
  /** Em height in px (engine default 48). */
  size: number;
}

/** One entity per word (`{id}.w0…`) — what karaoke/wordpop animate. */
export interface CaptionEntity extends EntityBase {
  kind: "caption";
  x: number; y: number;
  text: string;
  size: number;
}

export interface CircleEntity extends EntityBase {
  kind: "circle";
  x: number; y: number; r: number;
  paint: PaintMode;
  strokeWidth: number | null;
  outlineColor: string | null;
}

export interface RectEntity extends EntityBase {
  kind: "rect";
  x: number; y: number; width: number; height: number;
  paint: PaintMode;
  strokeWidth: number | null;
  outlineColor: string | null;
}

export interface DotEntity extends EntityBase {
  kind: "dot";
  x: number; y: number; r: number;
}

export interface LineEntity extends EntityBase {
  kind: "line";
  x1: number; y1: number; x2: number; y2: number;
  strokeWidth: number | null;
}

export interface ArrowEntity extends EntityBase {
  kind: "arrow";
  x1: number; y1: number; x2: number; y2: number;
  strokeWidth: number | null;
}

export interface PolygonEntity extends EntityBase {
  kind: "polygon";
  points: { x: number; y: number }[];
  paint: PaintMode;
  strokeWidth: number | null;
  outlineColor: string | null;
}

export interface CounterEntity extends EntityBase {
  kind: "counter";
  x: number; y: number;
  value: number;
  decimals: number;
  prefix: string;
  suffix: string;
}

export type SceneEntity = TextEntity | CaptionEntity | EquationEntity | CircleEntity | RectEntity | DotEntity | LineEntity | ArrowEntity | PolygonEntity | CounterEntity;
export type EntityKind = SceneEntity["kind"];

export type StepMode = "together" | "sequence" | "stagger";

export interface SceneAction {
  /** Verb name from the verb registry. */
  verb: string;
  /** Entity id; empty string for targetless verbs (`wait`). */
  target: string;
  /** `to`: which property. */
  prop: string | null;
  /** move: absolute point · shift: delta. */
  point: { x: number; y: number } | null;
  /** scale: factor · spin: degrees · to: target value. */
  amount: number | null;
  /** flash/karaoke: palette color name. */
  color: string | null;
  /** rewrite: the target LaTeX. */
  text: string | null;
  /** Literal duration argument (karaoke/wordpop: delay per word). */
  dur: number;
  ease: EaseName;
}

export interface SceneStep {
  name: string;
  mode: StepMode;
  /** Seconds between starts when mode is "stagger". */
  gap: number;
  actions: SceneAction[];
  /** Provenance: computed/generated steps are locked (see EntityBase.origin). */
  origin?: "computed" | "generated";
}

export interface SceneDoc {
  format: CanvasFormat;
  /** Exact canvas(w, h) when it differs from the format bucket's canonical size. */
  size?: CanvasSize;
  template: ManicTemplate;
  entities: SceneEntity[];
  steps: SceneStep[];
}
