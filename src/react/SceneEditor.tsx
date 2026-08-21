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
  allEntityDefs, allVerbDefs, cloneDoc, createEntity, docSize, entityAnchor,
  patchSceneSource, readSceneSource, serializeSceneFile, translateEntity, uniqueEntityId, verbDef,
  CANVAS_SIZES, MANIC_TEMPLATES, STARTERS,
  type CanvasFormat, type EntityDef, type EntityKind, type ManicTemplate,
  type SceneDoc, type SceneEntity, type SourceScene,
} from "../index.js";
import { Stage } from "./Stage.js";
import { Inspector } from "./Inspector.js";
import { Story } from "./Story.js";
import { CatalogExplorer } from "./CatalogExplorer.js";

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
  className?: string;
}

const FORMAT_LABELS: Record<CanvasFormat, string> = { "16:9": "16:9", square: "1:1", portrait: "9:16" };
const TEMPLATE_LABELS: Record<ManicTemplate, string> = {
  black: "Black", mono: "Mono", plain: "Plain", terminal: "Terminal",
  paper: "Paper", blueprint: "Blueprint", shorts: "Shorts",
};
const UNDO_LIMIT = 60;

/** Everything the canvas can author today — badges the catalog explorer. */
function implementedNames(): Set<string> {
  const names = new Set<string>([
    "canvas", "template", "color", "opacity", "rot", "hidden", "untraced", "hue", "tag", "z", "glow", "sticky", "dashed",
    "let", "for", "if", "def", "sum", "prod", "min", "max",
  ]);
  for (const def of allEntityDefs()) {
    names.add(def.ctor);
    for (const modifier of Object.keys(def.modifiers)) names.add(modifier);
  }
  for (const verb of allVerbDefs()) names.add(verb.name);
  return names;
}

