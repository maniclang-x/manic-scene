// The shared Manic visual editor. No file gets special treatment: the canvas
// is a direct projection of whatever .manic file is open. Statements inside
// the canvas vocabulary render and edit; the computation layer (let/for/if/def)
// is evaluated exactly like the engine, with computed/generated content shown
// but locked. Everything else is skipped and preserved byte-for-byte — edits
// patch only the statements they change.
//
// Data flow (built for fast drags):
//   display doc (cheap per-frame mutations) → idle reconcile (surgical patch +
//   re-projection, ~180ms) → debounced flush to the host. Undo/redo works on
//   reconciled source snapshots (⌘Z / ⇧⌘Z).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  actionReferences, allVocabularyEntries, appendTimedAction, applyBeatOnAdd, applyVocabularyFeature, canNativeCopy, cloneDoc, createAction, createBeatAction, createEntity, createTimedStep, defFor, docSize, entityDefByCtor, entityReferences, entriesForSurface, filterStepActions,
  isFeatureName,
  patchConditionalCondition, patchSceneSource, readSceneSource, reconcileVoicePairing, referenceIds, replaceStepActionReferences, replaceEntityReference, serializeSceneFile, stepActionAt, stepActions, translateEntity, uniqueEntityId, verbDef,
  vocabularyAvailability, CANVAS_SIZES, MANIC_TEMPLATES, STARTERS,
  type CanvasFormat, type EntityKind, type ManicTemplate, type VocabularyEntry,
  type ManicAsset, type ManicAssetProvider, type SceneDoc, type SceneEntity, type SourceScene,
} from "../index.js";
import { Stage } from "./Stage.js";
import { Inspector } from "./Inspector.js";
import { Story } from "./Story.js";
import { CatalogExplorer } from "./CatalogExplorer.js";
import { VocabularyBrowser } from "./VocabularyBrowser.js";
import { Conditions } from "./Conditions.js";
import { AssetBrowser } from "./AssetBrowser.js";

export interface SceneEditorProps {
  /** Name (or project-relative path) of the open .manic file, shown in the editor chrome. */
  fileName?: string;
  /** Full .manic source of the open file. */
  source: string;
  /** Called with the full updated source whenever the scene changes. */
  onSourceChange(next: string): void;
  /** Host hook: jump to the code editor. */
  onOpenSource?(): void;
  /** Host hook: open the source editor at a character offset (jump to a statement). */
  onRevealSource?(offset: number): void;
  /** Host hook: run a real engine preview of this file. */
  onPreview?(): void;
  /** Host-owned Library/Project discovery, upload, and URI resolution. */
  assetProvider?: ManicAssetProvider;
  className?: string;
}

const FORMAT_LABELS: Record<CanvasFormat, string> = { "16:9": "16:9", square: "1:1", portrait: "9:16" };
const TEMPLATE_LABELS: Record<ManicTemplate, string> = {
  black: "Black", mono: "Mono", plain: "Plain", terminal: "Terminal",
  paper: "Paper", blueprint: "Blueprint", shorts: "Shorts",
};
const UNDO_LIMIT = 60;

