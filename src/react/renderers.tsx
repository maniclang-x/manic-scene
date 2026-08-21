// SVG renderers per entity kind — the visual half of an entity definition.
// Register one to onboard a new kind; Stage stays generic.

import type { ReactNode } from "react";
import katex from "katex";
import {
  captionWords, counterText, equationBounds, hueToCss, layoutTextLines, resolveColor,
  type ArrowEntity, type CaptionEntity, type CircleEntity, type CounterEntity, type DotEntity, type EquationEntity,
  type LineEntity, type ManicTemplate, type PolygonEntity, type RectEntity, type SceneEntity, type TextEntity,
} from "../index.js";
import type { EntityFrame } from "../timeline.js";

export interface RenderCtx { template: ManicTemplate; }
export type EntityRenderer<E extends SceneEntity = SceneEntity> = (entity: E, frame: EntityFrame, ctx: RenderCtx) => ReactNode;

const renderers = new Map<string, EntityRenderer>();

export function registerRenderer<E extends SceneEntity>(kind: E["kind"], renderer: EntityRenderer<E>): void {
  renderers.set(kind, renderer as EntityRenderer);
}

export function renderEntity(entity: SceneEntity, frame: EntityFrame, ctx: RenderCtx): ReactNode {
  const renderer = renderers.get(entity.kind);
  return renderer ? renderer(entity, frame, ctx) : null;
}

/** Entity paint: hue → HSL (live `to(id,hue,…)` via aux), else palette; flash mixed on top. */
function paintFor(entity: SceneEntity, frame: EntityFrame, ctx: RenderCtx): string {
  const base = entity.hue || frame.aux.hue !== undefined
    ? hueToCss(entity.hue ?? { deg: 0, s: null, l: null }, frame.aux.hue)
    : resolveColor(ctx.template, entity.color);
  if (!frame.flash) return base;
  return mixColors(base, resolveColor(ctx.template, frame.flash.color), frame.flash.amount, ctx);
}

const FONT = "var(--mse-canvas-font, 'JetBrains Mono', 'SF Mono', Menlo, monospace)";
const DISPLAY_FONT = "var(--mse-canvas-display-font, 'Avenir Next', 'Helvetica Neue', sans-serif)";

// --- text ---------------------------------------------------------------

registerRenderer<TextEntity>("text", (entity, frame, ctx) => {
  const paint = paintFor(entity, frame, ctx);
  const anchor = entity.align === "left" ? "start" : entity.align === "right" ? "end" : "middle";
  const lines = entity.vertical
    ? [...entity.text.replaceAll("\n", " ")].map((char) => (char === " " ? "" : char))
    : layoutTextLines(entity);
  const total = lines.reduce((sum, line) => sum + line.length, 0);
  let remaining = Math.round(frame.type * total);
  return (
    <text
      x={entity.x}
      y={entity.y}
      textAnchor={entity.vertical ? "middle" : anchor}
      dominantBaseline="central"
      fontSize={entity.size}
      fill={paint}
      fontWeight={entity.bold || entity.display ? 700 : 400}
      fontFamily={entity.display ? DISPLAY_FONT : FONT}
    >
      {lines.map((line, index) => {
        const take = Math.max(0, Math.min(line.length, remaining));
        remaining -= line.length;
        return (
          <tspan
            key={index}
            x={entity.x}
            dy={index === 0 ? `${-((lines.length - 1) * entity.leading) / 2}em` : `${entity.leading}em`}
          >
            {line.slice(0, take) || " "}
          </tspan>
        );
      })}
    </text>
  );
});

// --- caption: one element per word so karaoke/wordpop can address them ----