export function SceneEditor({ fileName, source, onSourceChange, onOpenSource, onRevealSource, onPreview, className }: SceneEditorProps) {
  const initial = useMemo(() => readSceneSource(source), []); // eslint-disable-line react-hooks/exhaustive-deps
  const baselineRef = useRef<SourceScene>(initial);
  const [display, setDisplay] = useState<SceneDoc>(initial.doc);
  const [skipped, setSkipped] = useState<string[]>(initial.skipped);
  const [selectedId, setSelectedId] = useState("");
  const [selectedAction, setSelectedAction] = useState<{ step: number; index: number } | null>(null);
  const [dimmed, setDimmed] = useState<ReadonlySet<string>>(new Set());
  const [startersOpen, setStartersOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
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

  const implemented = useMemo(() => implementedNames(), []);
  const toolbarGroups = useMemo(() => {
    const groups = new Map<string, EntityDef[]>();
    for (const def of allEntityDefs()) {
      const group = groups.get(def.group) ?? [];
      group.push(def);
      groups.set(def.group, group);
    }
    return [...groups.entries()];
  }, []);

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
    for (let index = next.steps.length - 1; index >= 0 && next.steps[index].actions.length === 0; index -= 1) {
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

  function scheduleFlush() {
    clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      if (pendingSource.current === null) return;
      lastSent.current = pendingSource.current;
      onSourceChange(pendingSource.current);
    }, 350);
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

  /** Drag-fast path: copy only the touched entity, share everything else. */
  function mutateEntity(id: string, change: (entity: SceneEntity) => void) {
    const index = display.entities.findIndex((entity) => entity.id === id);
    if (index === -1) return;
    const entity = JSON.parse(JSON.stringify(display.entities[index])) as SceneEntity;
    change(entity);
    const entities = [...display.entities];
    entities[index] = entity;
    stageDoc({ ...display, entities });
  }

  // Keyboard: delete entity, nudge, undo/redo, escape.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (event.key === "Escape") {
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
    const entity = createEntity(kind, id, Math.round(size.width / 2 + offset), Math.round(size.height / 2 + offset));
    mutate((draft) => draft.entities.push(entity));
    setSelectedId(id);
    setNotice(`Added ${id}. Drag it into place, then give it a beat in the story.`);
  }

  function removeEntity(id: string) {
    const target = display.entities.find((entity) => entity.id === id);
    if (target?.origin === "generated") {
      setNotice(`${id} is generated by a loop — edit the loop in Source instead.`);
      return;
    }
    mutate((draft) => {
      draft.entities = draft.entities.filter((entity) => entity.id !== id);
      for (const step of draft.steps) step.actions = step.actions.filter((action) => action.target !== id);
    });
    setSelectedId("");
    setSelectedAction(null);
    setNotice(`Removed ${id} and its story beats.`);
  }

  function duplicateEntity(id: string) {
    const entity = display.entities.find((candidate) => candidate.id === id);
    if (!entity) return;
    const copy = JSON.parse(JSON.stringify(entity)) as SceneEntity;
    delete copy.origin;
    delete copy.genKey;
    copy.id = uniqueEntityId(display, entity.id.replaceAll(/[^A-Za-z0-9_]/gu, "_"));
    translateEntity(copy, 32, 32);
    mutate((draft) => draft.entities.push(copy));
    setSelectedId(copy.id);
  }

  function addAction(stepIndex: number, verbName: string) {
    const spec = verbDef(verbName);
    if (!spec) return;
    const target = spec.targetless ? "" : selectedId || display.entities.find((entity) => spec.appliesTo(entity.kind))?.id || "";
    if (!spec.targetless && !target) return;
    const action = spec.create(target);
    if (spec.ui.point === "absolute") {
      const entity = display.entities.find((candidate) => candidate.id === target);
      if (entity) {
        const anchor = entityAnchor(entity);
        action.point = { x: Math.round(anchor.x + 120), y: Math.round(anchor.y) };
      }
    }
    mutate((draft) => {
      const step = draft.steps[stepIndex];
      if (!step || step.origin) return;
      step.actions.push(action);
      if (!spec.targetless && spec.onAdd) {
        const entity = draft.entities.find((candidate) => candidate.id === target);
        if (entity && !entity.origin) spec.onAdd(entity);
      }
    });
    setSelectedAction({ step: stepIndex, index: display.steps[stepIndex]?.actions.length ?? 0 });
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
      for (const action of step.actions) {
        if (action.verb === "show") shown.add(action.target);
        if (action.verb === "draw") drawn.add(action.target);
      }
    }
    const covered = (entity: SceneEntity, set: Set<string>) =>
      set.has(entity.id) || (entity.tags ?? []).some((tag) => set.has(tag));
    const warnings: string[] = [];
    for (const entity of display.entities) {
      if (entity.origin) continue;
      if (entity.reveal !== "none" && !covered(entity, shown)) warnings.push(`${entity.id} is hidden but never shown.`);
      if (entity.untraced && !covered(entity, drawn)) warnings.push(`${entity.id} is untraced but never drawn.`);
    }
    return warnings.slice(0, 6);
  }, [display]);

  const selected = display.entities.find((entity) => entity.id === selectedId) ?? null;

  return (
    <section className={`mse-root${className ? ` ${className}` : ""}`} aria-label="Manic visual editor">
      <div className="mse-toolbar">
        {fileName && (
          <span className="mse-file" title={fileName}>
            <i aria-hidden="true" />{fileName.split("/").at(-1)}
          </span>
        )}
        {toolbarGroups.map(([group, defs]) => (
          <div className="mse-tool-group" aria-label={`Add ${group}`} key={group}>
            <span className="mse-tool-label">{group}</span>
            {defs.map((def) => (
              <button key={def.kind} onClick={() => addEntity(def.kind as EntityKind)} title={def.hint}>
                {def.icon}<span>{def.label}</span>
              </button>
            ))}
          </div>
        ))}
        <button className={`mse-starters-trigger${startersOpen ? " active" : ""}`} onClick={() => setStartersOpen((open) => !open)}>
          Starters
        </button>
        <button className={`mse-starters-trigger${catalogOpen ? " active" : ""}`} onClick={() => setCatalogOpen((open) => !open)}>
          Language
        </button>
        <label className="mse-select">
          <span>Style</span>
          <select value={display.template} onChange={(event) => mutate((draft) => { draft.template = event.target.value as ManicTemplate; })}>
            {MANIC_TEMPLATES.map((template) => <option key={template} value={template}>{TEMPLATE_LABELS[template]}</option>)}
          </select>
        </label>
        <div className="mse-tool-group mse-formats" aria-label="Canvas format">
          {(Object.keys(CANVAS_SIZES) as CanvasFormat[]).map((format) => (
            <button key={format} className={display.format === format && !display.size ? "active" : ""} onClick={() => mutate((draft) => { draft.format = format; delete draft.size; })}>
              {FORMAT_LABELS[format]}
            </button>
          ))}
        </div>
        <div className="mse-toolbar-right">
          {onOpenSource && <button onClick={onOpenSource}>View source</button>}
          {onPreview && <button className="mse-primary" onClick={onPreview}>▶ Preview with Manic</button>}
        </div>
      </div>

      {catalogOpen && <CatalogExplorer implemented={implemented} onClose={() => setCatalogOpen(false)} />}

      {(startersOpen || isEmpty) && (
        <div className="mse-starters" aria-label="Scene starters">
          <div className="mse-starters-copy">
            <span className="mse-eyebrow">STARTING POINTS</span>
            <strong>{isEmpty ? "This file is empty." : "Replace the file with a starter."}</strong>
            <p>Choose a scene, not a blank file — or just add entities from the toolbar. Everything becomes ordinary Manic source you can keep editing by hand.</p>
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

      <div className="mse-main">
        <Stage
          doc={display}
          fileName={fileName}
          skippedCount={skipped.length}
          dimmed={dimmed}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEntityChange={mutateEntity}
        />
        <Inspector
          doc={display}
          entity={selected}
          dimmed={dimmed}
          onSelect={setSelectedId}
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
              const entity = draft.entities.find((candidate) => candidate.id === previous);
              if (!entity) return;
              entity.id = id;
              for (const step of draft.steps) for (const action of step.actions) if (action.target === previous) action.target = id;
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
        selectedAction={selectedAction}
        warnings={storyWarnings}
        onSelectAction={setSelectedAction}
        onAddAction={addAction}
        onMutate={mutate}
        selectedEntity={selected}
        onPreview={onPreview}
      />

      <p className="mse-notice" role="status">{notice}</p>
    </section>
  );
}
