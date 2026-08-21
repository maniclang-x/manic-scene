// The canvas: a generic SVG design sketch of the scene — arrange, resize,
// select. Geometry (anchor, bounds, handles) comes from entity definitions;
// pixels come from the renderer registry. There is deliberately no playback
// here: watching the story is the engine's job (▶ Preview with Manic).

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  THEMES, defFor, docSize, entityAnchor, translateEntity,
  type SceneDoc, type SceneEntity,
} from "../index.js";
import type { EntityFrame } from "../timeline.js";
import { renderEntity } from "./renderers.js";

interface StageProps {
  doc: SceneDoc;
  fileName?: string;
  /** Count of file statements the canvas cannot show (for honest empty copy). */
  skippedCount?: number;
  dimmed: ReadonlySet<string>;
  selectedId: string;
  onSelect(id: string): void;
  onEntityChange(id: string, change: (entity: SceneEntity) => void): void;
}

export function Stage({ doc, fileName, skippedCount = 0, dimmed, selectedId, onSelect, onEntityChange }: StageProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<{ id: string; handle: string; grabX: number; grabY: number; downX: number; downY: number; moved: boolean } | null>(null);
  const size = docSize(doc);
  const theme = THEMES[doc.template];
  const selected = doc.entities.find((entity) => entity.id === selectedId) ?? null;

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
    const point = canvasPoint(event);
    const anchor = entityAnchor(entity);
    setDrag({ id, handle, grabX: point.x - anchor.x, grabY: point.y - anchor.y, downX: event.clientX, downY: event.clientY, moved: false });
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
    onEntityChange(drag.id, (entity) => {
      if (drag.handle === "move") {
        const anchor = entityAnchor(entity);
        translateEntity(entity, Math.round(point.x - drag.grabX - anchor.x), Math.round(point.y - drag.grabY - anchor.y));
      } else {
        defFor(entity).dragHandle(entity, drag.handle, px, py);
      }
    });
  }

  return (
    <div className="mse-stage-wrap">
      <div className={`mse-stage mse-format-${doc.format.replace(":", "x")}`} style={{ background: theme.background }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${size.width} ${size.height}`}
          onPointerDown={() => onSelect("")}
          onPointerMove={onPointerMove}
          onPointerUp={() => setDrag(null)}
          onPointerCancel={() => setDrag(null)}
          role="application"
          aria-label="Scene canvas"
        >
          <Grid width={size.width} height={size.height} stroke={theme.grid} />
          {[...doc.entities].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map((entity) => (
            <EntityView
              key={entity.id}
              entity={entity}
              frame={designFrame(entity)}
              doc={doc}
              dimmedInView={dimmed.has(entity.id)}
              onPointerDown={(event) => beginDrag(event, entity.id, "move")}
            />
          ))}
          {selected && (
            <SelectionOverlay entity={selected} onHandleDown={(event, handle) => beginDrag(event, selected.id, handle)} />
          )}
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

function designFrame(entity: SceneEntity): EntityFrame {
  const anchor = entityAnchor(entity);
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

function EntityView({ entity, frame, doc, dimmedInView, onPointerDown }: {
  entity: SceneEntity;
  frame: EntityFrame;
  doc: SceneDoc;
  dimmedInView: boolean;
  onPointerDown(event: ReactPointerEvent): void;
}) {
  const anchor = entityAnchor(entity);
  const dx = frame.x - anchor.x;
  const dy = frame.y - anchor.y;
  const transform = `translate(${dx} ${dy}) translate(${anchor.x} ${anchor.y}) rotate(${frame.rotation}) scale(${frame.scale}) translate(${-anchor.x} ${-anchor.y})`;
  return (
    <g
      transform={transform}
      opacity={dimmedInView ? frame.opacity * 0.07 : frame.opacity}
      pointerEvents={dimmedInView ? "none" : undefined}
      onPointerDown={onPointerDown}
      className="mse-entity"
    >
      {renderEntity(entity, frame, { template: doc.template })}
    </g>
  );
}

function SelectionOverlay({ entity, onHandleDown }: {
  entity: SceneEntity;
  onHandleDown(event: ReactPointerEvent, handle: string): void;
}) {
  const def = defFor(entity);
  const box = def.bounds(entity);
  const handles = def.handles(entity);
  return (
    <g className="mse-selection">
      <rect
        x={box.x - 8} y={box.y - 8} width={box.width + 16} height={box.height + 16}
        fill="none" stroke="var(--mse-accent, #E8683A)" strokeWidth="1.5" strokeDasharray="6 5" rx={6}
        pointerEvents="none"
      />
      {(entity.origin === "generated" || entity.reveal !== "none" || entity.untraced) && (
        <text x={box.x - 6} y={box.y - 14} fontSize={13} fill="var(--mse-accent, #E8683A)" fontFamily="var(--mse-canvas-font, monospace)" pointerEvents="none">
          {entity.origin === "generated" ? "generated by a loop — edit the loop in Source"
            : entity.untraced ? "untraced · drawn on later" : "hidden · shown later"}
        </text>
      )}
      {entity.origin !== "generated" && handles.map(({ name, x, y }) => (
        <circle key={name} cx={x} cy={y} r={7} className="mse-handle" onPointerDown={(event) => onHandleDown(event, name)} />
      ))}
    </g>
  );
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
