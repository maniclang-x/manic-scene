// Scene-document helpers over the registries. (Types live in types.ts;
// behavior lives in entities/ and verbs.ts.)

import "./entities/index.js";
import "./verbs.js";
import { projectPoint3, threePointReferences, worldAnchor3 } from "./entities/three.js";
import { hull2Geometry, ifs2Geometry, mandelbrotGeometry, polarPathGeometry } from "./entities/generative-next.js";
import { lsystemGeometry, repeatGeometry, LSYSTEM_CANVAS_POINT_CAP } from "./entities/patterns.js";
import { booleanOperation, dualGeometry, regionsGeometry, spanTreeGeometry } from "./entities/topology.js";
import { rrefStates } from "./entities/linear-algebra.js";
import { algoValues, graphAlgorithmPlan, graphGeometry, hashmapLayout, hashmapLookupPlan } from "./entities/algo.js";
import { statsGeometry } from "./entities/stats.js";
import { mlLayers, mlOutputShape, mlTensorGrid, mlTokens } from "./entities/ml.js";
import { opticsGeometry } from "./entities/optics.js";
import { PHYSICS_KINDS, physicsGeometry } from "./entities/physics.js";
import { SYSTEM_ENTITY_KINDS, systemConnectionGeometry, systemDiagramFor } from "./entities/systems.js";
import { circuitGeometry } from "./entities/circuit.js";
import { gridOperationSummary } from "./entities/grid-kit.js";
import { racePeriods, raceRows } from "./entities/race.js";
import { balanceSides, formulaAtoms } from "./entities/chem.js";
import { defFor, entityDef, isAuthorOnly, verbDef, type Box, type GeometryContext } from "./registry.js";
import { CANVAS_SIZES, type AppliedFeature, type CanvasAnnotation, type CanvasFormat, type EntityKind, type ManicTemplate, type SceneAction, type SceneDoc, type SceneEntity, type SceneStep, type TimedSegment, type TimingEntity } from "./types.js";

export * from "./types.js";

/** The doc's real canvas dimensions (exact file size, else the format bucket). */
export function docSize(doc: SceneDoc): { width: number; height: number } {
  return doc.size ?? CANVAS_SIZES[doc.format];
}

export function emptyDoc(format: CanvasFormat = "16:9", template: ManicTemplate = "black"): SceneDoc {
  return { format, template, entities: [], steps: [] };
}

export function cloneDoc(doc: SceneDoc): SceneDoc {
  return JSON.parse(JSON.stringify(doc)) as SceneDoc;
}

export function docsEqual(a: SceneDoc, b: SceneDoc): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The point an entity scales/rotates about and that `move` relocates. */
export function geometryContext(doc: SceneDoc): GeometryContext {
  const resolving = new Set<string>();
  const context: GeometryContext = {
    doc,
    entity: (ref) => doc.entities.find((entity) => entity.id === ref),
    bounds(ref) {
      if (resolving.has(ref)) return null;
      resolving.add(ref);
      const boxes: Box[] = [];
      for (const entity of doc.entities) {
        const def = defFor(entity);
        if (entity.id === ref || entity.tags?.includes(ref)) boxes.push(boundsWithContext(entity, context));
        else {
          const box = def.referenceBounds?.(entity, ref, context);
          if (box) boxes.push(box);
        }
      }
      resolving.delete(ref);
      return unionBoxes(boxes);
    },
  };
  return context;
}

export function entityAnchor(entity: SceneEntity, doc?: SceneDoc): { x: number; y: number } {
  if (entity.pin3) {
    const at = entity.pin3.at ?? (entity.pin3.target && doc ? worldAnchor3(entity.pin3.target, geometryContext(doc)) : null) ?? { x: 0, y: 0, z: 0 };
    const point = projectPoint3(at, doc);
    return { x: point.x + entity.pin3.offset.x, y: point.y + entity.pin3.offset.y };
  }
  return defFor(entity).anchor(entity, doc ? geometryContext(doc) : undefined);
}

export function entityBounds(entity: SceneEntity, doc?: SceneDoc): Box {
  const context = doc ? geometryContext(doc) : undefined;
  return boundsWithContext(entity, context);
}

function boundsWithContext(entity: SceneEntity, context?: GeometryContext): Box {
  const def = defFor(entity);
  const box = def.bounds(entity, context);
  if (!entity.pin3) return box;
  const original = def.anchor(entity, context);
  const at = entity.pin3.at ?? (entity.pin3.target ? worldAnchor3(entity.pin3.target, context) : null) ?? { x: 0, y: 0, z: 0 };
  const projected = projectPoint3(at, context?.doc);
  const anchor = { x: projected.x + entity.pin3.offset.x, y: projected.y + entity.pin3.offset.y };
  return { ...box, x: box.x + anchor.x - original.x, y: box.y + anchor.y - original.y };
}

export function translateEntity(entity: SceneEntity, dx: number, dy: number): void {
  defFor(entity).translate(entity, dx, dy);
}

export function createEntity(kind: EntityKind, id: string, x: number, y: number, doc?: SceneDoc, selectedId?: string): SceneEntity {
  const def = entityDef(kind);
  if (!def) throw new Error(`Unknown entity kind "${kind}"`);
  return def.create(id, x, y, doc, selectedId);
}

/** `copy(new, src)` calls the engine's concrete 2-D entity lookup. Logical
 * groups/controllers and 3-D world objects have no single root entity to clone. */
export function canNativeCopy(entity: SceneEntity): boolean {
  const concreteRoots = new Set<EntityKind>([
    "text", "equation", "circle", "rect", "image", "dot", "line", "arrow", "polygon", "counter",
    "link", "framebox", "brace", "plot", "deriv", "accum", "tangent", "slope", "area", "band", "integral",
    "segment", "vector", "ellipse", "circle2", "rightangle", "lsystem", "ifs2", "mandelbrot", "polarpath", "hull2", "watermark", "safezone",
    "invertpath", "reflectpath", "centroid", "circumcenter", "incenter", "orthocenter", "foot", "meet", "reflect", "bisector", "rotpoint", "between", "anglepoint",
    "circumcircle", "incircle", "fullline", "parabola", "commontangent",
    "boolean",
  ]);
  return concreteRoots.has(entity.kind) && defFor(entity).renameable !== false;
}

/** Core state verbs use the concrete Scene::get root but do not require that
 * the Canvas entity itself be renameable (attached labels and derived marks
 * still own a real native root). */
export function canNativeState(entity: SceneEntity): boolean {
  const concreteRoots = new Set<EntityKind>([
    "text", "equation", "circle", "rect", "image", "svg", "dot", "line", "arrow", "polygon", "counter",
    "label", "link", "framebox", "brace", "bracelabel", "bracetext", "invertpath", "reflectpath", "boolean",
    "point", "segment", "vector", "ellipse", "circle2", "midpoint", "anglemark", "rightangle",
    "centroid", "circumcenter", "incenter", "orthocenter", "foot", "meet", "reflect", "bisector", "rotpoint", "between", "anglepoint",
    "circumcircle", "incircle", "fullline", "parabola", "commontangent",
    "cloud", "shader", "glsl", "ifs2", "mandelbrot", "polarpath", "hull2", "trail", "lsystem", "plot", "deriv", "accum", "tangent", "slope", "area", "band", "integral",
    "watermark", "safezone",
  ]);
  return concreteRoots.has(entity.kind);
}

export function entityReferences(entity: SceneEntity): string[] {
  return [...new Set([
    ...(defFor(entity).references?.(entity) ?? []),
    ...(entity.copyOf ? [entity.copyOf] : []),
    ...(entity.clip ? [entity.clip] : []),
    ...(entity.mask ? [entity.mask] : []),
    ...(entity.morph2 ? [entity.morph2.target] : []),
    ...(entity.morph3 ? [entity.morph3.target] : []),
    ...(entity.pin3?.target ? [entity.pin3.target] : []),
    ...(entity.follow3 ? [entity.follow3.target] : []),
  ])];
}

export function replaceEntityReference(entity: SceneEntity, from: string, to: string, sourceKind?: EntityKind): void {
  defFor(entity).replaceReference?.(entity, from, to, sourceKind);
  if (entity.copyOf === from) entity.copyOf = to;
  if (entity.clip === from) entity.clip = to;
  if (entity.mask === from) entity.mask = to;
  if (entity.morph2?.target === from) entity.morph2.target = to;
  if (entity.morph3?.target === from) entity.morph3.target = to;
  if (entity.pin3?.target === from) entity.pin3.target = to;
  if (entity.follow3?.target === from) entity.follow3.target = to;
}

/** Every entity-like id owned by an action, including secondary relationships. */
export function actionReferences(action: SceneAction): string[] {
  return [...new Set([
    ...(action.target ? [action.target] : []),
    ...(action.ref ? [action.ref] : []),
    ...(action.refs ?? []),
  ])];
}

/** Rename an id everywhere an action can refer to it. */
export function replaceActionReference(action: SceneAction, from: string, to: string): void {
  if (action.target === from) action.target = to;
  if (action.ref === from) action.ref = to;
  if (action.refs) action.refs = action.refs.map((ref) => ref === from ? to : ref);
}

/** Canvas-editable actions in visual order. Timed steps keep their canonical
 * actions inside phase segments; opaque Source-owned items are intentionally
 * excluded. Returned action objects are the document's live references. */
export function stepActions(step: SceneStep): SceneAction[] {
  if (!step.timed) return step.actions;
  return step.timed.phases.flatMap((phase) => phase.segments.flatMap((segment) => segment.items.flatMap((item) => item.kind === "action" ? [item.action] : [])));
}

export function stepActionAt(step: SceneStep | undefined, index: number): SceneAction | null {
  return step ? stepActions(step)[index] ?? null : null;
}

interface TimedActionLocation { phase: number; segment: number; item: number; }

function timedActionLocation(step: SceneStep, actionIndex: number): TimedActionLocation | null {
  if (!step.timed) return null;
  let cursor = 0;
  for (let phase = 0; phase < step.timed.phases.length; phase += 1) {
    const segments = step.timed.phases[phase].segments;
    for (let segment = 0; segment < segments.length; segment += 1) {
      for (let item = 0; item < segments[segment].items.length; item += 1) {
        if (segments[segment].items[item].kind !== "action") continue;
        if (cursor === actionIndex) return { phase, segment, item };
        cursor += 1;
      }
    }
  }
  return null;
}

export function removeStepAction(step: SceneStep, index: number): void {
  if (!step.timed) { step.actions.splice(index, 1); return; }
  const location = timedActionLocation(step, index);
  if (location) step.timed.phases[location.phase].segments[location.segment].items.splice(location.item, 1);
}

/** Keep the native `voice(...)` / `speak(...)` authored invariant intact. */
export function reconcileVoicePairing(doc: SceneDoc): void {
  const hasSpeak = doc.steps.some((step) => stepActions(step).some((action) => action.verb === "speak"));
  if (hasSpeak) doc.voice ??= { service: "gtts", voice: null, tone: null, language: null };
  else delete doc.voice;
}

/** Reordering never crosses a native phase or composition-segment boundary. */
export function canSwapStepAction(step: SceneStep, index: number, delta: -1 | 1): boolean {
  if (!step.timed) return index + delta >= 0 && index + delta < step.actions.length;
  const here = timedActionLocation(step, index), there = timedActionLocation(step, index + delta);
  return Boolean(here && there && here.phase === there.phase && here.segment === there.segment);
}

export function swapStepAction(step: SceneStep, index: number, delta: -1 | 1): void {
  if (!canSwapStepAction(step, index, delta)) return;
  if (!step.timed) {
    [step.actions[index + delta], step.actions[index]] = [step.actions[index], step.actions[index + delta]];
    return;
  }
  const here = timedActionLocation(step, index)!, there = timedActionLocation(step, index + delta)!;
  const items = step.timed.phases[here.phase].segments[here.segment].items;
  [items[there.item], items[here.item]] = [items[here.item], items[there.item]];
}

export function appendTimedAction(step: SceneStep, phaseIndex: number, segmentIndex: number, action: SceneAction): number {
  if (!step.timed) throw new Error("appendTimedAction needs a timed Story step");
  const segment = step.timed.phases[phaseIndex]?.segments[segmentIndex];
  if (!segment) throw new Error("Unknown timed phase segment");
  let index = 0;
  for (let phase = 0; phase <= phaseIndex; phase += 1) {
    for (let one = 0; one < step.timed.phases[phase].segments.length; one += 1) {
      if (phase === phaseIndex && one === segmentIndex) {
        index += step.timed.phases[phase].segments[one].items.filter((item) => item.kind === "action").length;
        segment.items.push({ kind: "action", action });
        return index;
      }
      index += step.timed.phases[phase].segments[one].items.filter((item) => item.kind === "action").length;
    }
  }
  segment.items.push({ kind: "action", action });
  return index;
}

export function replaceStepActionReferences(step: SceneStep, from: string, to: string): void {
  for (const action of stepActions(step)) replaceActionReference(action, from, to);
  if (step.timed?.controller === from) step.timed.controller = to;
}

export function filterStepActions(step: SceneStep, keep: (action: SceneAction) => boolean): void {
  if (!step.timed) { step.actions = step.actions.filter(keep); return; }
  for (const phase of step.timed.phases) for (const segment of phase.segments) {
    segment.items = segment.items.filter((item) => item.kind === "source" || keep(item.action));
  }
}

