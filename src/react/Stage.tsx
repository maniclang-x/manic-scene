// The canvas: a generic SVG design sketch of the scene — arrange, resize,
// select. Geometry (anchor, bounds, handles) comes from entity definitions;
// pixels come from the renderer registry. There is deliberately no playback
// here: watching the story is the engine's job (▶ Preview with Manic).

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  THEMES, camera2Before, camera3Before, cameraViewport, canvasAnnotations, defFor, docSize, entityAnchor, entityBounds,
  eyeFromOrbit, geometryContext, guidePixelsToRadius, layoutTextLines, orbitFromPoints, projectPoint3, radiusToGuidePixels, stepActionAt, stepActions, translateEntity,
  type ActionSelection, type Camera3Entity, type Camera3State, type CaptionEntity, type CounterEntity, type EquationEntity, type ManicAssetProvider, type ResolvedManicAsset, type SceneAction, type SceneDoc, type SceneEntity, type TextEntity,
} from "../index.js";
import type { EntityFrame } from "../timeline.js";
import { renderEntity } from "./renderers.js";

interface StageProps {
  doc: SceneDoc;
  fileName?: string;
  /** Count of file statements the canvas cannot show (for honest empty copy). */
  skippedCount?: number;
  assetProvider?: ManicAssetProvider;
  dimmed: ReadonlySet<string>;
  selectedId: string;
  selectedAction: ActionSelection | null;
  onSelect(id: string): void;
  onClearSelection(): void;
  onEntityChange(id: string, change: (entity: SceneEntity) => void): void;
  onActionChange(selected: ActionSelection, change: (action: SceneAction) => void): void;
  onGestureEnd(): void;
}

interface DragState {
  kind: "entity" | "action";
  id: string;
  handle: string;
  grabX: number; grabY: number;
  downX: number; downY: number;
  downCanvasX: number; downCanvasY: number;
  moved: boolean;
  camera?: Camera3Entity;
}

