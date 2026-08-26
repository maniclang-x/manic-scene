// Pure types for the scene document. Behavior (parse/serialize/render hints/
// timeline) lives in registry definitions — adding a new entity kind or verb
// never edits the codec or timeline drivers.

export type CanvasFormat = "16:9" | "square" | "portrait";

export interface CanvasSize { width: number; height: number; }
export interface Point { x: number; y: number; }
export interface Point3 { x: number; y: number; z: number; }

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

export type GradientMode = "auto" | "linear" | "radial" | "along" | "speed" | "curvature";
export interface GradientSpec {
  stops: string[];
  mode: GradientMode;
  /** Degrees, only when mode is `linear`. */
  angle: number;
}

export interface ParameterBinding {
  target: string;
  property: string;
  /** Formula maps keep one or more native component expressions. */
  formulas: string[];
  /** Numeric range maps use the parameter's normalized range. */
  from: number | null;
  to: number | null;
}

export type CreatorFooter = "social" | "compact" | "signature" | "none";
export type CreatorSafe = "shorts" | "reels" | "tiktok" | "clean";
export type QuizSkin = "studio" | "badge" | "minimal" | "glass" | "plain";
export type QuizReveal = "type" | "fade" | "rise" | "pop" | "cut";
export type QuizLayout = "auto" | "stack" | "grid" | "media-first";
export type QuizDensity = "compact" | "comfortable" | "spacious";
export type QuizLabels = "letters" | "numbers" | "none";
export type QuizPace = "quick" | "balanced" | "calm" | "dramatic";
export type QuizMotion = "calm" | "studio" | "punch" | "cut";
export type TimerLook = "ring" | "bar" | "number" | "segments" | "ticks" | "pulse" | "none";

export interface TimerStyle {
  look: TimerLook;
  position: "auto" | "header" | "media" | "below";
  number: "inside" | "outside" | "none";
  direction: "drain" | "fill";
  finish: "fade" | "hold" | "flash" | "pulse";
  font: "mono" | "display";
  size: number;
  thickness: number;
  color: string | null;
  track: string | null;
  label: string;
}

export interface QuizTiming {
  pace: QuizPace;
  ask: number;
  options: number;
  think: number;
  reveal: number;
  hold: number;
  stagger: number;
}

export interface QuizOption { text: string; correct: boolean; }
export interface TimingPhase { name: string; duration: number; }

/** How faithfully the authoring canvas can portray a semantic feature. */
export type CanvasRepresentation = "exact" | "semantic";
export type CanvasAnnotationTone = "info" | "warning";

/** A reusable authoring hint: meaning stays editable even when pixels belong to Preview. */
export interface CanvasAnnotation {
  id: string;
  icon: string;
  label: string;
  detail: string;
  representation: CanvasRepresentation;
  tone: CanvasAnnotationTone;
  /** Related entity/tag/virtual-child references highlighted when the owner is selected. */
  refs: string[];
}

/** Compact Inspector index for active, directly editable entity features. */
export interface AppliedFeature {
  id: "gradient" | "plate" | "cursor" | "crop" | "glow" | "sticky" | "dashed" | "savestate" | "hue" | "layer" | "tags" | "pin3" | "follow3" | "thick3" | "finish3" | "morph2" | "morph3" | "bindings" | "socials" | "endcard" | "species" | "rules" | "speeds" | "phase" | "well" | "timegraph" | "energygraph" | "current" | "probes" | "scopes";
  label: string;
  detail: string;
  controlId: string;
}