registerRenderer<CaptionEntity>("caption", (entity, frame, ctx) => {
  const words = captionWords(entity);
  const glyph = entity.size * 0.62;
  const widths = words.map((word) => word.length * glyph);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, words.length - 1) * glyph;
  let cursor = entity.x - totalWidth / 2;
  const highlight = frame.words?.highlightColor ?? "lime";
  return (
    <g>
      {words.map((word, index) => {
        const center = cursor + widths[index] / 2;
        cursor += widths[index] + glyph;
        const highlighted = frame.words !== null && index <= frame.words.highlightUpTo;
        const pop = frame.words?.pop?.[index] ?? 1;
        const fill = highlighted
          ? resolveColor(ctx.template, highlight)
          : entity.hue
            ? hueToCss(entity.hue)
            : resolveColor(ctx.template, entity.color);
        return (
          <text
            key={index}
            x={center}
            y={entity.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={entity.size}
            fill={frame.flash ? mixColors(fill, resolveColor(ctx.template, frame.flash.color), frame.flash.amount, ctx) : fill}
            fontFamily={FONT}
            opacity={pop}
            transform={pop < 1 ? `translate(${center} ${entity.y}) scale(${0.5 + pop * 0.5}) translate(${-center} ${-entity.y})` : undefined}
          >
            {word}
          </text>
        );
      })}
    </g>
  );
});

// --- equation: KaTeX sketch of what RaTeX will typeset ----------------------

registerRenderer<EquationEntity>("equation", (entity, frame, ctx) => {
  const paint = paintFor(entity, frame, ctx);
  const box = equationBounds(entity);
  let html = "";
  try {
    html = katex.renderToString(entity.latex, { throwOnError: false, displayMode: true });
  } catch {
    html = "";
  }
  return (
    <g>
      {/* hit target for dragging (foreignObject content is pointer-transparent) */}
      <rect x={box.x} y={box.y} width={box.width} height={box.height} fill="transparent" />
      {html ? (
        <foreignObject x={box.x} y={box.y} width={box.width} height={box.height} pointerEvents="none">
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "100%", height: "100%", overflow: "hidden",
              color: paint, fontSize: entity.size * 0.8,
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </foreignObject>
      ) : (
        <text x={entity.x} y={entity.y} textAnchor="middle" dominantBaseline="central" fontSize={entity.size * 0.5} fill={paint} fontFamily={FONT}>
          {entity.latex}
        </text>
      )}
    </g>
  );
});

// --- shapes ---------------------------------------------------------------

function shapeRim(entity: CircleEntity | RectEntity | PolygonEntity, paint: string, ctx: RenderCtx): string {
  return entity.outlineColor ? resolveColor(ctx.template, entity.outlineColor) : paint;
}

/** Static dash pattern (`dashed(id, [dash], [gap])`, engine defaults 16/10). */
function dashPattern(entity: SceneEntity): string | undefined {
  if (!entity.dashed) return undefined;
  return `${entity.dashed.dash ?? 16} ${entity.dashed.gap ?? 10}`;
}

registerRenderer<CircleEntity>("circle", (entity, frame, ctx) => {
  const paint = paintFor(entity, frame, ctx);
  return (
    <circle
      cx={entity.x} cy={entity.y} r={entity.r}
      fill={entity.paint === "outlined" ? "none" : paint}
      fillOpacity={entity.paint === "outlined" ? 0 : (entity.paint === "filled" ? 0.9 : 0.26) * frame.draw}
      stroke={entity.paint === "filled" ? "none" : shapeRim(entity, paint, ctx)}
      strokeWidth={entity.strokeWidth ?? 2.5}
      pathLength={frame.draw < 1 ? 100 : undefined}
      strokeDasharray={frame.draw < 1 ? `${frame.draw * 100} 100` : dashPattern(entity)}
    />
  );
});