export function Stage({ doc, fileName, skippedCount = 0, assetProvider, dimmed, selectedId, selectedAction, onSelect, onClearSelection, onEntityChange, onActionChange, onGestureEnd }: StageProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [resolvedAssets, setResolvedAssets] = useState<ReadonlyMap<string, ResolvedManicAsset | null>>(new Map());
  const assetUris = useMemo(() => [...new Set(doc.entities.flatMap((entity) => entity.kind === "image" || entity.kind === "svg" ? [entity.path] : []))].sort(), [doc.entities]);
  const assetKey = assetUris.join("\n");
  const size = docSize(doc);
  const theme = THEMES[doc.template];
  const selected = doc.entities.find((entity) => entity.id === selectedId) ?? null;
  const action = selectedAction ? stepActionAt(doc.steps[selectedAction.step], selectedAction.index) : null;

  useEffect(() => {
    let live = true;
    setResolvedAssets(new Map());
    if (!assetProvider) return () => { live = false; };
    for (const uri of assetUris) {
      void assetProvider.resolve(uri).then((resolved) => {
        if (!live) return;
        setResolvedAssets((current) => new Map(current).set(uri, resolved));
      }).catch(() => {
        if (!live) return;
        setResolvedAssets((current) => new Map(current).set(uri, null));
      });
    }
    return () => { live = false; };
  }, [assetProvider, assetKey]);

  function canvasPoint(event: ReactPointerEvent): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * size.width,
      y: ((event.clientY - rect.top) / rect.height) * size.height,
    };
  }

  function beginDrag(event: ReactPointerEvent, id: string, handle: string) {
    event.stopPropagation();
    onSelect(id);
    const entity = doc.entities.find((candidate) => candidate.id === id);
    if (!entity || entity.origin === "generated") return; // loop instances: select only
    if (handle === "move" && (defFor(entity).movable === false || entity.copyOf)) return;
    const point = canvasPoint(event);
    const anchor = entityAnchor(entity, doc);
    setDrag({ kind: "entity", id, handle, grabX: point.x - anchor.x, grabY: point.y - anchor.y, downX: event.clientX, downY: event.clientY, downCanvasX: point.x, downCanvasY: point.y, moved: false, camera: entity.kind === "camera3" ? structuredClone(entity) : undefined });
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function beginActionDrag(event: ReactPointerEvent, handle: string) {
    if (!selectedAction || !action) return;
    event.stopPropagation();
    const point = canvasPoint(event);
    setDrag({ kind: "action", id: "", handle, grabX: 0, grabY: 0, downX: event.clientX, downY: event.clientY, downCanvasX: point.x, downCanvasY: point.y, moved: false });
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent) {
    if (!drag) return;
    // Click-vs-drag deadzone: a selection click must never nudge the entity
    // (layout can shift under the pointer when the inspector populates).
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.downX, event.clientY - drag.downY) < 4) return;
      drag.moved = true;
    }
    const point = canvasPoint(event);
    const px = clamp(Math.round(point.x), 0, size.width);
    const py = clamp(Math.round(point.y), 0, size.height);
    if (drag.kind === "action") {
      if (!selectedAction) return;
      onActionChange(selectedAction, (next) => updateCameraAction(next, drag.handle, { x: px, y: py }, doc, selectedAction));
      return;
    }
    onEntityChange(drag.id, (entity) => {
      if (entity.kind === "camera3" && drag.camera) {
        updateCamera3Entity(entity, drag.camera, drag.handle, point, drag, size);
        return;
      }
      if (drag.handle === "move") {
        const anchor = entityAnchor(entity, doc);
        translateEntity(entity, Math.round(point.x - drag.grabX - anchor.x), Math.round(point.y - drag.grabY - anchor.y));
      } else {
        defFor(entity).dragHandle(entity, drag.handle, px, py);
      }
    });
  }

  function finishDrag() {
    if (drag?.moved) onGestureEnd();
    setDrag(null);
  }

  return (
    <div className="mse-stage-wrap">
      <div className={`mse-stage mse-format-${doc.format.replace(":", "x")}`} style={{ background: theme.background }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${size.width} ${size.height}`}
          onPointerDown={onClearSelection}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          role="application"
          aria-label="Scene canvas"
        >
          <Grid width={size.width} height={size.height} stroke={theme.grid} />
          {[...doc.entities].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map((entity) => (
            <EntityView
              key={entity.id}
              entity={entity}
              frame={designFrame(entity, doc)}
              doc={doc}
              assets={assetProvider ? resolvedAssets : undefined}
              dimmedInView={dimmed.has(entity.id)}
              onPointerDown={(event) => beginDrag(event, entity.id, "move")}
            />
          ))}
          {selected && selected.kind !== "camera3" && (
            <SelectionOverlay entity={selected} doc={doc} onHandleDown={(event, handle) => beginDrag(event, selected.id, handle)} />
          )}
          {selected?.kind === "camera3" && (
            <Camera3EntityGizmo entity={selected} size={size} onHandleDown={(event, handle) => beginDrag(event, selected.id, handle)} />
          )}
          {action && selectedAction && (
            <ActionGizmo doc={doc} selected={selectedAction} action={action} size={size} onHandleDown={beginActionDrag} />
          )}
          <SceneAnimationMarker doc={doc} width={size.width} />
        </svg>
        <div className="mse-stage-caption">
          <span>{fileName ? `${fileName} · ` : ""}{doc.format} · {doc.entities.length} entities</span>
          <span>design sketch — the render is Manic&apos;s</span>
        </div>
        {doc.entities.length === 0 && (
          <div className="mse-stage-empty">
            {skippedCount > 0 ? (
              <>
                <strong>Nothing here is canvas vocabulary yet.</strong>
                <span>{skippedCount} statement{skippedCount === 1 ? "" : "s"} kept as written — edit this file in Source, or add canvas entities alongside.</span>
              </>
            ) : (
              <>
                <strong>Your scene is ready.</strong>
                <span>Add text or a shape from the toolbar to start explaining.</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function updateCameraAction(action: SceneAction, handle: string, point: { x: number; y: number }, doc: SceneDoc, selected: ActionSelection) {
  const size = docSize(doc);
  if (handle === "slide-destination") {
    action.amount = Math.round(action.verb === "slidex" ? point.x : point.y);
    return;
  }
  if (handle === "dock-target") {
    action.refs = [];
    action.point = { x: Math.round(point.x), y: Math.round(point.y) };
    return;
  }
  if (handle === "turn-pivot") {
    action.ref = null;
    action.point = { x: Math.round(point.x), y: Math.round(point.y) };
    return;
  }
  if (handle === "grow-endpoint") {
    action.ref = null;
    action.point = { x: Math.round(point.x), y: Math.round(point.y) };
    return;
  }
  if (handle === "matrix-origin") {
    action.point = { x: Math.round(point.x), y: Math.round(point.y) };
    return;
  }
  if (handle === "cam-center") {
    action.point = { x: Math.round(point.x), y: Math.round(point.y) };
    return;
  }
  if (handle === "zoom-corner") {
    const before = camera2Before(doc, selected);
    const dx = Math.max(1, Math.abs(point.x - before.center.x));
    const dy = Math.max(1, Math.abs(point.y - before.center.y));
    action.amount = round(Math.max(.05, Math.min(20, Math.min(size.width / (2 * dx), size.height / (2 * dy)))), 3);
    return;
  }
  if (handle === "orbit-eye" || handle === "orbit-elevation") {
    const layout = cameraGuideLayout(size, "right");
    if (handle === "orbit-eye") {
      action.amount = round(Math.atan2(point.y - layout.cy, point.x - layout.cx) * 180 / Math.PI, 1);
      const elevation = action.values?.[0] ?? 0;
      action.values = [elevation, round(guidePixelsToRadius(Math.hypot(point.x - layout.cx, point.y - layout.cy)), 2)];
    } else {
      const elevation = round(clamp((layout.cy - point.y) / layout.elevationHalf * 89, -89, 89), 1);
      action.values = [elevation, action.values?.[1] ?? 10];
    }
    return;
  }
  if (handle === "roll-angle") {
    const layout = cameraGuideLayout(size, "right");
    action.amount = round(Math.atan2(point.y - layout.cy, point.x - layout.cx) * 180 / Math.PI, 1);
  }
}

function updateCamera3Entity(entity: Camera3Entity, initial: Camera3Entity, handle: string, point: { x: number; y: number }, drag: DragState, size: { width: number; height: number }) {
  const layout = cameraGuideLayout(size, "left");
  const orbit = orbitFromPoints(initial.eye, initial.target);
  if (handle === "camera-target") {
    const dx = (point.x - drag.downCanvasX) / 24, dy = (point.y - drag.downCanvasY) / 24;
    entity.target = { x: round(initial.target.x + dx, 2), y: round(initial.target.y + dy, 2), z: initial.target.z };
    entity.eye = { x: round(initial.eye.x + dx, 2), y: round(initial.eye.y + dy, 2), z: initial.eye.z };
    return;
  }
  if (handle === "camera-target-z") {
    const z = round(clamp((layout.cy - point.y) / layout.elevationHalf * 12, -12, 12), 2);
    const dz = z - initial.target.z;
    entity.target = { ...initial.target, z };
    entity.eye = { ...initial.eye, z: round(initial.eye.z + dz, 2) };
    return;
  }
  if (handle === "camera-eye") {
    const next = {
      azimuth: Math.atan2(point.y - layout.cy, point.x - layout.cx) * 180 / Math.PI,
      elevation: orbit.elevation,
      radius: guidePixelsToRadius(Math.hypot(point.x - layout.cx, point.y - layout.cy)),
    };
    entity.eye = roundedPoint3(eyeFromOrbit(entity.target, next));
    return;
  }
  if (handle === "camera-elevation") {
    const elevation = clamp((layout.cy - point.y) / layout.elevationHalf * 89, -89, 89);
    entity.eye = roundedPoint3(eyeFromOrbit(entity.target, { ...orbit, elevation }));
  }
}

function ActionGizmo({ doc, selected, action, size, onHandleDown }: {
  doc: SceneDoc; selected: ActionSelection; action: SceneAction; size: { width: number; height: number };
  onHandleDown(event: ReactPointerEvent, handle: string): void;
}) {
  if (action.verb === "say") return <SayDestinationGizmo doc={doc} action={action} />;
  if (action.verb === "rewrite") return <RewriteDestinationGizmo doc={doc} action={action} />;
  if (action.verb === "slidex" || action.verb === "slidey") {
    const target = doc.entities.find((entity) => entity.id === action.target);
    const targetBox = geometryContext(doc).bounds(action.target);
    if (!target && !targetBox) return null;
    const from = target ? entityAnchor(target, doc) : { x: targetBox!.x + targetBox!.width / 2, y: targetBox!.y + targetBox!.height / 2 };
    const to = action.verb === "slidex" ? { x: action.amount ?? from.x, y: from.y } : { x: from.x, y: action.amount ?? from.y };
    return <g className="mse-camera-guide">
      <title>Absolute axis destination. Drag the handle to edit the native value; Preview owns timing and easing.</title>
      <line className="mse-camera-path" x1={from.x} y1={from.y} x2={to.x} y2={to.y} pointerEvents="none" />
      <CameraReticle x={to.x} y={to.y} />
      <text className="mse-camera-label" x={to.x + 18} y={to.y - 20}>{action.verb.toUpperCase()} → {Math.round(action.amount ?? 0)}</text>
      <circle className="mse-camera-handle" cx={to.x} cy={to.y} r={11} onPointerDown={(event) => onHandleDown(event, "slide-destination")} />
    </g>;
  }
  if (action.verb === "arrange" && action.ref) {
    const particles = doc.entities.find((entity) => entity.id === action.target);
    const container = geometryContext(doc).bounds(action.ref);
    if (!particles || !container) return null;
    const from = entityAnchor(particles, doc), to = { x: container.x + container.width / 2, y: container.y + container.height / 2 };
    return <g className="mse-semantic-relation" pointerEvents="none">
      <title>Semantic persistent-particle layout relationship. Native Preview owns routes and exact positions.</title>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} /><circle cx={to.x} cy={to.y} r={6} />
      <rect x={container.x - 5} y={container.y - 5} width={container.width + 10} height={container.height + 10} rx={7} />
      <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} textAnchor="middle">⠿ ARRANGE · {(action.text ?? "random").toUpperCase()}</text>
    </g>;
  }
  if (action.verb === "setsliders") {
    const rack = doc.entities.find((entity) => entity.id === action.target);
    if (!rack || rack.kind !== "sliders") return null;
    const values = Array.from({ length: Math.max(1, Math.round(rack.count)) }, (_unused, index) => Math.max(-1, Math.min(1, action.values?.[index] ?? 0)));
    const top = rack.y - rack.height / 2, bottom = rack.y + rack.height / 2;
    return <g className="mse-semantic-relation" pointerEvents="none">
      <title>Set Sliders destination. Canvas shows every requested coordinate; Preview owns native easing and the timed sum text event.</title>
      <rect x={rack.x - rack.width / 2 - 8} y={top - 8} width={rack.width + 16} height={rack.height + 82} rx={8} />
      {values.map((value, index) => { const x = rack.count <= 1 ? rack.x : rack.x - rack.width / 2 + (index + .5) * rack.width / rack.count; return <circle key={index} cx={x} cy={rack.y - value * rack.height / 2} r={6} />; })}
      <text x={rack.x} y={top - 18} textAnchor="middle">☷ SET SLIDERS · Σx²={values.reduce((sum, value) => sum + value * value, 0).toFixed(2)}</text>
    </g>;
  }
  if (action.verb === "wander") {
    const box = geometryContext(doc).bounds(action.target);
    if (!box) return null;
    return <g className="mse-semantic-relation" pointerEvents="none">
      <title>Deterministic contained particle motion. Preview expands seekable child position tracks from the particle seed.</title>
      <rect x={box.x - 7} y={box.y - 7} width={box.width + 14} height={box.height + 14} rx={8} />
      <path d={`M ${box.x + box.width * .2} ${box.y + box.height * .55} C ${box.x + box.width * .35} ${box.y + box.height * .15}, ${box.x + box.width * .6} ${box.y + box.height * .9}, ${box.x + box.width * .8} ${box.y + box.height * .42}`} fill="none" />
      <text x={box.x + box.width / 2} y={box.y - 16} textAnchor="middle">≈ WANDER · SEEDED · {action.dur}s ▶</text>
    </g>;
  }
  if (action.verb === "groupscale") {
    const group = geometryContext(doc).bounds(action.target);
    if (!group) return null;
    const factor = Math.max(.01, action.amount ?? 1), cx = group.x + group.width / 2, cy = group.y + group.height / 2;
    const scaled = { x: cx - group.width * factor / 2, y: cy - group.height * factor / 2, width: group.width * factor, height: group.height * factor };
    return <g className="mse-camera-guide" pointerEvents="none">
      <title>Semantic collective-centre scale. Preview applies the factor to every native group member.</title>
      <rect className="mse-camera-frame ghost" x={group.x} y={group.y} width={group.width} height={group.height} rx={8} />
      <rect className="mse-camera-frame target" x={scaled.x} y={scaled.y} width={scaled.width} height={scaled.height} rx={8} />
      <CameraReticle x={cx} y={cy} /><text className="mse-camera-label" x={scaled.x + 12} y={scaled.y - 12}>GROUPSCALE {action.target} · {factor}×</text>
    </g>;
  }
  if (action.verb === "dock" && action.ref) {
    const geometry = geometryContext(doc), group = geometry.bounds(action.target), member = geometry.bounds(action.ref);
    const destinationRef = action.refs?.[0], destinationBox = destinationRef ? geometry.bounds(destinationRef) : null;
    const destination = destinationBox ? { x: destinationBox.x + destinationBox.width / 2, y: destinationBox.y + destinationBox.height / 2 } : action.point;
    if (!group || !member || !destination) return null;
    const from = { x: member.x + member.width / 2, y: member.y + member.height / 2 };
    return <g className="mse-semantic-relation">
      <title>Semantic rigid group shift. The named member lands on this destination in native Preview.</title>
      <rect x={group.x - 5} y={group.y - 5} width={group.width + 10} height={group.height + 10} rx={7} pointerEvents="none" />
      <line x1={from.x} y1={from.y} x2={destination.x} y2={destination.y} pointerEvents="none" /><circle cx={destination.x} cy={destination.y} r={6} pointerEvents="none" />
      <text x={(from.x + destination.x) / 2} y={(from.y + destination.y) / 2 - 8} textAnchor="middle" pointerEvents="none">DOCK {action.ref} → {destinationRef ?? "POINT"}</text>
      {!destinationRef && <circle className="mse-camera-handle" cx={destination.x} cy={destination.y} r={11} onPointerDown={(event) => onHandleDown(event, "dock-target")} />}
    </g>;
  }
  if (action.verb === "surround" && action.ref) {
    const geometry = geometryContext(doc), box = geometry.bounds(action.target), destination = geometry.bounds(action.ref);
    if (!box || !destination) return null;
    const target = { x: destination.x - 8, y: destination.y - 8, width: destination.width + 16, height: destination.height + 16 };
    return <g className="mse-camera-guide" pointerEvents="none">
      <title>Semantic surround destination. Native Preview glides and resizes the existing rectangle with authored timing and easing.</title>
      <rect className="mse-camera-frame ghost" x={box.x} y={box.y} width={box.width} height={box.height} rx={8} />
      <rect className="mse-camera-frame target" x={target.x} y={target.y} width={target.width} height={target.height} rx={8} />
      <line className="mse-camera-path" x1={box.x + box.width / 2} y1={box.y + box.height / 2} x2={destination.x + destination.width / 2} y2={destination.y + destination.height / 2} />
      <text className="mse-camera-label" x={target.x + 10} y={target.y - 12}>SURROUND → {action.ref}</text>
    </g>;
  }
  if (action.verb === "grow") {
    const target = doc.entities.find((entity) => entity.id === action.target);
    const destinationBox = action.ref ? geometryContext(doc).bounds(action.ref) : null;
    const destination = destinationBox ? { x: destinationBox.x + destinationBox.width / 2, y: destinationBox.y + destinationBox.height / 2 } : action.point;
    if (!target || !destination) return null;
    const from = entityAnchor(target, doc);
    return <g className="mse-camera-guide">
      <title>Editable endpoint destination. Native Preview grows the line-like entity with authored timing and easing.</title>
      <line className="mse-camera-path" x1={from.x} y1={from.y} x2={destination.x} y2={destination.y} pointerEvents="none" />
      <CameraReticle x={destination.x} y={destination.y} />
      <text className="mse-camera-label" x={destination.x + 18} y={destination.y - 20}>GROW → {action.ref ?? `(${Math.round(destination.x)}, ${Math.round(destination.y)})`}</text>
      {!action.ref && <circle className="mse-camera-handle" cx={destination.x} cy={destination.y} r={11} onPointerDown={(event) => onHandleDown(event, "grow-endpoint")} />}
    </g>;
  }
  if (action.verb === "rotate") {
    const box = geometryContext(doc).bounds(action.target);
    if (!box) return null;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2, radius = Math.max(34, Math.hypot(box.width, box.height) * .58);
    const radians = (action.amount ?? 0) * Math.PI / 180, end = { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
    return <g className="mse-camera-guide" pointerEvents="none">
      <title>Absolute rotation destination. Canvas playback tracks the angle; Preview owns final pixels.</title>
      <circle className="mse-camera-frame target" cx={cx} cy={cy} r={radius} />
      <line className="mse-camera-path" x1={cx} y1={cy} x2={end.x} y2={end.y} />
      <CameraReticle x={cx} y={cy} /><text className="mse-camera-label" x={end.x + 10} y={end.y - 10}>ROTATE → {round(action.amount ?? 0, 1)}°</text>
    </g>;
  }
  if (action.verb === "transform") {
    const box = geometryContext(doc).bounds(action.target), origin = action.point;
    if (!box || !origin) return null;
    const [a, b, c, d] = action.values ?? [1, 0, 0, 1];
    const apply = (point: { x: number; y: number }) => { const x = point.x - origin.x, y = point.y - origin.y; return { x: origin.x + a * x + b * y, y: origin.y + c * x + d * y }; };
    const corners = [{ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y }, { x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y + box.height }].map(apply);
    return <g className="mse-camera-guide">
      <title>Semantic matrix destination. Canvas shows transformed bounds and anchor motion; Preview transforms the native geometry and endpoints.</title>
      <rect className="mse-camera-frame ghost" x={box.x} y={box.y} width={box.width} height={box.height} rx={7} pointerEvents="none" />
      <polygon className="mse-camera-frame target" points={corners.map((point) => `${point.x},${point.y}`).join(" ")} pointerEvents="none" />
      <CameraReticle x={origin.x} y={origin.y} />
      <text className="mse-camera-label" x={origin.x + 20} y={origin.y - 22}>MATRIX [[{round(a, 2)}, {round(b, 2)}], [{round(c, 2)}, {round(d, 2)}]]</text>
      <circle className="mse-camera-handle" cx={origin.x} cy={origin.y} r={11} onPointerDown={(event) => onHandleDown(event, "matrix-origin")} />
    </g>;
  }
  if (action.verb === "swap" && action.ref) {
    const geometry = geometryContext(doc), a = geometry.bounds(action.target), b = geometry.bounds(action.ref);
    if (!a || !b) return null;
    const ca = { x: a.x + a.width / 2, y: a.y + a.height / 2 }, cb = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    return <g className="mse-semantic-relation" pointerEvents="none">
      <title>Semantic two-entity position exchange. Preview resolves current authored positions and easing.</title>
      <rect x={a.x - 5} y={a.y - 5} width={a.width + 10} height={a.height + 10} rx={7} /><rect x={b.x - 5} y={b.y - 5} width={b.width + 10} height={b.height + 10} rx={7} />
      <line x1={ca.x} y1={ca.y - 7} x2={cb.x} y2={cb.y - 7} /><line x1={cb.x} y1={cb.y + 7} x2={ca.x} y2={ca.y + 7} />
      <text x={(ca.x + cb.x) / 2} y={(ca.y + cb.y) / 2 - 15} textAnchor="middle">⇄ SWAP POSITIONS</text>
    </g>;
  }
  if (action.verb === "deform") {
    const box = geometryContext(doc).bounds(action.target);
    if (!box) return null;
    const y = box.y + box.height / 2, left = box.x - 8, right = box.x + box.width + 8, width = Math.max(1, right - left);
    const wave = Array.from({ length: 25 }, (_unused, index) => { const x = left + width * index / 24; return `${index ? "L" : "M"} ${x} ${y + Math.sin(index * Math.PI / 3) * 12}`; }).join(" ");
    return <g className="mse-semantic-relation" pointerEvents="none">
      <title>Semantic homotopy marker. Preview samples the true outline and evaluates both formulas continuously.</title>
      <rect x={box.x - 7} y={box.y - 7} width={box.width + 14} height={box.height + 14} rx={7} /><path d={wave} fill="none" />
      <text x={box.x + box.width / 2} y={box.y - 17} textAnchor="middle">ƒ DEFORM · u/v(x,y,t) ▶</text>
    </g>;
  }
  if (action.verb === "restore") {
    const box = geometryContext(doc).bounds(action.target);
    if (!box) return null;
    return <g className="mse-camera-guide" pointerEvents="none">
      <title>Saved-state destination. Preview restores position, scale, rotation, colour, and opacity.</title>
      <rect className="mse-camera-frame target" x={box.x - 8} y={box.y - 8} width={box.width + 16} height={box.height + 16} rx={8} />
      <text className="mse-camera-label" x={box.x} y={box.y - 20}>↶ RESTORE SAVED STATE</text>
    </g>;
  }
  if (["blink", "wiggle", "circumscribe", "passflash", "spotlight", "spiralin"].includes(action.verb)) {
    const box = geometryContext(doc).bounds(action.target);
    if (!box) return null;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    if (action.verb === "circumscribe") return <g className="mse-camera-guide" pointerEvents="none">
      <title>Semantic temporary trace. Preview owns its exact stroke and fade.</title>
      <rect className="mse-camera-frame target" x={box.x - 12} y={box.y - 12} width={box.width + 24} height={box.height + 24} rx={9} />
      <text className="mse-camera-label" x={box.x} y={box.y - 24}>CIRCUMSCRIBE · {action.color ?? "gold"} ▶</text>
    </g>;
    if (action.verb === "spotlight") return <g className="mse-camera-guide" pointerEvents="none">
      <title>Semantic spotlight focus. Preview owns the expanding wash and fade.</title>
      <circle className="mse-camera-frame target" cx={cx} cy={cy} r={Math.max(36, Math.hypot(box.width, box.height) * .62)} />
      <CameraReticle x={cx} y={cy} /><text className="mse-camera-label" x={cx + 20} y={cy - 24}>SPOTLIGHT ▶</text>
    </g>;
    if (action.verb === "passflash") return <g className="mse-semantic-relation" pointerEvents="none">
      <title>Semantic passing outline. Preview samples and animates the exact native contour.</title>
      <rect x={box.x - 7} y={box.y - 7} width={box.width + 14} height={box.height + 14} rx={7} />
      <text x={cx} y={box.y - 16} textAnchor="middle">↝ PASS FLASH · {action.color ?? "gold"}</text>
    </g>;
    if (action.verb === "spiralin") return <g className="mse-semantic-relation" pointerEvents="none">
      <title>Semantic group entrance. Preview computes each member's staggered spiral from the collective centre.</title>
      <rect x={box.x - 6} y={box.y - 6} width={box.width + 12} height={box.height + 12} rx={8} />
      <circle cx={cx} cy={cy} r={7} /><text x={cx} y={cy - 18} textAnchor="middle">↻ SPIRAL IN · GROUP CENTRE</text>
    </g>;
    return <g className="mse-semantic-relation" pointerEvents="none">
      <title>{action.verb === "blink" ? "Canvas timeline reproduces the opacity beats; Preview is final pixel truth." : "Canvas timeline reproduces the scale and rotation gesture; Preview is final pixel truth."}</title>
      <rect x={box.x - 6} y={box.y - 6} width={box.width + 12} height={box.height + 12} rx={8} />
      <text x={cx} y={box.y - 14} textAnchor="middle">{action.verb === "blink" ? "◉ BLINK" : "≋ WIGGLE"}</text>
    </g>;
  }
  if (action.verb === "turn") {
    const target = doc.entities.find((entity) => entity.id === action.target);
    const pivotBox = action.ref ? geometryContext(doc).bounds(action.ref) : null;
    const pivot = pivotBox ? { x: pivotBox.x + pivotBox.width / 2, y: pivotBox.y + pivotBox.height / 2 } : action.point;
    if (!target || !pivot) return null;
    const anchor = entityAnchor(target, doc);
    const radius = Math.max(18, Math.hypot(anchor.x - pivot.x, anchor.y - pivot.y));
    return (
      <g className="mse-camera-guide">
        <title>Semantic turn pivot. Native Preview owns the exact orbit, segment sampling and easing.</title>
        <line className="mse-camera-path" x1={pivot.x} y1={pivot.y} x2={anchor.x} y2={anchor.y} pointerEvents="none" />
        <circle className="mse-camera-frame ghost" cx={pivot.x} cy={pivot.y} r={radius} fill="none" pointerEvents="none" />
        <CameraReticle x={pivot.x} y={pivot.y} />
        <text className="mse-camera-label" x={pivot.x + 18} y={pivot.y - 20}>TURN {action.amount ?? 0}° · {action.ref ?? "POINT PIVOT"}</text>
        {!action.ref && <circle className="mse-camera-handle" cx={pivot.x} cy={pivot.y} r={11} onPointerDown={(event) => onHandleDown(event, "turn-pivot")} />}
      </g>
    );
  }
  if (["become", "attach"].includes(action.verb) && action.ref && action.ref !== "none") {
    const source = doc.entities.find((entity) => entity.id === action.target), target = geometryContext(doc).bounds(action.ref);
    if (!source || !target) return null;
    const from = entityAnchor(source, doc), to = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    return <g className="mse-semantic-relation" pointerEvents="none"><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} /><circle cx={to.x} cy={to.y} r={6} /><rect x={target.x - 5} y={target.y - 5} width={target.width + 10} height={target.height + 10} rx={7} /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} textAnchor="middle">{action.verb === "attach" ? "⛓ ATTACH" : "⇢ BECOME"}</text></g>;
  }
  if (action.verb === "followshot" && action.target !== "none") {
    const target = doc.entities.find((entity) => entity.id === action.target);
    if (!target) return null;
    const at = entityAnchor(target, doc);
    return <g className="mse-camera-guide" pointerEvents="none"><CameraReticle x={at.x} y={at.y} /><text className="mse-camera-label" x={at.x + 20} y={at.y - 22}>FOLLOW SHOT · ▶ NATIVE PREVIEW</text></g>;
  }
  if (["move3", "grow3", "look3"].includes(action.verb)) {
    const values = action.values ?? [0, 0, 0];
    const at = projectPoint3({ x: values[0] ?? 0, y: values[1] ?? 0, z: values[2] ?? 0 }, doc);
    return <g className="mse-camera-guide" pointerEvents="none"><CameraReticle x={at.x} y={at.y} /><text className="mse-camera-label" x={at.x + 20} y={at.y - 22}>{action.verb.toUpperCase()} · WORLD ({values.slice(0, 3).join(", ")}) · ▶ PREVIEW</text></g>;
  }
  if (["become3", "travel3", "advect3"].includes(action.verb) && action.ref) {
    const geometry = geometryContext(doc), source = geometry.bounds(action.target), related = geometry.bounds(action.ref);
    if (!source || !related) return null;
    const from = { x: source.x + source.width / 2, y: source.y + source.height / 2 }, to = { x: related.x + related.width / 2, y: related.y + related.height / 2 };
    return <g className="mse-semantic-relation" pointerEvents="none"><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} /><rect x={related.x - 5} y={related.y - 5} width={related.width + 10} height={related.height + 10} rx={7} /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} textAnchor="middle">{action.verb.toUpperCase()} · ▶ NATIVE PREVIEW</text></g>;
  }
  if (action.verb === "turn3") {
    const geometry = geometryContext(doc), target = geometry.bounds(action.target);
    const values = action.values ?? [0, 0, 0], pivotBox = action.ref ? geometry.bounds(action.ref) : null;
    const pivot = pivotBox ? { x: pivotBox.x + pivotBox.width / 2, y: pivotBox.y + pivotBox.height / 2 } : projectPoint3({ x: values[0] ?? 0, y: values[1] ?? 0, z: values[2] ?? 0 }, doc);
    if (!target) return null;
    const from = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    return <g className="mse-camera-guide" pointerEvents="none"><line className="mse-camera-path" x1={from.x} y1={from.y} x2={pivot.x} y2={pivot.y} /><CameraReticle x={pivot.x} y={pivot.y} /><text className="mse-camera-label" x={pivot.x + 20} y={pivot.y - 22}>TURN3 {action.amount ?? 0}° · {action.prop ?? "axis"} · ▶ PREVIEW</text></g>;
  }
  if (action.verb === "view3" || action.verb === "present3") {
    const box = geometryContext(doc).bounds(action.target);
    if (!box) return null;
    return <g className="mse-camera-guide" pointerEvents="none"><rect className="mse-camera-frame target" x={box.x - 7} y={box.y - 7} width={box.width + 14} height={box.height + 14} rx={9} /><text className="mse-camera-label" x={box.x} y={box.y - 18}>{action.verb === "view3" ? `${(action.prop ?? "fit").toUpperCase()} VIEW · MARGIN ${action.amount ?? 1.18}` : `${(action.prop ?? "spatial").toUpperCase()} PRESENTATION`} · ▶ PREVIEW</text></g>;
  }
  if (action.verb === "followshot3" && action.target !== "none") {
    const box = geometryContext(doc).bounds(action.target);
    if (!box) return null;
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    return <g className="mse-camera-guide" pointerEvents="none"><CameraReticle x={at.x} y={at.y} /><text className="mse-camera-label" x={at.x + 20} y={at.y - 22}>FOLLOW SHOT 3D · XYZ OFFSET · ▶ PREVIEW</text></g>;
  }
  if (action.verb === "cam" || action.verb === "zoom") {
    const before = camera2Before(doc, selected);
    const after = action.verb === "cam" && action.point ? { ...before, center: action.point } : { ...before, zoom: Math.max(.01, action.amount ?? 1) };
    const from = cameraViewport(before, size), to = cameraViewport(after, size);
    const handle = action.verb === "cam" ? after.center : { x: to.x + to.width, y: to.y + to.height };
    return (
      <g className="mse-camera-guide">
        <title>Authoring guide only. Native Preview is the camera pixel truth.</title>
        <rect className="mse-camera-frame ghost" x={from.x} y={from.y} width={from.width} height={from.height} rx={10} pointerEvents="none" />
        <rect className="mse-camera-frame target" x={to.x} y={to.y} width={to.width} height={to.height} rx={10} pointerEvents="none" />
        <line className="mse-camera-path" x1={before.center.x} y1={before.center.y} x2={after.center.x} y2={after.center.y} pointerEvents="none" />
        <CameraReticle x={after.center.x} y={after.center.y} />
        <text className="mse-camera-label" x={to.x + 14} y={to.y + 26}>{action.verb === "cam" ? `CAM → (${Math.round(after.center.x)}, ${Math.round(after.center.y)})` : `ZOOM → ${round(after.zoom, 2)}×`}</text>
        <circle className="mse-camera-handle" cx={handle.x} cy={handle.y} r={11} onPointerDown={(event) => onHandleDown(event, action.verb === "cam" ? "cam-center" : "zoom-corner")} />
      </g>
    );
  }
  if (action.verb === "orbit3" || action.verb === "roll3") {
    const before = camera3Before(doc, selected);
    if (!before) return null;
    const target: Camera3State = action.verb === "orbit3" ? {
      ...before, azimuth: action.amount ?? before.azimuth, elevation: action.values?.[0] ?? before.elevation, radius: action.values?.[1] ?? before.radius,
    } : { ...before, roll: action.amount ?? before.roll };
    return <Camera3PlanGizmo state={target} ghost={before} size={size} side="right" mode={action.verb} onHandleDown={onHandleDown} />;
  }
  return null;
}

function RewriteDestinationGizmo({ doc, action }: { doc: SceneDoc; action: SceneAction }) {
  const target = doc.entities.find((entity): entity is EquationEntity => entity.id === action.target && entity.kind === "equation");
  if (!target) return null;
  const preview: EquationEntity = { ...target, latex: action.text ?? "" };
  const targetBox = entityBounds(target, doc), previewBox = entityBounds(preview, doc);
  const box = unionBox(targetBox, previewBox), theme = THEMES[doc.template];
  return (
    <g className="mse-text-destination mse-rewrite-destination" pointerEvents="none">
      <title>Semantic rewrite destination. Native Preview owns symbol matching, motion, and exact equation typesetting.</title>
      <rect className="mse-text-destination-plate" x={box.x - 14} y={box.y - 14} width={box.width + 28} height={box.height + 28} rx={9} fill={theme.background} />
      <rect className="mse-text-destination-frame" x={previewBox.x - 8} y={previewBox.y - 8} width={previewBox.width + 16} height={previewBox.height + 16} rx={7} />
      <g className="mse-text-destination-copy">{renderEntity(preview, designFrame(preview, doc), { template: doc.template, doc })}</g>
      <text className="mse-text-destination-label" x={previewBox.x} y={previewBox.y - 18}>REWRITE DESTINATION · ▶ NATIVE PREVIEW</text>
    </g>
  );
}

function SayDestinationGizmo({ doc, action }: { doc: SceneDoc; action: SceneAction }) {
  const target = doc.entities.find((entity) => entity.id === action.target);
  const preview = target ? sayPreviewEntity(target, action.text ?? "") : null;
  if (!target || !preview) return null;
  const targetBox = entityBounds(target, doc), previewBox = entityBounds(preview, doc);
  const box = unionBox(targetBox, previewBox), lines = layoutTextLines(preview, doc);
  const theme = THEMES[doc.template];
  return (
    <g className="mse-text-destination" pointerEvents="none">
      <title>Semantic say destination. Native Preview owns the crossfade and exact font shaping.</title>
      <rect className="mse-text-destination-plate" x={box.x - 14} y={box.y - 14} width={box.width + 28} height={box.height + 28} rx={9} fill={theme.background} />
      <rect className="mse-text-destination-frame" x={previewBox.x - 8} y={previewBox.y - 8} width={previewBox.width + 16} height={previewBox.height + 16} rx={7} />
      <g className="mse-text-destination-copy">{renderEntity(preview, designFrame(preview, doc), { template: doc.template, doc })}</g>
      <text className="mse-text-destination-label" x={previewBox.x} y={previewBox.y - 18}>SAY DESTINATION · {lines.length} LINE{lines.length === 1 ? "" : "S"} · ▶ NATIVE PREVIEW</text>
    </g>
  );
}

function sayPreviewEntity(entity: SceneEntity, text: string): TextEntity | null {
  if (entity.kind === "text") return { ...entity, text };
  if (entity.kind !== "caption" && entity.kind !== "counter") return null;
  const source = entity as CaptionEntity | CounterEntity;
  return {
    ...source,
    kind: "text", x: source.x, y: source.y, text,
    size: source.kind === "caption" ? source.size : 28,
    bold: source.kind === "caption", display: false, align: "center", leading: 1.4, wrap: null, vertical: false,
  };
}

function unionBox(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width), bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

function Camera3EntityGizmo({ entity, size, onHandleDown }: { entity: Camera3Entity; size: { width: number; height: number }; onHandleDown(event: ReactPointerEvent, handle: string): void }) {
  return <Camera3PlanGizmo state={orbitFromPoints(entity.eye, entity.target)} size={size} side="left" mode="camera3" target={entity.target} onHandleDown={onHandleDown} />;
}

function Camera3PlanGizmo({ state, ghost, size, side, mode, target, onHandleDown }: {
  state: Camera3State; ghost?: Camera3State; size: { width: number; height: number }; side: "left" | "right";
  mode: "camera3" | "orbit3" | "roll3"; target?: { x: number; y: number; z: number };
  onHandleDown(event: ReactPointerEvent, handle: string): void;
}) {
  const layout = cameraGuideLayout(size, side);
  const point = orbitGuidePoint(state, layout);
  const ghostPoint = ghost ? orbitGuidePoint(ghost, layout) : null;
  const elevationY = layout.cy - state.elevation / 89 * layout.elevationHalf;
  const targetZY = target ? layout.cy - clamp(target.z / 12, -1, 1) * layout.elevationHalf : layout.cy;
  const rollAngle = state.roll * Math.PI / 180;
  const rollPoint = { x: layout.cx + 80 * Math.cos(rollAngle), y: layout.cy + 80 * Math.sin(rollAngle) };
  const ghostRoll = ghost ? { x: layout.cx + 80 * Math.cos(ghost.roll * Math.PI / 180), y: layout.cy + 80 * Math.sin(ghost.roll * Math.PI / 180) } : null;
  return (
    <g className="mse-camera-guide mse-camera3-guide">
      <title>Semantic 3D camera authoring guide. Native Preview owns depth, shading and animation.</title>
      <rect className="mse-camera-panel" x={layout.cx - 142} y={layout.cy - 126} width={284} height={252} rx={14} pointerEvents="none" />
      <text className="mse-camera-kicker" x={layout.cx - 126} y={layout.cy - 100}>{mode === "camera3" ? "INITIAL 3D CAMERA" : mode === "orbit3" ? "ORBIT3 DESTINATION" : "ROLL3 DESTINATION"}</text>
      <circle className="mse-camera-orbit" cx={layout.cx} cy={layout.cy} r={80} pointerEvents="none" />
      <text className="mse-camera-axis" x={layout.cx + 88} y={layout.cy + 4}>+X</text>
      <text className="mse-camera-axis" x={layout.cx + 4} y={layout.cy + 92}>+Y</text>
      {mode !== "roll3" && <>
        {ghostPoint && <><line className="mse-camera-path" x1={ghostPoint.x} y1={ghostPoint.y} x2={point.x} y2={point.y} /><circle className="mse-camera-ghost-dot" cx={ghostPoint.x} cy={ghostPoint.y} r={7} /></>}
        <line className="mse-camera-ray" x1={layout.cx} y1={layout.cy} x2={point.x} y2={point.y} />
        <circle className="mse-camera-target-handle" cx={layout.cx} cy={layout.cy} r={10} onPointerDown={mode === "camera3" ? (event) => onHandleDown(event, "camera-target") : undefined} />
        <circle className="mse-camera-handle" cx={point.x} cy={point.y} r={11} onPointerDown={(event) => onHandleDown(event, mode === "camera3" ? "camera-eye" : "orbit-eye")} />
        <line className="mse-camera-elevation" x1={layout.elevationX} y1={layout.cy - layout.elevationHalf} x2={layout.elevationX} y2={layout.cy + layout.elevationHalf} />
        <circle className="mse-camera-handle" cx={layout.elevationX} cy={elevationY} r={9} onPointerDown={(event) => onHandleDown(event, mode === "camera3" ? "camera-elevation" : "orbit-elevation")} />
        {mode === "camera3" && <>
          <line className="mse-camera-elevation" x1={layout.targetZX} y1={layout.cy - layout.elevationHalf} x2={layout.targetZX} y2={layout.cy + layout.elevationHalf} />
          <circle className="mse-camera-handle" cx={layout.targetZX} cy={targetZY} r={9} onPointerDown={(event) => onHandleDown(event, "camera-target-z")} />
          <text className="mse-camera-small" x={layout.targetZX - 10} y={layout.cy - layout.elevationHalf - 8}>TZ</text>
        </>}
        <text className="mse-camera-small" x={layout.cx - 126} y={layout.cy + 106}>az {round(state.azimuth, 1)}° · el {round(state.elevation, 1)}° · r {round(state.radius, 2)}</text>
        <text className="mse-camera-small" x={layout.elevationX - 9} y={layout.cy - layout.elevationHalf - 8}>EL</text>
        {target && <text className="mse-camera-small" x={layout.cx - 126} y={layout.cy + 122}>target ({round(target.x, 2)}, {round(target.y, 2)}, {round(target.z, 2)})</text>}
      </>}
      {mode === "roll3" && <>
        {ghostRoll && <circle className="mse-camera-ghost-dot" cx={ghostRoll.x} cy={ghostRoll.y} r={7} />}
        <line className="mse-camera-ray" x1={layout.cx} y1={layout.cy} x2={rollPoint.x} y2={rollPoint.y} />
        <CameraReticle x={layout.cx} y={layout.cy} />
        <circle className="mse-camera-handle" cx={rollPoint.x} cy={rollPoint.y} r={11} onPointerDown={(event) => onHandleDown(event, "roll-angle")} />
        <text className="mse-camera-small" x={layout.cx - 126} y={layout.cy + 106}>roll {round(state.roll, 1)}°</text>
      </>}
      <text className="mse-camera-native" x={layout.cx + 126} y={layout.cy + 122} textAnchor="end">▶ NATIVE PREVIEW IS PIXEL TRUTH</text>
    </g>
  );
}

function CameraReticle({ x, y }: { x: number; y: number }) {
  return <g className="mse-camera-reticle" pointerEvents="none"><circle cx={x} cy={y} r={14} /><line x1={x - 22} y1={y} x2={x + 22} y2={y} /><line x1={x} y1={y - 22} x2={x} y2={y + 22} /></g>;
}

function cameraGuideLayout(size: { width: number; height: number }, side: "left" | "right") {
  const inset = Math.min(178, size.width / 2);
  const cx = side === "left" ? inset : size.width - inset;
  return { cx, cy: Math.min(170, size.height / 2), elevationX: cx + 112, targetZX: cx - 112, elevationHalf: 76 };
}

function orbitGuidePoint(state: Camera3State, layout: ReturnType<typeof cameraGuideLayout>) {
  const angle = state.azimuth * Math.PI / 180, radius = radiusToGuidePixels(state.radius);
  return { x: layout.cx + radius * Math.cos(angle), y: layout.cy + radius * Math.sin(angle) };
}

function roundedPoint3(point: { x: number; y: number; z: number }) { return { x: round(point.x, 2), y: round(point.y, 2), z: round(point.z, 2) }; }
function round(value: number, places: number): number { const factor = 10 ** places; return Math.round(value * factor) / factor; }

function designFrame(entity: SceneEntity, doc: SceneDoc): EntityFrame {
  const anchor = entityAnchor(entity, doc);
  return {
    x: anchor.x, y: anchor.y, opacity: entity.opacity, scale: 1, rotation: entity.rotation,
    draw: 1, type: 1, flash: null, aux: {}, words: null,
  };
}

function Grid({ width, height, stroke }: { width: number; height: number; stroke: string }) {
  const lines: string[] = [];
  for (let index = 1; index < 12; index += 1) lines.push(`M ${(width / 12) * index} 0 V ${height}`);
  for (let index = 1; index < 12; index += 1) lines.push(`M 0 ${(height / 12) * index} H ${width}`);
  return <path d={lines.join(" ")} stroke={stroke} strokeWidth="1" fill="none" />;
}

function SceneAnimationMarker({ doc, width }: { doc: SceneDoc; width: number }) {
  const actions = doc.steps.flatMap(stepActions);
  const summaries = [
    { verb: "mark", icon: "⚑", label: "timeline marks" },
    { verb: "cam", icon: "🎥", label: "camera pans" },
    { verb: "zoom", icon: "⌕", label: "camera zooms" },
    { verb: "followshot", icon: "🎯", label: "camera follow shots" },
    { verb: "orbit3", icon: "◇3", label: "3D camera orbits" },
    { verb: "roll3", icon: "↻3", label: "3D camera rolls" },
    { verb: "look3", icon: "⌖3", label: "3D camera looks" },
    { verb: "view3", icon: "▣3", label: "3D camera framing moves" },
    { verb: "followshot3", icon: "🎥3", label: "3D camera follow shots" },
  ].map((item) => ({ ...item, count: actions.filter((action) => action.verb === item.verb).length })).filter((item) => item.count > 0);
  if (summaries.length === 0) return null;
  const text = summaries.map((item) => `${item.icon} ${item.count}`).join("  ·  ");
  const title = summaries.map((item) => `${item.count} ${item.label}`).join(", ");
  const markerWidth = Math.max(128, text.length * 11 + 28);
  return (
    <g className="mse-semantic-marker" transform={`translate(${width - markerWidth - 18} 18)`} pointerEvents="none" aria-label={title}>
      <title>{title}. Edit these scene-wide actions in Story; Preview shows their native result.</title>
      <rect width={markerWidth} height={34} rx={17} />
      <text x={markerWidth / 2} y={18} textAnchor="middle" dominantBaseline="central">{text}</text>
    </g>
  );
}

function EntityView({ entity, frame, doc, assets, dimmedInView, onPointerDown }: {
  entity: SceneEntity;
  frame: EntityFrame;
  doc: SceneDoc;
  assets?: ReadonlyMap<string, ResolvedManicAsset | null>;
  dimmedInView: boolean;
  onPointerDown(event: ReactPointerEvent): void;
}) {
  const anchor = entityAnchor(entity, doc);
  const dx = frame.x - anchor.x;
  const dy = frame.y - anchor.y;
  const transform = `translate(${dx} ${dy}) translate(${anchor.x} ${anchor.y}) rotate(${frame.rotation}) scale(${frame.scale}) translate(${-anchor.x} ${-anchor.y})`;
  const consumedByExtrude = doc.entities.some((candidate) => candidate.kind === "extrude3" && candidate.source === entity.id);
  return (
    <g
      transform={transform}
      pointerEvents={dimmedInView ? "none" : undefined}
      onPointerDown={onPointerDown}
      className="mse-entity"
    >
      <g opacity={dimmedInView ? frame.opacity * 0.07 : consumedByExtrude ? frame.opacity * .08 : frame.opacity}>
        {renderEntity(entity, frame, { template: doc.template, doc, assets })}
      </g>
      <g opacity={dimmedInView ? 0.07 : 1}>
        <AnnotationMarker entity={entity} doc={doc} />
      </g>
    </g>
  );
}

function AnnotationMarker({ entity, doc }: { entity: SceneEntity; doc: SceneDoc }) {
  const annotations = canvasAnnotations(entity, doc);
  if (annotations.length === 0) return null;
  const box = entityBounds(entity, doc);
  const icons = annotations.map((annotation) => annotation.icon).join(" ");
  const label = annotations.map((annotation) => annotation.label).join("; ");
  const width = Math.max(38, icons.length * 15 + 18);
  return (
    <g className="mse-semantic-marker" transform={`translate(${box.x + box.width - width} ${box.y - 42})`} aria-label={label}>
      <title>{label}</title>
      <rect width={width} height={32} rx={16} />
      <text x={width / 2} y={17} textAnchor="middle" dominantBaseline="central">{icons}</text>
    </g>
  );
}

function SelectionOverlay({ entity, doc, onHandleDown }: {
  entity: SceneEntity;
  doc: SceneDoc;
  onHandleDown(event: ReactPointerEvent, handle: string): void;
}) {
  const def = defFor(entity);
  const geometry = geometryContext(doc);
  const box = def.bounds(entity, geometry);
  const handles = def.handles(entity, geometry);
  const annotations = canvasAnnotations(entity, doc);
  const summary = annotations.slice(0, 2).map((annotation) => `${annotation.icon} ${annotation.label}`).join(" · ") + (annotations.length > 2 ? ` · +${annotations.length - 2}` : "");
  const relations = annotations.flatMap((annotation) => annotation.refs.map((ref) => ({ annotation, ref, box: geometry.bounds(ref) }))).filter((relation) => relation.box !== null);
  return (
    <g className="mse-selection">
      {relations.map(({ annotation, ref, box: target }) => {
        const targetBox = target!;
        const tx = targetBox.x + targetBox.width / 2;
        const ty = targetBox.y + targetBox.height / 2;
        const from = entityAnchor(entity, doc);
        return (
          <g className="mse-semantic-relation" key={`${annotation.id}-${ref}`} pointerEvents="none">
            <line x1={from.x} y1={from.y} x2={tx} y2={ty} />
            <circle cx={tx} cy={ty} r={5} />
            <rect x={targetBox.x - 5} y={targetBox.y - 5} width={targetBox.width + 10} height={targetBox.height + 10} rx={7} />
            <text x={(from.x + tx) / 2} y={(from.y + ty) / 2 - 7} textAnchor="middle">{annotation.icon} {ref}</text>
          </g>
        );
      })}
      <rect
        x={box.x - 8} y={box.y - 8} width={box.width + 16} height={box.height + 16}
        fill="none" stroke="var(--mse-accent, #E8683A)" strokeWidth="1.5" strokeDasharray="6 5" rx={6}
        pointerEvents="none"
      />
      {annotations.length > 0 && (
        <text x={box.x - 6} y={box.y - 16} fontSize={17} fill="var(--mse-accent, #E8683A)" fontFamily="var(--mse-canvas-font, monospace)" pointerEvents="none">
          {summary}
        </text>
      )}
      {entity.origin !== "generated" && !entity.copyOf && handles.map(({ name, x, y }) => (
        <circle key={name} cx={x} cy={y} r={7} className="mse-handle" onPointerDown={(event) => onHandleDown(event, name)} />
      ))}
    </g>
  );
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