export function createTimedStep(controller: TimingEntity): SceneStep {
  return {
    name: `Timed · ${controller.id}`,
    mode: "sequence",
    gap: .15,
    actions: [],
    timed: {
      controller: controller.id,
      phases: controller.phases.map((phase) => ({
        name: phase.name,
        segments: [{ mode: "sequence", gap: .15, wrapped: false, items: [] }],
      })),
    },
  };
}

export interface TimedUsage { seconds: number; sourceOwned: boolean; }

/** Duration of one Canvas-readable segment. Opaque source statements make the
 * exact usage unknown, so the UI reports the known lower bound honestly. */
export function timedSegmentUsage(segment: TimedSegment, doc: SceneDoc): TimedUsage {
  const actions = segment.items.flatMap((item) => item.kind === "action" ? [item.action] : []);
  const durations = actions.map((action) => {
    const target = doc.entities.find((entity) => entity.id === action.target) ?? null;
    return Math.max(.01, verbDef(action.verb)?.beatDur(action, target, doc) ?? action.dur);
  });
  const seconds = segment.mode === "sequence" ? durations.reduce((sum, duration) => sum + duration, 0)
    : segment.mode === "stagger" ? durations.reduce((end, duration, index) => Math.max(end, index * Math.max(0, segment.gap) + duration), 0)
      : Math.max(0, ...durations);
  return { seconds, sourceOwned: segment.items.some((item) => item.kind === "source") };
}

export function timedPhaseUsage(step: SceneStep, phaseIndex: number, doc: SceneDoc): TimedUsage {
  const phase = step.timed?.phases[phaseIndex];
  if (!phase) return { seconds: 0, sourceOwned: false };
  return phase.segments.reduce<TimedUsage>((usage, segment) => {
    const next = timedSegmentUsage(segment, doc);
    return { seconds: usage.seconds + next.seconds, sourceOwned: usage.sourceOwned || next.sourceOwned };
  }, { seconds: 0, sourceOwned: false });
}

export function referenceIds(entity: SceneEntity): string[] {
  return defFor(entity).referenceIds?.(entity) ?? [];
}

/**
 * Meaning visible in the authoring canvas. `semantic` annotations deliberately
 * describe runtime behaviour without claiming to reproduce native pixels.
 */