export interface EntityBase {
  id: string;
  color: string;
  /** Constructor-provided multicolour paint is authoritative until an explicit color(...) override is authored. */
  nativePaint?: boolean;
  opacity: number;
  rotation: number;
  reveal: Reveal;
  untraced: boolean;
  hue: HueSpec | null;
  /** `tag(id, name)` group tags (verbs may broadcast over them). */
  tags?: string[];
  /** Native `copy(new, src)` provenance. Geometry stays snapshot-owned by the
   * source constructor; Canvas exposes styling and Story motion on the copy. */
  copyOf?: string;
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
  /** Constructor-time transform/style snapshot restored by a later Story beat. */
  savedState?: boolean;
  /** Multi-stop primary paint. The engine remains the gradient pixel truth. */
  gradient?: GradientSpec;
  /** Theme-background legibility chip opacity (text-like entities). */
  plate?: number;
  /** Typewriter cursor on text-like entities. */
  cursor?: boolean;
  /** Live rectangular clipping region. */
  clip?: string;
  /** Live arbitrary-shape masking region. */
  mask?: string;
  /** A 2-D label projected from a world-space 3-D point. */
  pin3?: {
    at: Point3 | null;
    /** Native entity target for pin3/label3; mutually exclusive with `at`. */
    target: string | null;
    offset: { x: number; y: number };
    /** label3-only depth-scaled text height. */
    worldHeight: number | null;
    form: "pin3" | "label3";
  };
  /** Native world-space tube radius for 3-D path entities. */
  thickness3?: number;
  /** Optional native material/render finish for one concrete 3-D entity. */
  finish3?: Finish3Spec;
  /** A native morph relationship sampled and animated through `to(id, morph, …)`. */
  morph2?: { target: string; spin: number | null };
  /** A native 3-D morph relationship sampled and animated through `to(id, morph, …)`. */
  morph3?: { target: string; spin: number | null };
  /** Persistent native world-position relationship authored by `follow3(id,target,offset)`. */
  follow3?: { target: string; offset: Point3 };
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

/** Raster artwork. Null dimensions preserve omitted native defaults exactly. */
export interface ImageEntity extends EntityBase {
  kind: "image";
  x: number; y: number;
  path: string;
  width: number | null;
  height: number | null;
}

/** Native vector import represented by its source artwork on Canvas. */
export interface SvgEntity extends EntityBase {
  kind: "svg";
  x: number; y: number;
  path: string;
  /** Native fitted width; null means the engine default of 240px. */
  size: number | null;
}

export interface DotEntity extends EntityBase {
  kind: "dot";
  x: number; y: number; r: number;
}

/** Math-kit symmetric coordinate cross. `unit=null` means no authored tick spacing. */
export interface AxesEntity extends EntityBase {
  kind: "axes";
  x: number; y: number;
  halfw: number; halfh: number;
  unit: number | null;
}

/** Cartesian grid with addressable grid and axis children. */
export interface PlaneEntity extends EntityBase {
  kind: "plane";
  /** Preserve the authored native alias when Canvas regenerates the constructor. */
  spelling: "plane" | "numberplane";
  x: number; y: number;
  halfw: number; halfh: number;
  /** Null preserves the omitted native default of 50px. */
  unit: number | null;
}

/** Cartesian plane with native Re/Im labels. */
export interface ComplexPlaneEntity extends EntityBase {
  kind: "complexplane";
  x: number; y: number;
  halfw: number; halfh: number;
  unit: number | null;
}

/** Concentric-ring and radial-spoke coordinate guide. */
export interface PolarPlaneEntity extends EntityBase {
  kind: "polarplane";
  x: number; y: number;
  radius: number;
  /** Null preserves native defaults (4 rings, 12 spokes). */
  rings: number | null;
  spokes: number | null;
}

/** A ranged one-dimensional axis with generated ticks and labels. */
export interface NumberLineEntity extends EntityBase {
  kind: "numberline";
  x: number; y: number;
  halfw: number;
  from: number; to: number; step: number;
}

/** Native circular arc line; angles are clockwise screen-space degrees. */
export interface ArcEntity extends EntityBase {
  kind: "arc";
  x: number; y: number;
  r: number; start: number; sweep: number;
  strokeWidth: number | null;
  /** Native arc strokes use an explicit cyan outline; null preserves it. */
  outlineColor: string | null;
}

/** Native filled pie-slice region. */
export interface SectorEntity extends EntityBase {
  kind: "sector";
  x: number; y: number;
  r: number; start: number; sweep: number;
  paint: PaintMode;
  strokeWidth: number | null;
  outlineColor: string | null;
}

/** Native full ring region. */
export interface AnnulusEntity extends EntityBase {
  kind: "annulus";
  x: number; y: number;
  outer: number; inner: number;
  paint: PaintMode;
  strokeWidth: number | null;
  outlineColor: string | null;
}

export interface MatrixEntity extends EntityBase {
  kind: "matrix";
  x: number; y: number;
  source: string;
  cellWidth: number | null;
  cellHeight: number | null;
}

export interface LinearMapEntity extends EntityBase {
  kind: "linmap";
  x: number; y: number; unit: number;
  a: number; b: number; c: number; d: number;
  span: number | null;
}

export interface GridMapEntity extends EntityBase {
  kind: "gridmap";
  x: number; y: number; unit: number;
  a: number; b: number; c: number; d: number;
  span: number | null;
  customFrom: boolean;
  fromA: number; fromB: number; fromC: number; fromD: number;
}

export interface DeterminantEntity extends EntityBase {
  kind: "determinant";
  x: number; y: number; unit: number;
  a: number; b: number; c: number; d: number;
  constructorColor: string | null;
}

export interface EigenEntity extends EntityBase {
  kind: "eigen";
  x: number; y: number; unit: number;
  a: number; b: number; c: number; d: number;
  constructorColor: string | null;
}

export interface DiagonaliseEntity extends EntityBase {
  kind: "diagonalise";
  spelling: "diagonalise" | "diagonalize";
  x: number; y: number; unit: number;
  a: number; b: number; c: number; d: number;
  constructorColor: string | null;
}

export interface LinearSolveEntity extends EntityBase {
  kind: "linsolve";
  x: number; y: number; unit: number;
  a: number; b: number; c: number; d: number;
  e: number; f: number;
  span: number | null;
}

export interface SpanEntity extends EntityBase {
  kind: "span";
  x: number; y: number; unit: number;
  vx: number; vy: number;
  twoVectors: boolean;
  wx: number; wy: number;
  constructorColor: string | null;
}

export interface ProjectionEntity extends EntityBase {
  kind: "project";
  x: number; y: number; unit: number;
  bx: number; by: number;
  ax: number; ay: number;
  constructorColor: string | null;
}

export interface RrefEntity extends EntityBase {
  kind: "rref";
  x: number; y: number;
  source: string;
  cellWidth: number | null;
  rowHeight: number | null;
}

export interface SquishEntity extends EntityBase {
  kind: "squish";
  x: number; y: number; unit: number;
  a: number; b: number;
  span: number | null;
}

/** Pure `field(name, formula)` declaration. The card is authoring-only: native
 * Manic registers the function but creates no drawable carrying `name`. */
export interface ScalarFieldEntity extends EntityBase {
  kind: "scalarfield";
  formula: string;
}

export interface VectorFieldEntity extends EntityBase {
  kind: "vectorfield";
  spelling: "arrowfield" | "vectorfield";
  x: number; y: number;
  halfWidth: number; halfHeight: number;
  formulaMode: boolean;
  namedField: string;
  uFormula: string; vFormula: string;
  density: number | null;
}

export interface ColorWheelEntity extends EntityBase {
  kind: "colorwheel";
  x: number; y: number; radius: number;
}

export interface DomainColorEntity extends EntityBase {
  kind: "domaincolor";
  x: number; y: number; width: number; height: number;
  formula: string; range: number | null;
}

export interface WarpEntity extends EntityBase {
  kind: "warp";
  x: number; y: number; unit: number;
  formula: string; range: number | null; resolution: number | null;
}

export interface TableEntity extends EntityBase {
  kind: "table";
  spelling: "table" | "mathtable" | "integertable" | "decimaltable";
  source: string;
  x: number; y: number;
  columnWidth: number | null; rowHeight: number | null;
  columnLabels: string | null; rowLabels: string | null;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface PieEntity extends EntityBase {
  kind: "pie";
  x: number; y: number; radius: number; slices: number;
  paint: PaintMode;
  strokeWidth: number | null;
  outlineColor: string | null;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface LeastSquaresEntity extends EntityBase {
  kind: "leastsquares";
  x: number; y: number; unit: number;
  source: string; constructorColor: string | null;
  childStyles: Record<string, VirtualChildStyle>;
}

export type StatsKind = "histogram" | "covariance" | "bayes" | "hypothesis" | "bellcurve" | "summary" | "correlation" | "skew" | "boxplot" | "distribution" | "confidence" | "montecarlo" | "randomwalk" | "lln" | "clt";

/** One of the native Stats-kit compositions. The shared numeric slots retain
 * optional constructor arguments exactly; each registered definition gives
 * those slots domain-specific labels and constraints in the Inspector. */
export interface StatsEntity extends EntityBase {
  kind: StatsKind;
  /** Preserves the native `gaussian` alias for bellcurve round-trips. */
  spelling: StatsKind | "gaussian";
  x: number; y: number;
  /** Dataset/point-pair payload where the constructor has one. */
  data: string;
  /** Distribution name for `distribution`; empty for every other kind. */
  mode: string;
  p1: number | null; p2: number | null; p3: number | null;
  p4: number | null; p5: number | null;
  /** Constructor colour word, including `rainbow`; null keeps native default. */
  constructorPaint: string | null;
  childStyles: Record<string, VirtualChildStyle>;
}

export type MlKind = "network" | "activation" | "tensor" | "digit" | "kernel" | "convolve" | "pool" | "tokenize" | "embedding" | "transformer" | "logits" | "attention" | "topk";

/** Declarative ML figure. Native Preview owns numerical execution; Canvas
 * retains every authored input/dependency and a bounded structural view. */
export interface MlEntity extends EntityBase {
  kind: MlKind;
  x: number; y: number;
  source: string;
  source2: string;
  ref: string;
  ref2: string;
  mode: string;
  p1: number | null; p2: number | null; p3: number | null;
  p4: number | null; p5: number | null;
  constructorColor: string | null;
  childStyles: Record<string, VirtualChildStyle>;
}

export type OpticsKind = "refract" | "lens" | "prism" | "achromat" | "lenssystem" | "rayfan" | "spotdiagram" | "fieldspot";

/** Optics-kit composition. Canvas retains the complete optical prescription
 * and a stable structural diagram; native Preview owns the physical trace. */
export interface OpticsEntity extends EntityBase {
  kind: OpticsKind;
  x: number; y: number;
  /** Glass/preset/custom prescription where the constructor accepts one. */
  source: string;
  p1: number | null; p2: number | null; p3: number | null;
  childStyles: Record<string, VirtualChildStyle>;
}

export type PhysicsKind = "freekick" | "pendulum" | "spring" | "doublependulum" | "springpendulum" | "kapitza" | "cartpendulum" | "comparependulum" | "verticalspring" | "springincline" | "bungee" | "resonance" | "doublespring" | "seriesparallel" | "carsuspension" | "piston" | "molecule" | "robotarm" | "pulley" | "pulleyscale" | "blocktackle" | "compoundpulley" | "ramp" | "dropmass" | "inclinepulley" | "doubleincline" | "inclinebumper" | "springchain" | "looptrack" | "collideblocks" | "bulletblock" | "newtonscradle" | "gas" | "dominos" | "dominopath" | "stringwave" | "raft" | "brachistochrone";
export interface PhysicsSpecies { name: string; weight: number | null; color: string | null }
export interface PhysicsPanel { x: number; y: number; size: number | null; p1?: number | null; p2?: number | null; p3?: number | null; p4?: number | null }

/** One pre-simulated Physics composition plus dependent analysis/features.
 * Canvas edits declarations and shows bounded state; Preview owns integration. */
export interface PhysicsEntity extends EntityBase {
  kind: PhysicsKind;
  x: number; y: number;
  source: string; source2: string;
  domain: Point | null;
  p1: number | null; p2: number | null; p3: number | null; p4: number | null;
  p5: number | null; p6: number | null; p7: number | null; p8: number | null;
  species: PhysicsSpecies[];
  rules: string[];
  speeds: PhysicsPanel | null;
  phase: PhysicsPanel | null;
  well: PhysicsPanel | null;
  timegraph: PhysicsPanel | null;
  energygraph: PhysicsPanel | null;
  childStyles: Record<string, VirtualChildStyle>;
}

export type SystemDiagramKind = "architecture" | "flowchart" | "c4";
export type SystemPort = "auto" | "left" | "right" | "top" | "bottom";

/** A responsive Systems-kit layout root. Architecture can own explicit bounds;
 * flowchart and C4 use the native canvas-safe responsive frame. */
export interface SystemDiagramEntity extends EntityBase {
  kind: SystemDiagramKind;
  x: number; y: number; width: number; height: number;
  responsive: boolean;
  direction: "auto" | "TD" | "LR";
  maxNodes: number | null;
  level: "context" | "container" | "component" | "code" | "system";
  childStyles: Record<string, VirtualChildStyle>;
}

/** One auto-positioned architecture, flowchart, or C4 element. */
export interface SystemNodeEntity extends EntityBase {
  kind: "node";
  parent: string;
  nodeKind: string;
  label: string;
  description: string | null;
  technology: string | null;
  childStyles: Record<string, VirtualChildStyle>;
}

/** A nested ownership boundary. Its geometry follows its parent and children. */
export interface SystemClusterEntity extends EntityBase {
  kind: "cluster";
  parent: string;
  label: string;
  legacyMembers: string | null;
  childStyles: Record<string, VirtualChildStyle>;
}

/** One semantic connection; Canvas shows one bounded representative lane while
 * Preview expands node↔cluster fan-out into its native concrete lanes. */
export interface SystemConnectionEntity extends EntityBase {
  kind: "connect";
  from: string; to: string;
  routing: "curve" | "orthogonal";
  bend: number;
  fromPort: SystemPort; toPort: SystemPort;
  annotation: string | null;
  childStyles: Record<string, VirtualChildStyle>;
}

/** A persistent message identity placed at a system node and moved by Story. */
export interface SystemMessageEntity extends EntityBase {
  kind: "message" | "request";
  source: string;
  label: string;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface CircuitProbe {
  at: Point | null;
  part: string | null;
  offset: Point | null;
}

export interface CircuitScope {
  at: Point | null;
  part: string | null;
  x: number; y: number;
  width: number; height: number;
}

export interface CircuitCurrentStyle {
  speed: number;
  shape: "circle" | "square" | "diamond";
  color: string;
  size: number;
}

/** Circuit-kit declaration. Canvas preserves and sketches the authored
 * topology; native Preview owns solving, transient playback, and readings. */
export interface CircuitEntity extends EntityBase {
  kind: "circuit";
  x: number; y: number;
  netlist: string;
  unit: number;
  labels: boolean;
  build: number;
  currentStyle: CircuitCurrentStyle | null;
  probes: CircuitProbe[];
  scopes: CircuitScope[];
  childStyles: Record<string, VirtualChildStyle>;
}

/** Algo-kit fixed slots and independently addressable value children. */
export interface ArrayEntity extends EntityBase {
  kind: "array";
  source: string;
  x: number; y: number;
  cellWidth: number;
  cellHeight: number;
  childStyles: Record<string, VirtualChildStyle>;
}

/** A live index marker whose position is derived from one array slot. */
export interface PointerEntity extends EntityBase {
  kind: "pointer";
  array: string;
  slot: number;
  label: string | null;
  childStyles: Record<string, VirtualChildStyle>;
}

/** Freely positioned algorithm marker with a generated label child. */
export interface CaretEntity extends EntityBase {
  kind: "caret";
  x: number; y: number;
  label: string;
  direction: "up" | "down" | "left" | "right";
  childStyles: Record<string, VirtualChildStyle>;
}

/** Empty source container; Story operations mint the native cells at runtime. */
export interface AlgoContainerEntity extends EntityBase {
  kind: "stack" | "queue";
  x: number; y: number;
  cellWidth: number;
  cellHeight: number;
}

/** Linked-list declaration with stable initial node anatomy and live re-threading. */
export interface ListEntity extends EntityBase {
  kind: "list";
  source: string;
  x: number; y: number;
  listKind: "singly" | "doubly" | "circular";
  cellWidth: number;
  cellHeight: number;
  childStyles: Record<string, VirtualChildStyle>;
}

/** Separate-chaining hash table; Story `put` operations mint its entries. */
export interface HashMapEntity extends EntityBase {
  kind: "hashmap";
  buckets: number;
  x: number; y: number;
  entryWidth: number;
  cellHeight: number;
  childStyles: Record<string, VirtualChildStyle>;
}

export type GraphLayout = "circular" | "circle" | "ring" | "row" | "line" | "grid";

/** Static labelled graph whose traversal algorithms are authored in Story. */
export interface GraphEntity extends EntityBase {
  kind: "graph";
  vertices: string;
  edges: string;
  layout: GraphLayout;
  x: number; y: number;
  scale: number;
  radius: number;
  childStyles: Record<string, VirtualChildStyle>;
}

/** Source-backed style intent aimed at a native generated child or tag. */
export interface VirtualChildStyle {
  color?: string;
  opacity?: number;
  glow?: number;
  reveal?: Reveal;
  untraced?: boolean;
  finish3?: Finish3Spec;
}

/** Math-kit coordinate frame with value-space ranges and independent pixel scales. */
export interface CoordsEntity extends EntityBase {
  kind: "coords";
  x: number; y: number;
  xmin: number; xmax: number;
  ymin: number; ymax: number;
  sx: number; sy: number;
  tips: boolean;
  step: number;
  numbers: boolean;
  xname: string | null;
  yname: string | null;
}

/** A custom value-space tick whose position follows a `coords` frame. */
export interface AxisTickEntity extends EntityBase {
  kind: "xtick" | "ytick";
  coords: string;
  value: number;
  /** Null asks Manic to format `value`; an empty string is an authored empty label. */
  text: string | null;
  size: number;
  markColor: string;
  markWidth: number | null;
  markReveal: Reveal;
}

/** Geo-kit point; its optional constructor label is the addressable child `id.label`. */
export interface PointEntity extends EntityBase {
  kind: "point";
  x: number; y: number;
  label: string | null;
  labelSize: number;
  labelColor: string;
  labelReveal: Reveal;
}

/** A segment whose endpoints follow two point-like entities. */
export interface SegmentEntity extends EntityBase {
  kind: "segment";
  from: string;
  to: string;
  strokeWidth: number | null;
}

/** Math-kit vector: dy is mathematical up, so its screen endpoint is y-dy. */
export interface VectorEntity extends EntityBase {
  kind: "vector";
  x: number; y: number;
  dx: number; dy: number;
  strokeWidth: number | null;
}

/** Geo-kit sampled ellipse outline with constructor-local rotation. */
export interface EllipseEntity extends EntityBase {
  kind: "ellipse";
  x: number; y: number;
  rx: number; ry: number;
  angle: number;
  strokeWidth: number | null;
}

/** Circle derived from a centre point and a second point on its circumference. */
export interface Circle2Entity extends EntityBase {
  kind: "circle2";
  center: string;
  through: string;
  paint: PaintMode;
  strokeWidth: number | null;
  outlineColor: string | null;
}

/** Live midpoint of two point-like entities. */
export interface MidpointEntity extends EntityBase {
  kind: "midpoint";
  a: string;
  b: string;
}

/** Live angle arc at vertex b; the optional label is the child `id.label`. */
export interface AngleMarkEntity extends EntityBase {
  kind: "anglemark";
  a: string; b: string; c: string;
  label: string | null;
  labelSize: number;
  labelColor: string;
  labelReveal: Reveal;
  strokeWidth: number | null;
}

/** Live right-angle polyline at vertex b. */
export interface RightAngleEntity extends EntityBase {
  kind: "rightangle";
  a: string; b: string; c: string;
  strokeWidth: number | null;
}

export type GeoDerivedPointKind = "centroid" | "circumcenter" | "incenter" | "orthocenter" | "foot" | "meet" | "reflect" | "bisector" | "rotpoint" | "between" | "anglepoint";

/** A live Euclidean point computed from two to four earlier point references. */
export interface GeoDerivedPointEntity extends EntityBase {
  kind: GeoDerivedPointKind;
  a: string;
  b: string;
  c: string | null;
  d: string | null;
  /** Degrees for rotpoint/anglepoint; fraction for between. */
  scalar: number | null;
}

/** A triangle-derived live circle. */
export interface GeoCircleEntity extends EntityBase {
  kind: "circumcircle" | "incircle";
  a: string; b: string; c: string;
  paint: PaintMode;
  strokeWidth: number | null;
  outlineColor: string | null;
}

/** A pair of virtual point children: `id0` and `id1`; there is no native root. */
export interface GeoIntersectionEntity extends EntityBase {
  kind: "linecircle" | "circlecircle";
  a: string; b: string; c: string; d: string;
  point0Color: string;
  point1Color: string;
  point0Reveal: Reveal;
  point1Reveal: Reveal;
  point0Tags: string[];
  point1Tags: string[];
}

/** Native full line through two live points. */
export interface FullLineEntity extends EntityBase {
  kind: "fullline";
  a: string; b: string;
  strokeWidth: number | null;
}

export interface ParabolaEntity extends EntityBase {
  kind: "parabola";
  x: number; y: number;
  halfWidth: number;
  height: number;
  strokeWidth: number | null;
}

/** Two tagged virtual branches, `id.r` and `id.l`. */
export interface HyperbolaEntity extends EntityBase {
  kind: "hyperbola";
  x: number; y: number;
  a: number; b: number;
  range: number;
  strokeWidth: number | null;
}

export interface CommonTangentEntity extends EntityBase {
  kind: "commontangent";
  centerA: string;
  throughA: string;
  centerB: string;
  throughB: string;
  tangentType: "external" | "internal";
  strokeWidth: number | null;
  touchAColor: string;
  touchBColor: string;
  touchAReveal: Reveal;
  touchBReveal: Reveal;
  touchATags: string[];
  touchBTags: string[];
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

/** Visible bounded value widget; bind statements make its value drive scene properties. */
export interface ParameterEntity extends EntityBase {
  kind: "parameter";
  x: number; y: number;
  value: number;
  min: number;
  max: number;
  label: string | null;
  decimals: number;
  bindings: ParameterBinding[];
}

/** `label(target, "text", [(dx,dy)])` creates the engine child `target.label`. */
export interface LabelEntity extends EntityBase {
  kind: "label";
  target: string;
  dx: number; dy: number;
  text: string;
  size: number;
}

/** A live edge whose endpoints follow two other scene entities. */
export interface LinkEntity extends EntityBase {
  kind: "link";
  from: string;
  to: string;
  bend: number;
  strokeWidth: number | null;
}

/** A highlight rectangle derived from a target entity or tag's bounds. */
export interface FrameboxEntity extends EntityBase {
  kind: "framebox";
  target: string;
  buff: number;
}

export type SupportDirection = "up" | "down" | "left" | "right";

/** Hatched mechanics support represented as one editable logical group. */
export interface SupportEntity extends EntityBase {
  kind: "support";
  x: number; y: number;
  length: number;
  direction: SupportDirection;
  strokeWidth: number | null;
}

/** Live sampled inversion of another concrete 2-D entity outline. */
export interface InvertPathEntity extends EntityBase {
  kind: "invertpath";
  source: string;
  center: string;
  radius: number;
  samples: number;
  strokeWidth: number | null;
}

/** Live sampled reflection of another concrete 2-D outline across a line. */
export interface ReflectPathEntity extends EntityBase {
  kind: "reflectpath";
  source: string;
  mirror: string;
  samples: number;
  strokeWidth: number | null;
}

export type BooleanCtor = "union" | "intersect" | "intersection" | "difference" | "subtract" | "exclusion" | "xor";
export type BooleanOperation = "union" | "intersection" | "difference" | "xor";

/** Static native boolean result built from two earlier fillable shapes. */
export interface BooleanRegionEntity extends EntityBase {
  kind: "boolean";
  spelling: BooleanCtor;
  a: string;
  b: string;
  paint: PaintMode;
  strokeWidth: number | null;
  outlineColor: string | null;
}

/** Generated coloured faces of a closed boundary divided by paths/tags. */
export interface RegionsEntity extends EntityBase {
  kind: "regions";
  boundary: string;
  dividers: string[];
  strokeWidth: number | null;
}

/** Greedy native tree/co-tree overlay generated from ordered edge references. */
export interface SpanTreeEntity extends EntityBase {
  kind: "spantree";
  edges: string[];
  strokeWidth: number | null;
  cotreeReveal: Reveal;
  cotreeUntraced: boolean;
}

/** Dual graph generated from a planar boundary and its interior edges. */
export interface DualEntity extends EntityBase {
  kind: "dual";
  boundary: string;
  dividers: string[];
  strokeWidth: number | null;
  nodesReveal: Reveal;
}

export type BraceDirection = "up" | "down" | "left" | "right";

export interface BraceEntity extends EntityBase {
  kind: "brace";
  x1: number; y1: number; x2: number; y2: number;
  depth: number;
  direction: BraceDirection | null;
  strokeWidth: number | null;
}

export interface BraceLabelEntity extends EntityBase {
  kind: "bracelabel" | "bracetext";
  x1: number; y1: number; x2: number; y2: number;
  depth: number;
  text: string;
  size: number;
  strokeWidth: number | null;
}

export interface MathPart {
  latex: string;
  color: string | null;
  reveal: Reveal;
  untraced: boolean;
}

/** One logical source statement with addressable engine children `id.0`, `id.1`, … */
export interface MathPartsEntity extends EntityBase {
  kind: "mathparts";
  x: number; y: number;
  parts: MathPart[];
  size: number;
}

export type ParticleLayout = "random" | "grid" | "ring";

/** A logical group whose engine children are `id.p0`, `id.p1`, … */
export interface ParticlesEntity extends EntityBase {
  kind: "particles";
  container: string;
  count: number;
  radius: number;
  seed: number;
  layout: ParticleLayout;
}

/** A logical N-dimensional control rack whose native children are addressable. */
export interface SlidersEntity extends EntityBase {
  kind: "sliders";
  x: number; y: number;
  count: number;
  width: number;
  height: number;
}

/** A live native magnifier represented by its source frame and display panel. */
export interface LoupeEntity extends EntityBase {
  kind: "loupe";
  sourceX: number; sourceY: number;
  sourceWidth: number; sourceHeight: number;
  panelX: number; panelY: number;
  magnification: number;
  panelColor: string;
}

/** Closed-form statements evaluated once per deterministic 2-D point sample. */
export interface CloudEntity extends EntityBase {
  kind: "cloud";
  count: number;
  pointOpacity: number;
  program: string;
  /** Optional native `from text/shape/path/flow/map(...)` home-point provider. */
  source: string | null;
  /** Computation-layer numbers captured at the constructor site for Canvas sampling only. */
  variables: Record<string, number>;
}

/** Closed-form statements evaluated once per deterministic world-space point sample. */
export interface Cloud3Entity extends EntityBase {
  kind: "cloud3";
  count: number;
  pointOpacity: number;
  program: string;
  variables: Record<string, number>;
}

/** Closed-form statements evaluated over normalized pixel coordinates. */
export interface ShaderEntity extends EntityBase {
  kind: "shader";
  program: string;
  variables: Record<string, number>;
  fullCanvas: boolean;
  /** Retained while fullCanvas is on, so toggling to a panel is one edit. */
  x: number; y: number;
  width: number; height: number;
}

/** Raw Shadertoy-style fragment source executed by Manic's native GPU pass. */
export interface GlslEntity extends EntityBase {
  kind: "glsl";
  source: string;
}

/** Deterministic affine iterated-function field; Canvas shows a bounded sample. */
export interface Ifs2Entity extends EntityBase {
  kind: "ifs2";
  x: number; y: number;
  width: number; height: number;
  count: number;
  seed: number;
  rules: string;
  options: string | null;
}

/** Escape-time field; Canvas uses a deliberately coarse grid. */
export interface MandelbrotEntity extends EntityBase {
  kind: "mandelbrot";
  x: number; y: number;
  width: number; height: number;
  xMin: number; xMax: number;
  yMin: number; yMax: number;
  iterations: number;
  columns: number | null;
}

/** Sampled r(t) path in screen-space polar coordinates. */
export interface PolarPathEntity extends EntityBase {
  kind: "polarpath";
  x: number; y: number;
  scale: number;
  formula: string;
  start: number; end: number;
  samples: number | null;
  closed: number | null;
  strokeWidth: number | null;
}

/** Onion-depth convex hull derived from an earlier ifs2 point cloud. */
export interface Hull2Entity extends EntityBase {
  kind: "hull2";
  cloud: string;
  depth: number | null;
  pivot: number | null;
  strokeWidth: number | null;
}

export type RepeatLayout = "hex" | "grid" | "radial";

/** One logical relationship whose native result is a stable tagged motif field. */
export interface RepeatEntity extends EntityBase {
  kind: "repeat";
  motif: string;
  layout: RepeatLayout;
  rings: number;
  rows: number;
  cols: number;
  count: number;
  spacing: number;
  gapX: number;
  gapY: number;
  radius: number;
  rotate: number;
  instanceScale: number;
  face: "same" | "out";
  strokeWidth: number | null;
}

/** A persistent native path that records a concrete entity's resolved motion. */
export interface TrailEntity extends EntityBase {
  kind: "trail";
  target: string;
  thickness: number;
}

/** A parameter-sweep declaration. Canvas shows the authored grid contract;
 * Preview expands the template and owns every generated cell. */
export interface SweepEntity extends EntityBase {
  kind: "sweep";
  template: string;
  xParam: string;
  xFrom: number;
  xTo: number;
  yParam: string;
  yFrom: number;
  yTo: number;
  x: number;
  y: number;
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  keepOverlays: boolean;
  fit: number;
}

export type LSystemBoundary = "open" | "closed" | "filled";

/** Compact deterministic grammar; Canvas sketches a bounded fitted path. */
export interface LSystemEntity extends EntityBase {
  kind: "lsystem";
  x: number; y: number;
  size: number;
  axiom: string;
  rules: string;
  angle: number;
  heading: number;
  iterations: number;
  drawSymbols: string;
  padding: number;
  boundary: LSystemBoundary;
  strokeWidth: number | null;
}

/** A sampled y=f(x) curve in screen coordinates. */
export interface PlotEntity extends EntityBase {
  kind: "plot";
  x: number; y: number;
  sx: number; sy: number;
  formula: string;
  formulaForm: "string" | "name";
  x0: number; x1: number;
  strokeWidth: number | null;
}

/** First-class curves derived from another plotted curve. */
export interface DerivedCurveEntity extends EntityBase {
  kind: "deriv" | "accum";
  source: string;
  /** Lower integration bound for accum; ignored by deriv. */
  a: number | null;
  strokeWidth: number | null;
}

export interface TangentEntity extends EntityBase {
  kind: "tangent";
  /** `curve` is tangent(curve, x, length); `circle` is tangent(point, centre, rim). */
  mode: "curve" | "circle";
  source: string;
  graphX: number;
  length: number;
  point: string | null;
  center: string | null;
  through: string | null;
  point0Color: string;
  point1Color: string;
  point0Reveal: Reveal;
  point1Reveal: Reveal;
  point0Tags: string[];
  point1Tags: string[];
  strokeWidth: number | null;
}

export interface SlopeEntity extends EntityBase {
  kind: "slope";
  source: string;
  graphX: number;
  dx: number; dy: number;
  size: number;
}

export interface AreaEntity extends EntityBase {
  kind: "area";
  source: string;
  a: number; b: number;
  samples: number;
}

/** A filled region derived from the shared x-domain of two plotted curves. */
export interface BandEntity extends EntityBase {
  kind: "band";
  top: string;
  bottom: string;
  /** Colour authored in the constructor; null means the native cyan default. */
  constructorColor: string | null;
  restricted: boolean;
  a: number;
  b: number;
}

export interface IntegralEntity extends EntityBase {
  kind: "integral";
  source: string;
  a: number; b: number;
  x: number | null; y: number | null;
  size: number;
}

export interface CalculusMarksEntity extends EntityBase {
  kind: "extrema" | "inflections";
  source: string;
}

export interface LimitEntity extends EntityBase {
  kind: "limit";
  source: string;
  at: number;
}

/** Formula-authored curves sampled by Canvas for composition; Preview owns the
 * native 1000-point evaluation and final stroke pixels. */
export interface ParametricCurveEntity extends EntityBase {
  kind: "param" | "polar";
  x: number; y: number;
  sx: number; sy: number;
  fx: string;
  fy: string;
  t0: number; t1: number;
  domainForm: "default" | "scalar" | "range";
  strokeWidth: number | null;
}

export interface NormalEntity extends EntityBase {
  kind: "normal";
  source: string;
  graphX: number;
  length: number;
  strokeWidth: number | null;
}

export interface SlopeTriangleEntity extends EntityBase {
  kind: "slopetri";
  source: string;
  graphX: number;
  run: number;
}

export interface RootsEntity extends EntityBase {
  kind: "roots";
  source: string;
}

export interface VerticalLineEntity extends EntityBase {
  kind: "vline";
  source: string;
  graphX: number;
  style: "dotted" | "dashed" | "solid";
}

export interface CurveDotEntity extends EntityBase {
  kind: "curvedot";
  source: string;
  graphX: number;
}

export interface GraphLabelEntity extends EntityBase {
  kind: "graphlabel";
  source: string;
  latex: string;
  graphX: number | null;
  /** Resolved source-domain end retained when native source omitted x. */
  defaultX: number;
  direction: "up" | "down" | "left" | "right" | "upright" | "upleft" | "downright" | "downleft";
  constructorColor: string | null;
  size: number;
}

export interface BoxToEntity extends EntityBase {
  kind: "boxto";
  source: string;
  graphX: number;
}

export interface RiemannEntity extends EntityBase {
  kind: "riemann";
  source: string;
  a: number;
  b: number;
  dx: number | null;
}

export interface TaylorEntity extends EntityBase {
  kind: "taylor";
  source: string;
  a: number;
  degree: number;
  strokeWidth: number | null;
}

export interface NewtonEntity extends EntityBase {
  kind: "newton";
  source: string;
  x0: number;
  steps: number;
  strokeWidth: number | null;
}

export interface SplineEntity extends EntityBase {
  kind: "spline";
  points: Point[];
  strokeWidth: number | null;
}

export interface TrajectoryEntity extends EntityBase {
  kind: "trajectory";
  fx: string;
  fy: string;
  start: Point;
  x: number; y: number;
  scaleFactor: number;
  steps: number;
  strokeWidth: number | null;
}

export interface Camera3Entity extends EntityBase {
  kind: "camera3";
  eye: Point3;
  target: Point3;
  fov: number;
  projection: "perspective" | "orthographic";
  panelX: number | null; panelY: number | null;
  panelWidth: number | null; panelHeight: number | null;
}

export interface GridEntity extends EntityBase {
  kind: "grid";
  x: number; y: number;
  cols: number; rows: number; cellSize: number;
  seed: string | null;
  neighbors: "4" | "8";
  operations: GridOperation[];
}

export type GridCellKind = "open" | "wall" | "start" | "goal";
export type GridOperation =
  | { kind: "setcell"; row: number; col: number; cellKind: GridCellKind }
  | { kind: "walls"; cells: string }
  | { kind: "evolve"; rule: string }
  | { kind: "collapse"; tileset: string; seed: number | null };

export interface RaceSeriesSpec { label: string; icon: string | null; values: string }
export interface RaceChartEntity extends EntityBase {
  kind: "racechart";
  layout: "bar" | "column" | "line";
  periods: string;
  title: string | null;
  dataBlocks: string[];
  series: RaceSeriesSpec[];
  companion: { label: string; values: string | null } | null;
  panel: boolean;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface LiveHistogramEntity extends EntityBase {
  kind: "livehistogram";
  x: number; y: number;
  min: number; max: number; bins: number;
  width: number; height: number;
  constructorColor: string;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface BalanceChemEntity extends EntityBase {
  kind: "balance";
  x: number; y: number;
  equation: string;
  size: number;
  supplied: string | null;
  limiting: boolean;
  limitX: number; limitY: number;
  limitWidth: number; limitRow: number; limitSize: number;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface LewisChemEntity extends EntityBase {
  kind: "lewis";
  formula: string;
  x: number; y: number;
  unit: number; size: number;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface LevelsChemEntity extends EntityBase {
  kind: "levels";
  x: number; y: number;
  width: number; height: number;
  nmax: number; atomicNumber: number;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface EmissionChemEntity extends EntityBase {
  kind: "emission";
  levels: string;
  x: number; y: number;
  width: number; height: number;
  fromNm: number;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface CellChemEntity extends EntityBase {
  kind: "cell";
  metals: string;
  x: number; y: number;
  width: number; height: number;
  spec: string;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface LatticeChemEntity extends EntityBase {
  kind: "lattice";
  formula: string;
  x: number; y: number;
  cols: number; rows: number; unit: number;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface NewmanChemEntity extends EntityBase {
  kind: "newman";
  source: string;
  x: number; y: number;
  unit: number; labelSize: number;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface ProfileChemEntity extends EntityBase {
  kind: "profile";
  torsion: string;
  x: number; y: number;
  width: number; height: number;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface VibrationChemEntity extends EntityBase {
  kind: "vibration";
  source: string;
  x: number; y: number;
  unit: number; labelSize: number;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface IRSpectrumChemEntity extends EntityBase {
  kind: "irspectrum";
  molecule: string;
  x: number; y: number;
  width: number; height: number; labelSize: number;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface Molecule3ChemEntity extends EntityBase {
  kind: "molecule3";
  source: string;
  center: Point3;
  scaleFactor: number;
  spec: string;
  childStyles: Record<string, VirtualChildStyle>;
}

export type ChemEntity = BalanceChemEntity | LewisChemEntity | LevelsChemEntity | EmissionChemEntity | CellChemEntity | LatticeChemEntity | NewmanChemEntity | ProfileChemEntity | VibrationChemEntity | IRSpectrumChemEntity | Molecule3ChemEntity;

export interface Grid3Entity extends EntityBase {
  kind: "grid3";
  center: Point3;
  half: number;
  spacing: number;
}

export interface Stroke3Entity extends EntityBase {
  kind: "line3" | "arrow3";
  from: Point3;
  to: Point3;
}

export interface Curve3Entity extends EntityBase {
  kind: "curve3";
  fx: string; fy: string; fz: string;
  t0: number; t1: number;
}

export interface Point3Entity extends EntityBase {
  kind: "point3";
  at: Point3;
  radius: number;
}

export interface Axes3Entity extends EntityBase {
  kind: "axes3";
  worldOrigin: Point3;
  length: number;
  step: number;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface Frame3Entity extends EntityBase {
  kind: "frame3";
  center: Point3;
  size: Point3;
  xMin: number; xMax: number;
  yMin: number; yMax: number;
  zMin: number; zMax: number;
  xScale: "linear" | "log";
  yScale: "linear" | "log";
  zScale: "linear" | "log";
  xMajor: number; yMajor: number; zMajor: number;
  xMinor: number | null; yMinor: number | null; zMinor: number | null;
  /** Comma-separated native plane specifications such as xy:min,xz:origin. */
  planes: string;
  mode: "textbook" | "spatial";
  childStyles: Record<string, VirtualChildStyle>;
}

export interface Box3Entity extends EntityBase {
  kind: "cube3";
  center: Point3;
  size: Point3;
}

export interface Sphere3Entity extends EntityBase {
  kind: "sphere3";
  center: Point3;
  radius: number;
}

export interface PolySolid3Entity extends EntityBase {
  kind: "prism3" | "pyramid3";
  center: Point3;
  sides: number;
  radius: number;
  height: number;
}

export interface Midpoint3Entity extends EntityBase {
  kind: "midpoint3";
  a: string;
  b: string;
  radius: number;
}

export interface Cross3Entity extends EntityBase {
  kind: "cross3";
  worldOrigin: Point3;
  v: Point3;
  w: Point3;
  crossColor: string;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface Link3Entity extends EntityBase {
  kind: "link3";
  from: string;
  to: string;
  trim: number;
}

export type Finish3Key = "shading" | "material" | "texture" | "scale" | "mesh" | "wire" | "depth" | "shadow";
export interface Finish3Spec {
  shading: "flat" | "smooth";
  material: "matte" | "metal" | "glass";
  texture: "solid" | "checker" | "stripes";
  textureScale: number;
  mesh: number;
  wire: number;
  depth: number;
  shadow: number;
  /** Authored keys, retained so an intentionally explicit default is not erased. */
  keys: Finish3Key[];
}

export interface Model3Entity extends EntityBase {
  kind: "model3";
  path: string;
  center: Point3;
  scaleFactor: number;
}

export interface Assembly3Entity extends EntityBase {
  kind: "assembly3";
  path: string;
  center: Point3;
  scaleFactor: number;
  /** Discoverable OBJ group names when catalogue metadata is available. */
  parts: string[];
  childStyles: Record<string, VirtualChildStyle>;
}

export interface Extrude3Entity extends EntityBase {
  kind: "extrude3";
  source: string;
  height: number;
  center: Point3;
}

export interface Revolve3Entity extends EntityBase {
  kind: "revolve3";
  center: Point3;
  profile: string;
  t0: number;
  t1: number;
  sides: number;
}

export interface Tube3Entity extends EntityBase {
  kind: "tube3";
  path: string;
  radiusProfile: string;
  sides: number;
}

export interface Project3Entity extends EntityBase {
  kind: "project3";
  source: string;
  plane: "xy" | "xz" | "yz";
  radius: number;
}

export interface ProjectPath3Entity extends EntityBase {
  kind: "projectpath3";
  source: string;
  plane: "xy" | "xz" | "yz";
}

export interface Surface3Entity extends EntityBase {
  kind: "surface3";
  formula: string;
  x0: number; x1: number; y0: number; y1: number;
  resolution: number;
}

export interface DomainSurface3Entity extends EntityBase {
  kind: "domainsurface";
  formula: string;
  x0: number; x1: number; y0: number; y1: number;
  resolution: number;
  height: number;
}

export interface ParamSurface3Entity extends EntityBase {
  kind: "param3";
  fx: string; fy: string; fz: string;
  u0: number; u1: number; v0: number; v1: number;
  resolution: number;
}

export interface Implicit3Entity extends EntityBase {
  kind: "implicit3";
  formula: string;
  x0: number; x1: number; y0: number; y1: number; z0: number; z1: number;
  level: number;
  resolution: number;
}

export interface Heightmap3Entity extends EntityBase {
  kind: "heightmap3";
  grid: string;
  formula: string;
  size: number;
}

export interface SurfaceDependent3Entity extends EntityBase {
  kind: "contour3" | "gradient3" | "tangentplane3" | "volume3" | "descend3";
  surface: string;
  level: number | null;
  x: number | null; y: number | null;
  resolution: number | null;
  rate: number | null; steps: number | null;
  derivedColor: string | null;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface Slice3Entity extends EntityBase {
  kind: "slice3";
  surface: string;
  axis: "x" | "y";
  value: number;
  at: number | null;
  sliceColor: string | null;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface VectorField3Entity extends EntityBase {
  kind: "vectorfield3";
  center: Point3;
  half: Point3;
  u: string; v: string; w: string;
  density: number;
}

export interface Trajectory3Entity extends EntityBase {
  kind: "trajectory3";
  dx: string; dy: string; dz: string;
  start: Point3;
  steps: number;
  dt: number;
}

export interface MatrixMap3Entity extends EntityBase {
  kind: "linmap3" | "eigen3";
  center: Point3;
  a: number; b: number; c: number;
  d: number; e: number; f: number;
  g: number; h: number; i: number;
  matrixColor: string | null;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface Collection3Entity extends EntityBase {
  kind: "collection3" | "collection3data";
  center: Point3;
  count: number;
  spread: Point3;
  seed: number;
  pointsData: string;
  radius: number;
}

export interface CollectionChild3Entity extends EntityBase {
  kind: "child3";
  collection: string;
  index: number;
  radius: number;
}

export interface CollectionLinks3Entity extends EntityBase {
  kind: "links3" | "links3data";
  collection: string;
  mode: "chain" | "nearest" | "all";
  neighbors: number;
  edgesData: string;
}

export interface Pieces3Entity extends EntityBase {
  kind: "pieces3";
  source: string;
  cols: number;
  rows: number;
  inset: number;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface CollectionPath3Entity extends EntityBase {
  kind: "ring3" | "trail3";
  collection: string;
  child: number;
  segments: number;
  pathThickness: number;
}

export interface HistoryPlotEntity extends EntityBase {
  kind: "historyplot";
  collection: string;
  child: number;
  component: "x" | "y" | "z";
  x: number; y: number; width: number; height: number;
}

export interface HistoryPlot3Entity extends EntityBase {
  kind: "historyplot3";
  collection: string;
  child: number;
  component: "x" | "y" | "z";
  origin3: Point3;
  width: number; height: number;
}

export interface RandomWalk3Entity extends EntityBase {
  kind: "randomwalk3";
  center: Point3;
  steps: number;
  seed: number;
  options: string;
}

export interface LSystem3Entity extends EntityBase {
  kind: "lsystem3";
  origin3: Point3;
  stepSize: number;
  angle: number;
  iterations: number;
  axiom: string;
  rules: string;
  maxSymbols: number;
}

export interface Tree3Entity extends EntityBase {
  kind: "tree3";
  root: Point3;
  length: number;
  angle: number;
  shrink: number;
  depth: number;
  seed: number;
  childStyles: Record<string, VirtualChildStyle>;
}

export interface Hilbert3Entity extends EntityBase {
  kind: "hilbert3";
  center: Point3;
  size: number;
  order3: number;
  options: string;
}

export interface WatermarkEntity extends EntityBase {
  kind: "watermark";
  x: number; y: number;
  text: string;
  size: number;
  /** True when native Manic owns the responsive bottom-right position. */
  responsive: boolean;
}

/** Non-drawing creator profile plus its optional responsive generated families. */
export interface CreatorEntity extends EntityBase {
  kind: "creator";
  handle: string;
  displayName: string;
  tagline: string;
  logo: string;
  website: string;
  cta: string;
  /** Space-separated native platform=value pairs, including unknown future platforms. */
  platforms: string;
  accent: string | null;
  secondary: string | null;
  footer: CreatorFooter;
  safe: CreatorSafe;
  socials: boolean;
  socialsAt: { x: number; y: number } | null;
  endcard: { title: string | null; cta: string | null; safe: CreatorSafe | null } | null;
  stickyFooter: boolean;
  stickyEndcard: boolean;
}

/** Authoring-only destination frame for native `figure(target, …)` group fitting. */
export interface FigureEntity extends EntityBase {
  kind: "figure";
  target: string;
  x: number; y: number;
  width: number; height: number;
}

/** Responsive platform safe-area guide; exact authored geometry, approximate pixels. */
export interface SafezoneEntity extends EntityBase {
  kind: "safezone";
  mode: CreatorSafe | "inset";
  inset: number;
}

/** Responsive native quiz family represented as one editable semantic group. */
export interface QuizEntity extends EntityBase {
  kind: "quiz";
  question: string;
  skin: QuizSkin;
  questionReveal: QuizReveal;
  layout: QuizLayout;
  density: QuizDensity;
  labels: QuizLabels;
  timerLook: TimerLook;
  pace: QuizPace;
  seconds: number | null;
  motion: QuizMotion;
  safe: CreatorSafe;
  accent: string | null;
  options: QuizOption[];
  explanation: string;
  explanationSource: string;
  timing: QuizTiming | null;
  timerStyle: TimerStyle | null;
}

/** Standalone native countdown widget with deterministic playback. */
export interface CountdownEntity extends EntityBase {
  kind: "countdown";
  x: number; y: number;
  seconds: number;
  timerStyle: TimerStyle;
}

/** Generic named-phase timing controller and its optional native clock. */
export interface TimingEntity extends EntityBase {
  kind: "timing";
  x: number; y: number;
  responsive: boolean;
  phases: TimingPhase[];
  timerStyle: TimerStyle;
}

export type SceneEntity = TextEntity | CaptionEntity | EquationEntity | CircleEntity | RectEntity | ImageEntity | SvgEntity | DotEntity | AxesEntity | PlaneEntity | ComplexPlaneEntity | PolarPlaneEntity | NumberLineEntity | ArcEntity | SectorEntity | AnnulusEntity | MatrixEntity | LinearMapEntity | GridMapEntity | DeterminantEntity | EigenEntity | DiagonaliseEntity | LinearSolveEntity | SpanEntity | ProjectionEntity | RrefEntity | SquishEntity | ScalarFieldEntity | VectorFieldEntity | ColorWheelEntity | DomainColorEntity | WarpEntity | TableEntity | PieEntity | LeastSquaresEntity | StatsEntity | MlEntity | OpticsEntity | PhysicsEntity | SystemDiagramEntity | SystemNodeEntity | SystemClusterEntity | SystemConnectionEntity | SystemMessageEntity | CircuitEntity | RaceChartEntity | LiveHistogramEntity | ChemEntity | ArrayEntity | PointerEntity | CaretEntity | AlgoContainerEntity | ListEntity | HashMapEntity | GraphEntity | CoordsEntity | AxisTickEntity | PointEntity | SegmentEntity | VectorEntity | EllipseEntity | Circle2Entity | MidpointEntity | AngleMarkEntity | RightAngleEntity | GeoDerivedPointEntity | GeoCircleEntity | GeoIntersectionEntity | FullLineEntity | ParabolaEntity | HyperbolaEntity | CommonTangentEntity | LineEntity | ArrowEntity | PolygonEntity | CounterEntity | ParameterEntity | LabelEntity | LinkEntity | FrameboxEntity | SupportEntity | InvertPathEntity | ReflectPathEntity | BooleanRegionEntity | RegionsEntity | SpanTreeEntity | DualEntity | BraceEntity | BraceLabelEntity | MathPartsEntity | ParticlesEntity | SlidersEntity | LoupeEntity | CloudEntity | Cloud3Entity | ShaderEntity | GlslEntity | Ifs2Entity | MandelbrotEntity | PolarPathEntity | Hull2Entity | RepeatEntity | TrailEntity | SweepEntity | LSystemEntity | PlotEntity | DerivedCurveEntity | TangentEntity | SlopeEntity | AreaEntity | BandEntity | IntegralEntity | CalculusMarksEntity | LimitEntity | ParametricCurveEntity | NormalEntity | SlopeTriangleEntity | RootsEntity | VerticalLineEntity | CurveDotEntity | GraphLabelEntity | BoxToEntity | RiemannEntity | TaylorEntity | NewtonEntity | SplineEntity | TrajectoryEntity | Camera3Entity | GridEntity | Grid3Entity | Stroke3Entity | Curve3Entity | Point3Entity | Axes3Entity | Frame3Entity | Box3Entity | Sphere3Entity | PolySolid3Entity | Midpoint3Entity | Cross3Entity | Link3Entity | Model3Entity | Assembly3Entity | Extrude3Entity | Revolve3Entity | Tube3Entity | Project3Entity | ProjectPath3Entity | Surface3Entity | DomainSurface3Entity | ParamSurface3Entity | Implicit3Entity | Heightmap3Entity | SurfaceDependent3Entity | Slice3Entity | VectorField3Entity | Trajectory3Entity | MatrixMap3Entity | Collection3Entity | CollectionChild3Entity | CollectionLinks3Entity | Pieces3Entity | CollectionPath3Entity | HistoryPlotEntity | HistoryPlot3Entity | RandomWalk3Entity | LSystem3Entity | Tree3Entity | Hilbert3Entity | WatermarkEntity | CreatorEntity | FigureEntity | SafezoneEntity | QuizEntity | CountdownEntity | TimingEntity;
export type EntityKind = SceneEntity["kind"];

export type StepMode = "together" | "sequence" | "stagger";

export interface SceneAction {
  /** Verb name from the verb registry. */
  verb: string;
  /** Entity relationship; empty for purely targetless verbs, semantic ids for camera verbs. */
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
  /** Secondary entity reference (for example `travel(entity, path, …)`). */
  ref?: string | null;
  /** Additional numeric verb parameters kept in native argument order. */
  values?: number[];
  /** Multiple numeric lists whose boundaries must survive parse/edit/serialize. */
  valueLists?: number[][];
  /** Additional entity relationships for variadic actions such as `cycle`. */
  refs?: string[];
  /** Ordered plain formula/source payloads for multi-expression verbs. */
  texts?: string[];
  /** Literal duration argument (karaoke/wordpop: delay per word). */
  dur: number;
  /** False when an optional native duration was omitted and derived from its target. */
  durationExplicit?: boolean;
  /** False when an optional numeric amount was omitted and derived from scene context. */
  amountExplicit?: boolean;
  ease: EaseName;
}

/** One statement inside a `during` composition segment. Unsupported inner
 * vocabulary remains an opaque source item so a Canvas edit can never erase it. */
export type TimedItem =
  | { kind: "action"; action: SceneAction }
  | { kind: "source"; raw: string };

/** A direct run of statements or one explicit par/seq/stagger wrapper. */
export interface TimedSegment {
  mode: StepMode;
  /** Seconds between starts when mode is "stagger". */
  gap: number;
  /** True when this segment was/normally is an explicit nested wrapper. */
  wrapped: boolean;
  items: TimedItem[];
}

export interface TimedPhase {
  /** Lower-case phase name declared by the linked generic timing controller. */
  name: string;
  /** Segments themselves play in sequence, matching native `during`. */
  segments: TimedSegment[];
}

export interface TimedComposition {
  /** Id of a generic TimingEntity. */
  controller: string;
  phases: TimedPhase[];
}

export interface SceneStep {
  name: string;
  mode: StepMode;
  /** Seconds between starts when mode is "stagger". */
  gap: number;
  actions: SceneAction[];
  /** Native `timed(clock) { during(...) { ... } }` composition. Regular steps
   * keep actions above; timed steps keep their actions inside phase segments. */
  timed?: TimedComposition;
  /** Provenance: computed/generated steps are locked (see EntityBase.origin). */
  origin?: "computed" | "generated";
}

export type VoiceService = "gtts" | "cartesia" | "elevenlabs";
export type VoiceTone = "normal" | "slow" | "fast";

/** One authored `voice(...)` declaration shared by every Speak beat. */
export interface VoiceConfig {
  service: VoiceService;
  voice: string | null;
  tone: VoiceTone | null;
  language: string | null;
}

export interface SceneDoc {
  /** Optional native scene title, authored from the Canvas Scene panel. */
  title?: string;
  format: CanvasFormat;
  /** Exact canvas(w, h) when it differs from the format bucket's canonical size. */
  size?: CanvasSize;
  template: ManicTemplate;
  /** Present iff the source owns a global `voice(...)` declaration. */
  voice?: VoiceConfig;
  entities: SceneEntity[];
  steps: SceneStep[];
}