registerRenderer<RectEntity>("rect", (entity, frame, ctx) => {
  const paint = paintFor(entity, frame, ctx);
  return (
    <rect
      x={entity.x - entity.width / 2} y={entity.y - entity.height / 2}
      width={entity.width} height={entity.height} rx={3}
      fill={entity.paint === "outlined" ? "none" : paint}
      fillOpacity={entity.paint === "outlined" ? 0 : (entity.paint === "filled" ? 0.9 : 0.26) * frame.draw}
      stroke={entity.paint === "filled" ? "none" : shapeRim(entity, paint, ctx)}
      strokeWidth={entity.strokeWidth ?? 2.5}
      pathLength={frame.draw < 1 ? 100 : undefined}
      strokeDasharray={frame.draw < 1 ? `${frame.draw * 100} 100` : dashPattern(entity)}
    />
  );
});

registerRenderer<PolygonEntity>("polygon", (entity, frame, ctx) => {
  const paint = paintFor(entity, frame, ctx);
  const points = entity.points.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <polygon
      points={points}
      fill={entity.paint === "outlined" ? "none" : paint}
      fillOpacity={entity.paint === "outlined" ? 0 : (entity.paint === "filled" ? 0.9 : 0.26) * frame.draw}
      stroke={entity.paint === "filled" ? "none" : shapeRim(entity, paint, ctx)}
      strokeWidth={entity.strokeWidth ?? 2.5}
      strokeLinejoin="round"
      pathLength={frame.draw < 1 ? 100 : undefined}
      strokeDasharray={frame.draw < 1 ? `${frame.draw * 100} 100` : dashPattern(entity)}
    />
  );
});

registerRenderer<CounterEntity>("counter", (entity, frame, ctx) => (
  <text
    x={entity.x} y={entity.y}
    textAnchor="middle" dominantBaseline="central"
    fontSize={28} fill={paintFor(entity, frame, ctx)} fontFamily={FONT}
  >
    {counterText(entity)}
  </text>
));

registerRenderer<DotEntity>("dot", (entity, frame, ctx) => (
  <circle cx={entity.x} cy={entity.y} r={entity.r} fill={paintFor(entity, frame, ctx)} />
));

// --- strokes ---------------------------------------------------------------

function strokeRenderer(kind: "line" | "arrow"): EntityRenderer<LineEntity | ArrowEntity> {
  return (entity, frame, ctx) => {
    const paint = paintFor(entity, frame, ctx);
    const endX = entity.x1 + (entity.x2 - entity.x1) * frame.draw;
    const endY = entity.y1 + (entity.y2 - entity.y1) * frame.draw;
    const width = entity.strokeWidth ?? 3.5;
    return (
      <g>
        <line x1={entity.x1} y1={entity.y1} x2={endX} y2={endY} stroke={paint} strokeWidth={width} strokeLinecap="round" strokeDasharray={frame.draw < 1 ? undefined : dashPattern(entity)} />
        {kind === "arrow" && frame.draw > 0.02 && (
          <polygon points={arrowHead(entity.x1, entity.y1, endX, endY, Math.max(10, width * 3.2))} fill={paint} />
        )}
        {/* generous invisible hit area */}
        <line x1={entity.x1} y1={entity.y1} x2={entity.x2} y2={entity.y2} stroke="transparent" strokeWidth={Math.max(16, width * 3)} />
      </g>
    );
  };
}

registerRenderer<LineEntity>("line", strokeRenderer("line"));
registerRenderer<ArrowEntity>("arrow", strokeRenderer("arrow"));

function arrowHead(x1: number, y1: number, x2: number, y2: number, length: number): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const spread = 0.44;
  const ax = x2 - length * Math.cos(angle - spread);
  const ay = y2 - length * Math.sin(angle - spread);
  const bx = x2 - length * Math.cos(angle + spread);
  const by = y2 - length * Math.sin(angle + spread);
  return `${x2},${y2} ${ax},${ay} ${bx},${by}`;
}

// --- shared helpers ---------------------------------------------------------

function mixColors(from: string, to: string, amount: number, _ctx: RenderCtx): string {
  const a = hexParts(from);
  const b = hexParts(to);
  if (!a || !b) return amount > 0.5 ? to : from;
  const mix = a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount));
  return `#${mix.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function hexParts(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})/iu.exec(hex);
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