export function SceneEditor({ fileName, source, onSourceChange, onOpenSource, onRevealSource, onPreview, assetProvider, className }: SceneEditorProps) {
  const initial = useMemo(() => readSceneSource(source), []); // eslint-disable-line react-hooks/exhaustive-deps
  const baselineRef = useRef<SourceScene>(initial);
  const [display, setDisplay] = useState<SceneDoc>(initial.doc);
  const [skipped, setSkipped] = useState<string[]>(initial.skipped);
  const [selectedId, setSelectedId] = useState("");
  const [selectedAction, setSelectedAction] = useState<{ step: number; index: number } | null>(null);
  const [dimmed, setDimmed] = useState<ReadonlySet<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [sceneOpen, setSceneOpen] = useState(false);
  const [startersOpen, setStartersOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [animateStep, setAnimateStep] = useState<number | null>(null);
  const [notice, setNotice] = useState("The canvas is a working sketch of your .manic file — edits patch only the statements they change. The render is always Manic's: use ▶ Preview with Manic.");

  const isEmpty = display.entities.length === 0 && display.steps.length === 0 && skipped.length === 0;

  const sourceRef = useRef(source);
  sourceRef.current = source;
  const pendingSource = useRef<string | null>(null);
  const pendingDoc = useRef<SceneDoc | null>(null);
  const lastSent = useRef<string | null>(null);
  const reconcileTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);

  const addEntries = useMemo(() => entriesForSurface("add"), []);
  const animateEntries = useMemo(() => entriesForSurface("animate").filter((entry) => verbDef(entry.name)?.placement !== "timeline"), []);
  const commandEntries = useMemo(() => allVocabularyEntries().filter((entry) => entry.kind !== "modifier" || entry.surfaces.includes("feature")), []);

  // Source prop changed. Skip the echo of our own write; re-project otherwise.
  useEffect(() => {
    if (source === lastSent.current) {
      lastSent.current = null;
      return;
    }
    if (source === pendingSource.current) return;
    pendingSource.current = null;
    pendingDoc.current = null;
    undoStack.current = [];
    redoStack.current = [];
    project(readSceneSource(source));
    setSelectedAction(null);
    setDimmed(new Set());
  }, [source]);

  useEffect(() => () => {
    clearTimeout(reconcileTimer.current);
    clearTimeout(flushTimer.current);
  }, []);

  function project(scene: SourceScene, drafts: SceneDoc["steps"] = []) {
    baselineRef.current = scene;
    const doc = scene.doc;
    doc.steps.push(...drafts);
    setDisplay(doc);
    setSkipped(scene.skipped);
  }

  /** Cheap per-gesture update; the surgical patch runs on idle. */
  function stageDoc(next: SceneDoc) {
    setDisplay(next);
    pendingDoc.current = next;
    clearTimeout(reconcileTimer.current);
    reconcileTimer.current = setTimeout(reconcile, 180);
  }

  function reconcile() {
    const next = pendingDoc.current;
    if (!next) return;
    pendingDoc.current = null;
    const base = pendingSource.current ?? sourceRef.current;
    const updated = patchSceneSource(base, baselineRef.current, next);
    if (updated !== base) {
      undoStack.current.push(base);
      if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
      redoStack.current = [];
    }
    pendingSource.current = updated;
    // Trailing empty steps are UI drafts the file can't hold yet.
    const drafts: SceneDoc["steps"] = [];
    for (let index = next.steps.length - 1; index >= 0 && !next.steps[index].timed && next.steps[index].actions.length === 0; index -= 1) {
      drafts.unshift(next.steps[index]);
    }
    project(readSceneSource(updated), drafts);
    scheduleFlush();
  }

  /** Replace the whole working source (starters, undo/redo). */
  function applySource(text: string) {
    pendingDoc.current = null;
    pendingSource.current = text;
    project(readSceneSource(text));
    setSelectedAction(null);
    scheduleFlush();
  }

  function changeCondition(conditionalId: string, branchIndex: number, expression: string) {
    const conditionalIndex = baselineRef.current.meta.conditionals.findIndex((conditional) => conditional.id === conditionalId);
    if (pendingDoc.current) reconcile();
    const base = pendingSource.current ?? sourceRef.current;
    try {
      const currentId = baselineRef.current.meta.conditionals[conditionalIndex]?.id ?? conditionalId;
      const updated = patchConditionalCondition(base, baselineRef.current, currentId, branchIndex, expression);
      if (updated === base) return;
      undoStack.current.push(base);
      if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
      redoStack.current = [];
      applySource(updated);
      flushNow();
      setNotice(`Updated the conditional expression. Canvas and Story were re-evaluated from native Manic semantics.`);
    } catch (error) {
      setNotice(`Condition was not changed: ${error instanceof Error ? error.message : "invalid expression"}.`);
    }
  }

  function scheduleFlush() {
    clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flushNow, 350);
  }

  function flushNow() {
    clearTimeout(flushTimer.current);
    if (pendingSource.current === null) return;
    lastSent.current = pendingSource.current;
    onSourceChange(pendingSource.current);
  }

  /** Story controls are discrete source edits. Commit them before the user can
   * switch to Source and unmount the Canvas; geometry gestures stay debounced. */
  function commit(change: (draft: SceneDoc) => void) {
    const next = cloneDoc(display);
    change(next);
    pendingDoc.current = next;
    clearTimeout(reconcileTimer.current);
    reconcile();
    flushNow();
  }

  function undo() {
    if (pendingDoc.current) reconcile();
    const previous = undoStack.current.pop();
    if (previous === undefined) {
      setNotice("Nothing to undo.");
      return;
    }
    redoStack.current.push(pendingSource.current ?? sourceRef.current);
    applySource(previous);
    setNotice("Undone.");
  }

  function redo() {
    const next = redoStack.current.pop();
    if (next === undefined) {
      setNotice("Nothing to redo.");
      return;
    }
    undoStack.current.push(pendingSource.current ?? sourceRef.current);
    applySource(next);
    setNotice("Redone.");
  }

  function mutate(change: (draft: SceneDoc) => void) {
    const next = cloneDoc(display);
    change(next);
    stageDoc(next);
  }

  /** Drag-fast path: copy only the touched entity, share everything else.
   * If the change renames the entity (label re-attach → `{target}.label`),
   * beats and selection follow the new id. */
  function mutateEntity(id: string, change: (entity: SceneEntity) => void) {
    const index = display.entities.findIndex((entity) => entity.id === id);
    if (index === -1) return;
    const entity = JSON.parse(JSON.stringify(display.entities[index])) as SceneEntity;
    change(entity);
    const entities = [...display.entities];
    entities[index] = entity;
    if (entity.id !== id) {
      const steps = structuredClone(display.steps);
      for (const step of steps) replaceStepActionReferences(step, id, entity.id);
      stageDoc({ ...display, entities, steps });
      setSelectedId(entity.id);
      return;
    }
    if (display.entities[index].kind === "timing" && entity.kind === "timing") {
      const before = display.entities[index].phases.map((phase) => phase.name);
      const after = entity.phases.map((phase) => phase.name);
      const beforeSet = new Set(before), afterSet = new Set(after);
      const renamed = new Map<string, string>();
      if (before.length === after.length) before.forEach((name, at) => {
        const next = after[at];
        if (name !== next && !afterSet.has(name) && !beforeSet.has(next)) renamed.set(name, next);
      });
      const steps = structuredClone(display.steps);
      for (const step of steps) {
        if (step.timed?.controller !== id) continue;
        for (const phase of step.timed.phases) phase.name = renamed.get(phase.name) ?? phase.name;
        step.timed.phases = step.timed.phases.filter((phase) => afterSet.has(phase.name));
      }
      stageDoc({ ...display, entities, steps });
      return;
    }
    if (display.entities[index].kind === "sliders" && entity.kind === "sliders" && display.entities[index].count !== entity.count) {
      const count = Math.max(1, Math.min(32, Math.round(entity.count)));
      entity.count = count;
      const steps = structuredClone(display.steps);
      for (const step of steps) for (const action of stepActions(step)) {
        if (action.verb === "setsliders" && action.target === id) action.values = Array.from({ length: count }, (_unused, at) => action.values?.[at] ?? 0);
      }
      stageDoc({ ...display, entities, steps });
      return;
    }
    stageDoc({ ...display, entities });
  }

  /** Canvas camera gizmos use the drag-fast path, then force a source commit
   * on pointer-up so switching directly to Source cannot lose the gesture. */
  function mutateActionAt(selected: { step: number; index: number }, change: (action: SceneDoc["steps"][number]["actions"][number]) => void) {
    const next = cloneDoc(display);
    const action = stepActionAt(next.steps[selected.step], selected.index);
    if (!action) return;
    change(action);
    stageDoc(next);
  }

  function finishGesture() {
    if (pendingDoc.current) reconcile();
    flushNow();
  }

  // Keyboard: delete entity, nudge, undo/redo, escape.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setAddOpen(false); setAssetsOpen(false); setSceneOpen(false); setCatalogOpen(false); setStartersOpen(false); setAnimateStep(null);
        setCommandOpen(true);
        return;
      }
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (event.key === "Escape") {
        if (addOpen || assetsOpen || sceneOpen || catalogOpen || commandOpen || startersOpen || animateStep !== null) {
          setAddOpen(false); setAssetsOpen(false); setSceneOpen(false); setCatalogOpen(false); setCommandOpen(false); setStartersOpen(false); setAnimateStep(null);
          return;
        }
        setSelectedId("");
        setSelectedAction(null);
        return;
      }
      if (!selectedId) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeEntity(selectedId);
        return;
      }
      const nudge = event.shiftKey ? 10 : 2;
      const delta = event.key === "ArrowLeft" ? { x: -nudge, y: 0 }
        : event.key === "ArrowRight" ? { x: nudge, y: 0 }
        : event.key === "ArrowUp" ? { x: 0, y: -nudge }
        : event.key === "ArrowDown" ? { x: 0, y: nudge }
        : null;
      if (!delta) return;
      event.preventDefault();
      mutateEntity(selectedId, (entity) => { if (entity.origin !== "generated") translateEntity(entity, delta.x, delta.y); });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function addEntity(kind: EntityKind) {
    const size = docSize(display);
    const id = uniqueEntityId(display, kind === "text" ? "label" : kind);
    const offset = (display.entities.length % 5) * 24 - 48;
    const entity = createEntity(kind, id, Math.round(size.width / 2 + offset), Math.round(size.height / 2 + offset), display, selectedId);
    mutate((draft) => draft.entities.push(entity));
    setSelectedId(entity.id);
    const refs = defFor(entity).references?.(entity) ?? [];
    setNotice(refs.length > 0
      ? `Added ${entity.id}, attached to ${refs.join(" and ")} — change that in the Inspector if it's wrong.`
      : `Added ${entity.id}. Drag it into place, then give it a beat in the story.`);
  }

  function addAsset(asset: ManicAsset) {
    const size = docSize(display);
    const kind: EntityKind = asset.kind === "model" ? (asset.parts && asset.parts.length > 1 ? "assembly3" : "model3") : asset.kind;
    const id = uniqueEntityId(display, kind === "image" ? "image" : kind === "svg" ? "art" : kind === "assembly3" ? "assembly" : "model");
    const offset = (display.entities.length % 5) * 24 - 48;
    const entity = createEntity(kind, id, Math.round(size.width / 2 + offset), Math.round(size.height / 2 + offset));
    if (entity.kind === "image") {
      entity.path = asset.uri;
      const width = Math.max(48, Math.min(420, asset.width ?? 300));
      entity.width = Math.round(width);
      entity.height = Math.round(width / Math.max(.05, asset.aspectRatio ?? 1));
    } else if (entity.kind === "svg") {
      entity.path = asset.uri;
      entity.size = Math.round(Math.max(48, Math.min(360, asset.width ?? 240)));
    } else if (entity.kind === "model3") {
      entity.path = asset.uri;
    } else if (entity.kind === "assembly3") {
      entity.path = asset.uri;
      entity.parts = [...(asset.parts ?? [])];
    }
    mutate((draft) => draft.entities.push(entity));
    setSelectedId(entity.id); setSelectedAction(null); setAssetsOpen(false);
    setNotice(`Added ${asset.title} as ${entity.id}. The file keeps ${asset.uri}; Preview resolves it independently.`);
  }

  function chooseEntity(entry: VocabularyEntry) {
    const def = entityDefByCtor(entry.name);
    if (!def) return;
    addEntity(def.kind as EntityKind);
    setAddOpen(false);
  }

  function openAnimate() {
    let stepIndex = -1;
    for (let index = display.steps.length - 1; index >= 0; index -= 1) {
      const step = display.steps[index];
      if (!step.origin && !step.timed && !step.actions.some((action) => verbDef(action.verb)?.placement === "timeline")) { stepIndex = index; break; }
    }
    if (stepIndex === -1) {
      stepIndex = display.steps.length;
      commit((draft) => draft.steps.push({ name: `Step ${draft.steps.length + 1}`, mode: "together", gap: 0.12, actions: [] }));
    }
    setAddOpen(false); setAssetsOpen(false); setSceneOpen(false); setCatalogOpen(false); setCommandOpen(false); setStartersOpen(false);
    setAnimateStep(stepIndex);
  }

  function addQuickAction(verbName: string) {
    const generated = createBeatAction(display, verbName, selectedId);
    if (!generated.action) { setNotice(generated.error); return; }
    let stepIndex = -1;
    for (let index = display.steps.length - 1; index >= 0; index -= 1) {
      const step = display.steps[index];
      if (!step.origin && !step.timed && !step.actions.some((action) => verbDef(action.verb)?.placement === "timeline")) { stepIndex = index; break; }
    }
    const action = generated.action;
    if (stepIndex === -1) stepIndex = display.steps.length;
    const destination = stepIndex;
    commit((draft) => {
      if (!draft.steps[destination]) draft.steps.push({ name: `Step ${draft.steps.length + 1}`, mode: "together", gap: 0.12, actions: [] });
      draft.steps[destination].actions.push(action);
      applyBeatOnAdd(draft, action);
    });
    setSelectedAction({ step: destination, index: display.steps[destination]?.actions.length ?? 0 });
    setSelectedId("");
    setNotice(`Added ${verbDef(verbName)?.label ?? verbName} to Step ${destination + 1}.`);
  }

  function chooseCommand(entry: VocabularyEntry) {
    if (entry.fidelity === "source-only") { if (onOpenSource) onOpenSource(); }
    else if (entry.name === "copy" && selected) duplicateEntity(selected.id);
    else if (entry.kind === "entity") chooseEntity(entry);
    else if (entry.kind === "verb" && verbDef(entry.name)?.placement === "timeline") addTimelineAction(entry.name);
    else if (entry.kind === "verb") addQuickAction(entry.name);
    else if (entry.kind === "modifier" && isFeatureName(entry.name) && selected) {
      const feature = entry.name;
      mutateEntity(selected.id, (entity) => { applyVocabularyFeature(entity, feature, display); });
      setNotice(`Applied ${entry.label} to ${selected.id}.`);
    } else if (entry.kind === "scene") setSceneOpen(true);
    else if (onOpenSource) onOpenSource();
    setCommandOpen(false);
  }

  function removeEntity(id: string) {
    const target = display.entities.find((entity) => entity.id === id);
    if (target?.origin === "generated") {
      setNotice(`${id} is generated by a loop — edit the loop in Source instead.`);
      return;
    }
    mutate((draft) => {
      const removed = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const entity of draft.entities) {
          if (removed.has(entity.id)) continue;
          if (entityReferences(entity).some((dependency) => removed.has(dependency))) {
            removed.add(entity.id);
            changed = true;
          }
        }
      }
      const removedTargets = new Set<string>();
      for (const entity of draft.entities) {
        if (!removed.has(entity.id)) continue;
        removedTargets.add(entity.id);
        for (const ref of referenceIds(entity)) removedTargets.add(ref);
      }
      draft.entities = draft.entities.filter((entity) => !removed.has(entity.id));
      draft.steps = draft.steps.filter((step) => !step.timed || !removedTargets.has(step.timed.controller));
      for (const step of draft.steps) filterStepActions(step, (action) => {
        // A Speak beat owns narration; its caption relationship is optional.
        if (action.verb === "speak" && removedTargets.has(action.target)) action.target = "";
        return !actionReferences(action).some((ref) => removedTargets.has(ref));
      });
      reconcileVoicePairing(draft);
    });
    setSelectedId("");
    setSelectedAction(null);
    setNotice(`Removed ${id} and its story beats.`);
  }

  function duplicateEntity(id: string) {
    const entity = display.entities.find((candidate) => candidate.id === id);
    if (!entity) return;
    if (!canNativeCopy(entity)) {
      setNotice(`${id} is a logical group or generated controller, not one concrete native entity. Duplicate its source structure instead.`);
      return;
    }
    const copy = JSON.parse(JSON.stringify(entity)) as SceneEntity;
    delete copy.origin;
    delete copy.genKey;
    delete copy.src;
    delete copy.tags;
    copy.id = uniqueEntityId(display, `${entity.id.replaceAll(/[^A-Za-z0-9_]/gu, "_")}_copy`);
    copy.copyOf = entity.id;
    mutate((draft) => draft.entities.push(copy));
    setSelectedId(copy.id);
    setNotice(`Added ${copy.id} with native copy(${copy.id}, ${entity.id}). It starts in the same place; use a Move, Shift, Slide, or Scale beat to separate it.`);
  }

  function addAction(stepIndex: number, verbName: string, timedAt?: { phase: number; segment: number }) {
    const generated = createBeatAction(display, verbName, selectedId);
    if (!generated.action) { setNotice(generated.error); return; }
    const action = generated.action;
    commit((draft) => {
      const step = draft.steps[stepIndex];
      if (!step || step.origin) return;
      if (timedAt && step.timed) appendTimedAction(step, timedAt.phase, timedAt.segment, action);
      else if (!step.timed) step.actions.push(action);
      applyBeatOnAdd(draft, action);
    });
    const selectedIndex = timedAt && display.steps[stepIndex]?.timed
      ? appendTimedAction(structuredClone(display.steps[stepIndex]), timedAt.phase, timedAt.segment, structuredClone(action))
      : display.steps[stepIndex]?.actions.length ?? 0;
    setSelectedAction({ step: stepIndex, index: selectedIndex });
  }

  function addTimelineAction(verbName: string) {
    const def = verbDef(verbName);
    if (!def || def.placement !== "timeline") { setNotice(`${verbName} is not a standalone timeline event.`); return; }
    const action = createAction(verbName, "");
    const stepIndex = display.steps.length;
    commit((draft) => draft.steps.push({ name: def.label, mode: "together", gap: 0.12, actions: [action] }));
    setSelectedAction({ step: stepIndex, index: 0 });
    setSelectedId("");
    setNotice(`Added ${def.label} as a standalone native timeline event.`);
  }

  function addTimedComposition(controllerId?: string) {
    const controller = display.entities.find((entity) => entity.kind === "timing" && (!controllerId || entity.id === controllerId));
    if (!controller || controller.kind !== "timing") { setNotice("Add a generic Timing controller before creating a timed Story composition."); return; }
    commit((draft) => draft.steps.push(createTimedStep(controller)));
    setSelectedAction(null);
    setSelectedId(controller.id);
    setNotice(`Added timed(${controller.id}) with ${controller.phases.length} named phase${controller.phases.length === 1 ? "" : "s"}.`);
  }

  function applyStarter(starter: SceneDoc, name: string) {
    if (sourceRef.current.trim() && !isEmpty && !window.confirm("Replace this file's content with the starter scene?")) return;
    undoStack.current.push(pendingSource.current ?? sourceRef.current);
    redoStack.current = [];
    applySource(serializeSceneFile(cloneDoc(starter)));
    setStartersOpen(false);
    setSelectedId("");
    setNotice(`${name} starter loaded — every element is ordinary Manic source.`);
  }

  const storyWarnings = useMemo(() => {
    const shown = new Set<string>();
    const drawn = new Set<string>();
    for (const step of display.steps) {
      for (const action of stepActions(step)) {
        if (action.verb === "show") shown.add(action.target);
        if (["to", "set"].includes(action.verb) && action.prop === "opacity" && (action.amount ?? 0) > 0) shown.add(action.target);
        if (action.verb === "draw") drawn.add(action.target);
      }
    }
    const covered = (entity: SceneEntity, set: Set<string>) =>
      set.has(entity.id) || (entity.tags ?? []).some((tag) => set.has(tag));
    const morphTargets = new Set(display.entities.flatMap((entity) => entity.morph3 ? [entity.morph3.target] : []));
    const warnings: string[] = [];
    for (const entity of display.entities) {
      if (entity.origin) continue;
      if (entity.reveal !== "none" && !morphTargets.has(entity.id) && !covered(entity, shown)) warnings.push(`${entity.id} is hidden but never shown.`);
      if (entity.untraced && !covered(entity, drawn)) warnings.push(`${entity.id} is untraced but never drawn.`);
    }
    return warnings.slice(0, 6);
  }, [display]);

  const selected = display.entities.find((entity) => entity.id === selectedId) ?? null;
  const conditionals = baselineRef.current.meta.conditionals;

  return (
    <section className={`mse-root${className ? ` ${className}` : ""}`} aria-label="Manic visual editor">
      <div className="mse-toolbar">
        {fileName && (
          <span className="mse-file" title={fileName}>
            <i aria-hidden="true" />{fileName.split("/").at(-1)}
          </span>
        )}
        <button aria-label="Add" className={`mse-command${addOpen ? " active" : ""}`} onClick={() => { setAddOpen((open) => !open); setAssetsOpen(false); setSceneOpen(false); setCatalogOpen(false); setCommandOpen(false); setStartersOpen(false); setAnimateStep(null); }}>
          <span aria-hidden="true">＋</span><strong>Add</strong>
        </button>
        <button aria-label="Animate" className={`mse-command${animateStep !== null ? " active" : ""}`} onClick={openAnimate}>
          <span aria-hidden="true">▶</span><strong>Animate</strong>
        </button>
        {assetProvider && <button aria-label="Assets" className={`mse-command${assetsOpen ? " active" : ""}`} onClick={() => { setAssetsOpen((open) => !open); setAddOpen(false); setSceneOpen(false); setCatalogOpen(false); setCommandOpen(false); setStartersOpen(false); setAnimateStep(null); }}><span aria-hidden="true">▧</span><strong>Assets</strong></button>}
        <button aria-label="Scene" className={`mse-command${sceneOpen ? " active" : ""}`} onClick={() => { setSceneOpen((open) => !open); setAddOpen(false); setAssetsOpen(false); setCatalogOpen(false); setCommandOpen(false); setStartersOpen(false); setAnimateStep(null); }}>
          <span aria-hidden="true">▣</span><strong>Scene</strong>
        </button>
        <button className={`mse-starters-trigger${startersOpen ? " active" : ""}`} onClick={() => { setStartersOpen((open) => !open); setAddOpen(false); setAssetsOpen(false); setSceneOpen(false); setCatalogOpen(false); setCommandOpen(false); setAnimateStep(null); }}>
          Starters
        </button>
        <button className={`mse-starters-trigger${catalogOpen ? " active" : ""}`} onClick={() => { setCatalogOpen((open) => !open); setAddOpen(false); setAssetsOpen(false); setSceneOpen(false); setCommandOpen(false); setStartersOpen(false); setAnimateStep(null); }}>
          Language
        </button>
        <button className={`mse-search-command${commandOpen ? " active" : ""}`} onClick={() => { setCommandOpen((open) => !open); setAddOpen(false); setAssetsOpen(false); setSceneOpen(false); setCatalogOpen(false); setStartersOpen(false); setAnimateStep(null); }} title="Search Manic commands and vocabulary (⌘K)">
          ⌕ Search <kbd>⌘K</kbd>
        </button>
        <div className="mse-toolbar-right">
          {onOpenSource && <button onClick={onOpenSource}>View source</button>}
          {onPreview && <button className="mse-primary" onClick={onPreview}>▶ Preview with Manic</button>}
        </div>
      </div>

      {addOpen && (
        <VocabularyBrowser
          title="Add to the Canvas"
          eyebrow="CREATE"
          hint={selected ? `Suggestions are ranked for ${selected.id}.` : "Choose an object, annotation, plot, or 3D element."}
          entries={addEntries}
          availability={(entry) => vocabularyAvailability(entry, display, selectedId)}
          onChoose={chooseEntity}
          onClose={() => setAddOpen(false)}
        />
      )}

      {animateStep !== null && (
        <VocabularyBrowser
          title="Animate"
          eyebrow={`STORY · STEP ${animateStep + 1}`}
          hint={selected ? `Compatible actions for ${selected.id} appear first.` : "Select an entity for targeted animation; scene actions remain available."}
          entries={animateEntries}
          availability={(entry) => vocabularyAvailability(entry, display, selectedId)}
          onChoose={(entry) => { addAction(animateStep, entry.name); setAnimateStep(null); }}
          onClose={() => setAnimateStep(null)}
        />
      )}

      {sceneOpen && (
        <section className="mse-scene-panel" aria-label="Scene settings">
          <div>
            <span className="mse-eyebrow">SCENE</span>
            <strong>Document appearance</strong>
            <small>These settings affect the whole Manic scene.</small>
          </div>
          <label className="mse-select">
            <span>Title</span>
            <input
              value={display.title ?? ""}
              placeholder="Untitled animation"
              onChange={(event) => mutate((draft) => { draft.title = event.target.value; })}
            />
          </label>
          <label className="mse-select">
            <span>Template</span>
            <select value={display.template} onChange={(event) => mutate((draft) => { draft.template = event.target.value as ManicTemplate; })}>
              {MANIC_TEMPLATES.map((template) => <option key={template} value={template}>{TEMPLATE_LABELS[template]}</option>)}
            </select>
          </label>
          <div className="mse-tool-group mse-formats" aria-label="Canvas format">
            <span className="mse-tool-label">Canvas</span>
            {(Object.keys(CANVAS_SIZES) as CanvasFormat[]).map((format) => (
              <button key={format} className={display.format === format && !display.size ? "active" : ""} onClick={() => mutate((draft) => { draft.format = format; delete draft.size; })}>
                {FORMAT_LABELS[format]}
              </button>
            ))}
          </div>
          <button type="button" className="mse-vocabulary-close" onClick={() => setSceneOpen(false)} aria-label="Close Scene">×</button>
        </section>
      )}

      {catalogOpen && <CatalogExplorer onClose={() => setCatalogOpen(false)} />}

      {assetsOpen && assetProvider && <AssetBrowser provider={assetProvider} onChoose={addAsset} onClose={() => setAssetsOpen(false)} />}

      {commandOpen && (
        <VocabularyBrowser
          title="Search Manic"
          eyebrow="COMMAND PALETTE"
          hint={selected ? `Commands are ranked for ${selected.id}.` : "Search the whole language and editor actions by what you want to do."}
          entries={commandEntries}
          availability={(entry) => {
            if (entry.fidelity === "source-only" || entry.kind === "helper") return onOpenSource ? { enabled: true, reason: "Opens Source." } : { enabled: false, reason: "This host has no Source action." };
            return vocabularyAvailability(entry, display, selectedId);
          }}
          onChoose={chooseCommand}
          onClose={() => setCommandOpen(false)}
          placeholder="Try “connect two things”, “camera”, “readable text”…"
        />
      )}

      {(startersOpen || isEmpty) && (
        <div className="mse-starters" aria-label="Scene starters">
          <div className="mse-starters-copy">
            <span className="mse-eyebrow">STARTING POINTS</span>
            <strong>{isEmpty ? "This file is empty." : "Replace the file with a starter."}</strong>
            <p>Choose a scene, not a blank file — or use Add to find an entity. Everything becomes ordinary Manic source you can keep editing by hand.</p>
          </div>
          <div className="mse-starters-list">
            {STARTERS.map((starter) => (
              <button key={starter.id} onClick={() => applyStarter(starter.doc, starter.name)}>
                <strong>{starter.name}</strong>
                <small>{starter.description}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {skipped.length > 0 && (
        <details className="mse-skipped" role="status">
          <summary>
            {skipped.length} note{skipped.length === 1 ? "" : "s"}: parts of this file aren't canvas vocabulary yet — kept exactly as written.
          </summary>
          <ul>{skipped.slice(0, 12).map((note, index) => <li key={index}>{note}</li>)}</ul>
        </details>
      )}

      {conditionals.length > 0 && (
        <Conditions
          doc={display}
          conditionals={conditionals}
          onFormat={(format) => {
            commit((draft) => { draft.format = format; delete draft.size; });
            setNotice(`Canvas changed to ${FORMAT_LABELS[format]}; conditional branches were re-evaluated.`);
          }}
          onChangeCondition={changeCondition}
          onRevealSource={onRevealSource}
        />
      )}

      <div className="mse-main">
        <Stage
          doc={display}
          fileName={fileName}
          skippedCount={skipped.length}
          assetProvider={assetProvider}
          dimmed={dimmed}
          selectedId={selectedId}
          selectedAction={selectedAction}
          onSelect={(id) => { setSelectedId(id); setSelectedAction(null); }}
          onClearSelection={() => { setSelectedId(""); setSelectedAction(null); }}
          onEntityChange={mutateEntity}
          onActionChange={mutateActionAt}
          onGestureEnd={finishGesture}
        />
        <Inspector
          doc={display}
          conditionals={conditionals}
          entity={selected}
          dimmed={dimmed}
          onSelect={(id) => { setSelectedId(id); setSelectedAction(null); }}
          onToggleDim={(id) => setDimmed((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })}
          onChange={(change) => selected && mutateEntity(selected.id, change)}
          onRename={(next) => {
            if (!selected || selected.origin === "generated") return;
            const id = uniqueEntityId(display, next);
            const previous = selected.id;
            mutate((draft) => {
              const before = draft.entities.map((candidate) => [candidate.id, ...referenceIds(candidate)]);
              const entity = draft.entities.find((candidate) => candidate.id === previous);
              if (!entity) return;
              entity.id = id;
              for (const candidate of draft.entities) replaceEntityReference(candidate, previous, id, entity.kind);
              const renames = new Map<string, string>();
              draft.entities.forEach((candidate, index) => {
                const after = [candidate.id, ...referenceIds(candidate)];
                before[index].forEach((oldTarget, at) => {
                  if (after[at] && after[at] !== oldTarget) renames.set(oldTarget, after[at]);
                });
              });
              for (const candidate of draft.entities) for (const [from, to] of renames) replaceEntityReference(candidate, from, to);
              for (const step of draft.steps) for (const [from, to] of renames) replaceStepActionReferences(step, from, to);
            });
            setSelectedId(id);
          }}
          onDuplicate={() => selected && duplicateEntity(selected.id)}
          onRemove={() => selected && removeEntity(selected.id)}
          onRevealSource={onRevealSource}
        />
      </div>
      <Story
        doc={display}
        conditionals={conditionals}
        selectedAction={selectedAction}
        warnings={storyWarnings}
        onSelectAction={(next) => { setSelectedAction(next); if (next) setSelectedId(""); }}
        onAddAction={addAction}
        onAddTimeline={addTimelineAction}
        onAddTimed={addTimedComposition}
        onMutate={commit}
        selectedEntity={selected}
        onPreview={onPreview}
      />

      <p className="mse-notice" role="status">{notice}</p>
    </section>
  );
}