export function canvasAnnotations(entity: SceneEntity, doc: SceneDoc): CanvasAnnotation[] {
  const out: CanvasAnnotation[] = [];
  const add = (annotation: CanvasAnnotation) => out.push(annotation);
  const extrusions = doc.entities.filter((candidate) => candidate.kind === "extrude3" && candidate.source === entity.id);
  if (extrusions.length) add({
    id: "extrude-source", icon: "⇧3", label: `Consumed by ${extrusions.map((item) => item.id).join(", ")}`,
    detail: "Native extrude3 hides this 2D cross-section after building the solid. Canvas keeps a faint editable recipe so the dependency is not lost.",
    representation: "semantic", tone: "info", refs: extrusions.map((item) => item.id),
  });
  const geometry = geometryContext(doc);

  if (entity.kind === "grid") {
    const actions = doc.steps.flatMap(stepActions).filter((action) => action.target === entity.id && ["run", "gridbfs", "gridastar"].includes(action.verb));
    add({
      id: "grid-computation", icon: "▦ƒ", label: `${entity.cols}×${entity.rows} · ${gridOperationSummary(entity)}`,
      detail: actions.length ? `Canvas shows the authored grid state and marks ${actions.length} computation beat${actions.length === 1 ? "" : "s"}. Preview owns exact cellular evolution, WFC collapse, frontier order, and path playback.` : "Canvas shows the deterministic authored grid state. Add Run, Grid BFS, or Grid A* in Story; Preview owns exact evolution and search playback.",
      representation: "semantic", tone: "info", refs: [`${entity.id}.cells`, `${entity.id}.frontier`, `${entity.id}.visited`, `${entity.id}.path`],
    });
  }
  if (entity.kind === "racechart") {
    const rows = raceRows(entity), periods = racePeriods(entity), races = doc.steps.flatMap(stepActions).filter((action) => action.target === entity.id && action.verb === "race");
    add({
      id: "race-playback", icon: "▰↕", label: `${rows.length} series · ${periods.length} periods${races.length ? ` · ${races.length} race beat${races.length === 1 ? "" : "s"}` : ""}`,
      detail: "Canvas keeps the responsive chart, data, companion line, and first authored period editable. Preview owns time interpolation, sorting, rank changes, and exact chart pixels.",
      representation: "semantic", tone: rows.length && periods.length ? "info" : "warning", refs: [`${entity.id}.period`, `${entity.id}.bars`, `${entity.id}.lines`, `${entity.id}.panel`],
    });
  }
  if (entity.kind === "livehistogram") {
    const observers = doc.steps.flatMap(stepActions).filter((action) => action.target === entity.id && ["collect", "observe"].includes(action.verb));
    add({
      id: "live-histogram", icon: "▂▅▇", label: `${entity.bins} bins · ${observers.length} observer beat${observers.length === 1 ? "" : "s"}`,
      detail: "The histogram is intentionally empty on Canvas because its samples are produced by process beats. Inspector and Story preserve the bins, collection, and measurement; Preview owns live accumulation.",
      representation: "semantic", tone: observers.length ? "info" : "warning", refs: [`${entity.id}.bars`, `${entity.id}.count`, ...observers.flatMap((action) => action.ref ? [action.ref] : [])],
    });
  }
  if (entity.kind === "particles" || entity.kind === "cloud") {
    const process = doc.steps.flatMap(stepActions).filter((action) => action.target === entity.id && ["stream", "emit", "advect", "branch"].includes(action.verb));
    if (process.length) add({
      id: "process-motion", icon: "⇢ƒ", label: `${process.length} process beat${process.length === 1 ? "" : "s"} attached`,
      detail: `Canvas marks ${process.map((action) => action.verb).join(", ")} as semantic motion relationships. Edit their path, field, profile, rate, and timing in Story; Preview owns generated trajectories and measurements.`,
      representation: "semantic", tone: "info", refs: process.flatMap((action) => action.ref ? [action.ref] : []),
    });
  }

  if (entity.kind === "balance") {
    const sides = balanceSides(entity.equation);
    const actions = doc.steps.flatMap(stepActions).filter((action) => action.target === entity.id && ["solve", "react"].includes(action.verb));
    add({
      id: "chemical-balance", icon: "⚗=", label: `${sides.left.length} reactant${sides.left.length === 1 ? "" : "s"} → ${sides.right.length} product${sides.right.length === 1 ? "" : "s"}${actions.length ? ` · ${actions.length} Story beat${actions.length === 1 ? "" : "s"}` : ""}`,
      detail: entity.limiting ? "Canvas keeps the equation, supplied amounts, and limiting-reagent layout editable. Preview owns exact rational coefficients, molar-mass arithmetic, yields, leftovers, conservation readouts, and motion." : "Canvas keeps the equation editable and marks coefficient solving. Enable supplied amounts and the limiting-reagent view in Inspector to author React; Preview owns exact chemistry and playback.",
      representation: "semantic", tone: entity.limiting && !entity.supplied ? "warning" : "info", refs: [`${entity.id}.parts`, ...(entity.limiting ? [`${entity.id}.limit`] : [])],
    });
  }
  if (entity.kind === "lewis") {
    const actions = doc.steps.flatMap(stepActions).filter((action) => action.target === entity.id && ["octet", "resonate"].includes(action.verb));
    add({
      id: "lewis-bookkeeping", icon: "••", label: `${formulaAtoms(entity.formula).length} atoms${actions.length ? ` · ${actions.map((action) => action.verb).join(" + ")}` : ""}`,
      detail: "Canvas shows an editable structural guide and stable atom/bond/pair families. Preview owns valence-electron bookkeeping, promoted bonds, formal charges, valid resonance forms, and electron motion.",
      representation: "semantic", tone: "info", refs: [`${entity.id}.atoms`, `${entity.id}.bonds`, `${entity.id}.pairs`, `${entity.id}.charges`],
    });
  }
  if (entity.kind === "levels") {
    const drops = doc.steps.flatMap(stepActions).filter((action) => action.target === entity.id && action.verb === "drop");
    const spectra = doc.entities.filter((candidate) => candidate.kind === "emission" && candidate.levels === entity.id);
    add({
      id: "energy-levels", icon: "Eₙ", label: `n = 1…${entity.nmax} · Z = ${entity.atomicNumber}${drops.length ? ` · ${drops.length} drop${drops.length === 1 ? "" : "s"}` : ""}`,
      detail: "Canvas preserves the energy ladder, transition choices, and linked spectra. Preview owns exact Bohr energies, wavelengths, photon travel, spectral-line creation, and transition playback.",
      representation: "semantic", tone: "info", refs: [`${entity.id}.rungs`, `${entity.id}.electron`, `${entity.id}.photon`, ...spectra.map((item) => item.id)],
    });
  }
  if (entity.kind === "emission") add({
    id: "emission-spectrum", icon: "▥λ", label: `Spectrum from ${entity.levels}`,
    detail: "Canvas shows the authored spectrum frame and its live energy-level dependency. Preview computes visible wavelengths and owns exact line placement, labels, and emitted-line updates.",
    representation: "semantic", tone: doc.entities.some((candidate) => candidate.id === entity.levels && candidate.kind === "levels") ? "info" : "warning", refs: [entity.levels, `${entity.id}.lines`, `${entity.id}.axis`],
  });
  if (entity.kind === "cell") {
    const discharges = doc.steps.flatMap(stepActions).filter((action) => action.target === entity.id && action.verb === "discharge");
    add({
      id: "galvanic-cell", icon: "−|+", label: `${entity.metals}${discharges.length ? ` · ${discharges.length} discharge beat${discharges.length === 1 ? "" : "s"}` : ""}`,
      detail: "Canvas shows editable electrodes, bridge, circuit, carriers, and measurement intent. Preview owns redox potentials, current, charge transfer, Faraday mass loss, carrier motion, and exact readings.",
      representation: "semantic", tone: "info", refs: [`${entity.id}.anode`, `${entity.id}.cathode`, `${entity.id}.bridge`, `${entity.id}.readout`],
    });
  }
  if (entity.kind === "lattice") {
    const dissolves = doc.steps.flatMap(stepActions).filter((action) => action.target === entity.id && action.verb === "dissolve");
    add({
      id: "ionic-lattice", icon: "⊕⊖", label: `${entity.cols}×${entity.rows} ${entity.formula}${dissolves.length ? ` · ${dissolves.length} dissolve beat${dissolves.length === 1 ? "" : "s"}` : ""}`,
      detail: "Canvas keeps lattice dimensions, ion families, hydration intent, and dissolve count editable. Preview owns coordination order, oriented water shells, energy accounting, and particle motion.",
      representation: "semantic", tone: "info", refs: [`${entity.id}.ions`, `${entity.id}.water`, `${entity.id}.energy`],
    });
  }
  if (entity.kind === "newman") {
    const profiles = doc.entities.filter((candidate) => candidate.kind === "profile" && candidate.torsion === entity.id);
    add({
      id: "torsion-projection", icon: "⊙", label: `Newman projection${profiles.length ? ` · profile ${profiles.map((item) => item.id).join(", ")}` : ""}`,
      detail: "Canvas represents the selected central bond and substituent groups for composition. Preview reads the 3D molecule, validates the rotatable bond, computes torsion energy, and owns exact geometry.",
      representation: "semantic", tone: "info", refs: [`${entity.id}.front`, `${entity.id}.back`, ...profiles.map((item) => item.id)],
    });
  }
  if (entity.kind === "profile") add({
    id: "torsion-profile", icon: "⌁°", label: `Energy profile from ${entity.torsion}`,
    detail: "Canvas keeps the plot frame and Newman relationship editable. Preview computes the full torsion-energy curve and synchronizes its live marker with molecular rotation.",
    representation: "semantic", tone: doc.entities.some((candidate) => candidate.id === entity.torsion && candidate.kind === "newman") ? "info" : "warning", refs: [entity.torsion, `${entity.id}.curve`, `${entity.id}.marker`],
  });
  if (entity.kind === "vibration") {
    const spectra = doc.entities.filter((candidate) => candidate.kind === "irspectrum" && candidate.molecule === entity.id);
    add({
      id: "molecular-vibration", icon: "↔ν", label: `Normal modes${spectra.length ? ` · IR ${spectra.map((item) => item.id).join(", ")}` : ""}`,
      detail: "Canvas shows the molecule asset, mode relationship, and stable atom family. Preview derives normal modes from 3D geometry, animates displacement vectors, and computes IR activity.",
      representation: "semantic", tone: "info", refs: [`${entity.id}.atoms`, `${entity.id}.readout`, ...spectra.map((item) => item.id)],
    });
  }
  if (entity.kind === "irspectrum") add({
    id: "infrared-spectrum", icon: "IR", label: `IR spectrum from ${entity.molecule}`,
    detail: "Canvas keeps the spectrum frame and molecular-vibration relationship visible. Preview computes active and silent modes, frequencies, intensities, peaks, and exact spectrum pixels.",
    representation: "semantic", tone: doc.entities.some((candidate) => candidate.id === entity.molecule && candidate.kind === "vibration") ? "info" : "warning", refs: [entity.molecule, `${entity.id}.peaks`, `${entity.id}.silent`],
  });
  if (entity.kind === "molecule3") add({
    id: "molecule3-asset", icon: "⚛3", label: "3D molecular asset",
    detail: "Canvas projects a bounded molecule placement proxy through the initial camera and exposes source, centre, scale, style, hydrogen, and spin intent. Preview parses atomic coordinates and owns bonds, multiple bonds, depth, shading, spin, and final pixels.",
    representation: "semantic", tone: "info", refs: ["__camera3", `${entity.id}.atoms`, `${entity.id}.bonds`, `${entity.id}.multibonds`],
  });

  if (entity.kind === "param" || entity.kind === "polar") add({
    id: "parametric-sample", icon: entity.kind === "param" ? "x(t)" : "rθ", label: "Bounded formula-path sample",
    detail: `Canvas samples the authored ${entity.kind === "param" ? "x(t), y(t)" : "r(t)"} path for composition. Preview evaluates the native 1,001 points and owns exact stroke pixels.`,
    representation: "semantic", tone: "info", refs: [],
  });
  if (entity.kind === "spline") add({
    id: "spline-sample", icon: "⌁", label: `${entity.points.length} editable knots`,
    detail: "Canvas uses the native Catmull–Rom construction and exposes draggable knots. Preview owns exact tessellation, draw-on timing, and final stroke pixels.",
    representation: "semantic", tone: "info", refs: entity.points.map((_point, index) => `${entity.id}.k${index}`),
  });
  if (entity.kind === "trajectory") add({
    id: "trajectory-sample", icon: "ẋ", label: `${Math.min(800, entity.steps)} of ${entity.steps} RK4 steps shown`,
    detail: "Canvas integrates a bounded deterministic design path from the authored differential system. Preview runs every native step and owns animation and final pixels.",
    representation: "semantic", tone: "info", refs: [],
  });

  if (entity.kind === "cloud") add({
    id: "cloud-sample", icon: "⁙", label: `${Math.min(entity.count, 600)} of ${entity.count} points sampled`,
    detail: entity.source ? `Canvas preserves the ${entity.source} home-point relationship as a semantic field. Preview resolves its native glyph, shape, path, flow, or map samples.` : "Canvas deterministically samples the formula field at t=0. Preview evaluates every point, live time, and parameter binding.",
    representation: "semantic", tone: "info", refs: [],
  });
  if (entity.kind === "cloud3") add({
    id: "cloud3-sample", icon: "⁙3", label: `${Math.min(entity.count, 600)} of ${entity.count} 3D points sampled`,
    detail: "Canvas projects a deterministic t=0 subset through the initial camera. Preview evaluates every point with live time, parameters, depth, and native shading.",
    representation: "semantic", tone: "info", refs: ["__camera3"],
  });
  if (entity.kind === "shader") add({
    id: "shader-sample", icon: "▦", label: "Reduced t=0 shader sample",
    detail: "Canvas evaluates a bounded low-resolution formula thumbnail for composition. Preview owns full-resolution pixels, live time, and GPU execution.",
    representation: "semantic", tone: "info", refs: [],
  });
  if (entity.kind === "glsl") {
    const uniformNames = [...new Set([...entity.source.matchAll(/\buniform\s+[A-Za-z_][A-Za-z0-9_]*\s+([A-Za-z_][A-Za-z0-9_]*)/gu)].map((match) => match[1]))];
    const parameters = new Set(doc.entities.filter((item) => item.kind === "parameter").map((item) => item.id));
    const parameterNames = uniformNames.filter((name) => name.startsWith("u_")).map((name) => name.slice(2));
    const boundParameters = parameterNames.filter((name) => parameters.has(name));
    const cameraNames = ["iCamEye", "iCamFwd", "iCamRight", "iCamUp", "iCamThf"];
    const builtinNames = ["iTime", "iResolution", "iMouse"];
    const usesCamera = uniformNames.some((name) => cameraNames.includes(name));
    const unbound = uniformNames.filter((name) => !builtinNames.includes(name) && !cameraNames.includes(name) && !(name.startsWith("u_") && parameters.has(name.slice(2))));
    add({
      id: "glsl-preview", icon: "GL", label: unbound.length ? `${unbound.length} GLSL uniform${unbound.length === 1 ? "" : "s"} unbound` : `Raw GLSL · ${boundParameters.length} parameter binding${boundParameters.length === 1 ? "" : "s"}`,
      detail: unbound.length ? `${unbound.join(", ")} ${unbound.length === 1 ? "has" : "have"} no Manic runtime binding. Add a matching parameter for u_<name>, or keep the native default intentionally. Canvas never fabricates shader pixels.` : "Canvas preserves the full-canvas GPU pass, source, and uniform relationships. Native Preview compiles mainImage at full resolution with live iTime, iResolution, iMouse, camera, and parameter values.",
      representation: "semantic", tone: unbound.length ? "warning" : "info", refs: [...parameterNames, ...(usesCamera ? ["__camera3"] : [])],
    });
  }
  if (entity.kind === "ifs2") {
    const generated = ifs2Geometry(entity);
    const shown = generated.mode === "points" ? generated.points.length : generated.segments.length;
    add({
      id: "ifs2-sample", icon: generated.mode === "points" ? "⁙ƒ" : "⌁ƒ",
      label: generated.issue ? "Affine rules need attention" : `${shown.toLocaleString()} of ${generated.total.toLocaleString()} ${generated.mode} shown`,
      detail: generated.issue ?? `Canvas runs the authored deterministic seed and affine rules with a bounded sample. Preview renders the full native element count and ${generated.mode === "points" ? "per-rule palette" : "segment spectrum"}.`,
      representation: "semantic", tone: generated.issue ? "warning" : "info", refs: [],
    });
  }
  if (entity.kind === "mandelbrot") {
    const generated = mandelbrotGeometry(entity);
    add({
      id: "mandelbrot-sample", icon: "M∞", label: `${generated.cells.length.toLocaleString()} of ${generated.nativeCells.toLocaleString()} cells shown`,
      detail: "Canvas uses a bounded escape-time grid for composition. Preview owns the authored native resolution, iterations, colour ramp, and final pixels.",
      representation: "semantic", tone: "info", refs: [],
    });
  }
  if (entity.kind === "polarpath") {
    const generated = polarPathGeometry(entity);
    add({
      id: "polarpath-sample", icon: "rθ", label: generated.issue ? "Polar formula needs attention" : `${generated.points.length.toLocaleString()} of ${generated.nativePoints.toLocaleString()} points shown`,
      detail: generated.issue ?? "Canvas evaluates a bounded static r(t) curve. Preview owns the full native sample budget and exact stroke pixels.",
      representation: "semantic", tone: generated.issue ? "warning" : "info", refs: [],
    });
  }
  if (entity.kind === "hull2") {
    const generated = hull2Geometry(entity, doc);
    add({
      id: "hull2-sample", icon: "⬡", label: generated.issue ? "Hull relationship needs attention" : `Hull from ${generated.sourcePoints.toLocaleString()} sampled points`,
      detail: generated.issue ?? `Canvas derives onion depth ${Math.floor(entity.depth ?? 0)} from the bounded ${entity.cloud} sample. Preview computes the hull from the complete native IFS point cloud.`,
      representation: "semantic", tone: generated.issue ? "warning" : "info", refs: [entity.cloud],
    });
  }
  if (entity.kind === "repeat") {
    const generated = repeatGeometry(entity, geometry);
    const overLimit = generated.nativeEntities > 12_000;
    add({
      id: "repeat-layout", icon: "⠿", label: `${generated.total} native ${entity.layout} instance${generated.total === 1 ? "" : "s"}`,
      detail: overLimit ? `This motif and layout would create about ${generated.nativeEntities.toLocaleString()} entities, above Manic's 12,000-entity repeat limit. Reduce the layout or motif before Preview.` : `Canvas shows ${generated.placements.length} bounded motif stamps and preserves the live ${entity.motif} relationship. Preview clones the exact artwork and creates stable ${entity.id}.iN tags.`,
      representation: "semantic", tone: generated.motifBox && !overLimit ? "info" : "warning", refs: [entity.motif],
    });
  }
  if (entity.kind === "lsystem") {
    const generated = lsystemGeometry(entity);
    add({
      id: "lsystem-grammar", icon: "⌁ƒ", label: generated.issue ? "Grammar needs attention" : `${generated.drawnSegments.toLocaleString()}-segment fitted curve`,
      detail: generated.issue ?? `Canvas draws at most ${LSYSTEM_CANVAS_POINT_CAP.toLocaleString()} fitted points from ${generated.expandedSymbols.toLocaleString()} expanded symbols. Preview owns the full batched path${entity.boundary === "filled" ? " and concave fill" : ""}.`,
      representation: "semantic", tone: generated.issue ? "warning" : "info", refs: [],
    });
  }
  if (entity.kind === "trail") add({
    id: "motion-trail", icon: "〰", label: `Records ${entity.target}`,
    detail: "Canvas shows the persistent motion relationship. Preview resolves the target's complete animation timeline and draws the exact accumulated path.",
    representation: "semantic", tone: geometry.entity(entity.target) ? "info" : "warning", refs: [entity.target],
  });
  if (entity.kind === "sweep") {
    const total = Math.max(1, Math.round(entity.rows)) * Math.max(1, Math.round(entity.cols));
    add({ id: "parameter-sweep", icon: "▦ƒ", label: `${total} evaluations of ${entity.template}`, detail: `Columns vary ${entity.xParam}; rows vary ${entity.yParam}. Canvas is a bounded grid contract, while Preview re-invokes the native template and fits its exact generated family in every cell.`, representation: "semantic", tone: geometry.entity(entity.template) ? "info" : "warning", refs: [entity.template, `${entity.id}.cells`] });
  }
  if (entity.kind === "sliders") add({
    id: "coordinate-sliders", icon: "☷", label: `${Math.round(entity.count)} addressable dials`,
    detail: `Canvas and Story expose the rack and its values. Preview owns native text metrics and the live ${entity.id}.sum event. Children remain addressable as ${entity.id}.dN, .lineN, and .labelN.`,
    representation: "semantic", tone: "info", refs: [`${entity.id}.dials`, `${entity.id}.sum`],
  });
  if (entity.kind === "loupe") add({
    id: "live-loupe", icon: "⌕", label: `${entity.magnification}× live magnifier`,
    detail: `Drag the source-size and panel handles or edit their Inspector fields. Preview redraws the live scene under ${entity.id}.frame inside ${entity.id}.panel.`,
    representation: "semantic", tone: "info", refs: [`${entity.id}.frame`, `${entity.id}.panel`],
  });
  if (entity.kind === "gridmap") add({
    id: "gridmap-morph", icon: "▦⇢", label: entity.customFrom ? "Matrix-to-matrix space morph" : "Identity-to-matrix space morph",
    detail: "Canvas overlays the authored from- and destination-grids for composition. Preview applies to(id, morph, …) continuously to every native grid and basis child.",
    representation: "semantic", tone: "info", refs: [`${entity.id}.bg`, `${entity.id}.i`, `${entity.id}.j`],
  });
  if (entity.kind === "squish") add({
    id: "squish-morph", icon: "▦→—", label: `Plane collapses under [${entity.a} ${entity.b}]`,
    detail: "Canvas overlays the plane and collapsed number-line destination. Preview performs the continuous rank-reducing morph and owns the intermediate pixels.",
    representation: "semantic", tone: "info", refs: [`${entity.id}.line`, `${entity.id}.dual`],
  });
  if (entity.kind === "scalarfield") add({
    id: "scalar-field-declaration", icon: "ƒ", label: `Reusable field ${entity.id}(x, y)`,
    detail: "This card represents a pure source declaration, not a drawable native entity. Inspector edits its one formula; Preview inlines it into later formula consumers.",
    representation: "semantic", tone: "info", refs: [],
  });
  if (entity.kind === "vectorfield") add({
    id: "vector-field-sample", icon: "⇢⁙", label: entity.formulaMode ? "Formula vector field at p = 0" : `Named ${entity.namedField} vector field`,
    detail: "Canvas shows the native lattice contract with bounded deterministic samples. Preview owns parameter bindings, runtime refresh, and final arrow pixels.",
    representation: "semantic", tone: "info", refs: [],
  });
  if (entity.kind === "domaincolor") add({
    id: "domain-color-sample", icon: "z→◫", label: `Complex domain coloring: ${entity.formula}`,
    detail: "Canvas draws a bounded authoring thumbnail for its supported complex subset and otherwise shows the formula contract. Preview evaluates the full native function set, including zeta, at render resolution.",
    representation: "semantic", tone: "info", refs: [],
  });
  if (entity.kind === "warp") add({
    id: "warp-morph", icon: "▦⇝", label: `Complex grid morph: z → ${entity.formula}`,
    detail: "Canvas overlays the identity and sampled destination grids. Preview continuously interpolates every native grid child through to(id, morph, …).",
    representation: "semantic", tone: "info", refs: [],
  });
  if (entity.kind === "rref") {
    const result = rrefStates(entity.source);
    add({
      id: "rref-states", icon: "RREF", label: result.issue ? "Row reduction needs attention" : `${result.states.length} elimination states`,
      detail: result.issue ?? "Canvas shows the final reduced matrix and keeps every native .sN state and .opN caption addressable. Preview owns cross-fades and row-operation timing.",
      representation: "semantic", tone: result.issue ? "warning" : "info", refs: result.states.map((_state, index) => `${entity.id}.s${index}`),
    });
  }
  if (["histogram", "covariance", "bayes", "hypothesis", "bellcurve", "summary", "correlation", "skew", "boxplot", "distribution", "confidence", "montecarlo", "randomwalk", "lln", "clt"].includes(entity.kind)) {
    const result = statsGeometry(entity as import("./types.js").StatsEntity);
    add({ id: "stats-composition", icon: "∑", label: result.issue ? "Statistical inputs need attention" : `${entity.kind} · ${result.primitives.length} Canvas parts`, detail: result.issue ?? result.note ?? "Canvas reconstructs the native statistical composition and keeps its generated children available to Story. Native Preview remains the final pixel authority.", representation: result.semantic ? "semantic" : "exact", tone: result.issue ? "warning" : "info", refs: result.primitives.flatMap((primitive) => [primitive.id, ...primitive.tags]).filter((ref, index, refs) => ref !== entity.id && refs.indexOf(ref) === index) });
  }
  if (["network", "activation", "tensor", "digit", "kernel", "convolve", "pool", "tokenize", "embedding", "transformer", "logits", "attention", "topk"].includes(entity.kind)) {
    const ml = entity as import("./types.js").MlEntity, operations = doc.steps.flatMap(stepActions).filter((action) => action.target === ml.id && ["forward", "feed", "loss", "backward", "checkpoint", "update", "restore", "scan", "encode", "sample", "attend"].includes(action.verb));
    const missing = [ml.ref, ml.ref2].filter(Boolean).filter((ref) => !doc.entities.some((candidate) => candidate.id === ref));
    let summary = `${ml.kind} is editable on Canvas`, warning: string | null = missing.length ? `Missing dependency: ${missing.join(", ")}.` : null;
    if (ml.kind === "network") { const layers = mlLayers(ml); summary = layers.length ? `${layers.join(" → ")} network · ${operations.length} runtime beat${operations.length === 1 ? "" : "s"}` : "Network needs positive layer sizes"; if (!layers.length) warning = "Layer sizes must contain positive numbers."; }
    else if (["tensor", "digit", "kernel"].includes(ml.kind)) { const grid = mlTensorGrid(ml); summary = grid.issue ?? `${grid.channels}×${grid.rows}×${grid.cols} ${ml.kind}`; warning = warning ?? grid.issue; }
    else if (ml.kind === "convolve" || ml.kind === "pool") { const shape = mlOutputShape(ml, doc); summary = shape.issue ?? `${ml.kind} output ${shape.channels}×${shape.rows}×${shape.cols} · ${shape.steps} scan steps`; warning = warning ?? shape.issue; }
    else if (ml.kind === "tokenize" || ml.kind === "attention") summary = `${mlTokens(ml).length} token${mlTokens(ml).length === 1 ? "" : "s"} · ${operations.length} runtime beat${operations.length === 1 ? "" : "s"}`;
    const exact = ["activation", "tensor", "kernel", "tokenize"].includes(ml.kind);
    add({ id: "ml-contract", icon: "ML", label: warning ?? summary, detail: warning ?? (exact ? "Canvas reconstructs this deterministic authoring figure and its stable generated children. Native Preview remains the final pixel authority." : "Canvas shows the editable structure, relationships, and runtime beats. Native Preview owns numerical execution, learned state, and exact animation pixels."), representation: exact ? "exact" : "semantic", tone: warning ? "warning" : "info", refs: [ml.ref, ml.ref2, ...operations.flatMap(actionReferences)].filter(Boolean) });
  }
  if (["refract", "lens", "prism", "achromat", "lenssystem", "rayfan", "spotdiagram", "fieldspot"].includes(entity.kind)) {
    const optics=entity as import("./types.js").OpticsEntity, geometry=opticsGeometry(optics), runs=doc.steps.flatMap(stepActions).filter(action=>action.target===optics.id&&action.verb==="run"), analysis=["rayfan","spotdiagram","fieldspot"].includes(optics.kind);
    add({ id:"optics-contract",icon:"◈",label:`${optics.kind} · ${geometry.primitives.length} Canvas parts${runs.length?` · ${runs.length} sweep${runs.length===1?"":"s"}`:""}`,detail:analysis?`${geometry.note}. Canvas preserves the preset, analysis frame, and stable generated-child targets; Preview performs the complete physical trace and owns exact values and pixels.`:`${geometry.note}. Canvas shows the editable optical structure and sweep intent; Preview evaluates Snell/dispersion/surface intersections and owns the animated ray positions.`,representation:"semantic",tone:"info",refs:geometry.primitives.flatMap(primitive=>[primitive.id,...primitive.tags]).filter((ref,index,refs)=>ref!==optics.id&&refs.indexOf(ref)===index) });
  }
  if(PHYSICS_KINDS.includes(entity.kind as never)){
    const physics=entity as import("./types.js").PhysicsEntity,geometry=physicsGeometry(physics),actions=doc.steps.flatMap(stepActions).filter(action=>action.target===physics.id&&["run","swing","forces"].includes(action.verb)),featureCount=physics.species.length+physics.rules.length+[physics.speeds,physics.phase,physics.well,physics.timegraph,physics.energygraph].filter(Boolean).length;
    add({id:"physics-contract",icon:"∫t",label:`${physics.kind} · ${geometry.primitives.length} bounded Canvas parts${actions.length?` · ${actions.length} playback beat${actions.length===1?"":"s"}`:""}`,detail:`Canvas preserves initial conditions${featureCount?`, ${featureCount} dependent view/feature${featureCount===1?"":"s"}`:""}, generated-child targets, and playback intent. It does not advance the simulation. Native Preview owns integration, collisions/events, live force and energy values, and exact animation pixels.`,representation:"semantic",tone:"info",refs:geometry.primitives.flatMap(primitive=>[primitive.id,...primitive.tags]).filter((ref,index,refs)=>ref!==physics.id&&refs.indexOf(ref)===index)});
  }
  if(SYSTEM_ENTITY_KINDS.includes(entity.kind as never)){
    if(entity.kind==="architecture"||entity.kind==="flowchart"||entity.kind==="c4"){
      const nodes=doc.entities.filter(candidate=>candidate.kind==="node"&&systemDiagramFor(candidate.id,doc)?.id===entity.id),clusters=doc.entities.filter(candidate=>candidate.kind==="cluster"&&systemDiagramFor(candidate.id,doc)?.id===entity.id),connections=doc.entities.filter(candidate=>candidate.kind==="connect"&&systemDiagramFor(candidate.from,doc)?.id===entity.id);
      add({id:"systems-layout",icon:"▦",label:`${entity.kind} · ${nodes.length} node${nodes.length===1?"":"s"} · ${clusters.length} cluster${clusters.length===1?"":"s"} · ${connections.length} connection${connections.length===1?"":"s"}`,detail:"Canvas shows deterministic bounded ownership and topology. Native Preview recomputes responsive auto-layout, scale-to-fit, provider icons, C4/flowchart details, ports, and concrete cluster fan-out lanes.",representation:"semantic",tone:"info",refs:[`${entity.id}.nodes`,`${entity.id}.connections`,`${entity.id}.clusters`]});
    }else if(entity.kind==="connect"){
      const path=systemConnectionGeometry(entity,doc);add({id:"systems-connection",icon:"⇢",label:`${entity.from} → ${entity.to}${entity.annotation?` · ${entity.annotation}`:""}`,detail:`Canvas preserves ${entity.routing==="orthogonal"?"port-aware orthogonal routing":entity.bend?`a signed ${entity.bend}px bend`:"a direct possibility lane"}. Preview expands cluster endpoints into valid physical lanes and illuminates only the selected runtime path.`,representation:"semantic",tone:path.points.length?"info":"warning",refs:[entity.from,entity.to,`${entity.id}.hot`]});
    }else if(entity.kind==="message"||entity.kind==="request"){
      const routes=doc.steps.flatMap(stepActions).filter(action=>action.target===entity.id&&["route","hotpath"].includes(action.verb));add({id:"systems-message",icon:"●→",label:`${entity.label} starts at ${entity.source}${routes.length?` · ${routes.length} route beat${routes.length===1?"":"s"}`:""}`,detail:"Canvas keeps one persistent identity and its authored route relationships visible. Preview validates continuity from the message’s current node, chooses seeded fan-out lanes, and owns exact motion and hot-path illumination.",representation:"semantic",tone:"info",refs:[entity.source,...routes.flatMap(action=>action.ref?[action.ref]:[])]});
    }
  }
  if(entity.kind==="circuit"){
    const geometry=circuitGeometry(entity),actions=doc.steps.flatMap(stepActions).filter(action=>action.target===entity.id&&["run","cut","reconnect"].includes(action.verb));
    add({id:"circuit-contract",icon:"⏚",label:`${geometry.parts.length} component${geometry.parts.length===1?"":"s"} · ${entity.probes.length} probe${entity.probes.length===1?"":"s"} · ${entity.scopes.length} scope${entity.scopes.length===1?"":"s"}${actions.length?` · ${actions.length} Story beat${actions.length===1?"":"s"}`:""}`,detail:geometry.warning??"Canvas preserves netlist topology, part identities, measurement declarations, and Story intent. Preview performs MNA/nonlinear/transient solving and owns actual readings, current speed, lamp glow, scope curves, and exact playback pixels.",representation:"semantic",tone:geometry.warning?"warning":"info",refs:[`${entity.id}.parts`,`${entity.id}.nodes`,`${entity.id}.probes`,`${entity.id}.scopes`,`${entity.id}.charge`]});
  }
  if (entity.kind === "array") {
    const count = algoValues(entity.source).length;
    const operations = doc.steps.flatMap(stepActions).filter((action) => action.target === entity.id && action.verb === "compare");
    const invalid = operations.filter((action) => (action.values ?? []).slice(0, 2).some((index) => index < 0 || index >= count));
    add({
      id: "algo-array", icon: "[i]", label: count ? `${count} fixed slot${count === 1 ? "" : "s"}${operations.length ? ` · ${operations.length} comparison${operations.length === 1 ? "" : "s"}` : ""}` : "Array needs values",
      detail: invalid.length ? `${invalid.length} Compare beat${invalid.length === 1 ? " uses" : "s use"} a slot outside 0…${Math.max(0, count - 1)}. Canvas keeps the fixed slots visible; Preview resolves live value occupancy after swaps.` : "Canvas exactly shows fixed boxes and initial value children. Compare follows live slot occupancy, so Preview remains authoritative after swaps or rewrites.",
      representation: operations.length ? "semantic" : "exact", tone: !count || invalid.length ? "warning" : "info", refs: [`${entity.id}.boxes`, `${entity.id}.cells`],
    });
  }
  if (entity.kind === "pointer") {
    const array = doc.entities.find((candidate) => candidate.id === entity.array);
    const count = array?.kind === "array" ? algoValues(array.source).length : 0;
    const moves = doc.steps.flatMap(stepActions).filter((action) => action.verb === "pointat" && action.target === entity.id);
    const invalid = array?.kind !== "array" || entity.slot < 0 || entity.slot >= count || moves.some((action) => action.ref !== entity.array || (action.amount ?? -1) < 0 || (action.amount ?? -1) >= count);
    add({ id: "algo-pointer", icon: "▲i", label: `Points to ${entity.array}[${entity.slot}]${moves.length ? ` · ${moves.length} move${moves.length === 1 ? "" : "s"}` : ""}`, detail: invalid ? "The initial slot or a Point at beat does not resolve to this array's fixed slot range. Choose a valid array and index before Preview." : "Canvas exactly places the initial marker. Point at annotations preserve later destination relationships; Preview executes their timing.", representation: moves.length ? "semantic" : "exact", tone: invalid ? "warning" : "info", refs: [entity.array, `${entity.array}.box${entity.slot}`] });
  }
  if (entity.kind === "stack" || entity.kind === "queue") {
    const addVerb = entity.kind === "stack" ? "push" : "enqueue", removeVerb = entity.kind === "stack" ? "pop" : "dequeue";
    const operations = doc.steps.flatMap(stepActions).filter((action) => action.target === entity.id && (action.verb === addVerb || action.verb === removeVerb));
    let occupancy = 0, underflow = 0, peak = 0;
    for (const action of operations) { if (action.verb === addVerb) { occupancy += 1; peak = Math.max(peak, occupancy); } else if (occupancy > 0) occupancy -= 1; else underflow += 1; }
    add({ id: `algo-${entity.kind}`, icon: entity.kind === "stack" ? "▤" : "▥", label: operations.length ? `${operations.length} operation${operations.length === 1 ? "" : "s"} · peak ${peak} cell${peak === 1 ? "" : "s"}` : `Empty ${entity.kind} anchor`, detail: underflow ? `${underflow} ${removeVerb} beat${underflow === 1 ? " runs" : "s run"} while the simulated container is empty. Reorder or add ${addVerb} before native Preview.` : `Canvas shows the empty anchor and operation direction without fabricating runtime cells. Preview creates stable ${entity.id}.cellN.box/.v children and executes ${entity.kind === "stack" ? "LIFO" : "FIFO"} occupancy.`, representation: "semantic", tone: underflow ? "warning" : "info", refs: [`${entity.id}.anchor`, `${entity.id}.cells`] });
  }
  if (entity.kind === "list") {
    const initial = algoValues(entity.source).length, operations = doc.steps.flatMap(stepActions).filter((action) => action.target === entity.id && (action.verb === "insert" || action.verb === "remove"));
    let count = initial, invalid = 0;
    for (const action of operations) { const index = Math.trunc(action.amount ?? -1); if (index < 0 || index >= count) invalid += 1; else if (action.verb === "insert") count += 1; else count -= 1; }
    add({ id: "algo-list", icon: "[•]→", label: `${initial} initial ${entity.listKind} node${initial === 1 ? "" : "s"}${operations.length ? ` · ${operations.length} mutation${operations.length === 1 ? "" : "s"}` : ""}`, detail: invalid ? `${invalid} Insert/Remove beat${invalid === 1 ? " addresses" : "s address"} an index outside the live list at that point. Canvas shows initial anatomy only; fix Story ordering or indexes before Preview.` : `Canvas exactly shows initial node compartments, head, terminators, and stable children. Preview owns inserted node ids, old-arrow fading, live re-threading, and operation motion.`, representation: operations.length ? "semantic" : "exact", tone: !initial || invalid ? "warning" : "info", refs: [`${entity.id}.nodes`, `${entity.id}.next`, ...(entity.listKind === "doubly" ? [`${entity.id}.prev`] : [])] });
  }
  if (entity.kind === "hashmap") {
    const operations = doc.steps.flatMap(stepActions).filter((action) => action.target === entity.id && (action.verb === "put" || action.verb === "get"));
    const layout = hashmapLayout(entity, doc), gets = operations.filter((action) => action.verb === "get").map((action) => ({ action, plan: hashmapLookupPlan(entity, action, doc) }));
    const hits = gets.filter((item) => item.plan.hit !== null).length;
    add({ id: "algo-hashmap", icon: "#→", label: `${Math.max(1, Math.trunc(entity.buckets))} buckets · ${layout.entries.length} planned entr${layout.entries.length === 1 ? "y" : "ies"}${gets.length ? ` · ${hits}/${gets.length} lookup hits` : ""}`, detail: "Canvas deterministically hashes every authored Put and shows its planned separate chain as an authoring ghost. Get timing is derived from the live chain before that beat; Preview owns entry creation, sequential scan colours, and hit/miss playback.", representation: operations.length ? "semantic" : "exact", tone: entity.buckets < 1 ? "warning" : "info", refs: [`${entity.id}.buckets`, `${entity.id}.entries`, `${entity.id}.chains`] });
  }
  if (entity.kind === "graph") {
    const geometryResult = graphGeometry(entity), operations = doc.steps.flatMap(stepActions).filter((action) => action.target === entity.id && ["bfs", "dfs", "dijkstra"].includes(action.verb));
    const plans = operations.map((action) => graphAlgorithmPlan(entity, action.text ?? "", action.verb as "bfs" | "dfs" | "dijkstra")), invalid = plans.filter((plan) => plan.issue);
    add({ id: "algo-graph", icon: "●—●", label: `${geometryResult.vertices.length} vertices · ${geometryResult.edges.length} edges${operations.length ? ` · ${operations.length} algorithm beat${operations.length === 1 ? "" : "s"}` : ""}`, detail: geometryResult.issue ?? (invalid[0]?.issue || (operations.length ? `Canvas computes traversal order and derived runtime for Story. Preview owns frontier/distance labels, per-node state transitions, relaxed edges, and final shortest-path-tree pixels.` : "Canvas exactly shows the authored labelled nodes, trimmed directed/undirected edges, and weights.")), representation: operations.length ? "semantic" : "exact", tone: geometryResult.issue || invalid.length ? "warning" : "info", refs: [`${entity.id}.nodes`, `${entity.id}.edges`, ...operations.flatMap((action) => action.verb === "dijkstra" ? geometryResult.vertices.map((name) => `${entity.id}.${name}.d`) : [`${entity.id}.frontier`, `${entity.id}.visited`])] });
  }

  if (entity.gradient?.mode === "speed") add({
    id: "gradient-speed", icon: "⚡", label: "Speed gradient",
    detail: "Manic maps the palette to true local trajectory speed. Canvas shows a static palette guide; Preview computes the exact result.",
    representation: "semantic", tone: "warning", refs: [],
  });
  if (entity.gradient?.mode === "curvature") add({
    id: "gradient-curvature", icon: "∿", label: "Curvature gradient",
    detail: "Manic maps the palette to computed path curvature. Canvas shows the palette along the stroke; Preview computes the exact distribution.",
    representation: "semantic", tone: "info", refs: [],
  });
  if (entity.clip) add({
    id: "clip", icon: "◫", label: `Clipped to ${entity.clip}`,
    detail: "The rectangular crop follows this region as the scene changes.",
    representation: "exact", tone: geometry.bounds(entity.clip) ? "info" : "warning", refs: [entity.clip],
  });
  if (entity.mask) {
    const region = doc.entities.find((candidate) => candidate.id === entity.mask);
    const exact = region && ["circle", "rect", "polygon", "sector", "annulus"].includes(region.kind);
    add({
      id: "mask", icon: "◉", label: `Masked by ${entity.mask}`,
      detail: exact ? "Canvas shows this live silhouette relationship." : "Canvas indicates the live mask relationship; Preview resolves its exact silhouette.",
      representation: exact ? "exact" : "semantic", tone: geometry.bounds(entity.mask) ? "info" : "warning", refs: [entity.mask],
    });
  }
  if (entity.pin3) add({
    id: "pin3", icon: "⌖3", label: entity.pin3.form === "label3" ? "Depth-scaled 3D label" : "Pinned to a 3D point",
    detail: "Canvas projects the initial camera pose and keeps the world-point relationship editable. Preview follows the point through camera motion.",
    representation: "semantic", tone: "info", refs: ["__camera3", ...(entity.pin3.target ? [entity.pin3.target] : [])],
  });
  if (entity.morph2) add({
    id: "morph2", icon: "⇄", label: `Morph target ${entity.morph2.target}`,
    detail: "Canvas shows the source and target relationship. Preview renders the native sampled outline morph and optional winding.",
    representation: "semantic", tone: geometry.bounds(entity.morph2.target) ? "info" : "warning", refs: [entity.morph2.target],
  });
  if (entity.kind === "parameter") {
    entity.bindings.forEach((binding, index) => add({
      id: `binding-${index}`, icon: "⛓p", label: `Drives ${binding.target}.${binding.property}`,
      detail: binding.formulas.length > 0
        ? `Preview evaluates ${binding.formulas.length === 1 ? binding.formulas[0] : `${binding.formulas.length} component formulas`} as the parameter changes.`
        : `Preview maps the parameter range to ${binding.from}…${binding.to}.`,
      representation: "semantic", tone: geometry.bounds(binding.target) ? "info" : "warning", refs: [binding.target],
    }));
  }
  if (entity.kind === "creator") {
    if (entity.socials && entity.footer !== "none") add({ id: "socials", icon: "@", label: "Responsive social footer", detail: "Canvas sketches the authored profile and responsive footer region. Preview draws the exact native icon geometry and layout.", representation: "semantic", tone: "info", refs: [`${entity.id}.footer`] });
    if (entity.socials && entity.footer === "none") add({ id: "socials", icon: "@", label: "Social footer suppressed", detail: "The socials statement is preserved, but the profile's footer=none setting means native Preview creates no footer drawables. Choose another Footer style to reveal it.", representation: "semantic", tone: "warning", refs: [] });
    if (entity.endcard) add({ id: "endcard", icon: "▣", label: "Hidden creator end card", detail: "Canvas keeps the end card visible as an authoring ghost. Preview starts its generated parts hidden until a Show beat targets the endcard.", representation: "semantic", tone: "info", refs: [`${entity.id}.endcard`] });
  }
  if (entity.kind === "safezone") add({ id: "safezone", icon: "▱", label: `${entity.mode} safe area`, detail: "This guide is ordinary Manic geometry and will render unless hidden or removed.", representation: "exact", tone: "info", refs: [] });
  if (entity.kind === "figure") add({ id: "figure", icon: "▣↔", label: `Fits ${entity.target}`, detail: "Canvas shows the destination region and relationship. Preview performs the native group scale and translation.", representation: "semantic", tone: geometry.bounds(entity.target) ? "info" : "warning", refs: [entity.target] });
  if (entity.kind === "quiz") {
    const correct = entity.options.filter((option) => option.correct).length;
    add({ id: "quiz-workflow", icon: "?", label: `${entity.options.length} answer${entity.options.length === 1 ? "" : "s"} · ${correct === 1 ? "correct answer set" : correct === 0 ? "no correct answer" : "multiple correct answers"}`, detail: "Canvas keeps question, cards, correctness, responsive regions, explanation, and timer editable. Preview owns fitted typography and the ask → think → reveal motion.", representation: "semantic", tone: entity.options.length >= 2 && correct === 1 ? "info" : "warning", refs: [`${entity.id}.question`, `${entity.id}.options`, `${entity.id}.timer`] });
    if (entity.explanation) add({ id: "quiz-explanation", icon: "i", label: "Answer explanation", detail: "The authored explanation is shown on the Canvas for editing and revealed with the correct answer by native Run playback.", representation: "semantic", tone: "info", refs: [`${entity.id}.explanation`] });
  }
  if (entity.kind === "countdown") add({ id: "countdown", icon: "◴", label: `${entity.seconds}s native countdown`, detail: "Canvas shows timer style and placement. Preview plays the deterministic countdown, direction, number treatment, and finish effect.", representation: "semantic", tone: "info", refs: [`${entity.id}.timer`] });
  if (entity.kind === "timing") {
    const compositions = doc.steps.filter((step) => step.timed?.controller === entity.id).length;
    add({ id: "timing", icon: "◷", label: `${entity.phases.length} named phase${entity.phases.length === 1 ? "" : "s"}${compositions ? ` · ${compositions} timed story` : ""}`, detail: "Canvas keeps phase order, durations, clock placement, and timed/during Story relationships editable. Preview remains the scheduling and timer-pixel authority.", representation: "semantic", tone: "info", refs: [`${entity.id}.timer`] });
  }
  if (entity.kind === "boolean") {
    const operation = booleanOperation(entity.spelling);
    add({ id: "boolean-region", icon: operation === "union" ? "∪" : operation === "intersection" ? "∩" : operation === "difference" ? "−" : "⊕", label: `${entity.spelling}: ${entity.a} ${operation} ${entity.b}`, detail: "Canvas composites the two known operand silhouettes for authoring. Preview computes the robust native Region triangles, holes, and outer rings from the constructor-time geometry.", representation: "semantic", tone: geometry.bounds(entity.a) && geometry.bounds(entity.b) ? "info" : "warning", refs: [entity.a, entity.b] });
  }
  if (entity.kind === "regions") {
    const result = regionsGeometry(entity, geometry);
    add({ id: "planar-regions", icon: "▦", label: `${result.totalFaces} bounded region${result.totalFaces === 1 ? "" : "s"}`, detail: result.issue ?? "Canvas follows the native snapped half-edge face walk for this bounded arrangement. Preview remains authoritative for large or unsupported source families.", representation: "semantic", tone: result.issue ? "warning" : "info", refs: [entity.boundary, ...entity.dividers] });
  }
  if (entity.kind === "spantree") {
    const result = spanTreeGeometry(entity, geometry);
    add({ id: "spanning-tree", icon: "♧", label: `${result.tree.length} tree · ${result.cotree.length} co-tree edges`, detail: result.issue ?? "Green edges are selected greedily in authored argument order; orange edges form the co-tree exposed as {id}.co.", representation: "semantic", tone: result.issue ? "warning" : "info", refs: entity.edges });
  }
  if (entity.kind === "dual") {
    const result = dualGeometry(entity, geometry);
    add({ id: "dual-graph", icon: "◇", label: `${result.nodes.length} dual nodes · ${result.edges.length} edges`, detail: result.issue ?? "Canvas places one node per enclosed face plus the outer node. Preview owns exact native face adjacency and generated child pixels.", representation: "semantic", tone: result.issue ? "warning" : "info", refs: [entity.boundary, ...entity.dividers] });
  }
  if (entity.morph3) add({
    id: "morph3", icon: "⇄3", label: `Morph target ${entity.morph3.target}`,
    detail: "Canvas shows the source and target relationship. Preview renders the native sampled 3D morph and optional spin.",
    representation: "semantic", tone: geometry.bounds(entity.morph3.target) ? "info" : "warning", refs: [entity.morph3.target],
  });
  if (entity.follow3) add({
    id: "follow3", icon: "⛓3", label: `Follows ${entity.follow3.target}`,
    detail: "Canvas keeps the persistent world-space relationship and offset editable. Preview resolves the target every frame; the design sketch does not simulate that motion.",
    representation: "semantic", tone: geometry.bounds(entity.follow3.target) ? "info" : "warning", refs: [entity.follow3.target],
  });
  if (["grid3", "line3", "arrow3", "curve3", "point3", "cloud3", "axes3", "frame3", "cube3", "sphere3", "prism3", "pyramid3", "midpoint3", "cross3", "link3", "model3", "assembly3", "extrude3", "revolve3", "tube3", "project3", "projectpath3", "surface3", "domainsurface", "param3", "implicit3", "heightmap3", "contour3", "slice3", "tangentplane3", "gradient3", "vectorfield3", "volume3", "trajectory3", "descend3", "linmap3", "eigen3", "collection3", "collection3data", "child3", "links3", "links3data", "pieces3", "ring3", "trail3", "historyplot3", "randomwalk3", "lsystem3", "tree3", "hilbert3"].includes(entity.kind)) add({
    id: "projection3", icon: "◇3", label: "Initial 3D projection",
    detail: "Canvas is a camera-aware design sketch. Orbit, roll, depth and native 3D shading remain Preview-authoritative.",
    representation: "semantic", tone: "info", refs: ["__camera3"],
  });
  if (["surface3", "param3", "vectorfield3"].includes(entity.kind)) add({
    id: "bounded-three-sample", icon: "≈3", label: "Bounded Canvas sample",
    detail: "Inspector preserves the native formula and resolution. Canvas caps the authoring sample for responsiveness; Preview evaluates the full native field and mesh.",
    representation: "semantic", tone: "info", refs: [],
  });
  if (["collection3", "collection3data", "links3", "links3data", "pieces3", "ring3", "trail3", "historyplot", "historyplot3", "randomwalk3", "lsystem3", "tree3", "hilbert3"].includes(entity.kind)) add({
    id: "procedural3", icon: "⠿3", label: "Procedural/live 3D system",
    detail: entity.kind === "trail3" || entity.kind === "historyplot" || entity.kind === "historyplot3" ? "Canvas shows the target and current authoring state. Preview owns accumulated samples over animation time." : "Canvas uses a deterministic bounded design sample. Preview owns the full native construction, stable child state, depth, and final pixels.",
    representation: "semantic", tone: "info", refs: [],
  });
  if (["domainsurface", "implicit3", "trajectory3", "eigen3"].includes(entity.kind)) add({
    id: "native-three-solver", icon: "⚙3", label: "Native numerical solver",
    detail: entity.kind === "domainsurface" ? "Canvas shows the complex domain and height envelope. Preview owns modulus, pole clamping, and phase hue." : entity.kind === "implicit3" ? "Canvas shows the sampled volume. Preview owns tetrahedral isosurface extraction at the chosen level and resolution." : entity.kind === "trajectory3" ? "Canvas uses a bounded path estimate. Preview owns RK4 integration, divergence validation, auto-fit, and speed colouring." : "Canvas marks the matrix construction. Preview owns cubic eigenvalue solving, real invariant directions, and complex-eigenvalue notes.",
    representation: "semantic", tone: "info", refs: [],
  });
  if (entity.kind === "contour3" || entity.kind === "slice3" || entity.kind === "tangentplane3" || entity.kind === "gradient3" || entity.kind === "volume3" || entity.kind === "descend3") add({
    id: "surface3-dependency", icon: "⌁3", label: `Derived from ${entity.surface}`,
    detail: "The relationship is editable and rename-safe. Canvas recomputes a bounded semantic guide; Preview owns the exact native numerical construction and generated pixels.",
    representation: "semantic", tone: geometry.bounds(entity.surface) ? "info" : "warning", refs: [entity.surface],
  });
  if (entity.kind === "heightmap3") add({
    id: "heightmap3-grid", icon: "▦3", label: `Grid state from ${entity.grid}`,
    detail: "Canvas preserves the grid dependency and height formula. Preview reads the latest native CA/WFC frame and builds the terrain mesh.",
    representation: "semantic", tone: geometry.bounds(entity.grid) ? "info" : "warning", refs: [entity.grid],
  });
  if (entity.kind === "linmap3") add({
    id: "linmap3-family", icon: "M3", label: "Addressable matrix image",
    detail: "Canvas shows the mapped parallelepiped. Preview owns the reference cube, basis arrows and labels, determinant value, fill orientation, and exact depth ordering.",
    representation: "semantic", tone: "info", refs: referenceIds(entity),
  });
  if (entity.finish3) add({
    id: "finish3", icon: entity.finish3.wire > 0 ? "▦" : "◐", label: `${entity.finish3.material} · ${entity.finish3.shading} finish`,
    detail: `Texture ${entity.finish3.texture}; mesh ${entity.finish3.mesh}, wire ${entity.finish3.wire}, depth ${entity.finish3.depth}, shadow ${entity.finish3.shadow}. Canvas marks the intent; Preview owns material, lighting, occlusion, and final pixels.`,
    representation: "semantic", tone: "info", refs: [],
  });

  const semanticFeatureRefs = new Set([
    entity.clip, entity.mask, entity.morph2?.target, entity.follow3?.target, entity.copyOf,
    ...(entity.kind === "parameter" ? entity.bindings.map((binding) => binding.target) : []),
    ...(entity.kind === "figure" ? [entity.target] : []),
    ...(entity.kind === "hull2" ? [entity.cloud] : []),
    ...(["boolean", "regions", "spantree", "dual"].includes(entity.kind) ? entityReferences(entity) : []),
  ].filter((ref): ref is string => Boolean(ref)));
  if (entity.copyOf) add({
    id: "copy", icon: "⧉", label: `Native copy of ${entity.copyOf}`,
    detail: "Canvas shows the copied snapshot and keeps constructor geometry locked. Shared styling and Story motion remain editable; Preview owns the native clone result.",
    representation: "semantic", tone: geometry.bounds(entity.copyOf) ? "info" : "warning", refs: [entity.copyOf],
  });
  const structuralRefs = entityReferences(entity).filter((ref) => !semanticFeatureRefs.has(ref));
  if (structuralRefs.length > 0) add({
    id: "dependencies", icon: "⌁", label: `Linked to ${structuralRefs.join(", ")}`,
    detail: defFor(entity).fidelity === "semantic" ? "Canvas preserves this live relationship as a design representation; Preview resolves its exact generated geometry." : "This geometry is derived from the referenced scene object and follows it when it changes.",
    representation: defFor(entity).fidelity ?? "exact", tone: "info", refs: structuralRefs,
  });

  const actionTargets = new Set([entity.id, ...(entity.tags ?? []), ...referenceIds(entity)]);
  const camera3Workflows = new Set(["look3", "view3", "followshot3"]);
  const actions = doc.steps.flatMap(stepActions).filter((action) => actionReferences(action).some((ref) => actionTargets.has(ref)) || (entity.kind === "camera3" && camera3Workflows.has(action.verb)));
  const rewriteCount = entity.kind === "equation" ? actions.filter((action) => action.verb === "rewrite").length : 0;
  if (rewriteCount > 0) add({
    id: "rewrite-chain", icon: "⇝", label: `${rewriteCount} authored rewrite state${rewriteCount === 1 ? "" : "s"}`,
    detail: "Each target LaTeX state is editable in Story. Select a Rewrite beat to inspect its semantic destination; Preview owns symbol continuity and motion.",
    representation: "semantic", tone: "info", refs: [],
  });
  for (const action of actions) {
    if (action.verb === "slidex" || action.verb === "slidey") add({ id: `${action.verb}-${out.length}`, icon: action.verb === "slidex" ? "↔" : "↕", label: `${action.verb} to ${action.amount ?? 0}`, detail: "Canvas exposes the absolute axis destination; Preview plays the native timing and easing.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "groupscale") add({ id: `groupscale-${out.length}`, icon: "⤢", label: `Collective scale ${action.amount ?? 1}×`, detail: "All members scale around the group's shared centre, not around their individual centres.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "dock") add({ id: `dock-${out.length}`, icon: "⊢", label: `Dock ${action.ref ?? "member"}`, detail: "Canvas marks the group, landing member, and destination. Preview performs the rigid group shift.", representation: "semantic", tone: action.ref && geometry.bounds(action.ref) ? "info" : "warning", refs: [...(action.ref ? [action.ref] : []), ...(action.refs ?? [])] });
    if (action.verb === "arrange") {
      const container = action.ref ? geometry.entity(action.ref) : undefined;
      const layout = action.text ?? "random";
      const compatible = container && (layout === "random" ? ["circle", "rect"].includes(container.kind) : layout === "grid" ? container.kind === "rect" : container.kind === "circle");
      add({ id: `arrange-${out.length}`, icon: "⠿", label: `${layout} particle arrangement`, detail: compatible ? "Canvas preserves the persistent particle/container relationship. Preview owns deterministic routes and exact child positions." : `${layout} needs ${layout === "grid" ? "a rectangle" : layout === "ring" ? "a circle" : "a circle or rectangle"} container; choose a compatible destination before Preview.`, representation: "semantic", tone: compatible ? "info" : "warning", refs: action.ref ? [action.ref] : [] });
    }
    if (action.verb === "surround") add({ id: `surround-${out.length}`, icon: "▣→", label: `Surrounds ${action.ref ?? "target"}`, detail: "Canvas shows the current and destination frames. Preview glides and resizes the native rectangle with the authored timing and easing.", representation: "semantic", tone: action.ref && geometry.bounds(action.ref) ? "info" : "warning", refs: action.ref ? [action.ref] : [] });
    if (action.verb === "grow") add({ id: `grow-${out.length}`, icon: "↗", label: `Endpoint grows to ${action.ref ?? `(${action.point?.x ?? 0}, ${action.point?.y ?? 0})`}`, detail: "Canvas keeps the endpoint destination editable on-stage. Preview plays the native endpoint tween with authored timing and easing.", representation: "semantic", tone: action.ref && !geometry.bounds(action.ref) ? "warning" : "info", refs: action.ref ? [action.ref] : [] });
    if (action.verb === "rotate") add({ id: `rotate-${out.length}`, icon: "↻", label: `Rotates to ${action.amount ?? 0}°`, detail: "This is an absolute angle, unlike Spin's relative rotation. Canvas tracks the angle; Preview owns final pixels.", representation: "exact", tone: "info", refs: [] });
    if (action.verb === "set") add({ id: `set-${out.length}`, icon: "→", label: `Sets ${action.prop ?? "value"} to ${action.amount ?? 0}`, detail: "Set is Manic's alias of To. Story exposes only numeric properties the selected Canvas entity can author safely.", representation: "exact", tone: "info", refs: [] });
    if (action.verb === "transform") add({ id: `transform-${out.length}`, icon: "▱", label: "2×2 matrix transform", detail: "Canvas shows the editable origin, transformed bounds, and anchor destination. Preview applies the matrix to native geometry, endpoints, and control points.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "swap") add({ id: `swap-${out.length}`, icon: "⇄", label: `Swaps with ${action.ref ?? "target"}`, detail: "Canvas marks the two position destinations. Preview resolves their latest authored positions and performs the exchange.", representation: "semantic", tone: action.ref && geometry.bounds(action.ref) ? "info" : "warning", refs: action.ref ? [action.ref] : [] });
    if (action.verb === "deform") add({ id: `deform-${out.length}`, icon: "ƒ∿", label: "Continuous outline deformation", detail: "Both u(x,y,t) and v(x,y,t) remain editable in Story. Preview samples the true outline and evaluates the homotopy over time.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "restore") add({ id: `restore-${out.length}`, icon: "↶", label: "Returns to saved state", detail: "Canvas marks the snapshot destination. Preview restores position, scale, rotation, colour, and opacity with authored timing and easing.", representation: "semantic", tone: entity.savedState ? "info" : "warning", refs: [] });
    if (action.verb === "blink") add({ id: `blink-${out.length}`, icon: "◉", label: "Two-part blink", detail: "Canvas reproduces the authored opacity beats and marks the affected entity; Preview remains final pixel truth.", representation: "exact", tone: "info", refs: [] });
    if (action.verb === "wiggle") add({ id: `wiggle-${out.length}`, icon: "≋", label: "Scale-and-rotation wiggle", detail: "Canvas reproduces the six-part attention gesture and marks where it applies.", representation: "exact", tone: "info", refs: [] });
    if (action.verb === "circumscribe") add({ id: `circumscribe-${out.length}`, icon: "▣", label: "Temporary circumscribe trace", detail: "Canvas shows the padded target frame. Preview creates, traces, and fades the temporary native rectangle.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "passflash") add({ id: `passflash-${out.length}`, icon: "↝", label: "Passing outline flash", detail: "Canvas identifies the affected outline and colour. Preview samples the true contour and animates its glowing pass.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "spotlight") add({ id: `spotlight-${out.length}`, icon: "◉", label: "Temporary spotlight", detail: "Canvas marks the focus region. Preview creates and fades the exact expanding foreground wash.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "spiralin") add({ id: `spiralin-${out.length}`, icon: "↻", label: "Group spirals into place", detail: "Canvas marks the collective centre and group extent. Preview staggers each member's native entrance.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "turn") add({ id: `turn-${out.length}`, icon: "↻", label: "Turns around a pivot", detail: "Canvas marks the pivot relationship; Preview plays the exact rigid orbit and easing.", representation: "semantic", tone: "info", refs: action.ref ? [action.ref] : [] });
    if (action.verb === "roll") add({ id: `roll-${out.length}`, icon: "◯↝", label: `Rolls along ${action.ref ?? "track"} · ${action.amount ?? 1} ${geometry.entity(action.ref ?? "")?.kind === "circle" ? "lap(s)" : "px"}`, detail: "Canvas preserves the rolling body or tagged rig, track, distance/laps, duration, and easing. Preview enforces no-slip rotation, inside/outside roulette geometry, rigid tag motion, and exact trajectory pixels.", representation: "semantic", tone: action.ref && ["line", "circle"].includes(geometry.entity(action.ref)?.kind ?? "") ? "info" : "warning", refs: action.ref ? [action.ref] : [] });
    if (action.verb === "flow") add({ id: `flow-${out.length}`, icon: "➜", label: `${action.prop ?? "forward"} ${action.text ?? "once"} flow`, detail: "A luminous native pulse or stream travels over this path. Canvas marks direction and mode; Preview owns motion.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "become") add({ id: `become-${out.length}`, icon: "⇢", label: `Becomes ${action.ref ?? "target"}`, detail: "The source keeps its id while adopting the target blueprint in Preview.", representation: "semantic", tone: action.ref && geometry.bounds(action.ref) ? "info" : "warning", refs: action.ref ? [action.ref] : [] });
    if (action.verb === "attach") add({ id: `attach-${out.length}`, icon: "⛓", label: action.ref === "none" ? "Attachment released" : `Attached to ${action.ref ?? "target"}`, detail: "This is a persistent per-frame relationship; Preview follows the target with the authored offset.", representation: "semantic", tone: "info", refs: action.ref && action.ref !== "none" ? [action.ref] : [] });
    if (action.verb === "attach3") add({ id: `attach3-${out.length}`, icon: "⛓3", label: action.ref === "none" ? "3D attachment released" : `${action.prop === "rigid" ? "Rigidly attached" : "Position attached"} to ${action.ref ?? "target"}`, detail: "This zero-duration Story action changes a persistent native 3D relationship. Canvas exposes target, mode, and XYZ offset; Preview owns per-frame world transforms.", representation: "semantic", tone: "info", refs: action.ref && action.ref !== "none" ? [action.ref] : [] });
    if (action.verb === "move3") add({ id: `move3-${out.length}`, icon: "→3", label: `Moves to (${(action.values ?? [0, 0, 0]).slice(0, 3).join(", ")})`, detail: "Story exposes the absolute world destination. Canvas marks the affected object; Preview owns the 3D transform, timing, depth and pixels.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "shift3") add({ id: `shift3-${out.length}`, icon: "↦3", label: `Shifts by (${(action.values ?? [0, 0, 0]).slice(0, 3).join(", ")})`, detail: "This is a relative world-space delta. Preview resolves it against the latest native transform and attachment state.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "rotate3") add({ id: `rotate3-${out.length}`, icon: "↻3", label: `Rotates to XYZ ${(action.values ?? [0, 0, 0]).slice(0, 3).join("° / ")}°`, detail: "The values are absolute native Euler angles. Canvas keeps the destination editable without pretending to play the 3D rotation.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "grow3") add({ id: `grow3-${out.length}`, icon: "↗3", label: `3D endpoint → (${(action.values ?? [0, 0, 0]).slice(0, 3).join(", ")})`, detail: "Canvas records the absolute world endpoint for this line3 or arrow3. Preview plays the endpoint tween.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "turn3") add({ id: `turn3-${out.length}`, icon: "⟳3", label: `Turns ${action.amount ?? 0}° around ${action.prop ?? "axis"}`, detail: "Canvas exposes the world pivot, axis, group relationship, timing and easing. Preview applies the rigid segmented 3D turn.", representation: "semantic", tone: "info", refs: action.ref ? [action.ref] : [] });
    if (action.verb === "become3") add({ id: `become3-${out.length}`, icon: "⇢3", label: `Becomes ${action.ref ?? "3D blueprint"}`, detail: "The source keeps its native id while geometry, transform and style settle onto the blueprint. Preview chooses morph continuity or crossfade.", representation: "semantic", tone: action.ref && geometry.bounds(action.ref) ? "info" : "warning", refs: action.ref ? [action.ref] : [] });
    if (action.verb === "travel3") add({ id: `travel3-${out.length}`, icon: "➜3", label: `Travels along ${action.ref ?? "3D path"}`, detail: "Canvas marks the persistent subject/path relationship. Preview samples the native path and holds its exact endpoint.", representation: "semantic", tone: action.ref && geometry.bounds(action.ref) ? "info" : "warning", refs: action.ref ? [action.ref] : [] });
    if (action.verb === "drift3") add({ id: `drift3-${out.length}`, icon: "≈3", label: `Deterministic drift · ${action.amount ?? .35}`, detail: "Canvas keeps amount and duration editable and marks the collection as animated. Preview compiles the bounded absolute-time child samples.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "chain3") add({ id: `chain3-${out.length}`, icon: "⛓3", label: `${action.valueLists?.[0]?.length ?? 0}-segment dependency chain`, detail: "Lengths and rotation rates stay individually editable per stable child. Preview computes every chained endpoint over time.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "advect3") add({ id: `advect3-${out.length}`, icon: "⇝3", label: `Advected through ${action.ref ?? "vector field"}`, detail: "Canvas exposes the collection/field relationship, rate and duration. Preview performs deterministic RK4 integration and animates both field and particles.", representation: "semantic", tone: action.ref && geometry.bounds(action.ref) ? "info" : "warning", refs: action.ref ? [action.ref] : [] });
    if (action.verb === "look3") add({ id: `look3-${out.length}`, icon: "⌖3", label: `Camera looks at (${(action.values ?? [0, 0, 0]).slice(0, 3).join(", ")})`, detail: "Canvas keeps the world-space target editable while preserving the initial authoring projection. Native Preview moves the actual camera target.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "view3") add({ id: `view3-${out.length}`, icon: "▣3", label: `${action.prop ?? "fit"} view · ${action.amount ?? 1.18}× margin`, detail: "Canvas marks the bounded subject and camera intent. Preview computes projection-aware fit, responsive media framing and camera tracks.", representation: "semantic", tone: geometry.bounds(action.target) ? "info" : "warning", refs: action.target === entity.id ? [] : [action.target] });
    if (action.verb === "present3") add({ id: `present3-${out.length}`, icon: "▦3", label: `${action.prop ?? "spatial"} frame presentation`, detail: "Only the scientific frame's visual treatment changes; geometry, data coordinates, tags and camera continuity remain intact.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "followshot3") add({ id: `followshot3-${out.length}`, icon: "🎥3", label: action.target === "none" ? "3D follow shot released" : `3D camera follows ${action.target}`, detail: "This zero-duration relationship attaches the native camera target with an editable XYZ offset. Canvas keeps its authoring view fixed.", representation: "semantic", tone: "info", refs: action.target !== "none" && action.target !== entity.id ? [action.target] : [] });
    if (action.verb === "oscillate") add({ id: `oscillate-${out.length}`, icon: "∿", label: `Oscillates ${action.prop ?? "size"}`, detail: "Canvas identifies the driven property, amplitude, period and phase. Preview samples the sinusoidal motion.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "shake") add({ id: `shake-${out.length}`, icon: "≋", label: "Shake gesture", detail: "Preview plays the horizontal error/impact gesture; Canvas marks where it applies.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "run") add({ id: `run-${out.length}`, icon: "▶", label: `Native workflow · ${action.dur}s`, detail: "Canvas records the target and effective duration. Preview executes the target's generated motion, timer, and reveal states.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "route") add({ id: `route-${out.length}`, icon: "●→", label: `Routes through ${action.ref ?? "connection"}`, detail: "Canvas exposes the persistent message/connection relationship. Preview validates that this lane begins at the message’s current node and moves the same identity continuously.", representation: "semantic", tone: action.ref && geometry.bounds(action.ref) ? "info" : "warning", refs: action.ref ? [action.ref] : [] });
    if (action.verb === "hotpath") add({ id: `hotpath-${out.length}`, icon: "●⇢", label: `Seeded path · ${action.amount ?? 1}`, detail: "Canvas marks seeded pathfinding intent without inventing a route. Preview walks the live directed topology to a reachable sink and illuminates only the chosen lanes.", representation: "semantic", tone: "info", refs: [] });
    if (action.verb === "followshot") add({ id: `followshot-${out.length}`, icon: "🎥", label: action.target === "none" ? "Follow shot released" : "Camera follows this entity", detail: "Canvas keeps the authoring view stable while Preview attaches the camera to this subject.", representation: "semantic", tone: "info", refs: [] });
  }
  if (actions.length > 0) {
    const verbs = [...new Set(actions.map((action) => action.verb))];
    const actionRefs = [...new Set(actions.flatMap((action) => [...(action.ref ? [action.ref] : []), ...(action.refs ?? [])]).filter((ref) => ref !== entity.id))];
    add({
      id: "timeline", icon: "▶", label: `${actions.length} animation action${actions.length === 1 ? "" : "s"}`,
      detail: `${verbs.join(", ")} ${actions.length === 1 ? "is" : "are"} applied here. Canvas marks the intent; Preview plays the motion and timing.`,
      representation: "semantic", tone: "info", refs: actionRefs,
    });
  }
  if (entity.reveal !== "none") {
    const hasShow = actions.some((action) => action.verb === "show");
    const opacityReveal = actions.some((action) => ["to", "set"].includes(action.verb) && action.prop === "opacity" && (action.amount ?? 0) > 0);
    add({
    id: "reveal", icon: "◌", label: "Hidden initially",
    detail: entity.reveal === "grow" && hasShow
      ? "A Show action grows this entity from its centre."
      : opacityReveal && !hasShow
        ? "A Story opacity action reveals this entity to the authored level."
        : "A Show action fades this entity into view.",
    representation: "semantic", tone: "info", refs: [],
    });
  }
  if (entity.untraced) add({
    id: "untraced", icon: "✎", label: "Drawn later",
    detail: "The path starts untraced and a Draw action reveals its stroke.",
    representation: "semantic", tone: "info", refs: [],
  });
  if (entity.sticky) add({
    id: "sticky", icon: "⌖", label: "Screen pinned",
    detail: "This entity stays fixed in screen space while the Manic camera moves.",
    representation: "semantic", tone: "info", refs: [],
  });
  if (entity.savedState) add({
    id: "saved-state", icon: "◆", label: "Transform and style state saved",
    detail: "A Restore beat can return this entity to its constructor-time position, scale, rotation, colour, and opacity. Preview owns the exact state interpolation.",
    representation: "semantic", tone: "info", refs: [],
  });
  if (entity.origin === "computed") add({
    id: "computed", icon: "ƒ", label: "Uses variables",
    detail: "The source expression remains authoritative; direct position edits preserve it as an offset.",
    representation: "semantic", tone: "info", refs: [],
  });
  if (entity.origin === "generated") add({
    id: "generated", icon: "ƒ", label: "Generated by source",
    detail: "This loop or macro instance has no independent statement to edit on Canvas.",
    representation: "semantic", tone: "info", refs: [],
  });
  return out;
}

/** Active features indexed at the top of Inspector so their controls are never buried. */
export function appliedFeatures(entity: SceneEntity): AppliedFeature[] {
  const out: AppliedFeature[] = [];
  if (entity.gradient) {
    const mode = entity.gradient.mode === "linear" ? `Linear ${entity.gradient.angle}°`
      : entity.gradient.mode === "auto" ? "Engine automatic"
        : entity.gradient.mode === "along" ? "Along stroke"
          : entity.gradient.mode === "radial" ? "Radial"
            : entity.gradient.mode === "speed" ? "Speed"
              : "Curvature";
    out.push({ id: "gradient", label: "Gradient", detail: `${mode} · ${entity.gradient.stops.length} stops`, controlId: "mse-gradient-controls" });
  }
  if (entity.plate !== undefined) out.push({ id: "plate", label: "Text plate", detail: `${Math.round(entity.plate * 100)}% opacity`, controlId: "mse-text-composition-controls" });
  if (entity.cursor) out.push({ id: "cursor", label: "Typewriter cursor", detail: "Enabled", controlId: "mse-text-composition-controls" });
  if (entity.mask) out.push({ id: "crop", label: "Mask", detail: entity.mask, controlId: "mse-crop-controls" });
  else if (entity.clip) out.push({ id: "crop", label: "Clip", detail: entity.clip, controlId: "mse-crop-controls" });
  if (entity.glow !== undefined) out.push({ id: "glow", label: "Glow", detail: String(entity.glow), controlId: "mse-shared-feature-controls" });
  if (entity.sticky) out.push({ id: "sticky", label: "Screen pinned", detail: "Follows camera viewport", controlId: "mse-shared-feature-controls" });
  if (entity.dashed) out.push({ id: "dashed", label: "Dashed stroke", detail: entity.dashed.dash === null ? "Engine defaults" : `${entity.dashed.dash}/${entity.dashed.gap ?? "auto"}`, controlId: "mse-shared-feature-controls" });
  if (entity.savedState) out.push({ id: "savestate", label: "Saved state", detail: "Restore destination", controlId: "mse-state-controls" });
  if (entity.hue) out.push({ id: "hue", label: "Hue", detail: `${Math.round(entity.hue.deg)}°`, controlId: "mse-shared-style-controls" });
  if (entity.z !== undefined) out.push({ id: "layer", label: "Layer", detail: String(entity.z), controlId: "mse-shared-style-controls" });
  if (entity.tags?.length) out.push({ id: "tags", label: "Tags", detail: entity.tags.join(", "), controlId: "mse-shared-style-controls" });
  if (entity.pin3) out.push({ id: "pin3", label: entity.pin3.form === "label3" ? "3D label" : "3D pin", detail: entity.pin3.target ?? (entity.pin3.at ? `(${entity.pin3.at.x}, ${entity.pin3.at.y}, ${entity.pin3.at.z})` : "unresolved"), controlId: "mse-spatial3-controls" });
  if (entity.follow3) out.push({ id: "follow3", label: "3D follow", detail: entity.follow3.target, controlId: "mse-spatial3-controls" });
  if (entity.thickness3 !== undefined && entity.thickness3 !== 0) out.push({ id: "thick3", label: "3D thickness", detail: String(entity.thickness3), controlId: "mse-spatial3-controls" });
  if (entity.finish3) out.push({ id: "finish3", label: "3D finish", detail: `${entity.finish3.material} · ${entity.finish3.shading}${entity.finish3.wire > 0 ? " · wire" : ""}`, controlId: "mse-spatial3-controls" });
  if (entity.morph3) out.push({ id: "morph3", label: "3D morph", detail: entity.morph3.target, controlId: "mse-spatial3-controls" });
  if (entity.morph2) out.push({ id: "morph2", label: "Shape morph", detail: entity.morph2.target, controlId: "mse-morph2-controls" });
  if (entity.kind === "parameter" && entity.bindings.length > 0) out.push({ id: "bindings", label: "Bindings", detail: `${entity.bindings.length} target${entity.bindings.length === 1 ? "" : "s"}`, controlId: "mse-parameter-bindings" });
  if (entity.kind === "creator" && entity.socials) out.push({ id: "socials", label: "Social footer", detail: entity.footer === "none" ? "Suppressed by profile style" : entity.socialsAt ? "Custom position" : "Responsive position", controlId: "mse-publishing-controls" });
  if (entity.kind === "creator" && entity.endcard) out.push({ id: "endcard", label: "End card", detail: entity.endcard.title ?? entity.displayName, controlId: "mse-publishing-controls" });
  if (PHYSICS_KINDS.includes(entity.kind as never)) {
    const physics=entity as import("./types.js").PhysicsEntity;
    if(physics.species.length)out.push({id:"species",label:"Gas species",detail:`${physics.species.length} population${physics.species.length===1?"":"s"}`,controlId:"mse-physics-feature-controls"});
    if(physics.rules.length)out.push({id:"rules",label:"Collision rules",detail:`${physics.rules.length} rule${physics.rules.length===1?"":"s"}`,controlId:"mse-physics-feature-controls"});
    for(const [id,label,value] of [["speeds","Speed histogram",physics.speeds],["phase","Phase portrait",physics.phase],["well","Potential well",physics.well],["timegraph","Time graph",physics.timegraph],["energygraph","Energy graph",physics.energygraph]] as const)if(value)out.push({id,label,detail:`(${Math.round(value.x)}, ${Math.round(value.y)})`,controlId:"mse-physics-feature-controls"});
  }
  if(entity.kind==="circuit"){
    if(entity.currentStyle)out.push({id:"current",label:"Current dots",detail:`${entity.currentStyle.shape} · ${entity.currentStyle.speed}×`,controlId:"mse-circuit-feature-controls"});
    if(entity.probes.length)out.push({id:"probes",label:"Circuit probes",detail:`${entity.probes.length} measurement${entity.probes.length===1?"":"s"}`,controlId:"mse-circuit-feature-controls"});
    if(entity.scopes.length)out.push({id:"scopes",label:"Scope views",detail:`${entity.scopes.length} waveform${entity.scopes.length===1?"":"s"}`,controlId:"mse-circuit-feature-controls"});
  }
  return out;
}

function unionBoxes(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function createAction(verb: string, target: string): SceneAction {
  const def = verbDef(verb);
  if (!def) throw new Error(`Unknown verb "${verb}"`);
  return def.create(target);
}

export interface BeatTargetOption { id: string; label: string; kind: EntityKind; ownerId: string; }

/** Concrete entities plus explicitly authorable native children for one verb. */
export function beatTargetOptions(doc: SceneDoc, verb: string): BeatTargetOption[] {
  const spec = verbDef(verb);
  if (!spec || spec.targetless) return [];
  return doc.entities.flatMap((entity) => {
    const out: BeatTargetOption[] = [];
    if ((!isAuthorOnly(entity) || spec.allowAuthorOnlyTargets) && spec.appliesTo(entity.kind)) out.push({ id: entity.id, label: entity.id, kind: entity.kind, ownerId: entity.id });
    for (const child of defFor(entity).storyTargets?.(entity) ?? []) {
      if ((!child.verbs || child.verbs.includes(verb)) && spec.appliesTo(child.kind) && (!spec.concreteStoryTargetsOnly || threePointReferences(doc).includes(child.id))) out.push({ id: child.id, label: child.label, kind: child.kind, ownerId: entity.id });
    }
    return out;
  });
}

export interface BeatAvailability { enabled: boolean; reason: string; }

/** Whether a Story `+ Beat` click can produce a valid native statement. */
export function beatAvailability(doc: SceneDoc, verb: string, selectedId: string): BeatAvailability {
  const def = verbDef(verb);
  if (!def) return { enabled: false, reason: `Unknown verb ${verb}.` };
  if (def.placement === "timeline") return { enabled: false, reason: `${def.label} is a top-level timeline event, not a step beat.` };
  const selected = doc.entities.find((entity) => entity.id === selectedId) ?? null;
  if (!def.targetless && (!selected || !beatTargetOptions(doc, verb).some((option) => option.ownerId === selectedId))) return { enabled: false, reason: `Select a compatible entity for ${def.label}.` };
  if (def.canAdd && !def.canAdd(doc, selected)) return { enabled: false, reason: def.addBlockedReason ?? `${def.label} needs more scene context.` };
  if (def.ui.entityArg) {
    const found = doc.entities.some((entity) => entity.id !== selectedId
      && (!def.ui.entityArg?.kinds || def.ui.entityArg.kinds.includes(entity.kind))
      && (!def.ui.entityArg?.accept || def.ui.entityArg.accept(entity.kind)));
    if (!found && !def.ui.entityArg.allowNone) return { enabled: false, reason: `${def.label} needs another compatible entity.` };
  }
  if (def.ui.entityList) {
    const count = doc.entities.filter((entity) => def.appliesTo(entity.kind)).length;
    if (count < def.ui.entityList.min) return { enabled: false, reason: `${def.label} needs at least ${def.ui.entityList.min} compatible entities.` };
  }
  return { enabled: true, reason: "" };
}

export function verbPropertyOptions(verb: string, entity: SceneEntity): readonly string[] {
  const options = verbDef(verb)?.ui.propOptions;
  return typeof options === "function" ? options(entity) : options ?? [];
}

export function verbPropertyOptionsForTarget(doc: SceneDoc, verb: string, target: string): readonly string[] {
  const entity = doc.entities.find((candidate) => candidate.id === target);
  if (entity) return verbPropertyOptions(verb, entity);
  const option = beatTargetOptions(doc, verb).find((candidate) => candidate.id === target);
  const options = verbDef(verb)?.ui.propOptions;
  if (typeof options === "function") return option ? options({ kind: option.kind } as SceneEntity) : [];
  return options ?? [];
}

/** Build a complete Beat payload; no intermediate invalid source is emitted. */
export function createBeatAction(doc: SceneDoc, verb: string, selectedId: string): { action: SceneAction | null; error: string } {
  const availability = beatAvailability(doc, verb, selectedId);
  if (!availability.enabled) return { action: null, error: availability.reason };
  const def = verbDef(verb)!;
  const target = def.targetless ? "" : beatTargetOptions(doc, verb).find((option) => option.ownerId === selectedId)?.id ?? selectedId;
  const targetEntity = doc.entities.find((entity) => entity.id === target);
  const action = def.create(target);
  for (const choice of def.ui.choices ?? []) {
    const options = typeof choice.options === "function" ? choice.options(targetEntity ?? null) : choice.options;
    const value = action[choice.field];
    if (options.length && (!value || !options.includes(value))) action[choice.field] = options[0];
  }
  if (def.ui.numberList?.countFromTarget) {
    const entity = doc.entities.find((candidate) => candidate.id === target);
    const raw = entity ? Reflect.get(entity, def.ui.numberList.countFromTarget) : null;
    if (typeof raw === "number") action.values = Array.from({ length: Math.max(1, Math.round(raw)) }, (_unused, index) => action.values?.[index] ?? 0);
  }
  if (def.ui.numberLists) {
    const entity = doc.entities.find((candidate) => candidate.id === target);
    action.valueLists = def.ui.numberLists.map((list, listIndex) => {
      const raw = entity && list.countFromTarget ? Reflect.get(entity, list.countFromTarget) : action.valueLists?.[listIndex]?.length;
      const count = Math.max(1, Math.round(typeof raw === "number" ? raw : 1));
      return Array.from({ length: count }, (_unused, index) => action.valueLists?.[listIndex]?.[index] ?? list.initial ?? 0);
    });
  }
  if (def.ui.entityArg) {
    action.ref = doc.entities.find((entity) => entity.id !== target
      && (!def.ui.entityArg?.kinds || def.ui.entityArg.kinds.includes(entity.kind))
      && (!def.ui.entityArg?.accept || def.ui.entityArg.accept(entity.kind)))?.id ?? "none";
  }
  def.completeAction?.(action, doc);
  // Dynamic index limits are resolved only after secondary relationships have
  // been defaulted (`pointat` derives its range from action.ref).
  if (def.ui.amount && action.amount !== null) {
    const max = typeof def.ui.amount.max === "function" ? def.ui.amount.max(targetEntity ?? null, doc, action) : def.ui.amount.max;
    action.amount = Math.max(def.ui.amount.min ?? -Infinity, Math.min(max ?? Infinity, action.amount));
  }
  if (def.ui.numbers && action.values) {
    action.values = action.values.map((value, index) => {
      const field = def.ui.numbers?.[index]; if (!field) return value;
      const max = typeof field.max === "function" ? field.max(targetEntity ?? null, doc, action) : field.max;
      return Math.max(field.min ?? -Infinity, Math.min(max ?? Infinity, value));
    });
  }
  if(def.ui.numbers&&targetEntity){const visible=def.ui.numbers.filter(field=>!field.visibleWhenKinds||field.visibleWhenKinds.includes(targetEntity.kind));action.values=visible.length?visible.map((field,index)=>action.values?.[index]??field.initial??0):undefined;}
  if(action.verb==="run"&&action.durationExplicit===false)action.dur=def.beatDur(action,targetEntity??null,doc);
  if (def.ui.entityList) {
    action.refs = doc.entities.filter((entity) => entity.id !== target && def.appliesTo(entity.kind)).slice(0, def.ui.entityList.min - 1).map((entity) => entity.id);
  }
  if (targetEntity && def.ui.point === "absolute") {
    const anchor = entityAnchor(targetEntity, doc);
    action.point = { x: Math.round(anchor.x + 120), y: Math.round(anchor.y) };
  }
  if (!targetEntity && def.ui.point === "absolute") {
    const box = geometryContext(doc).bounds(target);
    if (box) action.point = { x: Math.round(box.x + box.width / 2 + 120), y: Math.round(box.y + box.height / 2) };
  }
  if (targetEntity && def.ui.pointOrEntity && !action.ref && !action.point) {
    const anchor = entityAnchor(targetEntity, doc);
    action.point = { x: Math.round(anchor.x), y: Math.round(anchor.y) };
  }
  if (targetEntity) {
    const options = verbPropertyOptions(verb, targetEntity);
    if (options.length > 0 && (!action.prop || !options.includes(action.prop))) action.prop = options[0];
    if (verb === "show" && targetEntity.reveal === "grow") action.ease = "out";
    if (action.durationExplicit === false) action.dur = def.beatDur(action, targetEntity, doc);
  }
  if (!targetEntity) {
    const options = verbPropertyOptionsForTarget(doc, verb, target);
    if (options.length > 0 && (!action.prop || !options.includes(action.prop))) action.prop = options[0];
  }
  return { action, error: "" };
}

/** Apply constructor-side arming (`show` → hidden, `draw`/`type` → untraced). */
export function applyBeatOnAdd(doc: SceneDoc, action: SceneAction): void {
  if (action.verb === "speak") doc.voice ??= { service: "gtts", voice: null, tone: null, language: null };
  const def = verbDef(action.verb);
  if (!def?.onAdd) return;
  const entity = doc.entities.find((candidate) => candidate.id === action.target);
  if (entity && !entity.origin) def.onAdd(entity);
}

export function sanitizeId(value: string): string {
  const cleaned = value.replaceAll(/[^A-Za-z0-9_]/gu, "_");
  return /^[A-Za-z_]/u.test(cleaned) ? cleaned : `e_${cleaned}`;
}

export function uniqueEntityId(doc: SceneDoc, base: string): string {
  const taken = new Set(doc.entities.map((entity) => entity.id));
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base}${index}`)) index += 1;
  return `${base}${index}`;
}
