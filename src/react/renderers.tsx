// SVG renderers per entity kind — the visual half of an entity definition.
// Register one to onboard a new kind; Stage stays generic.

import type { ReactNode } from "react";
import katex from "katex";
import {
  angleMarkGeometry, areaPoints, axisTickGeometry, bandGeometry, boxToPoints, bracePoints, calculusMarkPoints, captionWords, circle2Geometry, commonTangentGeometry, curveDotPoint,
  algoValues, arrayLayout, caretShape, graphGeometry, hashmapLayout, listLayout, pointerPosition,
  arcGeometry, numberLineValues, planeGrid, polarPlaneCounts,
  determinantGeometry, diagonaliseGeometry, eigenGeometry, fmtMatrixValue, identityGrid,
  linearSolveGeometry, mappedGrid, matrixGrid, matrixLayout, projectionGeometry,
  rrefStates, spanGeometry, squishGeometry,
  balanceSides, chemChildStyle, formulaAtoms, circuitChildStyle, circuitGeometry, circuitPartAnchor, circuitScreenPoint, domainColorSamples, gridDesignCells, gridOperationSummary, leastSquaresGeometry, mlLayers, mlOutputShape, mlTensorGrid, mlTokens, opticsGeometry, physicsGeometry, processChildStyle, raceBox, raceChildStyle, racePeriods, raceRows, systemChildStyle, systemConnectionGeometry, systemDiagramFor, systemItemBox, scalarFieldCard, statsGeometry, tableGrid, tableLayout, vectorFieldShape, warpLines,
  booleanGeometry, booleanOperation, dualGeometry, regionsGeometry, spanTreeGeometry,
  coordsAxisValues, counterText, creatorEndcardBox, creatorFooterBox, creatorHasFooter, entityAnchor, entityBounds, equationBounds, imageSize,
  derivedPathPoints, supportGeometry,
  cloud3Samples, cloudSamples, geometryContext, glslUniforms, graphLabelPosition, graphSamples, hueToCss, integralValue, layoutTextLines, limitGeometry, linkGeometry,
  assembly3PartCenter, collection3Points, collectionChild3Point, collectionLinks3Geometry, collectionPath3Points, cross3WorldGeometry, cube3WorldVertices, extrude3WorldVertices, frame3Map, hilbert3Points, hull2Geometry, ifs2Geometry, link3WorldGeometry, linmap3WorldGeometry, lsystem3Geometry, lsystemGeometry, loupeBoxes, mandelbrotGeometry, mathPartBoxes, newtonPoints, normalGeometry, orbitFromPoints, param3Grid, parametricCurvePoints, path3WorldPoints, pieces3Quads, polarPathGeometry, polySolid3WorldGeometry, project3WorldPoint, projectPoint3, randomWalk3Points, revolve3WorldGeometry, slice3WorldPoints, surface3Grid, surfaceDependent3Points, trajectory3WorldPoints, tree3Geometry, vectorField3Segments, curve3ScreenPoints, quizOptionBoxes, quizRegions, repeatGeometry, resolveColor, riemannBars, rootsPoints, sliderX, slopeGeometry, slopeTriangleGeometry, splinePoints, svgSize, sweepGeometry, tangentGeometry, tangentPointGeometry, taylorPoints, trajectoryPoints, verticalLineGeometry, worldAnchor3,
  fullLineGeometry, geoCircleGeometry, geoDerivedPoint, geoIntersectionPoints, hyperbolaBranches, midpointGeometry, parabolaPoints, rightAnglePoints, segmentGeometry, shaderSamples,
  type ArrowEntity, type CaptionEntity, type CircleEntity, type CounterEntity, type DotEntity, type EquationEntity, type ImageEntity,
  type BraceEntity, type BraceLabelEntity, type FrameboxEntity, type InvertPathEntity, type LabelEntity, type LinkEntity, type MathPartsEntity, type ReflectPathEntity, type SupportEntity,
  type BooleanRegionEntity, type DualEntity, type RegionsEntity, type SpanTreeEntity,
  type AreaEntity, type BandEntity, type BoxToEntity, type CalculusMarksEntity, type CurveDotEntity, type DerivedCurveEntity, type GraphLabelEntity, type IntegralEntity, type LimitEntity, type NewtonEntity, type NormalEntity, type ParametricCurveEntity, type RiemannEntity, type RootsEntity, type SlopeTriangleEntity, type SplineEntity, type TaylorEntity, type TrajectoryEntity, type VerticalLineEntity,
  type Cloud3Entity, type CloudEntity, type GlslEntity, type Hull2Entity, type Ifs2Entity, type LineEntity, type LoupeEntity, type LSystemEntity, type MandelbrotEntity, type ManicTemplate, type ParameterEntity, type ParticlesEntity, type PlotEntity, type PolarPathEntity, type PolygonEntity, type RectEntity, type RepeatEntity, type ShaderEntity, type SlidersEntity, type SweepEntity, type TrailEntity,
  type ResolvedManicAsset, type SceneDoc, type SceneEntity, type SlopeEntity, type SvgEntity, type TangentEntity, type TextEntity,
  type Assembly3Entity, type Axes3Entity, type Box3Entity, type Camera3Entity, type Collection3Entity, type CollectionChild3Entity, type CollectionLinks3Entity, type CollectionPath3Entity, type Cross3Entity, type Curve3Entity, type DomainSurface3Entity, type Extrude3Entity, type Frame3Entity, type Grid3Entity, type GridEntity, type Heightmap3Entity, type Hilbert3Entity, type HistoryPlot3Entity, type HistoryPlotEntity, type Implicit3Entity, type Link3Entity, type LSystem3Entity, type MatrixMap3Entity, type Midpoint3Entity, type Model3Entity, type ParamSurface3Entity, type Pieces3Entity, type Point3, type Point3Entity, type PolySolid3Entity, type Project3Entity, type ProjectPath3Entity, type RandomWalk3Entity, type Revolve3Entity, type Slice3Entity, type Sphere3Entity, type Stroke3Entity, type Surface3Entity, type SurfaceDependent3Entity, type Trajectory3Entity, type Tree3Entity, type Tube3Entity, type VectorField3Entity, type WatermarkEntity,
  type CountdownEntity, type CreatorEntity, type FigureEntity, type QuizEntity, type SafezoneEntity, type TimingEntity,
  type AngleMarkEntity, type AxesEntity, type AxisTickEntity, type Circle2Entity, type CoordsEntity,
  type AnnulusEntity, type ArcEntity, type ComplexPlaneEntity, type NumberLineEntity, type PlaneEntity, type PolarPlaneEntity, type SectorEntity,
  type DeterminantEntity, type DiagonaliseEntity, type EigenEntity, type GridMapEntity,
  type LinearMapEntity, type LinearSolveEntity, type MatrixEntity, type ProjectionEntity,
  type RrefEntity, type SpanEntity, type SquishEntity,
  type ColorWheelEntity, type DomainColorEntity, type LeastSquaresEntity, type PieEntity,
  type ChemEntity, type CircuitEntity, type LiveHistogramEntity, type MlEntity, type OpticsEntity, type OpticsPrimitive, type PhysicsEntity, type PhysicsPrimitive, type RaceChartEntity, type SystemClusterEntity, type SystemConnectionEntity, type SystemDiagramEntity, type SystemMessageEntity, type SystemNodeEntity, type ScalarFieldEntity, type StatsEntity, type StatsPrimitive, type TableEntity, type VectorFieldEntity, type WarpEntity,
  type AlgoContainerEntity, type ArrayEntity, type CaretEntity, type GraphEntity, type HashMapEntity, type ListEntity, type PointerEntity, type VirtualChildStyle,
  type CommonTangentEntity, type EllipseEntity, type FullLineEntity, type GeoCircleEntity, type GeoDerivedPointEntity, type GeoIntersectionEntity, type HyperbolaEntity, type MidpointEntity, type ParabolaEntity, type PointEntity, type RightAngleEntity, type SegmentEntity, type VectorEntity,
} from "../index.js";
import type { EntityFrame } from "../timeline.js";

export interface RenderCtx {
  template: ManicTemplate;
  doc: SceneDoc;
  /** Undefined means the host has no asset resolver; a missing map key is loading. */
  assets?: ReadonlyMap<string, ResolvedManicAsset | null>;
}
export type EntityRenderer<E extends SceneEntity = SceneEntity> = (entity: E, frame: EntityFrame, ctx: RenderCtx) => ReactNode;

const renderers = new Map<string, EntityRenderer>();

export function registerRenderer<E extends SceneEntity>(kind: E["kind"], renderer: EntityRenderer<E>): void {
  renderers.set(kind, renderer as EntityRenderer);
}

export function renderEntity(entity: SceneEntity, frame: EntityFrame, ctx: RenderCtx): ReactNode {
  const renderer = renderers.get(entity.kind);
  if (!renderer) return null;
  const content = renderer(entity, frame, ctx);
  const clipping = clippingDef(entity, ctx);
  const box = entityBounds(entity, ctx.doc);
  const textLike = entity.kind === "text" || entity.kind === "label";
  return (
    <g>
      {entity.gradient && <GradientDef entity={entity} ctx={ctx} />}
      {clipping.def}
      <g clipPath={clipping.url}>
        {textLike && entity.plate !== undefined && entity.plate > 0 && (
          <rect x={box.x - 8} y={box.y - 5} width={box.width + 16} height={box.height + 10} rx={7} fill={ctx.doc.template === "paper" ? "#f7f0dd" : ctx.doc.template === "blueprint" ? "#0a2a50" : "#050608"} opacity={entity.plate} />
        )}
        {content}
        {textLike && entity.cursor && (
          <text x={box.x + box.width + 3} y={box.y + box.height / 2} dominantBaseline="central" fontSize={Math.max(12, box.height * 0.65)} fill={paintFor(entity, frame, ctx)} fontFamily={FONT}>_</text>
        )}
      </g>
    </g>
  );
}

/** Entity paint: hue → HSL (live `to(id,hue,…)` via aux), else palette; flash mixed on top. */
function paintFor(entity: SceneEntity, frame: EntityFrame, ctx: RenderCtx): string {
  if (entity.gradient) return `url(#${gradientId(entity)})`;
  const base = entity.hue || frame.aux.hue !== undefined
    ? hueToCss(entity.hue ?? { deg: 0, s: null, l: null }, frame.aux.hue)
    : resolveColor(ctx.template, entity.color);
  if (!frame.flash) return base;
  return mixColors(base, resolveColor(ctx.template, frame.flash.color), frame.flash.amount, ctx);
}

function gradientId(entity: SceneEntity): string {
  return `mse-gradient-${entity.id.replaceAll(/[^A-Za-z0-9_-]/gu, "-")}`;
}

function GradientDef({ entity, ctx }: { entity: SceneEntity; ctx: RenderCtx }) {
  const gradient = entity.gradient!;
  const stops = gradient.stops.map((color, index) => (
    <stop key={`${color}-${index}`} offset={`${gradient.stops.length === 1 ? 0 : index / (gradient.stops.length - 1) * 100}%`} stopColor={resolveColor(ctx.template, color)} />
  ));
  if (gradient.mode === "radial") return <radialGradient id={gradientId(entity)}>{stops}</radialGradient>;
  const degrees = gradient.mode === "linear" ? gradient.angle : 0;
  const radians = degrees * Math.PI / 180;
  const dx = Math.cos(radians) * 0.5, dy = Math.sin(radians) * 0.5;
  return <linearGradient id={gradientId(entity)} x1={0.5 - dx} y1={0.5 - dy} x2={0.5 + dx} y2={0.5 + dy}>{stops}</linearGradient>;
}

function clippingDef(entity: SceneEntity, ctx: RenderCtx): { def: ReactNode; url?: string } {
  const ref = entity.mask ?? entity.clip;
  if (!ref) return { def: null };
  const id = `mse-${entity.mask ? "mask" : "clip"}-${entity.id.replaceAll(/[^A-Za-z0-9_-]/gu, "-")}`;
  const region = ctx.doc.entities.find((candidate) => candidate.id === ref);
  const fallback = geometryContext(ctx.doc).bounds(ref) ?? entityBounds(entity, ctx.doc);
  let shape: ReactNode = <rect x={fallback.x} y={fallback.y} width={fallback.width} height={fallback.height} />;
  if (entity.mask && region?.kind === "circle") shape = <circle cx={region.x} cy={region.y} r={region.r} />;
  if (entity.mask && region?.kind === "rect") shape = <rect x={region.x - region.width / 2} y={region.y - region.height / 2} width={region.width} height={region.height} />;
  if (entity.mask && region?.kind === "polygon") shape = <polygon points={region.points.map((point) => `${point.x},${point.y}`).join(" ")} />;
  if (entity.mask && region?.kind === "sector") shape = <path d={arcGeometry(region.x, region.y, region.r, 0, region.start, region.sweep).path} />;
  if (entity.mask && region?.kind === "annulus") shape = <path d={arcGeometry(region.x, region.y, region.outer, region.inner, 0, 360).path} fillRule="evenodd" />;
  return { def: <clipPath id={id} clipPathUnits="userSpaceOnUse">{shape}</clipPath>, url: `url(#${id})` };
}

const FONT = "var(--mse-canvas-font, 'JetBrains Mono', 'SF Mono', Menlo, monospace)";
const DISPLAY_FONT = "var(--mse-canvas-display-font, 'Avenir Next', 'Helvetica Neue', sans-serif)";

// --- text ---------------------------------------------------------------

registerRenderer<TextEntity>("text", (entity, frame, ctx) => {
  const paint = paintFor(entity, frame, ctx);
  const position = entity.pin3 ? entityAnchor(entity, ctx.doc) : { x: entity.x, y: entity.y };
  const anchor = entity.align === "left" ? "start" : entity.align === "right" ? "end" : "middle";
  const lines = entity.vertical
    ? [...entity.text.replaceAll("\n", " ")].map((char) => (char === " " ? "" : char))
    : layoutTextLines(entity, ctx.doc);
  const total = lines.reduce((sum, line) => sum + line.length, 0);
  let remaining = Math.round(frame.type * total);
  return (
    <text
      x={position.x}
      y={position.y}
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
            x={position.x}
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
  const anchor = entity.pin3 ? entityAnchor(entity, ctx.doc) : { x: entity.x, y: entity.y };
  const view = entity.pin3 ? { ...entity, x: anchor.x, y: anchor.y } : entity;
  const box = equationBounds(view);
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
        <text x={view.x} y={view.y} textAnchor="middle" dominantBaseline="central" fontSize={entity.size * 0.5} fill={paint} fontFamily={FONT}>
          {entity.latex}
        </text>
      )}
    </g>
  );
});

registerRenderer<LabelEntity>("label", (entity, frame, ctx) => {
  const at = entityAnchor(entity, ctx.doc);
  return (
    <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" fontSize={entity.size} fill={paintFor(entity, frame, ctx)} fontWeight={700} fontFamily={FONT}>
      {entity.text}
    </text>
  );
});

registerRenderer<MathPartsEntity>("mathparts", (entity, frame, ctx) => {
  const boxes = mathPartBoxes(entity);
  return (
    <g>
      {entity.parts.map((part, index) => {
        const box = boxes[index];
        let html = "";
        try { html = katex.renderToString(part.latex, { throwOnError: false, displayMode: true }); } catch { html = ""; }
        const fill = part.color ? resolveColor(ctx.template, part.color) : paintFor(entity, frame, ctx);
        return html ? (
          <foreignObject key={index} x={box.x} y={box.y} width={box.width} height={box.height} pointerEvents="none">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", overflow: "hidden", color: fill, fontSize: entity.size * 0.8 }} dangerouslySetInnerHTML={{ __html: html }} />
          </foreignObject>
        ) : (
          <text key={index} x={box.x + box.width / 2} y={entity.y} textAnchor="middle" dominantBaseline="central" fontSize={entity.size * 0.7} fill={fill} fontFamily={FONT}>{part.latex}</text>
        );
      })}
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

function AssetPlaceholder({ x, y, width, height, label, state }: { x: number; y: number; width: number; height: number; label: string; state: "loading" | "missing" | "unavailable" }) {
  const short = label.length > 34 ? `…${label.slice(-33)}` : label;
  return <g className={`mse-asset-placeholder ${state}`} pointerEvents="none">
    <rect x={x} y={y} width={width} height={height} rx={5} />
    {state !== "loading" && <><line x1={x + 8} y1={y + 8} x2={x + width - 8} y2={y + height - 8} /><line x1={x + width - 8} y1={y + 8} x2={x + 8} y2={y + height - 8} /></>}
    <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central">{state === "loading" ? "Loading asset…" : state === "missing" ? "Asset missing" : "Asset resolver unavailable"}</text>
    <text x={x + width / 2} y={y + height - 12} textAnchor="middle">{short}</text>
  </g>;
}

registerRenderer<ImageEntity>("image", (entity, _frame, ctx) => {
  const size = imageSize(entity), x = entity.x - size.width / 2, y = entity.y - size.height / 2;
  const resolved = ctx.assets?.get(entity.path);
  if (resolved) return <image href={resolved.previewUrl} x={x} y={y} width={size.width} height={size.height} preserveAspectRatio="none" />;
  return <AssetPlaceholder x={x} y={y} width={size.width} height={size.height} label={entity.path} state={!ctx.assets ? "unavailable" : ctx.assets.has(entity.path) ? "missing" : "loading"} />;
});

registerRenderer<SvgEntity>("svg", (entity, _frame, ctx) => {
  const size = svgSize(entity), x = entity.x - size / 2, y = entity.y - size / 2;
  const resolved = ctx.assets?.get(entity.path);
  if (resolved) return <image href={resolved.previewUrl} x={x} y={y} width={size} height={size} preserveAspectRatio="xMidYMid meet" />;
  return <AssetPlaceholder x={x} y={y} width={size} height={size} label={entity.path} state={!ctx.assets ? "unavailable" : ctx.assets.has(entity.path) ? "missing" : "loading"} />;
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

registerRenderer<ParameterEntity>("parameter", (entity, frame, ctx) => {
  const paint = paintFor(entity, frame, ctx);
  const left = entity.x - 96, right = entity.x + 96, y = entity.y + 34;
  const range = Math.max(1e-9, entity.max - entity.min);
  const u = Math.max(0, Math.min(1, (entity.value - entity.min) / range));
  const live = left + (right - left) * u;
  const label = entity.label ?? entity.id;
  return (
    <g>
      <text x={entity.x} y={entity.y} textAnchor="middle" dominantBaseline="central" fontSize={27} fill={paint} fontFamily={FONT} fontWeight={700}>
        {label} = {entity.value.toFixed(entity.decimals)}
      </text>
      <line x1={left} y1={y} x2={right} y2={y} stroke={resolveColor(ctx.template, "dim")} strokeWidth={3} opacity={.62} />
      <line x1={left} y1={y} x2={live} y2={y} stroke={resolveColor(ctx.template, "cyan")} strokeWidth={4.5} />
      <circle cx={live} cy={y} r={7} fill={resolveColor(ctx.template, "cyan")} />
    </g>
  );
});

registerRenderer<SafezoneEntity>("safezone", (entity, frame, ctx) => {
  const box = entityBounds(entity, ctx.doc);
  return <rect x={box.x} y={box.y} width={box.width} height={box.height} fill="none" stroke={paintFor(entity, frame, ctx)} strokeWidth={2} opacity={frame.opacity * .35} />;
});

registerRenderer<FigureEntity>("figure", (entity, frame, ctx) => {
  const box = entityBounds(entity, ctx.doc);
  return (
    <g opacity={frame.opacity}>
      <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={12} fill={resolveColor(ctx.template, "panel")} fillOpacity={.14} stroke={resolveColor(ctx.template, "gold")} strokeWidth={2} strokeDasharray="12 8" />
      <text x={box.x + 14} y={box.y + 24} fontFamily={FONT} fontSize={14} fill={resolveColor(ctx.template, "gold")}>FIGURE · fits {entity.target} in Preview</text>
    </g>
  );
});

registerRenderer<CreatorEntity>("creator", (entity, frame, ctx) => {
  const accent = resolveColor(ctx.template, entity.accent ?? "cyan");
  const secondary = resolveColor(ctx.template, entity.secondary ?? "magenta");
  const footer = creatorFooterBox(entity, ctx.doc), end = creatorEndcardBox(entity, ctx.doc);
  const hasFooter = creatorHasFooter(entity);
  const platformCount = entity.platforms.trim() ? entity.platforms.trim().split(/\s+/u).length + (entity.website ? 1 : 0) : entity.website ? 1 : 0;
  if (!hasFooter && !entity.endcard) {
    return <g><rect x={18} y={18} width={220} height={46} rx={8} fill={resolveColor(ctx.template, "panel")} stroke={accent} strokeDasharray="6 5" /><text x={32} y={47} fontFamily={FONT} fontSize={15} fill={accent}>@ PROFILE · {entity.displayName || entity.id}</text></g>;
  }
  return (
    <g opacity={frame.opacity}>
      {hasFooter && <g>
        <line x1={footer.x} y1={footer.y + 4} x2={footer.x + footer.width} y2={footer.y + 4} stroke={resolveColor(ctx.template, "dim")} strokeWidth={1.5} />
        <circle cx={footer.x + 24} cy={footer.y + footer.height * .62} r={12} fill={accent} />
        <text x={footer.x + 44} y={footer.y + footer.height * .64} dominantBaseline="central" fontFamily={FONT} fontSize={Math.max(13, footer.height * .24)} fill={resolveColor(ctx.template, "fg")}>{entity.handle || entity.displayName}</text>
        <text x={footer.x + footer.width - 8} y={footer.y + footer.height * .64} textAnchor="end" dominantBaseline="central" fontFamily={FONT} fontSize={12} fill={resolveColor(ctx.template, "dim")}>{platformCount} social{platformCount === 1 ? "" : "s"}</text>
      </g>}
      {entity.endcard && <g opacity={.72}>
        <rect x={end.x} y={end.y} width={end.width} height={end.height} rx={28} fill={resolveColor(ctx.template, "panel")} stroke={resolveColor(ctx.template, "dim")} strokeWidth={2} strokeDasharray="12 8" />
        <circle cx={end.x + end.width / 2} cy={end.y + end.height * .25} r={Math.min(52, end.height * .1)} fill={accent} />
        <text x={end.x + end.width / 2} y={end.y + end.height * .48} textAnchor="middle" fontFamily={DISPLAY_FONT} fontSize={Math.max(24, Math.min(48, end.width / 11))} fill={resolveColor(ctx.template, "fg")}>{entity.endcard.title ?? entity.displayName}</text>
        <rect x={end.x + end.width * .2} y={end.y + end.height * .63} width={end.width * .6} height={Math.max(50, end.height * .13)} rx={16} fill={resolveColor(ctx.template, "void")} stroke={secondary} />
        <text x={end.x + end.width / 2} y={end.y + end.height * .695} dominantBaseline="central" textAnchor="middle" fontFamily={FONT} fontSize={Math.max(14, Math.min(24, end.width / 24))} fill={resolveColor(ctx.template, "fg")}>{entity.endcard.cta ?? (entity.cta || "FOLLOW FOR MORE")}</text>
        <text x={end.x + 12} y={end.y + 22} fontFamily={FONT} fontSize={12} fill={resolveColor(ctx.template, "dim")}>END CARD · hidden until Show</text>
      </g>}
    </g>
  );
});

function compactLines(text: string, width: number, fontSize: number, maxLines: number): string[] {
  const cap = Math.max(8, Math.floor(width / Math.max(1, fontSize * .58))), words = text.split(/\s+/u);
  const lines: string[] = [];
  for (const word of words) {
    if (lines.length === 0 || `${lines.at(-1)} ${word}`.length > cap) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  }
  if (lines.length > maxLines) {
    const out = lines.slice(0, maxLines);
    out[maxLines - 1] = `${out[maxLines - 1].slice(0, Math.max(1, cap - 1)).trimEnd()}…`;
    return out;
  }
  return lines;
}

registerRenderer<QuizEntity>("quiz", (entity, frame, ctx) => {
  const regions = quizRegions(entity, ctx.doc), cards = quizOptionBoxes(entity, ctx.doc);
  const accent = resolveColor(ctx.template, entity.accent ?? "cyan"), fg = resolveColor(ctx.template, "fg"), panel = resolveColor(ctx.template, "panel"), dim = resolveColor(ctx.template, "dim"), correct = resolveColor(ctx.template, "lime");
  const questionSize = Math.max(18, Math.min(38, regions.header.height * .23)), questionLines = compactLines(entity.question, regions.header.width * .84, questionSize, 4);
  return <g opacity={frame.opacity}>
    <rect x={regions.header.x} y={regions.header.y} width={regions.header.width} height={regions.header.height} rx={18} fill={panel} stroke={accent} strokeWidth={2} />
    <text x={regions.header.x + regions.header.width / 2} y={regions.header.y + regions.header.height / 2 - (questionLines.length - 1) * questionSize * .58} textAnchor="middle" fontFamily={DISPLAY_FONT} fontSize={questionSize} fill={fg}>
      {questionLines.map((line, index) => <tspan key={index} x={regions.header.x + regions.header.width / 2} dy={index ? questionSize * 1.16 : 0}>{line}</tspan>)}
    </text>
    {entity.options.map((option, index) => {
      const box = cards[index]; if (!box) return null;
      const label = entity.labels === "letters" ? String.fromCharCode(65 + index) : entity.labels === "numbers" ? String(index + 1) : "";
      const size = Math.max(14, Math.min(26, box.height * .27)), lines = compactLines(option.text, box.width * .68, size, 2), textX = box.x + (label ? Math.min(64, box.height * .62) : 18);
      return <g key={index}>
        <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={Math.min(18, box.height * .18)} fill={panel} stroke={option.correct ? correct : dim} strokeWidth={option.correct ? 3 : 1.5} strokeDasharray={option.correct ? "7 5" : undefined} />
        {label && <><circle cx={box.x + Math.min(34, box.height * .32)} cy={box.y + box.height / 2} r={Math.min(19, box.height * .22)} fill={option.correct ? correct : accent} /><text x={box.x + Math.min(34, box.height * .32)} y={box.y + box.height / 2} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={Math.max(12, size * .72)} fill={resolveColor(ctx.template, "void")}>{label}</text></>}
        <text x={textX} y={box.y + box.height / 2 - (lines.length - 1) * size * .48} dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={size} fill={fg}>{lines.map((line, lineIndex) => <tspan key={lineIndex} x={textX} dy={lineIndex ? size * 1.08 : 0}>{line}</tspan>)}</text>
      </g>;
    })}
    <rect x={regions.timer.x} y={regions.timer.y} width={regions.timer.width} height={regions.timer.height} rx={regions.timer.height / 2} fill="none" stroke={dim} strokeWidth={2} strokeDasharray="10 7" />
    <text x={regions.timer.x + regions.timer.width / 2} y={regions.timer.y + regions.timer.height / 2} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={Math.max(12, regions.timer.height * .22)} fill={accent}>{entity.timerStyle?.label || `${entity.timerStyle?.look ?? entity.timerLook} · ${entity.timing?.think ?? entity.seconds ?? "pace"}s`}</text>
    <text x={regions.header.x + 8} y={regions.header.y - 10} fontFamily={FONT} fontSize={12} fill={dim}>QUIZ · options visible for authoring · Preview plays reveal</text>
  </g>;
});

function renderTimerGuide(entity: CountdownEntity | TimingEntity, frame: EntityFrame, ctx: RenderCtx): ReactNode {
  const box = entityBounds(entity, ctx.doc), style = entity.timerStyle, accent = resolveColor(ctx.template, style.color ?? "cyan"), dim = resolveColor(ctx.template, style.track ?? "dim"), panel = resolveColor(ctx.template, "panel"), fg = resolveColor(ctx.template, "fg");
  const seconds = entity.kind === "countdown" ? entity.seconds : entity.phases.reduce((sum, phase) => sum + phase.duration, 0);
  const label = style.label || (entity.kind === "countdown" ? "COUNTDOWN" : entity.phases.map((phase) => phase.name).join(" → "));
  return <g opacity={frame.opacity}>
    <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={18} fill={panel} fillOpacity={.75} stroke={dim} strokeWidth={2} strokeDasharray="10 7" />
    {style.look === "ring" || style.look === "ticks" || style.look === "pulse" ? <circle cx={box.x + box.width * .18} cy={box.y + box.height / 2} r={Math.min(box.height * .3, box.width * .1)} fill="none" stroke={accent} strokeWidth={Math.max(3, 7 * style.thickness)} /> : <rect x={box.x + box.width * .08} y={box.y + box.height * .35} width={box.width * .22} height={box.height * .3} rx={9} fill={accent} />}
    <text x={box.x + box.width * .18} y={box.y + box.height / 2} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={Math.max(14, box.height * .22)} fill={fg}>{seconds.toFixed(seconds % 1 ? 1 : 0)}</text>
    <text x={box.x + box.width * .37} y={box.y + box.height * .42} dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={Math.max(14, box.height * .18)} fill={fg}>{label}</text>
    <text x={box.x + box.width * .37} y={box.y + box.height * .68} dominantBaseline="central" fontFamily={FONT} fontSize={Math.max(11, box.height * .12)} fill={dim}>RUN · native timer playback in Preview</text>
  </g>;
}

registerRenderer<CountdownEntity>("countdown", renderTimerGuide);
registerRenderer<TimingEntity>("timing", renderTimerGuide);

registerRenderer<DotEntity>("dot", (entity, frame, ctx) => (
  <circle cx={entity.x} cy={entity.y} r={entity.r} fill={paintFor(entity, frame, ctx)} />
));

// --- Algo kit -------------------------------------------------------------

function algoChildStyle(entity: { childStyles: Record<string, VirtualChildStyle> }, ref: string, group?: string): VirtualChildStyle {
  return entity.childStyles[ref] ?? (group ? entity.childStyles[group] : undefined) ?? {};
}
function algoPaint(style: VirtualChildStyle, fallback: string, ctx: RenderCtx): string { return resolveColor(ctx.template, style.color ?? fallback); }
function algoOpacity(style: VirtualChildStyle): number { return style.opacity ?? (style.reveal ? .34 : 1); }

registerRenderer<ArrayEntity>("array", (entity, _frame, ctx) => {
  const layout = arrayLayout(entity), dim = resolveColor(ctx.template, "dim"), panel = resolveColor(ctx.template, "panel"), fg = resolveColor(ctx.template, "fg");
  return <g>{layout.boxes.map((box, index) => {
    const boxStyle = algoChildStyle(entity, `${entity.id}.box${index}`, `${entity.id}.boxes`), cellStyle = algoChildStyle(entity, `${entity.id}.c${index}`, `${entity.id}.cells`);
    return <g key={index}>
      <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={3} fill={panel} fillOpacity={.08 * algoOpacity(boxStyle)} stroke={boxStyle.color ? algoPaint(boxStyle, "dim", ctx) : dim} strokeWidth={2.5} opacity={algoOpacity(boxStyle)} />
      <text x={box.x + box.width / 2} y={box.y + box.height / 2} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={entity.cellHeight * .42} fill={cellStyle.color ? algoPaint(cellStyle, "fg", ctx) : fg} opacity={algoOpacity(cellStyle)}>{layout.values[index] ?? "?"}</text>
    </g>;
  })}</g>;
});

function CaretMark({ x, y, label, direction, entity, frame, ctx, labelOffset }: { x: number; y: number; label: string | null; direction: CaretEntity["direction"]; entity: CaretEntity | PointerEntity; frame: EntityFrame; ctx: RenderCtx; labelOffset?: { x: number; y: number } }) {
  const geometry = caretShape(direction), offset = labelOffset ?? geometry.labelOffset, paint = paintFor(entity, frame, ctx), labelStyle = algoChildStyle(entity, `${entity.id}.label`);
  return <g><polygon points={geometry.points.map((point) => `${x + point.x},${y + point.y}`).join(" ")} fill={paint} />{label !== null && <text x={x + offset.x} y={y + offset.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={entity.kind === "pointer" ? 24 : 22} fill={algoPaint(labelStyle, "magenta", ctx)} opacity={algoOpacity(labelStyle)}>{label}</text>}</g>;
}
registerRenderer<CaretEntity>("caret", (entity, frame, ctx) => <CaretMark x={entity.x} y={entity.y} label={entity.label} direction={entity.direction} entity={entity} frame={frame} ctx={ctx} />);
registerRenderer<PointerEntity>("pointer", (entity, frame, ctx) => { const at = pointerPosition(entity, geometryContext(ctx.doc)); return <CaretMark x={at.x} y={at.y} label={entity.label} direction="up" entity={entity} frame={frame} ctx={ctx} labelOffset={{ x: 0, y: 34 }} />; });

function ContainerGuide({ entity, ctx }: { entity: AlgoContainerEntity; ctx: RenderCtx }) {
  const dim = resolveColor(ctx.template, "dim"), cyan = resolveColor(ctx.template, "cyan"), fg = resolveColor(ctx.template, "fg"), stack = entity.kind === "stack";
  const slots = Array.from({ length: 4 }, (_unused, index) => ({ x: entity.x + (stack ? 0 : index * entity.cellWidth), y: entity.y - (stack ? index * entity.cellHeight : 0) }));
  return <g opacity={.72}>
    {slots.map((slot, index) => <rect key={index} x={slot.x - entity.cellWidth * .45} y={slot.y - entity.cellHeight * .45} width={entity.cellWidth * .9} height={entity.cellHeight * .9} rx={3} fill="none" stroke={index ? dim : cyan} strokeWidth={index ? 1.5 : 2.5} strokeDasharray={index ? "7 6" : "4 4"} opacity={index ? .38 : .8} />)}
    <text x={entity.x} y={stack ? entity.y + entity.cellHeight * .72 : entity.y - entity.cellHeight * .72} textAnchor={stack ? "middle" : "start"} fontFamily={FONT} fontWeight={700} fontSize={14} fill={fg}>{stack ? "STACK · PUSH / POP ↑" : "QUEUE · DEQUEUE ←  ENQUEUE →"}</text>
    <text x={entity.x} y={stack ? entity.y - entity.cellHeight * 3.75 : entity.y + entity.cellHeight * .82} textAnchor={stack ? "middle" : "start"} fontFamily={FONT} fontSize={12} fill={dim}>Story operations create cells · ▶ Preview executes occupancy</text>
  </g>;
}
registerRenderer<AlgoContainerEntity>("stack", (entity, _frame, ctx) => <ContainerGuide entity={entity} ctx={ctx} />);
registerRenderer<AlgoContainerEntity>("queue", (entity, _frame, ctx) => <ContainerGuide entity={entity} ctx={ctx} />);

registerRenderer<ListEntity>("list", (entity, _frame, ctx) => {
  const layout = listLayout(entity), values = algoValues(entity.source), panel = resolveColor(ctx.template, "panel"), cyan = resolveColor(ctx.template, "cyan"), dim = resolveColor(ctx.template, "dim"), magenta = resolveColor(ctx.template, "magenta"), fg = resolveColor(ctx.template, "fg");
  let arrowIndex = 0;
  const Arrow = ({ x1, y1, x2, y2, group, fallback }: { x1: number; y1: number; x2: number; y2: number; group: string; fallback: string }) => {
    const ref = `${entity.id}.ar${arrowIndex++}`, style = algoChildStyle(entity, ref, `${entity.id}.${group}`), paint = algoPaint(style, fallback, ctx), opacity = algoOpacity(style);
    return <g opacity={opacity}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={paint} strokeWidth={2.5} /><polygon points={arrowHead(x1, y1, x2, y2, 9)} fill={paint} /></g>;
  };
  const nodeLeft = (center: { x: number; y: number }) => center.x - layout.nodeWidth / 2;
  const nodeRight = (center: { x: number; y: number }) => center.x + layout.nodeWidth / 2;
  return <g>
    {layout.centers.slice(0, -1).map((center, index) => { const next = layout.centers[index + 1], lift = entity.listKind === "doubly" ? 9 : 0; return <g key={`ar-${index}`}>
      <Arrow x1={center.x + layout.nextOffset} y1={center.y - lift} x2={nodeLeft(next)} y2={next.y - lift} group="next" fallback="cyan" />
      {layout.prevOffset !== null && <Arrow x1={next.x + layout.prevOffset} y1={next.y + lift} x2={nodeRight(center)} y2={center.y + lift} group="prev" fallback="dim" />}
    </g>; })}
    {entity.listKind === "circular" ? (() => { const first = layout.centers[0], last = layout.centers.at(-1)!, x1 = last.x + layout.nextOffset, y1 = last.y, x2 = nodeLeft(first), y2 = first.y, controlY = y1 + 2.3 * entity.cellHeight + 20, ref = `${entity.id}.ar${arrowIndex++}`, style = algoChildStyle(entity, ref, `${entity.id}.next`), paint = algoPaint(style, "magenta", ctx); return <g opacity={algoOpacity(style)}><path d={`M ${x1} ${y1} Q ${(x1 + x2) / 2} ${controlY} ${x2} ${y2}`} fill="none" stroke={paint} strokeWidth={2.5} /><polygon points={arrowHead((x1 + x2) / 2, controlY, x2, y2, 9)} fill={paint} /></g>; })() : (() => { const last = layout.centers.at(-1)!, nullX = nodeRight(last) + 52, lift = entity.listKind === "doubly" ? 9 : 0; return <><Arrow x1={last.x + layout.nextOffset} y1={last.y - lift} x2={nullX - 18} y2={last.y - lift} group="next" fallback="cyan" />{layout.prevOffset !== null && (() => { const first = layout.centers[0], nullLX = nodeLeft(first) - 52; return <Arrow x1={first.x + layout.prevOffset} y1={first.y + lift} x2={nullLX + 18} y2={first.y + lift} group="prev" fallback="dim" />; })()}</>; })()}
    {(() => { const first = layout.centers[0]; return <Arrow x1={first.x} y1={first.y - entity.cellHeight / 2 - 30} x2={first.x} y2={first.y - entity.cellHeight / 2 - 5} group="head" fallback="magenta" />; })()}
    {layout.centers.map((center, index) => { const nodeRef = `${entity.id}.node${index}`, nodeStyle = algoChildStyle(entity, nodeRef, `${entity.id}.nodes`), valueStyle = algoChildStyle(entity, `${nodeRef}.v`, `${entity.id}.nodes`); return <g key={nodeRef} opacity={algoOpacity(nodeStyle)}>
      <rect x={nodeLeft(center)} y={center.y - entity.cellHeight / 2} width={layout.nodeWidth} height={entity.cellHeight} rx={3} fill={panel} stroke={algoPaint(nodeStyle, "cyan", ctx)} strokeWidth={2.5} />
      {layout.dividers.map((offset, divider) => { const style = algoChildStyle(entity, `${nodeRef}.dv${divider}`, `${entity.id}.nodes`); return <line key={divider} x1={center.x + offset} y1={center.y - entity.cellHeight * .45} x2={center.x + offset} y2={center.y + entity.cellHeight * .45} stroke={algoPaint(style, "dim", ctx)} strokeWidth={2.5} opacity={algoOpacity(style)} />; })}
      <text x={center.x + layout.dataOffset} y={center.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={entity.cellHeight * .42} fill={algoPaint(valueStyle, "fg", ctx)} opacity={algoOpacity(valueStyle)}>{values[index] ?? "?"}</text>
      <circle cx={center.x + layout.nextOffset} cy={center.y} r={4} fill={algoPaint(algoChildStyle(entity, `${nodeRef}.pn`, `${entity.id}.nodes`), "cyan", ctx)} />
      {layout.prevOffset !== null && <circle cx={center.x + layout.prevOffset} cy={center.y} r={4} fill={algoPaint(algoChildStyle(entity, `${nodeRef}.pp`, `${entity.id}.nodes`), "cyan", ctx)} />}
    </g>; })}
    {(() => { const first = layout.centers[0], style = algoChildStyle(entity, `${entity.id}.head`); return <text x={first.x} y={first.y - entity.cellHeight / 2 - 48} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={20} fill={algoPaint(style, "magenta", ctx)} opacity={algoOpacity(style)}>head</text>; })()}
    {entity.listKind !== "circular" && (() => { const last = layout.centers.at(-1)!, style = algoChildStyle(entity, `${entity.id}.null`); return <text x={nodeRight(last) + 52} y={last.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={20} fill={algoPaint(style, "dim", ctx)} opacity={algoOpacity(style)}>NULL</text>; })()}
    {entity.listKind === "doubly" && (() => { const first = layout.centers[0], style = algoChildStyle(entity, `${entity.id}.nullL`); return <text x={nodeLeft(first) - 52} y={first.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={20} fill={algoPaint(style, "dim", ctx)} opacity={algoOpacity(style)}>NULL</text>; })()}
  </g>;
});

registerRenderer<HashMapEntity>("hashmap", (entity, _frame, ctx) => {
  const layout = hashmapLayout(entity, ctx.doc), panel = resolveColor(ctx.template, "panel"), dim = resolveColor(ctx.template, "dim"), cyan = resolveColor(ctx.template, "cyan"), fg = resolveColor(ctx.template, "fg");
  return <g>
    {layout.buckets.map((box, index) => { const boxStyle = algoChildStyle(entity, `${entity.id}.bucket${index}`, `${entity.id}.buckets`), valueStyle = algoChildStyle(entity, `${entity.id}.bucket${index}.v`); return <g key={index} opacity={algoOpacity(boxStyle)}>
      <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={3} fill={panel} stroke={algoPaint(boxStyle, "dim", ctx)} strokeWidth={2.5} />
      <text x={box.x + box.width / 2} y={box.y + box.height / 2} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={entity.cellHeight * .44} fill={algoPaint(valueStyle, "dim", ctx)} opacity={algoOpacity(valueStyle)}>{index}</text>
    </g>; })}
    {layout.entries.map((entry) => { const bucket = layout.buckets[entry.bucket], previous = entry.chainIndex ? layout.entries.find((candidate) => candidate.bucket === entry.bucket && candidate.chainIndex === entry.chainIndex - 1) : null, fromX = previous ? previous.x + entity.entryWidth / 2 : bucket.x + bucket.width, toX = entry.x - entity.entryWidth / 2; return <g key={entry.id} opacity={.66}>
      <line x1={fromX} y1={entry.y} x2={toX} y2={entry.y} stroke={cyan} strokeWidth={2.5} strokeDasharray="7 5" />
      <polygon points={arrowHead(fromX, entry.y, toX, entry.y, 9)} fill={cyan} />
      <rect x={entry.x - entity.entryWidth / 2} y={entry.y - entity.cellHeight / 2} width={entity.entryWidth} height={entity.cellHeight} rx={3} fill={panel} stroke={cyan} strokeWidth={2.5} strokeDasharray="7 5" />
      <text x={entry.x} y={entry.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={entity.cellHeight * .4} fill={fg}>{entry.key}:{entry.value}</text>
    </g>; })}
    {layout.entries.length > 0 && <text x={layout.bounds.x} y={layout.bounds.y - 12} fontFamily={FONT} fontSize={12} fill={dim}>PLANNED PUT ENTRIES · Preview animates creation and live lookup</text>}
  </g>;
});

registerRenderer<GraphEntity>("graph", (entity, _frame, ctx) => {
  const geometry = graphGeometry(entity), panel = resolveColor(ctx.template, "panel"), cyan = resolveColor(ctx.template, "cyan"), dim = resolveColor(ctx.template, "dim"), fg = resolveColor(ctx.template, "fg");
  const positions = new Map(geometry.vertices.map((name, index) => [name, geometry.positions[index]]));
  return <g>
    {geometry.edges.map((edge) => { const from = positions.get(edge.from)!, to = positions.get(edge.to)!, dx = to.x - from.x, dy = to.y - from.y, length = Math.max(1e-6, Math.hypot(dx, dy)), ux = dx / length, uy = dy / length, x1 = from.x + ux * entity.radius, y1 = from.y + uy * entity.radius, x2 = to.x - ux * entity.radius, y2 = to.y - uy * entity.radius, style = algoChildStyle(entity, edge.id, `${entity.id}.edges`), paint = algoPaint(style, "dim", ctx), midX = (from.x + to.x) / 2 - uy * 16, midY = (from.y + to.y) / 2 + ux * 16, weightStyle = algoChildStyle(entity, `${edge.id}.w`); return <g key={edge.id} opacity={algoOpacity(style)}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={paint} strokeWidth={2} />
      {edge.directed && <polygon points={arrowHead(x1, y1, x2, y2, 11)} fill={paint} />}
      {edge.weight !== null && <text x={midX} y={midY} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={20} fill={algoPaint(weightStyle, "cyan", ctx)} opacity={algoOpacity(weightStyle)}>{Number.isInteger(edge.weight) ? edge.weight : edge.weight.toFixed(1)}</text>}
    </g>; })}
    {geometry.vertices.map((name, index) => { const point = geometry.positions[index], nodeRef = `${entity.id}.${name}`, nodeStyle = algoChildStyle(entity, nodeRef, `${entity.id}.nodes`), labelStyle = algoChildStyle(entity, `${nodeRef}.label`); return <g key={name} opacity={algoOpacity(nodeStyle)}>
      <circle cx={point.x} cy={point.y} r={entity.radius} fill={panel} stroke={algoPaint(nodeStyle, "cyan", ctx)} strokeWidth={2.5} />
      <text x={point.x} y={point.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={22} fill={algoPaint(labelStyle, "fg", ctx)} opacity={algoOpacity(labelStyle)}>{name}</text>
    </g>; })}
    {geometry.issue && <text x={entity.x} y={entity.y} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={16} fill={resolveColor(ctx.template, "magenta")}>{geometry.issue}</text>}
  </g>;
});

registerRenderer<FrameboxEntity>("framebox", (entity, frame, ctx) => {
  const box = entityBounds(entity, ctx.doc);
  return <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={3} fill="none" stroke={paintFor(entity, frame, ctx)} strokeWidth={2.5} />;
});

registerRenderer<ParticlesEntity>("particles", (entity, frame, ctx) => (
  <g>{particlePoints(entity, ctx.doc).map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={entity.radius} fill={paintFor(entity, frame, ctx)} />)}</g>
));

registerRenderer<SlidersEntity>("sliders", (entity, frame, ctx) => {
  const paint = paintFor(entity, frame, ctx), top = entity.y - entity.height / 2, bottom = entity.y + entity.height / 2;
  const values = Array.from({ length: Math.max(1, Math.round(entity.count)) }, (_unused, index) => Math.max(-1, Math.min(1, frame.aux[`slider-${index}`] ?? 0)));
  const sum = values.reduce((total, value) => total + value * value, 0);
  return <g>
    {values.map((value, index) => { const x = sliderX(entity, index), y = entity.y - value * entity.height / 2; return <g key={index}>
      <line x1={x} y1={top} x2={x} y2={bottom} stroke={resolveColor(ctx.template, "dim")} strokeWidth={2} />
      <circle cx={x} cy={y} r={9} fill={paint} />
      <text x={x} y={bottom + 22} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={17} fill={resolveColor(ctx.template, "fg")}>x{index + 1}</text>
    </g>; })}
    <text x={entity.x} y={bottom + 54} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={20} fill={resolveColor(ctx.template, "cyan")}>Σx² = {sum.toFixed(2)}</text>
  </g>;
});

registerRenderer<LoupeEntity>("loupe", (entity, frame, ctx) => {
  const { source, panel } = loupeBoxes(entity), framePaint = paintFor(entity, frame, ctx), panelPaint = resolveColor(ctx.template, entity.panelColor);
  return <g>
    <line x1={source.x + source.width} y1={source.y + source.height / 2} x2={panel.x} y2={panel.y + panel.height / 2} stroke={framePaint} strokeWidth={1.5} strokeDasharray="8 7" opacity={.55} />
    <rect x={source.x} y={source.y} width={source.width} height={source.height} fill="none" stroke={framePaint} strokeWidth={2.5} />
    <rect x={panel.x} y={panel.y} width={panel.width} height={panel.height} rx={5} fill={resolveColor(ctx.template, "panel")} fillOpacity={.18} stroke={panelPaint} strokeWidth={3} />
    <path d={`M ${panel.x + 14} ${panel.y + panel.height - 18} L ${panel.x + panel.width * .35} ${panel.y + panel.height * .52} L ${panel.x + panel.width * .58} ${panel.y + panel.height * .67} L ${panel.x + panel.width - 14} ${panel.y + 18}`} fill="none" stroke={framePaint} strokeWidth={2} strokeDasharray="7 6" opacity={.48} />
    <text x={panel.x + 12} y={panel.y + 22} fontFamily={FONT} fontWeight={700} fontSize={13} fill={panelPaint}>LIVE LOUPE · {entity.magnification}× · ▶ PREVIEW</text>
  </g>;
});

registerRenderer<SupportEntity>("support", (entity, frame, ctx) => {
  const geometry = supportGeometry(entity), paint = paintFor(entity, frame, ctx);
  return <g>
    <line x1={geometry.from.x} y1={geometry.from.y} x2={geometry.to.x} y2={geometry.to.y} stroke={paint} strokeWidth={entity.strokeWidth ?? 3} strokeLinecap="round" />
    {geometry.ticks.map((tick, index) => <line key={index} x1={tick.from.x} y1={tick.from.y} x2={tick.to.x} y2={tick.to.y} stroke={paint} strokeWidth={entity.strokeWidth ?? 1.5} strokeLinecap="round" />)}
  </g>;
});

function derivedPathRenderer(entity: InvertPathEntity | ReflectPathEntity, frame: EntityFrame, ctx: RenderCtx) {
  const points = derivedPathPoints(entity, geometryContext(ctx.doc));
  return <polyline
    points={points.map((point) => `${point.x},${point.y}`).join(" ")}
    fill="none" stroke={paintFor(entity, frame, ctx)} strokeWidth={entity.strokeWidth ?? 3}
    strokeLinecap="round" strokeLinejoin="round" pathLength={100}
    strokeDasharray={frame.draw < 1 ? `${Math.max(0, frame.draw) * 100} 100` : dashPattern(entity)}
  />;
}

registerRenderer<InvertPathEntity>("invertpath", derivedPathRenderer);
registerRenderer<ReflectPathEntity>("reflectpath", derivedPathRenderer);

function topologyPath(rings: readonly (readonly { x: number; y: number }[])[]): string {
  return rings.map((ring) => ring.length ? `M ${ring.map((point) => `${point.x} ${point.y}`).join(" L ")} Z` : "").join(" ");
}

function topologyId(entity: SceneEntity, suffix: string): string {
  return `mse-topology-${entity.id.replaceAll(/[^A-Za-z0-9_-]/gu, "-")}-${suffix}`;
}

registerRenderer<BooleanRegionEntity>("boolean", (entity, frame, ctx) => {
  const geometry = booleanGeometry(entity, geometryContext(ctx.doc)), operation = booleanOperation(entity.spelling);
  const a = topologyPath(geometry.a), b = topologyPath(geometry.b), clip = topologyId(entity, "clip-b"), maskA = topologyId(entity, "mask-a"), maskB = topologyId(entity, "mask-b");
  const paint = paintFor(entity, frame, ctx), pad = 4, box = geometry.bounds;
  const fill = entity.paint === "outlined" ? "none" : paint, outline = resolveColor(ctx.template, entity.outlineColor ?? "fg"), stroke = entity.paint === "filled" ? "none" : outline;
  if (geometry.issue) return <g opacity={frame.opacity}><rect x={box.x} y={box.y} width={box.width} height={box.height} fill="none" stroke={paint} strokeWidth={2} strokeDasharray="8 6" /><text x={box.x + box.width / 2} y={box.y + box.height / 2} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={13} fill={paint}>{entity.spelling} · Preview</text></g>;
  const shape = (d: string, props: Record<string, unknown> = {}) => <path d={d} fill={fill} fillRule="evenodd" stroke={stroke} strokeWidth={entity.strokeWidth ?? 2.5} {...props} />;
  return <g opacity={frame.opacity}>
    <defs>
      <clipPath id={clip}><path d={b} fill="white" fillRule="evenodd" /></clipPath>
      <mask id={maskA} maskUnits="userSpaceOnUse" x={box.x - pad} y={box.y - pad} width={box.width + pad * 2} height={box.height + pad * 2}><rect x={box.x - pad} y={box.y - pad} width={box.width + pad * 2} height={box.height + pad * 2} fill="white" /><path d={a} fill="black" fillRule="evenodd" /></mask>
      <mask id={maskB} maskUnits="userSpaceOnUse" x={box.x - pad} y={box.y - pad} width={box.width + pad * 2} height={box.height + pad * 2}><rect x={box.x - pad} y={box.y - pad} width={box.width + pad * 2} height={box.height + pad * 2} fill="white" /><path d={b} fill="black" fillRule="evenodd" /></mask>
    </defs>
    {operation === "union" && <>{shape(a)}{shape(b)}</>}
    {operation === "intersection" && shape(a, { clipPath: `url(#${clip})` })}
    {operation === "difference" && shape(a, { mask: `url(#${maskB})` })}
    {operation === "xor" && <>{shape(a, { mask: `url(#${maskB})` })}{shape(b, { mask: `url(#${maskA})` })}</>}
  </g>;
});

registerRenderer<RegionsEntity>("regions", (entity, frame, ctx) => {
  const geometry = regionsGeometry(entity, geometryContext(ctx.doc));
  const palette = ["cyan", "magenta", "lime", "gold", "violet", "red", "blue", "orange"];
  return <g opacity={frame.opacity}>
    {geometry.faces.map((face, index) => <path key={index} d={topologyPath([face])} fill={resolveColor(ctx.template, entity.color === "rainbow" ? palette[index % palette.length] : entity.color)} fillOpacity={.5} stroke="none" />)}
    {geometry.issue && <text x={geometry.bounds.x + geometry.bounds.width / 2} y={geometry.bounds.y + 18} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={resolveColor(ctx.template, "gold")}>REGIONS · bounded Canvas guide</text>}
  </g>;
});

registerRenderer<SpanTreeEntity>("spantree", (entity, frame, ctx) => {
  const geometry = spanTreeGeometry(entity, geometryContext(ctx.doc)), tree = paintFor(entity, frame, ctx), cotree = resolveColor(ctx.template, "orange"), width = entity.strokeWidth ?? 5;
  return <g opacity={frame.opacity}>
    {geometry.tree.map((edge, index) => <line key={`t${index}`} x1={edge.from.x} y1={edge.from.y} x2={edge.to.x} y2={edge.to.y} stroke={tree} strokeWidth={width} strokeLinecap="round" />)}
    <g opacity={entity.cotreeReveal === "none" ? 1 : .22}>{geometry.cotree.map((edge, index) => <line key={`c${index}`} x1={edge.from.x} y1={edge.from.y} x2={edge.to.x} y2={edge.to.y} stroke={cotree} strokeWidth={5} strokeLinecap="round" strokeDasharray={entity.cotreeUntraced ? "8 6" : undefined} />)}</g>
  </g>;
});

registerRenderer<DualEntity>("dual", (entity, frame, ctx) => {
  const geometry = dualGeometry(entity, geometryContext(ctx.doc)), edgeColor = paintFor(entity, frame, ctx), nodeColor = resolveColor(ctx.template, "violet");
  return <g opacity={frame.opacity}>
    {geometry.edges.map((edge, index) => <line key={`e${index}`} x1={edge.from.x} y1={edge.from.y} x2={edge.to.x} y2={edge.to.y} stroke={edgeColor} strokeWidth={entity.strokeWidth ?? 3} strokeLinecap="round" />)}
    <g opacity={entity.nodesReveal === "none" ? 1 : .22}>{geometry.nodes.map((node, index) => <circle key={`n${index}`} cx={node.x} cy={node.y} r={6} fill={nodeColor} stroke={nodeColor} strokeWidth={1.5} />)}</g>
  </g>;
});

// --- coordinates and live Euclidean geometry ------------------------------

function partialDash(frame: EntityFrame, entity: SceneEntity): string | undefined {
  return frame.draw < 1 ? `${Math.max(0, frame.draw) * 100} 100` : dashPattern(entity);
}

registerRenderer<AxesEntity>("axes", (entity, frame, ctx) => {
  const paint = paintFor(entity, frame, ctx), dash = partialDash(frame, entity);
  const ticks = entity.unit !== null && entity.unit > 1;
  const xCount = ticks ? Math.min(120, Math.floor(entity.halfw / entity.unit!)) : 0;
  const yCount = ticks ? Math.min(120, Math.floor(entity.halfh / entity.unit!)) : 0;
  return (
    <g>
      <line x1={entity.x - entity.halfw} y1={entity.y} x2={entity.x + entity.halfw} y2={entity.y} stroke={paint} strokeWidth={2} pathLength={100} strokeDasharray={dash} />
      <polygon points={arrowHead(entity.x - entity.halfw, entity.y, entity.x + entity.halfw, entity.y, 11)} fill={paint} />
      <line x1={entity.x} y1={entity.y + entity.halfh} x2={entity.x} y2={entity.y - entity.halfh} stroke={paint} strokeWidth={2} pathLength={100} strokeDasharray={dash} />
      <polygon points={arrowHead(entity.x, entity.y + entity.halfh, entity.x, entity.y - entity.halfh, 11)} fill={paint} />
      {Array.from({ length: xCount * 2 }, (_unused, index) => index < xCount ? index - xCount : index - xCount + 1).map((value) => {
        const x = entity.x + value * entity.unit!;
        return <g key={`x${value}`}><line x1={x} y1={entity.y - 6} x2={x} y2={entity.y + 6} stroke={paint} strokeWidth={2} /><text x={x} y={entity.y + 24} textAnchor="middle" dominantBaseline="central" fontSize={15} fill={paint} fontFamily={FONT}>{value}</text></g>;
      })}
      {Array.from({ length: yCount * 2 }, (_unused, index) => index < yCount ? index - yCount : index - yCount + 1).map((value) => {
        const y = entity.y - value * entity.unit!;
        return <g key={`y${value}`}><line x1={entity.x - 6} y1={y} x2={entity.x + 6} y2={y} stroke={paint} strokeWidth={2} /><text x={entity.x - 26} y={y} textAnchor="middle" dominantBaseline="central" fontSize={15} fill={paint} fontFamily={FONT}>{value}</text></g>;
      })}
    </g>
  );
});

function cartesianPlaneRenderer(entity: PlaneEntity | ComplexPlaneEntity, frame: EntityFrame, ctx: RenderCtx) {
  const grid = planeGrid(entity), override = entity.nativePaint ? null : paintFor(entity, frame, ctx);
  const gridPaint = override ?? resolveColor(ctx.template, "dim"), axisPaint = override ?? resolveColor(ctx.template, "fg");
  const labelPaint = override ?? resolveColor(ctx.template, "cyan"), dash = partialDash(frame, entity);
  return <g>
    <g opacity={.35}>
      {grid.vertical.map(({ offset, x }) => <line key={`v${offset}`} x1={x} y1={entity.y - entity.halfh} x2={x} y2={entity.y + entity.halfh} stroke={gridPaint} strokeWidth={1} />)}
      {grid.horizontal.map(({ offset, y }) => <line key={`h${offset}`} x1={entity.x - entity.halfw} y1={y} x2={entity.x + entity.halfw} y2={y} stroke={gridPaint} strokeWidth={1} />)}
    </g>
    <line x1={entity.x - entity.halfw} y1={entity.y} x2={entity.x + entity.halfw} y2={entity.y} stroke={axisPaint} strokeWidth={2} pathLength={100} strokeDasharray={dash} />
    <polygon points={arrowHead(entity.x - entity.halfw, entity.y, entity.x + entity.halfw, entity.y, 11)} fill={axisPaint} />
    <line x1={entity.x} y1={entity.y + entity.halfh} x2={entity.x} y2={entity.y - entity.halfh} stroke={axisPaint} strokeWidth={2} pathLength={100} strokeDasharray={dash} />
    <polygon points={arrowHead(entity.x, entity.y + entity.halfh, entity.x, entity.y - entity.halfh, 11)} fill={axisPaint} />
    {entity.kind === "complexplane" && <>
      <text x={entity.x + entity.halfw - 16} y={entity.y - 20} textAnchor="middle" dominantBaseline="central" fontSize={20} fill={labelPaint} fontFamily={FONT}>Re</text>
      <text x={entity.x + 22} y={entity.y - entity.halfh + 14} textAnchor="middle" dominantBaseline="central" fontSize={20} fill={labelPaint} fontFamily={FONT}>Im</text>
    </>}
  </g>;
}

registerRenderer<PlaneEntity>("plane", cartesianPlaneRenderer);
registerRenderer<ComplexPlaneEntity>("complexplane", cartesianPlaneRenderer);

registerRenderer<PolarPlaneEntity>("polarplane", (entity, frame, ctx) => {
  const paint = entity.nativePaint ? resolveColor(ctx.template, "dim") : paintFor(entity, frame, ctx), counts = polarPlaneCounts(entity), radius = Math.abs(entity.radius);
  return <g opacity={.4}>
    {Array.from({ length: counts.rings }, (_unused, index) => <circle key={`r${index}`} cx={entity.x} cy={entity.y} r={radius * (index + 1) / counts.rings} fill="none" stroke={paint} strokeWidth={1} pathLength={100} strokeDasharray={partialDash(frame, entity)} />)}
    {Array.from({ length: counts.spokes }, (_unused, index) => { const angle = Math.PI * 2 * index / counts.spokes; return <line key={`s${index}`} x1={entity.x} y1={entity.y} x2={entity.x + Math.cos(angle) * radius} y2={entity.y + Math.sin(angle) * radius} stroke={paint} strokeWidth={1} />; })}
  </g>;
});

registerRenderer<NumberLineEntity>("numberline", (entity, frame, ctx) => {
  const override = entity.nativePaint ? null : paintFor(entity, frame, ctx), axisPaint = override ?? resolveColor(ctx.template, "dim"), labelPaint = override ?? resolveColor(ctx.template, "fg"), values = numberLineValues(entity), span = entity.to - entity.from;
  return <g>
    <line x1={entity.x - entity.halfw} y1={entity.y} x2={entity.x + entity.halfw} y2={entity.y} stroke={axisPaint} strokeWidth={2} pathLength={100} strokeDasharray={partialDash(frame, entity)} />
    <polygon points={arrowHead(entity.x - entity.halfw, entity.y, entity.x + entity.halfw, entity.y, 11)} fill={axisPaint} />
    {values.map((value, index) => { const x = entity.x - entity.halfw + (value - entity.from) / span * entity.halfw * 2; return <g key={index}><line x1={x} y1={entity.y - 8} x2={x} y2={entity.y + 8} stroke={axisPaint} strokeWidth={2} /><text x={x} y={entity.y + 30} textAnchor="middle" dominantBaseline="central" fontSize={18} fill={labelPaint} fontFamily={FONT}>{formatAxisValue(value)}</text></g>; })}
  </g>;
});

registerRenderer<ArcEntity>("arc", (entity, frame, ctx) => {
  const geometry = arcGeometry(entity.x, entity.y, entity.r, 0, entity.start, entity.sweep);
  const paint = paintFor(entity, frame, ctx), stroke = entity.gradient || entity.hue ? paint : entity.outlineColor ? resolveColor(ctx.template, entity.outlineColor) : resolveColor(ctx.template, "cyan");
  return <polyline points={geometry.outer.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={stroke} strokeWidth={entity.strokeWidth ?? 3} strokeLinejoin="round" strokeLinecap="round" pathLength={100} strokeDasharray={partialDash(frame, entity)} />;
});

function regionRenderer(entity: SectorEntity | AnnulusEntity, frame: EntityFrame, ctx: RenderCtx) {
  const inner = entity.kind === "annulus" ? entity.inner : 0, outer = entity.kind === "annulus" ? entity.outer : entity.r;
  const start = entity.kind === "annulus" ? 0 : entity.start, sweep = entity.kind === "annulus" ? 360 : entity.sweep;
  const geometry = arcGeometry(entity.x, entity.y, outer, inner, start, sweep), paint = paintFor(entity, frame, ctx);
  const fill = entity.gradient ? paint : entity.nativePaint ? resolveColor(ctx.template, "panel") : paint;
  const rim = entity.hue ? paint : entity.outlineColor ? resolveColor(ctx.template, entity.outlineColor) : resolveColor(ctx.template, "cyan");
  const fillOpacity = entity.paint === "outlined" ? 0 : (entity.paint === "filled" ? .9 : 1) * frame.draw;
  const stroke = entity.paint === "filled" ? "none" : rim, strokeWidth = entity.strokeWidth ?? 2.5, dash = frame.draw < 1 ? `${frame.draw * 100} 100` : dashPattern(entity);
  if (entity.kind === "annulus") return <g>
    <path d={geometry.path} fill={entity.paint === "outlined" ? "none" : fill} fillOpacity={fillOpacity} fillRule="evenodd" stroke="none" />
    {entity.paint !== "filled" && <><circle cx={entity.x} cy={entity.y} r={Math.abs(entity.outer)} fill="none" stroke={stroke} strokeWidth={strokeWidth} pathLength={100} strokeDasharray={dash} /><circle cx={entity.x} cy={entity.y} r={Math.abs(entity.inner)} fill="none" stroke={stroke} strokeWidth={strokeWidth} pathLength={100} strokeDasharray={dash} /></>}
  </g>;
  if (geometry.full) return <circle cx={entity.x} cy={entity.y} r={Math.abs(entity.r)} fill={entity.paint === "outlined" ? "none" : fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth} pathLength={100} strokeDasharray={dash} />;
  return <path d={geometry.path} fill={entity.paint === "outlined" ? "none" : fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" pathLength={100} strokeDasharray={dash} />;
}

registerRenderer<SectorEntity>("sector", regionRenderer);
registerRenderer<AnnulusEntity>("annulus", regionRenderer);

// --- linear algebra -------------------------------------------------------

function nativeOr(entity: SceneEntity, native: string, frame: EntityFrame, ctx: RenderCtx): string {
  return entity.nativePaint ? resolveColor(ctx.template, native) : paintFor(entity, frame, ctx);
}

function algebraArrow(from: { x: number; y: number }, to: { x: number; y: number }, color: string, width = 4) {
  return <g><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={width} strokeLinecap="round" /><polygon points={arrowHead(from.x, from.y, to.x, to.y, Math.max(10, width * 3.2))} fill={color} /></g>;
}

function matrixBrackets(layout: ReturnType<typeof matrixLayout>, color: string) {
  return <>
    <polyline points={`${layout.left + layout.serif},${layout.top} ${layout.left},${layout.top} ${layout.left},${layout.bottom} ${layout.left + layout.serif},${layout.bottom}`} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
    <polyline points={`${layout.right - layout.serif},${layout.top} ${layout.right},${layout.top} ${layout.right},${layout.bottom} ${layout.right - layout.serif},${layout.bottom}`} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
  </>;
}

registerRenderer<MatrixEntity>("matrix", (entity, frame, ctx) => {
  const grid = matrixGrid(entity.source); if (grid.issue) return null;
  const layout = matrixLayout(entity, grid.rows.length, grid.rows[0].length), entries = nativeOr(entity, "fg", frame, ctx), brackets = nativeOr(entity, "cyan", frame, ctx);
  return <g>{matrixBrackets(layout, brackets)}{grid.rows.flatMap((row, i) => row.map((value, j) => <text key={`${i}-${j}`} x={layout.x0 + j * layout.cellWidth} y={layout.y0 + i * layout.cellHeight} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={30} fill={entries}>{value}</text>))}</g>;
});

registerRenderer<LinearMapEntity>("linmap", (entity, frame, ctx) => {
  const identity = identityGrid(entity), mapped = mappedGrid(entity), uniform = entity.nativePaint ? null : paintFor(entity, frame, ctx), origin = { x: entity.x, y: entity.y };
  const gridPaint = uniform ?? resolveColor(ctx.template, "cyan"), dim = uniform ?? resolveColor(ctx.template, "dim"), i = uniform ?? resolveColor(ctx.template, "gold"), j = uniform ?? resolveColor(ctx.template, "magenta");
  const iEnd = { x: entity.x + entity.a * entity.unit, y: entity.y - entity.c * entity.unit }, jEnd = { x: entity.x + entity.b * entity.unit, y: entity.y - entity.d * entity.unit };
  return <g><g opacity={.2}>{identity.map((line,index)=><line key={index} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} stroke={dim} strokeWidth={1}/>)}</g><g opacity={.85}>{mapped.map((line,index)=><line key={index} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} stroke={gridPaint} strokeWidth={1.5}/>)}</g>{algebraArrow(origin,iEnd,i)}{algebraArrow(origin,jEnd,j)}<text x={iEnd.x+14} y={iEnd.y-12} fontFamily={FONT} fontWeight={700} fontSize={22} fill={i}>i</text><text x={jEnd.x+14} y={jEnd.y-12} fontFamily={FONT} fontWeight={700} fontSize={22} fill={j}>j</text></g>;
});

registerRenderer<GridMapEntity>("gridmap", (entity, frame, ctx) => {
  const background = identityGrid(entity), from = mappedGrid(entity, true), target = mappedGrid(entity), uniform = entity.nativePaint ? null : paintFor(entity, frame, ctx), dim = resolveColor(ctx.template,"dim"), grid = uniform ?? resolveColor(ctx.template,"cyan"), origin={x:entity.x,y:entity.y};
  const iEnd={x:entity.x+entity.a*entity.unit,y:entity.y-entity.c*entity.unit},jEnd={x:entity.x+entity.b*entity.unit,y:entity.y-entity.d*entity.unit};
  return <g><g opacity={.22}>{background.map((line,index)=><line key={index} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} stroke={dim} strokeWidth={1}/>)}</g><g opacity={.28}>{from.map((line,index)=><line key={index} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} stroke={grid} strokeWidth={1.2} strokeDasharray="5 5"/>)}</g><g opacity={.88}>{target.map((line,index)=><line key={index} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} stroke={grid} strokeWidth={1.6}/>)}</g>{algebraArrow(origin,iEnd,uniform??resolveColor(ctx.template,"lime"))}{algebraArrow(origin,jEnd,uniform??resolveColor(ctx.template,"red"))}</g>;
});

registerRenderer<DeterminantEntity>("determinant", (entity, frame, ctx) => {
  const geometry=determinantGeometry(entity), primary=entity.nativePaint?resolveColor(ctx.template,entity.constructorColor??(geometry.det<0?"magenta":"lime")):paintFor(entity,frame,ctx),unit=nativeOr(entity,"dim",frame,ctx);
  return <g><polygon points={geometry.unit.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={unit} strokeWidth={2} opacity={.35}/><polygon points={geometry.image.map(p=>`${p.x},${p.y}`).join(" ")} fill={primary} fillOpacity={.45} stroke={primary} strokeWidth={2}/><text x={geometry.label.x} y={geometry.label.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={24} fill={primary}>det = {geometry.det.toFixed(2)}</text></g>;
});

registerRenderer<EigenEntity>("eigen", (entity, frame, ctx) => {
  const geometry=eigenGeometry(entity), color=entity.nativePaint?resolveColor(ctx.template,entity.color):paintFor(entity,frame,ctx);
  if(!geometry.length)return <text x={entity.x} y={entity.y+entity.unit*2.6} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={20} fill={nativeOr(entity,"dim",frame,ctx)}>complex eigenvalues (a rotation)</text>;
  return <g>{geometry.map((line,index)=><g key={index}><line x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} stroke={color} strokeWidth={3}/><text x={line.label.x} y={line.label.y-14} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={20} fill={color}>lambda = {line.value.toFixed(2)}</text></g>)}</g>;
});

registerRenderer<DiagonaliseEntity>("diagonalise", (entity, frame, ctx) => {
  const geometry=diagonaliseGeometry(entity), uniform=entity.nativePaint?null:paintFor(entity,frame,ctx);
  if(geometry.pairs.length<2)return <text x={entity.x} y={entity.y+entity.unit*2.6} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={20} fill={uniform??resolveColor(ctx.template,"dim")}>no real eigenbasis (complex or repeated eigenvalues)</text>;
  const dim=uniform??resolveColor(ctx.template,"dim"),primary=uniform??resolveColor(ctx.template,entity.color),gold=uniform??resolveColor(ctx.template,"gold"),magenta=uniform??resolveColor(ctx.template,"magenta"),origin={x:entity.x,y:entity.y};
  const end1={x:entity.x+geometry.pairs[0].value*geometry.pairs[0].vector.x*entity.unit,y:entity.y-geometry.pairs[0].value*geometry.pairs[0].vector.y*entity.unit},end2={x:entity.x+geometry.pairs[1].value*geometry.pairs[1].vector.x*entity.unit,y:entity.y-geometry.pairs[1].value*geometry.pairs[1].vector.y*entity.unit};
  return <g><g opacity={.2}>{geometry.grid.map((line,index)=><line key={index} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} stroke={dim} strokeWidth={1}/>)}</g><line x1={geometry.axes[0].from.x} y1={geometry.axes[0].from.y} x2={geometry.axes[0].to.x} y2={geometry.axes[0].to.y} stroke={gold} strokeWidth={2} opacity={.8}/><line x1={geometry.axes[1].from.x} y1={geometry.axes[1].from.y} x2={geometry.axes[1].to.x} y2={geometry.axes[1].to.y} stroke={magenta} strokeWidth={2} opacity={.8}/><polygon points={geometry.cell.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={dim} strokeWidth={2} opacity={.5}/><polygon points={geometry.image.map(p=>`${p.x},${p.y}`).join(" ")} fill={primary} fillOpacity={.4} stroke={primary} strokeWidth={2}/>{algebraArrow(origin,end1,gold)}{algebraArrow(origin,end2,magenta)}<text x={end1.x+10} y={end1.y-12} fontFamily={FONT} fontSize={20} fontWeight={700} fill={gold}>lambda = {geometry.pairs[0].value.toFixed(2)}</text><text x={end2.x+10} y={end2.y-12} fontFamily={FONT} fontSize={20} fontWeight={700} fill={magenta}>lambda = {geometry.pairs[1].value.toFixed(2)}</text></g>;
});

registerRenderer<LinearSolveEntity>("linsolve", (entity, frame, ctx) => {
  const geometry=linearSolveGeometry(entity),uniform=entity.nativePaint?null:paintFor(entity,frame,ctx),cyan=uniform??resolveColor(ctx.template,"cyan"),magenta=uniform??resolveColor(ctx.template,"magenta"),gold=uniform??resolveColor(ctx.template,"gold");
  return <g>{geometry.first&&<line x1={geometry.first.from.x} y1={geometry.first.from.y} x2={geometry.first.to.x} y2={geometry.first.to.y} stroke={cyan} strokeWidth={3}/>} {geometry.second&&<line x1={geometry.second.from.x} y1={geometry.second.from.y} x2={geometry.second.to.x} y2={geometry.second.to.y} stroke={magenta} strokeWidth={3}/>} {geometry.solution&&geometry.screenSolution?<><circle cx={geometry.screenSolution.x} cy={geometry.screenSolution.y} r={8} fill={gold}/><text x={geometry.screenSolution.x+18} y={geometry.screenSolution.y-18} fontFamily={FONT} fontSize={22} fontWeight={700} fill={gold}>({geometry.solution.x.toFixed(2)}, {geometry.solution.y.toFixed(2)})</text></>:<text x={entity.x} y={entity.y+entity.unit*2.6} textAnchor="middle" fontFamily={FONT} fontSize={20} fill={uniform??resolveColor(ctx.template,"dim")}>no unique solution (parallel lines)</text>}</g>;
});

registerRenderer<SpanEntity>("span", (entity, frame, ctx) => {
  const geometry=spanGeometry(entity),uniform=entity.nativePaint?null:paintFor(entity,frame,ctx),primary=uniform??resolveColor(ctx.template,entity.color),magenta=uniform??resolveColor(ctx.template,"magenta"),dim=uniform??resolveColor(ctx.template,"dim"),cyan=uniform??resolveColor(ctx.template,"cyan");
  return <g>{geometry.independent?<polygon points={geometry.plane.map(p=>`${p.x},${p.y}`).join(" ")} fill={cyan} fillOpacity={.14}/>:<line x1={geometry.line.from.x} y1={geometry.line.from.y} x2={geometry.line.to.x} y2={geometry.line.to.y} stroke={dim} strokeWidth={2} opacity={.85}/>} {algebraArrow(geometry.origin,geometry.v,primary)} {entity.twoVectors&&algebraArrow(geometry.origin,geometry.w,magenta)}</g>;
});

registerRenderer<ProjectionEntity>("project", (entity, frame, ctx) => {
  const geometry=projectionGeometry(entity);if(!geometry)return <text x={entity.x} y={entity.y} textAnchor="middle" fontFamily={FONT} fontSize={18} fill={resolveColor(ctx.template,"gold")}>Subspace vector cannot be zero</text>;
  const uniform=entity.nativePaint?null:paintFor(entity,frame,ctx),primary=uniform??resolveColor(ctx.template,entity.color),gold=uniform??resolveColor(ctx.template,"gold"),magenta=uniform??resolveColor(ctx.template,"magenta"),dim=uniform??resolveColor(ctx.template,"dim");
  return <g><line x1={geometry.line.from.x} y1={geometry.line.from.y} x2={geometry.line.to.x} y2={geometry.line.to.y} stroke={dim} strokeWidth={2} opacity={.7}/>{algebraArrow(geometry.origin,geometry.b,primary)}{algebraArrow(geometry.origin,geometry.projection,gold)}<line x1={geometry.projection.x} y1={geometry.projection.y} x2={geometry.b.x} y2={geometry.b.y} stroke={magenta} strokeWidth={2.5}/><polyline points={geometry.rightAngle.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={dim} strokeWidth={2}/><text x={geometry.b.x+12} y={geometry.b.y-12} fontFamily={FONT} fontSize={22} fontWeight={700} fill={primary}>b</text><text x={geometry.projection.x+12} y={geometry.projection.y-12} fontFamily={FONT} fontSize={22} fontWeight={700} fill={gold}>proj</text></g>;
});

registerRenderer<RrefEntity>("rref", (entity, frame, ctx) => {
  const result=rrefStates(entity.source);if(result.issue||!result.states.length)return null;const rows=result.states.at(-1)!.rows,layout=matrixLayout(entity,rows.length,rows[0].length),entries=nativeOr(entity,"fg",frame,ctx),brackets=nativeOr(entity,"cyan",frame,ctx),operation=nativeOr(entity,"gold",frame,ctx);
  return <g>{matrixBrackets(layout,brackets)}{rows.flatMap((row,i)=>row.map((value,j)=><text key={`${i}-${j}`} x={layout.x0+j*layout.cellWidth} y={layout.y0+i*layout.cellHeight} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={30} fill={entries}>{fmtMatrixValue(value)}</text>))}<text x={entity.x} y={layout.y0+layout.totalHeight+layout.cellHeight*.95} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={20} fill={operation}>RREF · {result.states.length} states</text></g>;
});

registerRenderer<SquishEntity>("squish", (entity, frame, ctx) => {
  const geometry=squishGeometry(entity),uniform=entity.nativePaint?null:paintFor(entity,frame,ctx),cyan=uniform??resolveColor(ctx.template,"cyan"),fg=resolveColor(ctx.template,"fg"),lime=uniform??resolveColor(ctx.template,"lime"),red=uniform??resolveColor(ctx.template,"red"),gold=resolveColor(ctx.template,"gold");
  return <g><g opacity={.22}>{geometry.identity.map((line,index)=><line key={index} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} stroke={cyan} strokeWidth={1}/>)}</g><g opacity={.85}>{geometry.collapsed.map((line,index)=><line key={index} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} stroke={cyan} strokeWidth={1.5}/>)}</g><line x1={geometry.axis.from.x} y1={geometry.axis.from.y} x2={geometry.axis.to.x} y2={geometry.axis.to.y} stroke={fg} strokeWidth={2}/>{algebraArrow(geometry.origin,geometry.i,lime)}{algebraArrow(geometry.origin,geometry.j,red)}{algebraArrow(geometry.origin,geometry.dual,gold)}</g>;
});

// --- fields, complex visualization, tables, and statistics ----------------

registerRenderer<ScalarFieldEntity>("scalarfield", (entity, _frame, ctx) => {
  const card=scalarFieldCard(entity,geometryContext(ctx.doc)),cyan=resolveColor(ctx.template,"cyan"),panel=resolveColor(ctx.template,"panel"),fg=resolveColor(ctx.template,"fg"),formula=entity.formula.length>33?`${entity.formula.slice(0,32)}…`:entity.formula;
  return <g><rect x={card.x} y={card.y} width={card.width} height={card.height} rx={8} fill={panel} fillOpacity={.45} stroke={cyan} strokeWidth={1.5} strokeDasharray="6 4"/><text x={card.x+12} y={card.y+17} fontFamily={FONT} fontSize={11} fontWeight={700} fill={cyan}>ƒ DECLARATION · {entity.id}(x, y)</text><text x={card.x+12} y={card.y+35} fontFamily={FONT} fontSize={12} fill={fg}>{formula}</text></g>;
});

function fieldPaint(t:number):string { const hue=t<.5?180-60*t*2:120+180*(t-.5)*2; return `hsl(${hue} 90% 56%)`; }
registerRenderer<VectorFieldEntity>("vectorfield", (entity, frame, ctx) => {
  const result=vectorFieldShape(entity),uniform=entity.nativePaint?null:paintFor(entity,frame,ctx),dim=resolveColor(ctx.template,"dim");
  if(result.issue)return <g><rect x={entity.x-entity.halfWidth} y={entity.y-entity.halfHeight} width={entity.halfWidth*2} height={entity.halfHeight*2} fill="none" stroke={dim} strokeDasharray="8 6"/><text x={entity.x} y={entity.y} textAnchor="middle" fontFamily={FONT} fontSize={16} fill={dim}>{result.issue}</text></g>;
  return <g><rect x={entity.x-entity.halfWidth} y={entity.y-entity.halfHeight} width={entity.halfWidth*2} height={entity.halfHeight*2} fill="none" stroke={dim} strokeWidth={1} strokeDasharray="5 7" opacity={.35}/>{result.arrows.map(arrow=>{const color=uniform??fieldPaint(arrow.normalizedMagnitude);return <g key={arrow.id}><line x1={arrow.from.x} y1={arrow.from.y} x2={arrow.to.x} y2={arrow.to.y} stroke={color} strokeWidth={1.6}/><polygon points={arrowHead(arrow.from.x,arrow.from.y,arrow.to.x,arrow.to.y,7)} fill={color}/></g>;})}</g>;
});

registerRenderer<ColorWheelEntity>("colorwheel", (entity, frame, ctx) => {
  if(!entity.nativePaint)return <circle cx={entity.x} cy={entity.y} r={entity.radius} fill={paintFor(entity,frame,ctx)}/>;
  const segments=72,gradient=`mse-wheel-${entity.id.replaceAll(/[^A-Za-z0-9_-]/gu,"_")}`;
  return <g><defs><radialGradient id={gradient}><stop offset="0" stopColor="black" stopOpacity={.8}/><stop offset="100%" stopColor="white" stopOpacity={0}/></radialGradient></defs>{Array.from({length:segments},(_v,index)=>{const a=index*Math.PI*2/segments,b=(index+1)*Math.PI*2/segments;return <path key={index} d={`M ${entity.x} ${entity.y} L ${entity.x+Math.cos(a)*entity.radius} ${entity.y+Math.sin(a)*entity.radius} A ${entity.radius} ${entity.radius} 0 0 1 ${entity.x+Math.cos(b)*entity.radius} ${entity.y+Math.sin(b)*entity.radius} Z`} fill={`hsl(${index*360/segments} 100% 62%)`}/>;})}<circle cx={entity.x} cy={entity.y} r={entity.radius} fill={`url(#${gradient})`}/></g>;
});

registerRenderer<DomainColorEntity>("domaincolor", (entity, frame, ctx) => {
  if(!entity.nativePaint)return <rect x={entity.x-entity.width/2} y={entity.y-entity.height/2} width={entity.width} height={entity.height} fill={paintFor(entity,frame,ctx)}/>;
  const samples=domainColorSamples(entity);if(samples.length)return <g>{samples.map((sample,index)=><rect key={index} x={sample.x} y={sample.y} width={sample.width} height={sample.height} fill={`hsl(${sample.hue} 100% ${Math.max(0,Math.min(100,sample.lightness*100))}%)`}/>)}</g>;
  const x=entity.x-entity.width/2,y=entity.y-entity.height/2,dim=resolveColor(ctx.template,"dim"),panel=resolveColor(ctx.template,"panel"),fg=resolveColor(ctx.template,"fg");
  return <g><rect x={x} y={y} width={entity.width} height={entity.height} fill={panel} fillOpacity={.5} stroke={dim} strokeDasharray="10 7"/><text x={entity.x} y={entity.y-10} textAnchor="middle" fontFamily={FONT} fontSize={16} fontWeight={700} fill={fg}>DOMAIN COLOR · f(z)</text><text x={entity.x} y={entity.y+18} textAnchor="middle" fontFamily={FONT} fontSize={14} fill={dim}>{entity.formula}</text><text x={entity.x} y={entity.y+42} textAnchor="middle" fontFamily={FONT} fontSize={11} fill={dim}>native complex sampler in Preview</text></g>;
});

registerRenderer<WarpEntity>("warp", (entity, frame, ctx) => {
  const result=warpLines(entity),paint=paintFor(entity,frame,ctx),dim=resolveColor(ctx.template,"dim");if(result.issue)return <text x={entity.x} y={entity.y} textAnchor="middle" fontFamily={FONT} fontSize={16} fill={dim}>{result.issue}</text>;
  return <g><g opacity={.24}>{result.lines.map(line=><polyline key={`from-${line.id}`} points={line.from.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={paint} strokeWidth={1.2} strokeDasharray="5 5"/>)}</g><g opacity={.9}>{result.lines.map(line=><polyline key={`to-${line.id}`} points={line.to.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={paint} strokeWidth={1.6}/>)}</g></g>;
});

function virtualColor(entity:TableEntity|PieEntity|LeastSquaresEntity,refs:string[],fallback:string,ctx:RenderCtx):string{for(const ref of refs){const value=entity.childStyles[ref]?.color;if(value)return resolveColor(ctx.template,value);}return fallback;}
registerRenderer<TableEntity>("table", (entity, frame, ctx) => {
  const grid=tableGrid(entity);if(grid.issue)return <text x={entity.x} y={entity.y} textAnchor="middle" fontFamily={FONT} fontSize={16} fill={resolveColor(ctx.template,"gold")}>{grid.issue}</text>;const layout=tableLayout(entity),uniform=entity.nativePaint?null:paintFor(entity,frame,ctx),fg=uniform??resolveColor(ctx.template,"fg"),cyan=uniform??resolveColor(ctx.template,"cyan"),dim=uniform??resolveColor(ctx.template,"dim"),rowOffset=layout.hasColumnLabels?1:0,columnOffset=layout.hasRowLabels?1:0;
  return <g>{grid.rows.flatMap((row,i)=>row.map((value,j)=>{const at=layout.cell(i+rowOffset,j+columnOffset),color=virtualColor(entity,[`${entity.id}.r${i}c${j}`,`${entity.id}.row${i}`,`${entity.id}.col${j}`,`${entity.id}.entries`],fg,ctx);return <text key={`${i}-${j}`} x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={26} fill={color}>{value}</text>;}))}{grid.columnLabels.slice(0,grid.rows[0].length).map((value,j)=>{const at=layout.cell(0,j+columnOffset);return <text key={`c${j}`} x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={26} fill={virtualColor(entity,[`${entity.id}.collabel${j}`,`${entity.id}.labels`],cyan,ctx)}>{value}</text>;})}{grid.rowLabels.slice(0,grid.rows.length).map((value,i)=>{const at=layout.cell(i+rowOffset,0);return <text key={`r${i}`} x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={26} fill={virtualColor(entity,[`${entity.id}.rowlabel${i}`,`${entity.id}.labels`],cyan,ctx)}>{value}</text>;})}{Array.from({length:layout.gridRows+1},(_v,k)=><line key={`h${k}`} x1={layout.x0} y1={layout.y0+k*layout.rowHeight} x2={layout.x0+layout.width} y2={layout.y0+k*layout.rowHeight} stroke={virtualColor(entity,[`${entity.id}.h${k}`,`${entity.id}.hlines`,`${entity.id}.lines`],dim,ctx)} strokeWidth={1.5}/>)}{Array.from({length:layout.gridColumns+1},(_v,k)=><line key={`v${k}`} x1={layout.x0+k*layout.columnWidth} y1={layout.y0} x2={layout.x0+k*layout.columnWidth} y2={layout.y0+layout.height} stroke={virtualColor(entity,[`${entity.id}.v${k}`,`${entity.id}.vlines`,`${entity.id}.lines`],dim,ctx)} strokeWidth={1.5}/>)}</g>;
});

registerRenderer<PieEntity>("pie", (entity, frame, ctx) => {
  const count=Math.max(1,Math.min(360,Math.trunc(entity.slices))),uniform=entity.nativePaint?null:paintFor(entity,frame,ctx),base=uniform??resolveColor(ctx.template,"panel"),outline=uniform??resolveColor(ctx.template,entity.outlineColor??"cyan"),fill=entity.paint!=="outlined";
  if(count===1)return <circle cx={entity.x} cy={entity.y} r={entity.radius} fill={fill?virtualColor(entity,[`${entity.id}0`],base,ctx):"none"} stroke={outline} strokeWidth={entity.strokeWidth??2.5}/>;
  const step=Math.PI*2/count;return <g>{Array.from({length:count},(_v,index)=>{const a=index*step,b=(index+1)*step,ref=`${entity.id}${index}`,color=virtualColor(entity,[ref],base,ctx);return <path key={ref} d={`M ${entity.x} ${entity.y} L ${entity.x+Math.cos(a)*entity.radius} ${entity.y+Math.sin(a)*entity.radius} A ${entity.radius} ${entity.radius} 0 ${step>Math.PI?1:0} 1 ${entity.x+Math.cos(b)*entity.radius} ${entity.y+Math.sin(b)*entity.radius} Z`} fill={fill?color:"none"} stroke={entity.outlineColor?outline:color} strokeWidth={entity.strokeWidth??2.5}/>;})}</g>;
});

registerRenderer<LeastSquaresEntity>("leastsquares", (entity, frame, ctx) => {
  const result=leastSquaresGeometry(entity),uniform=entity.nativePaint?null:paintFor(entity,frame,ctx);if(!result.geometry)return <text x={entity.x} y={entity.y} textAnchor="middle" fontFamily={FONT} fontSize={16} fill={resolveColor(ctx.template,"gold")}>{result.issue}</text>;const g=result.geometry,point=uniform??resolveColor(ctx.template,entity.constructorColor??"cyan"),gold=uniform??resolveColor(ctx.template,"gold"),magenta=uniform??resolveColor(ctx.template,"magenta");
  return <g>{g.residuals.map((line,index)=><line key={index} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} stroke={virtualColor(entity,[`${entity.id}.r${index}`,`${entity.id}.residuals`],magenta,ctx)} strokeWidth={2} opacity={.8}/>) }<line x1={g.line.from.x} y1={g.line.from.y} x2={g.line.to.x} y2={g.line.to.y} stroke={virtualColor(entity,[`${entity.id}.line`],gold,ctx)} strokeWidth={3}/>{g.points.map((p,index)=><circle key={index} cx={p.x} cy={p.y} r={7} fill={virtualColor(entity,[`${entity.id}.p${index}`,`${entity.id}.points`],point,ctx)}/>)}<text x={g.label.x} y={g.label.y} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={22} fill={virtualColor(entity,[`${entity.id}.eq`],gold,ctx)}>{g.equation}</text></g>;
});

function statsPrimitiveStyle(entity: StatsEntity, primitive: StatsPrimitive): VirtualChildStyle {
  return entity.childStyles[primitive.id] ?? primitive.tags.map((tag) => entity.childStyles[tag]).find(Boolean) ?? {};
}
function statsPaint(value: string, ctx: RenderCtx): string { return value.startsWith("hsl(") || value.startsWith("#") ? value : resolveColor(ctx.template, value); }
function renderStatsPrimitive(entity: StatsEntity, primitive: StatsPrimitive, frame: EntityFrame, ctx: RenderCtx): ReactNode {
  const style = statsPrimitiveStyle(entity, primitive), uniform = entity.nativePaint ? null : paintFor(entity, frame, ctx), paint = uniform ?? statsPaint(style.color ?? primitive.color, ctx), opacity = primitive.opacity * (style.opacity ?? (style.reveal ? .34 : 1));
  if (primitive.kind === "line") return <line key={primitive.id} x1={primitive.from.x} y1={primitive.from.y} x2={primitive.to.x} y2={primitive.to.y} stroke={paint} strokeWidth={primitive.width} opacity={opacity} />;
  if (primitive.kind === "rect") return <rect key={primitive.id} x={primitive.x} y={primitive.y} width={primitive.width} height={primitive.height} fill={primitive.outline && primitive.opacity >= .99 ? "none" : paint} stroke={primitive.outline ? paint : "none"} strokeWidth={primitive.outline ? 2 : 0} opacity={opacity} />;
  if (primitive.kind === "circle") return <circle key={primitive.id} cx={primitive.x} cy={primitive.y} r={primitive.radius} fill={primitive.fill === false ? "none" : paint} stroke={primitive.fill === false ? paint : "none"} strokeWidth={primitive.fill === false ? 2 : 0} opacity={opacity} />;
  if (primitive.kind === "text") return <text key={primitive.id} x={primitive.x} y={primitive.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={primitive.size} fill={paint} opacity={opacity}>{primitive.text}</text>;
  const points = primitive.points.map((point) => `${point.x},${point.y}`).join(" ");
  return primitive.kind === "polygon"
    ? <polygon key={primitive.id} points={points} fill={paint} opacity={opacity} />
    : <polyline key={primitive.id} points={points} fill="none" stroke={paint} strokeWidth={primitive.width} strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />;
}
function renderStats(entity: StatsEntity, frame: EntityFrame, ctx: RenderCtx): ReactNode {
  const geometry = statsGeometry(entity);
  if (geometry.issue) return <g><rect x={entity.x - 160} y={entity.y - 42} width={320} height={84} rx={7} fill="none" stroke={resolveColor(ctx.template, "magenta")} strokeDasharray="8 6" /><text x={entity.x} y={entity.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={15} fill={resolveColor(ctx.template, "magenta")}>{geometry.issue}</text></g>;
  return <g>{geometry.primitives.map((primitive) => renderStatsPrimitive(entity, primitive, frame, ctx))}{geometry.note && <text x={entity.x} y={entityBounds(entity, ctx.doc).y - 12} textAnchor="middle" fontFamily={FONT} fontSize={11} fill={resolveColor(ctx.template, "dim")}>{geometry.note}</text>}</g>;
}
for (const kind of ["histogram", "covariance", "bayes", "hypothesis", "bellcurve", "summary", "correlation", "skew", "boxplot", "distribution", "confidence", "montecarlo", "randomwalk", "lln", "clt"] as const) registerRenderer<StatsEntity>(kind, renderStats);

function mlChildColor(entity: MlEntity, refs: string[], fallback: string, ctx: RenderCtx): string {
  if (!entity.nativePaint) return resolveColor(ctx.template, entity.color);
  for (const ref of refs) { const color = entity.childStyles[ref]?.color; if (color) return resolveColor(ctx.template, color); }
  return resolveColor(ctx.template, fallback);
}
function mlPanel(entity: MlEntity, title: string, subtitle: string, ctx: RenderCtx, body?: ReactNode): ReactNode {
  const box = entityBounds(entity, ctx.doc), panel = resolveColor(ctx.template, "panel"), cyan = mlChildColor(entity, [`${entity.id}.heading`], "cyan", ctx), dim = resolveColor(ctx.template, "dim");
  return <g><rect x={box.x} y={box.y} width={box.width} height={box.height} rx={12} fill={panel} stroke={cyan} strokeWidth={2}/><text x={entity.x} y={box.y+30} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={18} fill={cyan}>{title}</text><text x={entity.x} y={box.y+52} textAnchor="middle" fontFamily={FONT} fontSize={11} fill={dim}>{subtitle}</text>{body}</g>;
}
function renderMlTensor(entity: MlEntity, _frame: EntityFrame, ctx: RenderCtx): ReactNode {
  const grid = mlTensorGrid(entity), box = entityBounds(entity, ctx.doc), dim = resolveColor(ctx.template, "dim");
  if (grid.issue) return mlPanel(entity, entity.kind, grid.issue, ctx);
  return <g>{grid.cells.map((cell) => { const ref=`${entity.id}.c${cell.channel}.r${cell.row}c${cell.col}`, fill=mlChildColor(entity,[ref,`${entity.id}.channel${cell.channel}`,`${entity.id}.row${cell.row}`,`${entity.id}.col${cell.col}`,`${entity.id}.cells`],entity.constructorColor??entity.color,ctx), opacity=Math.max(.12,Math.min(1,Math.abs(cell.value)));return <g key={cell.id}><rect x={cell.x-cell.size*.45} y={cell.y-cell.size*.45} width={cell.size*.9} height={cell.size*.9} rx={2} fill={fill} fillOpacity={opacity} stroke={fill} strokeWidth={1}/>{cell.size>=24&&<text x={cell.x} y={cell.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={Math.max(9,cell.size*.26)} fill={Math.abs(cell.value)>.55?"#050608":resolveColor(ctx.template,"fg")}>{Math.round(cell.value*100)/100}</text>}</g>;})}<text x={entity.x} y={box.y+box.height-8} textAnchor="middle" fontFamily={FONT} fontSize={11} fill={dim}>{entity.kind}{grid.channels>1?` · ${grid.channels} channels`:""} · {grid.rows}×{grid.cols}</text></g>;
}
function renderActivation(entity: MlEntity, _frame: EntityFrame, ctx: RenderCtx): ReactNode {
  const box=entityBounds(entity,ctx.doc), paint=mlChildColor(entity,[`${entity.id}.curve`],entity.color,ctx), dim=resolveColor(ctx.template,"dim"), f=(x:number)=>entity.mode==="relu"?Math.max(0,x):entity.mode==="sigmoid"?1/(1+Math.exp(-x)):entity.mode==="tanh"?Math.tanh(x):x;
  const points=Array.from({length:81},(_v,i)=>{const x=-3+6*i/80,y=f(x),sx=box.x+18+(i/80)*(box.width-36),sy=entity.mode==="relu"||entity.mode==="linear"?box.y+box.height-22-(y+3)/6*(box.height-44):box.y+box.height/2-y*(box.height*.34);return `${sx},${sy}`;}).join(" ");
  return <g><line x1={box.x+14} y1={entity.y} x2={box.x+box.width-14} y2={entity.y} stroke={dim}/><line x1={entity.x} y1={box.y+12} x2={entity.x} y2={box.y+box.height-12} stroke={dim}/><polyline points={points} fill="none" stroke={paint} strokeWidth={3}/><text x={box.x+box.width-14} y={box.y+20} textAnchor="end" fontFamily={FONT} fontWeight={700} fontSize={14} fill={paint}>{entity.mode}</text></g>;
}
function renderNetwork(entity: MlEntity, _frame: EntityFrame, ctx: RenderCtx): ReactNode {
  const layers=mlLayers(entity), box=entityBounds(entity,ctx.doc), paint=mlChildColor(entity,[`${entity.id}.nodes`],entity.color,ctx), edge=mlChildColor(entity,[`${entity.id}.edges`],"dim",ctx), max=Math.max(1,...layers.map(n=>Math.min(n,9))), centers=layers.map((_n,i)=>box.x+54+i*(box.width-108)/Math.max(1,layers.length-1));
  const nodes=layers.map((n,l)=>Array.from({length:Math.min(n,9)},(_v,i)=>({x:centers[l],y:entity.y+(i-(Math.min(n,9)-1)/2)*Math.min(34,(box.height-90)/max)})));
  return <g><rect x={box.x} y={box.y} width={box.width} height={box.height} rx={12} fill="none" stroke={paint} strokeWidth={2}/>{nodes.slice(0,-1).flatMap((column,l)=>column.flatMap((a,i)=>nodes[l+1].map((b,j)=><line key={`${l}-${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={edge} strokeWidth={1} opacity={.34}/>)))}{nodes.flatMap((column,l)=>column.map((p,i)=><circle key={`${l}-${i}`} cx={p.x} cy={p.y} r={8} fill={resolveColor(ctx.template,"panel")} stroke={mlChildColor(entity,[`${entity.id}.l${l}.n${i}`,`${entity.id}.layer${l}`,`${entity.id}.nodes`],entity.color,ctx)} strokeWidth={2}/>))}<text x={entity.x} y={box.y+24} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={15} fill={paint}>{layers.join(" → ")} neural network</text></g>;
}
function renderTokenize(entity: MlEntity, _frame: EntityFrame, ctx: RenderCtx): ReactNode {
  const tokens=mlTokens(entity), box=entityBounds(entity,ctx.doc), gap=8, width=Math.min(110,Math.max(48,(box.width-gap*(tokens.length+1))/Math.max(1,tokens.length))), total=tokens.length*(width+gap)-gap, start=entity.x-total/2, paint=mlChildColor(entity,[`${entity.id}.tokens`],entity.color,ctx);
  return <g><text x={entity.x} y={box.y+22} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={resolveColor(ctx.template,"dim")}>{entity.mode} tokenizer</text>{tokens.map((token,i)=><g key={i}><rect x={start+i*(width+gap)} y={entity.y-25} width={width} height={50} rx={7} fill={resolveColor(ctx.template,"panel")} stroke={mlChildColor(entity,[`${entity.id}.token${i}.box`,`${entity.id}.token${i}`],entity.color,ctx)} strokeWidth={2}/><text x={start+i*(width+gap)+width/2} y={entity.y-3} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={Math.min(15,Math.max(9,80/Math.max(1,token.length)))} fill={paint}>{token}</text><text x={start+i*(width+gap)+width/2} y={entity.y+18} textAnchor="middle" fontFamily={FONT} fontSize={9} fill={resolveColor(ctx.template,"dim")}>{i+1}</text></g>)}</g>;
}
function renderMlSemantic(entity: MlEntity, _frame: EntityFrame, ctx: RenderCtx): ReactNode {
  if (entity.kind==="network") return renderNetwork(entity,_frame,ctx);
  const shape=(entity.kind==="convolve"||entity.kind==="pool")?mlOutputShape(entity,ctx.doc):null, labels=entity.source.split("|").map(v=>v.trim()).filter(Boolean), title:Record<string,string>={convolve:"Convolution",pool:`${entity.mode} pooling`,embedding:"Token embedding",transformer:"Transformer block",logits:"Logits → probabilities",attention:"Q · K · V attention",topk:`Top ${entity.p2??3}`};
  const subtitle=shape?(shape.issue??`${entity.ref} → ${shape.channels}×${shape.rows}×${shape.cols} · ${shape.steps} scan steps`):entity.kind==="embedding"?`${entity.ref} + ${entity.mode} position`:entity.kind==="transformer"?`${entity.ref} · ${entity.source}`:entity.kind==="attention"?`${mlTokens(entity).length} tokens · deterministic semantic matrix`:entity.kind==="logits"?`${entity.ref} token ${entity.p1??1} · temperature ${entity.p2??1}`:`${entity.ref} token ${entity.p1??1}`;
  const box=entityBounds(entity,ctx.doc), cyan=resolveColor(ctx.template,"cyan"), magenta=resolveColor(ctx.template,"magenta"), body=entity.kind==="transformer"?<g>{["Attention","Add + Norm","MLP","Add + Norm"].map((name,i)=>{const w=(box.width-70)/4,x=box.x+20+i*(w+10);return <g key={name}><rect x={x} y={entity.y-38} width={w} height={76} rx={8} fill="none" stroke={i%2?magenta:cyan} strokeWidth={2}/><text x={x+w/2} y={entity.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={12} fill={i%2?magenta:cyan}>{name}</text>{i<3&&<text x={x+w+5} y={entity.y} textAnchor="middle" dominantBaseline="central" fill={resolveColor(ctx.template,"dim")}>→</text>}</g>;})}</g>:labels.length?<g>{labels.slice(0,8).map((label,i)=>{const y=box.y+78+i*Math.min(28,(box.height-95)/Math.max(1,labels.length)),bar=(.25+((i*37+17)%70)/100)*(box.width*.42);return <g key={i}><text x={entity.x-box.width*.38} y={y} dominantBaseline="central" fontFamily={FONT} fontSize={11} fill={resolveColor(ctx.template,"fg")}>{label}</text><rect x={entity.x-box.width*.08} y={y-5} width={bar} height={10} rx={3} fill={i%2?magenta:cyan} opacity={.75}/></g>;})}</g>:<text x={entity.x} y={entity.y+12} textAnchor="middle" fontFamily={FONT} fontSize={22} fill={cyan}>{entity.kind==="convolve"?"▦  ∗  ▦  →  ▦":entity.kind==="pool"?"▦  ↓  ▦":"vectors → context"}</text>;
  return mlPanel(entity,title[entity.kind]??entity.kind,subtitle,ctx,body);
}
registerRenderer<MlEntity>("activation",renderActivation);
for(const kind of ["tensor","digit","kernel"] as const) registerRenderer<MlEntity>(kind,renderMlTensor);
registerRenderer<MlEntity>("tokenize",renderTokenize);
for(const kind of ["network","convolve","pool","embedding","transformer","logits","attention","topk"] as const) registerRenderer<MlEntity>(kind,renderMlSemantic);

function opticsPrimitiveStyle(entity: OpticsEntity, primitive: OpticsPrimitive): VirtualChildStyle {
  return entity.childStyles[primitive.id] ?? primitive.tags.map((tag) => entity.childStyles[tag]).find(Boolean) ?? {};
}
function renderOpticsPrimitive(entity: OpticsEntity, primitive: OpticsPrimitive, frame: EntityFrame, ctx: RenderCtx): ReactNode {
  const style=opticsPrimitiveStyle(entity,primitive), uniform=entity.nativePaint?null:paintFor(entity,frame,ctx), paint=uniform??resolveColor(ctx.template,style.color??primitive.color), opacity=primitive.opacity*(style.opacity??(style.reveal?.34:1));
  if(primitive.kind==="line")return <line key={primitive.id} x1={primitive.from.x} y1={primitive.from.y} x2={primitive.to.x} y2={primitive.to.y} stroke={paint} strokeWidth={primitive.width} strokeDasharray={primitive.dashed?"7 6":undefined} opacity={opacity}/>;
  if(primitive.kind==="rect")return <rect key={primitive.id} x={primitive.x} y={primitive.y} width={primitive.width} height={primitive.height} fill={primitive.outline?"none":paint} stroke={primitive.outline?paint:"none"} strokeWidth={primitive.outline?2:0} opacity={opacity}/>;
  if(primitive.kind==="circle")return <circle key={primitive.id} cx={primitive.x} cy={primitive.y} r={primitive.radius} fill={primitive.fill===false?"none":paint} stroke={primitive.fill===false?paint:"none"} strokeWidth={primitive.fill===false?2:0} strokeDasharray={primitive.dashed?"5 4":undefined} opacity={opacity}/>;
  if(primitive.kind==="text")return <text key={primitive.id} x={primitive.x} y={primitive.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={600} fontSize={primitive.size} fill={paint} opacity={opacity}>{primitive.text}</text>;
  const points=primitive.points.map(point=>`${point.x},${point.y}`).join(" ");return primitive.kind==="polygon"?<polygon key={primitive.id} points={points} fill={paint} fillOpacity={Math.min(.22,opacity)} stroke={paint} strokeWidth={primitive.width} opacity={opacity}/>:<polyline key={primitive.id} points={points} fill="none" stroke={paint} strokeWidth={primitive.width} strokeLinecap="round" strokeLinejoin="round" opacity={opacity}/>;
}
function renderOptics(entity: OpticsEntity, frame: EntityFrame, ctx: RenderCtx): ReactNode {
  const geometry=opticsGeometry(entity), box=entityBounds(entity,ctx.doc);return <g>{geometry.primitives.map(primitive=>renderOpticsPrimitive(entity,primitive,frame,ctx))}<text x={entity.x} y={box.y+box.height+16} textAnchor="middle" fontFamily={FONT} fontSize={11} fill={resolveColor(ctx.template,"dim")}>{geometry.note}</text></g>;
}
for(const kind of ["refract","lens","prism","achromat","lenssystem","rayfan","spotdiagram","fieldspot"] as const) registerRenderer<OpticsEntity>(kind,renderOptics);

function renderPhysicsPrimitive(entity:PhysicsEntity,primitive:PhysicsPrimitive,frame:EntityFrame,ctx:RenderCtx):ReactNode{
  const style=entity.childStyles[primitive.id]??primitive.tags.map(tag=>entity.childStyles[tag]).find(Boolean)??{},uniform=entity.nativePaint?null:paintFor(entity,frame,ctx),paint=uniform??resolveColor(ctx.template,style.color??primitive.color),opacity=primitive.opacity*(style.opacity??(style.reveal?.34:1));
  if(primitive.kind==="line")return <line key={primitive.id} x1={primitive.from.x} y1={primitive.from.y} x2={primitive.to.x} y2={primitive.to.y} stroke={paint} strokeWidth={primitive.width} opacity={opacity}/>;
  if(primitive.kind==="rect")return <rect key={primitive.id} x={primitive.x} y={primitive.y} width={primitive.width} height={primitive.height} fill={primitive.outline?"none":paint} stroke={primitive.outline?paint:"none"} strokeWidth={primitive.outline?2:0} opacity={opacity}/>;
  if(primitive.kind==="circle")return <circle key={primitive.id} cx={primitive.x} cy={primitive.y} r={primitive.radius} fill={primitive.fill===false?"none":paint} stroke={primitive.fill===false?paint:"none"} strokeWidth={2} opacity={opacity}/>;
  if(primitive.kind==="text")return <text key={primitive.id} x={primitive.x} y={primitive.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={600} fontSize={primitive.size} fill={paint} opacity={opacity}>{primitive.text}</text>;
  const points=primitive.points.map(point=>`${point.x},${point.y}`).join(" ");return primitive.kind==="polygon"?<polygon key={primitive.id} points={points} fill={paint} fillOpacity={.18} stroke={paint} strokeWidth={primitive.width} opacity={opacity}/>:<polyline key={primitive.id} points={points} fill="none" stroke={paint} strokeWidth={primitive.width} strokeLinecap="round" strokeLinejoin="round" opacity={opacity}/>;
}
function renderPhysics(entity:PhysicsEntity,frame:EntityFrame,ctx:RenderCtx):ReactNode{const geometry=physicsGeometry(entity),box=entityBounds(entity,ctx.doc);return <g>{geometry.primitives.map(primitive=>renderPhysicsPrimitive(entity,primitive,frame,ctx))}<text x={entity.x} y={box.y+box.height+14} textAnchor="middle" fontFamily={FONT} fontSize={11} fill={resolveColor(ctx.template,"dim")}>{geometry.note}</text></g>;}
for(const kind of ["freekick","pendulum","spring","doublependulum","springpendulum","kapitza","cartpendulum","comparependulum","verticalspring","springincline","bungee","resonance","doublespring","seriesparallel","carsuspension","piston","molecule","robotarm","pulley","pulleyscale","blocktackle","compoundpulley","ramp","dropmass","inclinepulley","doubleincline","inclinebumper","springchain","looptrack","collideblocks","bulletblock","newtonscradle","gas","dominos","dominopath","stringwave","raft","brachistochrone"] as const)registerRenderer<PhysicsEntity>(kind,renderPhysics);

type SystemRenderable=SystemDiagramEntity|SystemNodeEntity|SystemClusterEntity|SystemConnectionEntity|SystemMessageEntity;
function systemPaint(entity:SystemRenderable,ref:string,fallback:string,frame:EntityFrame,ctx:RenderCtx):{paint:string;opacity:number}{const style=systemChildStyle(entity,ref),paint=entity.nativePaint?resolveColor(ctx.template,style.color??fallback):paintFor(entity,frame,ctx);return{paint,opacity:style.opacity??(style.reveal?.34:1)};}
function renderSystemDiagram(entity:SystemDiagramEntity,frame:EntityFrame,ctx:RenderCtx):ReactNode{const box=systemItemBox(entity.id,ctx.doc)! ,style=systemPaint(entity,`${entity.id}.frame`,"dim",frame,ctx),title=entity.kind==="architecture"?"ARCHITECTURE":entity.kind==="flowchart"?`FLOWCHART · ${entity.direction}`:`C4 · ${entity.level}`;return <g opacity={style.opacity}><rect x={box.x} y={box.y} width={box.width} height={box.height} rx={12} fill={resolveColor(ctx.template,"panel")} fillOpacity={.18} stroke={style.paint} strokeWidth={1.5}/><text x={box.x+14} y={box.y+18} fontFamily={FONT} fontWeight={700} fontSize={11} fill={style.paint}>{title}</text></g>;}
function renderSystemCluster(entity:SystemClusterEntity,frame:EntityFrame,ctx:RenderCtx):ReactNode{const box=systemItemBox(entity.id,ctx.doc);if(!box)return null;const shell=systemPaint(entity,`${entity.id}.frame`,"cyan",frame,ctx),label=systemPaint(entity,`${entity.id}.label`,"cyan",frame,ctx);return <g><rect x={box.x} y={box.y} width={box.width} height={box.height} rx={9} fill={resolveColor(ctx.template,"panel")} fillOpacity={.16} stroke={shell.paint} strokeWidth={1.5} opacity={shell.opacity}/><text x={box.x+10} y={box.y+17} fontFamily={FONT} fontWeight={700} fontSize={11} fill={label.paint} opacity={label.opacity}>{entity.label}</text></g>;}
function renderSystemNode(entity:SystemNodeEntity,frame:EntityFrame,ctx:RenderCtx):ReactNode{const box=systemItemBox(entity.id,ctx.doc);if(!box)return null;const owner=systemDiagramFor(entity.id,ctx.doc),c4=owner?.kind==="c4",flow=owner?.kind==="flowchart",card=systemPaint(entity,`${entity.id}.card`,c4?entity.nodeKind==="external"?"gold":"cyan":"dim",frame,ctx),label=systemPaint(entity,`${entity.id}.label`,c4?entity.nodeKind==="external"?"gold":"cyan":"fg",frame,ctx),icon=systemPaint(entity,`${entity.id}.icon`,"cyan",frame,ctx),cx=box.x+box.width/2,cy=box.y+box.height/2,decision=flow&&entity.nodeKind.toLowerCase()==="decision",terminator=flow&&["terminator","connector"].includes(entity.nodeKind.toLowerCase());const cardShape=decision?<polygon points={`${cx},${box.y} ${box.x+box.width},${cy} ${cx},${box.y+box.height} ${box.x},${cy}`} fill={resolveColor(ctx.template,"panel")} fillOpacity={.5} stroke={card.paint} strokeWidth={2}/>:<rect x={box.x} y={box.y} width={box.width} height={box.height} rx={terminator?box.height/2:c4?10:7} fill={resolveColor(ctx.template,"panel")} fillOpacity={c4?.22:.48} stroke={card.paint} strokeWidth={c4?2.5:2}/>;if(c4){const lines=[entity.label,`[${entity.nodeKind}${entity.technology?`: ${entity.technology}`:""}]`,...(entity.description?[entity.description]:[])];return <g opacity={card.opacity}>{cardShape}{lines.map((line,index)=><text key={index} x={cx} y={cy+(index-(lines.length-1)/2)*17} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={index===0?700:500} fontSize={index===0?14:11} fill={label.paint}>{line.length>34?`${line.slice(0,32)}…`:line}</text>)}</g>;}if(flow)return <g opacity={card.opacity}>{cardShape}<text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={13} fill={label.paint}>{entity.label.length>24?`${entity.label.slice(0,22)}…`:entity.label}</text></g>;const provider=entity.nodeKind.includes(":"),glyph=provider?entity.nodeKind.split(":").at(-1)?.split(/[/-]/u).map(v=>v[0]?.toUpperCase()).join("").slice(0,3):({client:"○",service:"SVC",gateway:"GW",database:"DB",cache:"C",queue:"Q",storage:"ST",external:"EXT"} as Record<string,string>)[entity.nodeKind.toLowerCase()]??"SYS";return <g opacity={card.opacity}>{cardShape}<rect x={box.x+12} y={cy-20} width={42} height={40} rx={provider?7:20} fill="none" stroke={icon.paint} strokeWidth={2}/><text x={box.x+33} y={cy} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={glyph&&glyph.length>2?10:16} fill={icon.paint}>{glyph}</text><text x={box.x+64} y={cy} dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={13} fill={label.paint}>{entity.label.length>18?`${entity.label.slice(0,16)}…`:entity.label}</text></g>;}
function renderSystemConnection(entity:SystemConnectionEntity,frame:EntityFrame,ctx:RenderCtx):ReactNode{const geometry=systemConnectionGeometry(entity,ctx.doc),path=geometry.points.map(point=>`${point.x},${point.y}`).join(" "),cold=systemPaint(entity,entity.routing==="orthogonal"?`${entity.id}.body`:entity.id,"dim",frame,ctx),hot=systemPaint(entity,`${entity.id}.hot`,"cyan",frame,ctx),last=geometry.points.at(-1)!,before=geometry.points.at(-2)??geometry.start,angle=Math.atan2(last.y-before.y,last.x-before.x),arrow=[0,1,2].map(index=>{const a=angle+Math.PI+(index-1)*.55,r=index===1?0:13;return`${last.x+Math.cos(a)*r},${last.y+Math.sin(a)*r}`;}).join(" ");return <g><polyline points={path} fill="none" stroke={cold.paint} strokeWidth={2.5} strokeDasharray="10 8" strokeLinejoin="round" opacity={cold.opacity}/><polyline points={path} fill="none" stroke={hot.paint} strokeWidth={4} strokeLinejoin="round" opacity={.12*hot.opacity}/><polygon points={arrow} fill={cold.paint} opacity={cold.opacity}/>{entity.annotation&&<g><rect x={geometry.control.x-Math.max(30,entity.annotation.length*4.2)} y={geometry.control.y-13} width={Math.max(60,entity.annotation.length*8.4)} height={26} rx={4} fill={resolveColor(ctx.template,"panel")} fillOpacity={.94}/><text x={geometry.control.x} y={geometry.control.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={11} fill={resolveColor(ctx.template,"fg")}>{entity.annotation}</text></g>}</g>;}
function renderSystemMessage(entity:SystemMessageEntity,frame:EntityFrame,ctx:RenderCtx):ReactNode{const p=entityAnchor(entity,ctx.doc),token=systemPaint(entity,`${entity.id}.token`,"gold",frame,ctx),label=systemPaint(entity,`${entity.id}.label`,"gold",frame,ctx);return <g><circle cx={p.x} cy={p.y} r={10} fill={token.paint} stroke={resolveColor(ctx.template,"fg")} strokeWidth={2} opacity={token.opacity}/><text x={p.x} y={p.y-24} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={12} fill={label.paint} opacity={label.opacity}>{entity.label}</text></g>;}
for(const kind of ["architecture","flowchart","c4"] as const)registerRenderer<SystemDiagramEntity>(kind,renderSystemDiagram);
registerRenderer<SystemClusterEntity>("cluster",renderSystemCluster);registerRenderer<SystemNodeEntity>("node",renderSystemNode);registerRenderer<SystemConnectionEntity>("connect",renderSystemConnection);for(const kind of ["message","request"] as const)registerRenderer<SystemMessageEntity>(kind,renderSystemMessage);

function circuitPaint(entity:CircuitEntity,refs:string[],fallback:string,frame:EntityFrame,ctx:RenderCtx):{paint:string;opacity:number}{const style=refs.map(ref=>circuitChildStyle(entity,ref)).find(value=>value.color||value.opacity!==undefined||value.reveal);return{paint:entity.nativePaint?resolveColor(ctx.template,style?.color??fallback):paintFor(entity,frame,ctx),opacity:style?.opacity??(style?.reveal?.34:1)};}
function circuitSymbol(entity:CircuitEntity,part:ReturnType<typeof circuitGeometry>["parts"][number],frame:EntityFrame,ctx:RenderCtx):ReactNode{const a=circuitScreenPoint(entity,part.p1),b=circuitScreenPoint(entity,part.p2),ref=`${entity.id}.c${part.index}`,style=circuitPaint(entity,[`${entity.id}.${part.name??""}`,ref,`${entity.id}.${part.kind}s`,`${entity.id}.parts`],part.kind.includes("voltage")||part.kind.includes("current")?"gold":part.kind==="led"||part.kind==="lamp"?"magenta":"fg",frame,ctx),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,nx=-uy,ny=ux,mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},line=(x1:number,y1:number,x2:number,y2:number,key:string)=><line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={style.paint} strokeWidth={part.kind==="wire"?2:2.5} strokeLinecap="round"/>;
  let body:ReactNode;if(part.kind==="wire")body=line(a.x,a.y,b.x,b.y,"wire");else if(part.kind==="ground")body=<g>{line(a.x,a.y,b.x,b.y,"stem")}{[-1,0,1].map((v,i)=>line(b.x+nx*(15-i*5),b.y+ny*(15-i*5)+v*4,b.x-nx*(15-i*5),b.y-ny*(15-i*5)+v*4,`g${i}`))}</g>;else if(part.kind==="resistor"){const points=Array.from({length:9},(_v,i)=>{const t=.22+i*.56/8,w=i===0||i===8?0:(i%2?8:-8);return`${a.x+dx*t+nx*w},${a.y+dy*t+ny*w}`;}).join(" ");body=<g>{line(a.x,a.y,a.x+dx*.22,a.y+dy*.22,"a")}<polyline points={points} fill="none" stroke={style.paint} strokeWidth={2.5}/>{line(a.x+dx*.78,a.y+dy*.78,b.x,b.y,"b")}</g>;}else if(part.kind==="capacitor"||part.kind==="polarized-cap"){body=<g>{line(a.x,a.y,mid.x-dx*.06,mid.y-dy*.06,"a")}{line(mid.x+dx*.06,mid.y+dy*.06,b.x,b.y,"b")}{line(mid.x-dx*.035+nx*15,mid.y-dy*.035+ny*15,mid.x-dx*.035-nx*15,mid.y-dy*.035-ny*15,"p1")}{line(mid.x+dx*.035+nx*15,mid.y+dy*.035+ny*15,mid.x+dx*.035-nx*15,mid.y+dy*.035-ny*15,"p2")}</g>;}else if(part.kind==="switch"){body=<g>{line(a.x,a.y,mid.x-dx*.12,mid.y-dy*.12,"a")}{line(mid.x+dx*.18,mid.y+dy*.18,b.x,b.y,"b")}{line(mid.x-dx*.12,mid.y-dy*.12,mid.x+dx*.15+nx*12,mid.y+dy*.15+ny*12,"blade")}<circle cx={mid.x-dx*.12} cy={mid.y-dy*.12} r={3.5} fill={style.paint}/><circle cx={mid.x+dx*.18} cy={mid.y+dy*.18} r={3.5} fill={style.paint}/></g>;}else if(part.kind==="lamp"){body=<g>{line(a.x,a.y,mid.x-dx*.14,mid.y-dy*.14,"a")}{line(mid.x+dx*.14,mid.y+dy*.14,b.x,b.y,"b")}<circle cx={mid.x} cy={mid.y} r={18} fill="none" stroke={style.paint} strokeWidth={2.5}/>{line(mid.x-10*ux-10*nx,mid.y-10*uy-10*ny,mid.x+10*ux+10*nx,mid.y+10*uy+10*ny,"x1")}{line(mid.x-10*ux+10*nx,mid.y-10*uy+10*ny,mid.x+10*ux-10*nx,mid.y+10*uy-10*ny,"x2")}</g>;}else{const short=part.kind.replaceAll("-", " ").split(" ").map(v=>v[0]?.toUpperCase()).join("").slice(0,3);body=<g>{line(a.x,a.y,mid.x-dx*.18,mid.y-dy*.18,"a")}{line(mid.x+dx*.18,mid.y+dy*.18,b.x,b.y,"b")}<circle cx={mid.x} cy={mid.y} r={18} fill={resolveColor(ctx.template,"panel")} stroke={style.paint} strokeWidth={2.2}/><text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={9} fill={style.paint}>{short}</text></g>;}return <g key={ref} opacity={style.opacity}>{body}{entity.labels&&part.value&&<text x={mid.x+nx*25} y={mid.y+ny*25} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={12} fill={resolveColor(ctx.template,"dim")}>{part.value}</text>}</g>;}
registerRenderer<CircuitEntity>("circuit",(entity,frame,ctx)=>{const geometry=circuitGeometry(entity),dim=resolveColor(ctx.template,"dim"),current=entity.currentStyle,marker=current?circuitPaint(entity,[`${entity.id}.charge`],current.color,frame,ctx):null;return <g>{geometry.parts.map(part=>circuitSymbol(entity,part,frame,ctx))}{geometry.junctions.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={4} fill={resolveColor(ctx.template,"fg")}/>) }{current&&marker&&geometry.parts.slice(0,12).map((part,i)=>{const p=circuitPartAnchor(entity,part.name??`c${part.index}`)!;return current.shape==="square"?<rect key={i} x={p.x-current.size} y={p.y-current.size} width={current.size*2} height={current.size*2} fill={marker.paint} opacity={.72}/>:current.shape==="diamond"?<rect key={i} x={p.x-current.size} y={p.y-current.size} width={current.size*2} height={current.size*2} fill={marker.paint} opacity={.72} transform={`rotate(45 ${p.x} ${p.y})`}/>:<circle key={i} cx={p.x} cy={p.y} r={current.size} fill={marker.paint} opacity={.72}/>})}{entity.probes.map((probe,i)=>{const anchor=probe.at?circuitScreenPoint(entity,probe.at):circuitPartAnchor(entity,probe.part??"");if(!anchor)return null;const off=probe.offset??{x:0,y:-30},p={x:anchor.x+off.x,y:anchor.y+off.y};return <g key={i}><circle cx={anchor.x} cy={anchor.y} r={6} fill="none" stroke={probe.at?resolveColor(ctx.template,"cyan"):resolveColor(ctx.template,"gold")} strokeWidth={1.7}/><line x1={anchor.x} y1={anchor.y} x2={p.x} y2={p.y} stroke={dim} strokeDasharray="3 3"/><text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={13} fill={probe.at?resolveColor(ctx.template,"cyan"):resolveColor(ctx.template,"gold")}>{probe.at?"V?":"I?"}</text></g>;})}{entity.scopes.map((scope,i)=>{const paint=scope.at?resolveColor(ctx.template,"cyan"):resolveColor(ctx.template,"gold"),left=scope.x-scope.width/2,top=scope.y-scope.height/2,points=Array.from({length:31},(_v,k)=>`${left+k*scope.width/30},${scope.y+Math.sin(k*.65+i)*scope.height*.27}`).join(" ");return <g key={i}><rect x={left} y={top} width={scope.width} height={scope.height} rx={5} fill={resolveColor(ctx.template,"panel")} fillOpacity={.18} stroke={dim}/><polyline points={points} fill="none" stroke={paint} strokeWidth={2}/><text x={left+8} y={top+15} fontFamily={FONT} fontSize={10} fill={dim}>semantic scope · Preview values</text></g>;})}{geometry.warning&&<text x={entity.x} y={geometry.bounds.y+geometry.bounds.height+18} textAnchor="middle" fontFamily={FONT} fontSize={11} fill={dim}>{geometry.warning}</text>}</g>;});

registerRenderer<CoordsEntity>("coords", (entity, frame, ctx) => {
  const paint = paintFor(entity, frame, ctx), dash = partialDash(frame, entity);
  const x0 = entity.x + entity.xmin * entity.sx, x1 = entity.x + entity.xmax * entity.sx;
  const y0 = entity.y - entity.ymin * entity.sy, y1 = entity.y - entity.ymax * entity.sy;
  const xvalues = coordsAxisValues(entity.xmin, entity.xmax, entity.step);
  const yvalues = coordsAxisValues(entity.ymin, entity.ymax, entity.step);
  return (
    <g>
      <line x1={x0} y1={entity.y} x2={x1} y2={entity.y} stroke={paint} strokeWidth={2} pathLength={100} strokeDasharray={dash} />
      <line x1={entity.x} y1={y0} x2={entity.x} y2={y1} stroke={paint} strokeWidth={2} pathLength={100} strokeDasharray={dash} />
      {entity.tips && <><polygon points={arrowHead(x0, entity.y, x1, entity.y, 11)} fill={paint} /><polygon points={arrowHead(entity.x, y0, entity.x, y1, 11)} fill={paint} /></>}
      {xvalues.map((value) => { const x = entity.x + value * entity.sx; return <g key={`x${value}`}><line x1={x} y1={entity.y - 6} x2={x} y2={entity.y + 6} stroke={paint} strokeWidth={1.5} />{entity.numbers && <text x={x} y={entity.y + 22} textAnchor="middle" dominantBaseline="central" fontSize={15} fill={paint} fontFamily={FONT}>{formatAxisValue(value)}</text>}</g>; })}
      {yvalues.map((value) => { const y = entity.y - value * entity.sy; return <g key={`y${value}`}><line x1={entity.x - 6} y1={y} x2={entity.x + 6} y2={y} stroke={paint} strokeWidth={1.5} />{entity.numbers && <text x={entity.x - 22} y={y} textAnchor="middle" dominantBaseline="central" fontSize={15} fill={paint} fontFamily={FONT}>{formatAxisValue(value)}</text>}</g>; })}
      {entity.xname !== null && <text x={x1 + 22} y={entity.y} textAnchor="middle" dominantBaseline="central" fontSize={22} fill={paint} fontFamily={FONT}>{entity.xname}</text>}
      {entity.yname !== null && <text x={entity.x} y={y1 - 24} textAnchor="middle" dominantBaseline="central" fontSize={22} fill={paint} fontFamily={FONT}>{entity.yname}</text>}
    </g>
  );
});

function formatAxisValue(value: number): string {
  return Math.abs(value - Math.round(value)) < 1e-6 ? String(Math.round(value)) : String(Math.round(value * 1000) / 1000);
}

function axisTickRenderer(entity: AxisTickEntity, frame: EntityFrame, ctx: RenderCtx) {
  const geometry = axisTickGeometry(entity, geometryContext(ctx.doc));
  const markPaint = resolveColor(ctx.template, entity.markColor);
  return (
    <g>
      <line x1={geometry.markFrom.x} y1={geometry.markFrom.y} x2={geometry.markTo.x} y2={geometry.markTo.y} stroke={markPaint} strokeWidth={entity.markWidth ?? 1.5} />
      <text x={geometry.label.x} y={geometry.label.y} textAnchor="middle" dominantBaseline="central" fontSize={entity.size} fill={paintFor(entity, frame, ctx)} fontFamily={FONT}>{entity.text ?? formatAxisValue(entity.value)}</text>
    </g>
  );
}

registerRenderer<AxisTickEntity>("xtick", axisTickRenderer);
registerRenderer<AxisTickEntity>("ytick", axisTickRenderer);

registerRenderer<PointEntity>("point", (entity, frame, ctx) => (
  <g>
    <circle cx={entity.x} cy={entity.y} r={7} fill={paintFor(entity, frame, ctx)} />
    {entity.label !== null && <text x={entity.x} y={entity.y - 22} textAnchor="middle" dominantBaseline="central" fontSize={entity.labelSize} fill={resolveColor(ctx.template, entity.labelColor)} fontWeight={700} fontFamily={FONT}>{entity.label}</text>}
  </g>
));

registerRenderer<SegmentEntity>("segment", (entity, frame, ctx) => {
  const geometry = segmentGeometry(entity, geometryContext(ctx.doc)), width = entity.strokeWidth ?? 2;
  return <g><line x1={geometry.from.x} y1={geometry.from.y} x2={geometry.to.x} y2={geometry.to.y} stroke={paintFor(entity, frame, ctx)} strokeWidth={width} strokeLinecap="round" pathLength={100} strokeDasharray={partialDash(frame, entity)} /><line x1={geometry.from.x} y1={geometry.from.y} x2={geometry.to.x} y2={geometry.to.y} stroke="transparent" strokeWidth={Math.max(16, width * 3)} /></g>;
});

registerRenderer<VectorEntity>("vector", (entity, frame, ctx) => {
  const to = { x: entity.x + entity.dx * frame.draw, y: entity.y - entity.dy * frame.draw }, width = entity.strokeWidth ?? 3;
  return <g><line x1={entity.x} y1={entity.y} x2={to.x} y2={to.y} stroke={paintFor(entity, frame, ctx)} strokeWidth={width} strokeLinecap="round" strokeDasharray={frame.draw < 1 ? undefined : dashPattern(entity)} />{frame.draw > .02 && <polygon points={arrowHead(entity.x, entity.y, to.x, to.y, Math.max(10, width * 3.2))} fill={paintFor(entity, frame, ctx)} />}</g>;
});

registerRenderer<EllipseEntity>("ellipse", (entity, frame, ctx) => (
  <ellipse cx={entity.x} cy={entity.y} rx={Math.abs(entity.rx)} ry={Math.abs(entity.ry)} transform={`rotate(${entity.angle} ${entity.x} ${entity.y})`} fill="none" stroke={paintFor(entity, frame, ctx)} strokeWidth={entity.strokeWidth ?? 2.5} pathLength={100} strokeDasharray={partialDash(frame, entity)} />
));

registerRenderer<Circle2Entity>("circle2", (entity, frame, ctx) => {
  const geometry = circle2Geometry(entity, geometryContext(ctx.doc));
  const paint = paintFor(entity, frame, ctx), rim = entity.outlineColor ? resolveColor(ctx.template, entity.outlineColor) : paint;
  return <circle cx={geometry.center.x} cy={geometry.center.y} r={geometry.radius} fill={entity.paint === "filled" ? paint : "none"} fillOpacity={entity.paint === "filled" ? .9 : 0} stroke={entity.paint === "filled" ? "none" : rim} strokeWidth={entity.strokeWidth ?? 2.5} pathLength={100} strokeDasharray={partialDash(frame, entity)} />;
});

registerRenderer<MidpointEntity>("midpoint", (entity, frame, ctx) => {
  const point = midpointGeometry(entity, geometryContext(ctx.doc));
  return <circle cx={point.x} cy={point.y} r={7} fill={paintFor(entity, frame, ctx)} />;
});

registerRenderer<AngleMarkEntity>("anglemark", (entity, frame, ctx) => {
  const geometry = angleMarkGeometry(entity, geometryContext(ctx.doc));
  return <g><path d={geometry.path} fill="none" stroke={paintFor(entity, frame, ctx)} strokeWidth={entity.strokeWidth ?? 2} pathLength={100} strokeDasharray={partialDash(frame, entity)} />{entity.label !== null && <text x={geometry.label.x} y={geometry.label.y} textAnchor="middle" dominantBaseline="central" fontSize={entity.labelSize} fill={resolveColor(ctx.template, entity.labelColor)} fontWeight={700} fontFamily={FONT}>{entity.label}</text>}</g>;
});

registerRenderer<RightAngleEntity>("rightangle", (entity, frame, ctx) => (
  <polyline points={rightAnglePoints(entity, geometryContext(ctx.doc)).map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={paintFor(entity, frame, ctx)} strokeWidth={entity.strokeWidth ?? 2} strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray={partialDash(frame, entity)} />
));

for (const kind of ["centroid", "circumcenter", "incenter", "orthocenter", "foot", "meet", "reflect", "bisector", "rotpoint", "between", "anglepoint"] as const) {
  registerRenderer<GeoDerivedPointEntity>(kind, (entity, frame, ctx) => {
    const point = geoDerivedPoint(entity, geometryContext(ctx.doc));
    return <circle cx={point.x} cy={point.y} r={7} fill={paintFor(entity, frame, ctx)} />;
  });
}

for (const kind of ["circumcircle", "incircle"] as const) {
  registerRenderer<GeoCircleEntity>(kind, (entity, frame, ctx) => {
    const circle = geoCircleGeometry(entity, geometryContext(ctx.doc));
    const paint = paintFor(entity, frame, ctx), rim = entity.outlineColor ? resolveColor(ctx.template, entity.outlineColor) : paint;
    return <circle cx={circle.center.x} cy={circle.center.y} r={circle.radius} fill={entity.paint === "filled" ? paint : "none"} stroke={entity.paint === "filled" ? "none" : rim} strokeWidth={entity.strokeWidth ?? 2.5} pathLength={100} strokeDasharray={partialDash(frame, entity)} />;
  });
}

for (const kind of ["linecircle", "circlecircle"] as const) {
  registerRenderer<GeoIntersectionEntity>(kind, (entity, _frame, ctx) => {
    const geometry = geoIntersectionPoints(entity, geometryContext(ctx.doc));
    return <g>
      <circle cx={geometry.points[0].x} cy={geometry.points[0].y} r={5} fill={resolveColor(ctx.template, entity.point0Color)} opacity={entity.point0Reveal === "none" ? 1 : .22} />
      <circle cx={geometry.points[1].x} cy={geometry.points[1].y} r={5} fill={resolveColor(ctx.template, entity.point1Color)} opacity={entity.point1Reveal === "none" ? 1 : .22} />
      {!geometry.intersects && <text x={geometry.points[0].x + 10} y={geometry.points[0].y - 10} fontFamily={FONT} fontSize={11} fill={resolveColor(ctx.template, "gold")}>no real intersection · native fallback</text>}
    </g>;
  });
}

registerRenderer<FullLineEntity>("fullline", (entity, frame, ctx) => {
  const line = fullLineGeometry(entity, geometryContext(ctx.doc));
  return <line x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} stroke={paintFor(entity, frame, ctx)} strokeWidth={entity.strokeWidth ?? 2} pathLength={100} strokeDasharray={partialDash(frame, entity)} />;
});

registerRenderer<ParabolaEntity>("parabola", (entity, frame, ctx) => (
  <polyline points={parabolaPoints(entity).map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={paintFor(entity, frame, ctx)} strokeWidth={entity.strokeWidth ?? 2.5} strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray={partialDash(frame, entity)} />
));

registerRenderer<HyperbolaEntity>("hyperbola", (entity, frame, ctx) => {
  const branches = hyperbolaBranches(entity), paint = paintFor(entity, frame, ctx), dash = partialDash(frame, entity);
  return <g>
    <polyline points={branches.right.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={paint} strokeWidth={entity.strokeWidth ?? 2.5} strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray={dash} />
    <polyline points={branches.left.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={paint} strokeWidth={entity.strokeWidth ?? 2.5} strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray={dash} />
  </g>;
});

registerRenderer<CommonTangentEntity>("commontangent", (entity, frame, ctx) => {
  const tangent = commonTangentGeometry(entity, geometryContext(ctx.doc)), paint = paintFor(entity, frame, ctx);
  return <g>
    <line x1={tangent.from.x} y1={tangent.from.y} x2={tangent.to.x} y2={tangent.to.y} stroke={paint} strokeWidth={entity.strokeWidth ?? 4} pathLength={100} strokeDasharray={partialDash(frame, entity)} />
    <circle cx={tangent.from.x} cy={tangent.from.y} r={5} fill={resolveColor(ctx.template, entity.touchAColor)} opacity={entity.touchAReveal === "none" ? 1 : .22} />
    <circle cx={tangent.to.x} cy={tangent.to.y} r={5} fill={resolveColor(ctx.template, entity.touchBColor)} opacity={entity.touchBReveal === "none" ? 1 : .22} />
    {!tangent.valid && <text x={(tangent.from.x + tangent.to.x) / 2} y={(tangent.from.y + tangent.to.y) / 2 - 12} textAnchor="middle" fontFamily={FONT} fontSize={11} fill={resolveColor(ctx.template, "red")}>no {entity.tangentType} tangent</text>}
  </g>;
});

// --- calculus --------------------------------------------------------------

function graphRenderer(entity: PlotEntity | DerivedCurveEntity, frame: EntityFrame, ctx: RenderCtx) {
  const points = graphSamples(entity, geometryContext(ctx.doc));
  const draw = Math.max(0, Math.min(1, frame.draw));
  const encoded = points.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <g>
      <polyline
        points={encoded}
        fill="none"
        stroke={paintFor(entity, frame, ctx)}
        strokeWidth={entity.strokeWidth ?? 4}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        strokeDasharray={draw < 1 ? `${draw * 100} 100` : dashPattern(entity)}
      />
      <polyline points={encoded} fill="none" stroke="transparent" strokeWidth={Math.max(18, (entity.strokeWidth ?? 4) * 3)} strokeLinecap="round" strokeLinejoin="round" pointerEvents="stroke" />
    </g>
  );
}

registerRenderer<PlotEntity>("plot", graphRenderer);
registerRenderer<DerivedCurveEntity>("deriv", graphRenderer);
registerRenderer<DerivedCurveEntity>("accum", graphRenderer);

registerRenderer<TangentEntity>("tangent", (entity, frame, ctx) => {
  if (entity.mode === "circle") {
    const geometry = tangentPointGeometry(entity, geometryContext(ctx.doc));
    return <g>
      <circle cx={geometry.points[0].x} cy={geometry.points[0].y} r={5} fill={resolveColor(ctx.template, entity.point0Color)} opacity={entity.point0Reveal === "none" ? 1 : .22} />
      <circle cx={geometry.points[1].x} cy={geometry.points[1].y} r={5} fill={resolveColor(ctx.template, entity.point1Color)} opacity={entity.point1Reveal === "none" ? 1 : .22} />
      {!geometry.valid && <text x={geometry.points[0].x + 10} y={geometry.points[0].y - 10} fontFamily={FONT} fontSize={11} fill={resolveColor(ctx.template, "gold")}>point must be outside circle · native fallback</text>}
    </g>;
  }
  const geometry = tangentGeometry(entity, geometryContext(ctx.doc));
  const paint = paintFor(entity, frame, ctx);
  return (
    <g>
      <line x1={geometry.from.x} y1={geometry.from.y} x2={geometry.to.x} y2={geometry.to.y} stroke={paint} strokeWidth={entity.strokeWidth ?? 3.5} strokeLinecap="round" strokeDasharray={dashPattern(entity)} />
      <circle cx={geometry.touch.x} cy={geometry.touch.y} r={5} fill={paint} />
    </g>
  );
});

registerRenderer<SlopeEntity>("slope", (entity, frame, ctx) => {
  const geometry = slopeGeometry(entity, geometryContext(ctx.doc));
  const value = Number.isFinite(geometry.slope) ? geometry.slope.toFixed(2).replace(/\.00$/u, "") : "?";
  return <text x={geometry.at.x} y={geometry.at.y} dominantBaseline="central" fontSize={entity.size} fill={paintFor(entity, frame, ctx)} fontFamily={FONT}>m = {value}</text>;
});

registerRenderer<AreaEntity>("area", (entity, frame, ctx) => (
  <polygon
    points={areaPoints(entity, geometryContext(ctx.doc)).map((point) => `${point.x},${point.y}`).join(" ")}
    fill={paintFor(entity, frame, ctx)} fillOpacity={Math.max(.08, entity.opacity * .42)}
    stroke={paintFor(entity, frame, ctx)} strokeOpacity={.7} strokeWidth={1.5}
  />
));

registerRenderer<BandEntity>("band", (entity, frame, ctx) => {
  const geometry = bandGeometry(entity, geometryContext(ctx.doc));
  if (geometry.points.length < 3) return <FormulaFallback entity={entity} label="BETWEEN CURVES" detail={geometry.issue ?? "choose two overlapping plots"} ctx={ctx} />;
  const points = geometry.points.map((point) => `${point.x},${point.y}`).join(" "), paint = paintFor(entity, frame, ctx);
  return <polygon points={points} fill={paint} stroke="none" pointerEvents="none" />;
});

registerRenderer<IntegralEntity>("integral", (entity, frame, ctx) => {
  const value = integralValue(entity, geometryContext(ctx.doc));
  const at = entityAnchor(entity, ctx.doc);
  const shown = Number.isFinite(value) ? value.toFixed(3).replace(/\.?0+$/u, "") : "?";
  return <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" fontSize={entity.size} fill={paintFor(entity, frame, ctx)} fontFamily={FONT}>∫ = {shown}</text>;
});

function marksRenderer(entity: CalculusMarksEntity, frame: EntityFrame, ctx: RenderCtx) {
  const paint = paintFor(entity, frame, ctx);
  return <g>{calculusMarkPoints(entity, geometryContext(ctx.doc)).map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={8} fill={ctx.doc.template === "paper" ? "#f7f0dd" : "#050608"} stroke={paint} strokeWidth={4} />)}</g>;
}

registerRenderer<CalculusMarksEntity>("extrema", marksRenderer);
registerRenderer<CalculusMarksEntity>("inflections", marksRenderer);

registerRenderer<LimitEntity>("limit", (entity, frame, ctx) => {
  const geometry = limitGeometry(entity, geometryContext(ctx.doc));
  const paint = paintFor(entity, frame, ctx);
  const value = Number.isFinite(geometry.value) ? geometry.value.toFixed(3).replace(/\.?0+$/u, "") : "?";
  return (
    <g>
      <line x1={geometry.start.x} y1={geometry.start.y} x2={geometry.target.x} y2={geometry.target.y} stroke={paint} strokeWidth={2.5} strokeDasharray="8 7" opacity={.72} />
      {!geometry.infinity && <line x1={geometry.target.x} y1={geometry.target.y} x2={geometry.target.x} y2={geometry.domain?.y ?? geometry.target.y + 90} stroke={paint} strokeWidth={1.5} strokeDasharray="5 7" opacity={.55} />}
      <circle cx={geometry.target.x} cy={geometry.target.y} r={7} fill={ctx.doc.template === "paper" ? "#f7f0dd" : "#050608"} stroke={paint} strokeWidth={3} />
      <text x={geometry.target.x + 14} y={geometry.target.y - 18} dominantBaseline="central" fontSize={20} fill={paint} fontFamily={FONT}>lim → {value}</text>
    </g>
  );
});

function sampledCurve(points: readonly { x: number; y: number }[], entity: SceneEntity, frame: EntityFrame, ctx: RenderCtx, width: number) {
  const encoded = points.map((point) => `${point.x},${point.y}`).join(" ");
  return <polyline points={encoded} fill="none" stroke={paintFor(entity, frame, ctx)} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray={frame.draw < 1 ? `${frame.draw * 100} 100` : dashPattern(entity)} />;
}

function parametricRenderer(entity: ParametricCurveEntity, frame: EntityFrame, ctx: RenderCtx) {
  return sampledCurve(parametricCurvePoints(entity), entity, frame, ctx, entity.strokeWidth ?? 3);
}
registerRenderer<ParametricCurveEntity>("param", parametricRenderer);
registerRenderer<ParametricCurveEntity>("polar", parametricRenderer);

registerRenderer<NormalEntity>("normal", (entity, frame, ctx) => {
  const geometry = normalGeometry(entity, geometryContext(ctx.doc)), paint = paintFor(entity, frame, ctx);
  return <g><line x1={geometry.from.x} y1={geometry.from.y} x2={geometry.to.x} y2={geometry.to.y} stroke={paint} strokeWidth={entity.strokeWidth ?? 3} strokeLinecap="round" /><circle cx={geometry.touch.x} cy={geometry.touch.y} r={5} fill={paint} /></g>;
});

registerRenderer<SlopeTriangleEntity>("slopetri", (entity, frame, ctx) => {
  const geometry = slopeTriangleGeometry(entity, geometryContext(ctx.doc));
  return <g><line x1={geometry.point.x} y1={geometry.point.y} x2={geometry.run.x} y2={geometry.run.y} stroke={resolveColor(ctx.template, "fg")} strokeWidth={2} /><line x1={geometry.run.x} y1={geometry.run.y} x2={geometry.rise.x} y2={geometry.rise.y} stroke={resolveColor(ctx.template, "red")} strokeWidth={2.5} /><text x={(geometry.point.x + geometry.run.x) / 2} y={geometry.run.y + 13} textAnchor="middle" dominantBaseline="central" fontSize={14} fill={resolveColor(ctx.template, "fg")} fontFamily={FONT}>{entity.run.toFixed(2).replace(/\.00$/u, "")}</text></g>;
});

registerRenderer<RootsEntity>("roots", (entity, frame, ctx) => <g>{rootsPoints(entity, geometryContext(ctx.doc)).map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={6} fill={paintFor(entity, frame, ctx)} />)}</g>);

registerRenderer<VerticalLineEntity>("vline", (entity, frame, ctx) => {
  const geometry = verticalLineGeometry(entity, geometryContext(ctx.doc)), pattern = entity.style === "dotted" ? "2 7" : entity.style === "dashed" ? "11 8" : undefined;
  return <line x1={geometry.from.x} y1={geometry.from.y} x2={geometry.to.x} y2={geometry.to.y} stroke={paintFor(entity, frame, ctx)} strokeWidth={2} strokeDasharray={pattern} />;
});

registerRenderer<CurveDotEntity>("curvedot", (entity, frame, ctx) => { const point = curveDotPoint(entity, geometryContext(ctx.doc)); return point ? <circle cx={point.x} cy={point.y} r={6} fill={paintFor(entity, frame, ctx)} /> : null; });

registerRenderer<GraphLabelEntity>("graphlabel", (entity, frame, ctx) => {
  const at = graphLabelPosition(entity, geometryContext(ctx.doc)), box = entityBounds(entity, ctx.doc); let html = "";
  try { html = katex.renderToString(entity.latex, { throwOnError: false, displayMode: true }); } catch { html = ""; }
  const fill = paintFor(entity, frame, ctx);
  return html ? <foreignObject x={box.x} y={box.y} width={box.width} height={box.height} pointerEvents="none"><div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", overflow: "hidden", color: fill, fontSize: entity.size * .8 }} dangerouslySetInnerHTML={{ __html: html }} /></foreignObject> : <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" fontSize={entity.size} fill={fill} fontFamily={FONT}>{entity.latex}</text>;
});

registerRenderer<BoxToEntity>("boxto", (entity, frame, ctx) => <polygon points={boxToPoints(entity, geometryContext(ctx.doc)).map((point) => `${point.x},${point.y}`).join(" ")} fill={paintFor(entity, frame, ctx)} fillOpacity={.5} stroke={resolveColor(ctx.template, "gold")} strokeWidth={1.5} />);

registerRenderer<RiemannEntity>("riemann", (entity, frame, ctx) => <g>{riemannBars(entity, geometryContext(ctx.doc)).map((bar) => <rect key={bar.index} x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={paintFor(entity, frame, ctx)} fillOpacity={.6} stroke={paintFor(entity, frame, ctx)} strokeWidth={1} />)}</g>);

registerRenderer<TaylorEntity>("taylor", (entity, frame, ctx) => sampledCurve(taylorPoints(entity, geometryContext(ctx.doc)), entity, frame, ctx, entity.strokeWidth ?? 3));
registerRenderer<NewtonEntity>("newton", (entity, frame, ctx) => sampledCurve(newtonPoints(entity, geometryContext(ctx.doc)), entity, frame, ctx, entity.strokeWidth ?? 2.5));

registerRenderer<SplineEntity>("spline", (entity, frame, ctx) => <g>{sampledCurve(splinePoints(entity), entity, frame, ctx, entity.strokeWidth ?? 3)}{entity.points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={5} fill={resolveColor(ctx.template, "magenta")} />)}</g>);

registerRenderer<TrajectoryEntity>("trajectory", (entity, frame, ctx) => sampledCurve(trajectoryPoints(entity), entity, frame, ctx, entity.strokeWidth ?? 3));

// --- Generative fields: bounded t=0 semantic samples ----------------------

function proceduralPaint(hue: number | null, saturation: number, value: number, fallback: string): string {
  return hue === null ? fallback : `hsl(${((hue % 360) + 360) % 360} ${saturation * 100}% ${value * 100}%)`;
}

function rgb(sample: { r: number; g: number; b: number; hue: number | null; saturation: number; value: number }): string {
  if (sample.hue !== null) return proceduralPaint(sample.hue, sample.saturation, sample.value, "#000");
  return `rgb(${Math.round(sample.r * 255)} ${Math.round(sample.g * 255)} ${Math.round(sample.b * 255)})`;
}

function FormulaFallback({ entity, label, detail, ctx }: { entity: SceneEntity; label: string; detail: string; ctx: RenderCtx }) {
  const box = entityBounds(entity, ctx.doc);
  return <g className="mse-formula-field">
    <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={12} />
    <text x={box.x + box.width / 2} y={box.y + box.height / 2 - 10} textAnchor="middle">{label}</text>
    <text className="detail" x={box.x + box.width / 2} y={box.y + box.height / 2 + 17} textAnchor="middle">{detail}</text>
  </g>;
}

registerRenderer<CloudEntity>("cloud", (entity, frame, ctx) => {
  const samples = cloudSamples(entity, ctx.doc);
  if (samples.length === 0) return <FormulaFallback entity={entity} label="POINT CLOUD" detail={entity.source ? `home points: ${entity.source}` : "formula needs native Preview"} ctx={ctx} />;
  const fallback = paintFor(entity, frame, ctx);
  return <g>{samples.map((sample) => <circle key={sample.index} cx={sample.x} cy={sample.y} r={sample.radius} fill={proceduralPaint(sample.hue, sample.saturation, sample.value, fallback)} opacity={sample.alpha} />)}</g>;
});

registerRenderer<Cloud3Entity>("cloud3", (entity, frame, ctx) => {
  const samples = cloud3Samples(entity, ctx.doc).sort((a, b) => a.scale - b.scale);
  if (samples.length === 0) return <FormulaFallback entity={entity} label="3D POINT CLOUD" detail="formula needs native Preview" ctx={ctx} />;
  const fallback = paintFor(entity, frame, ctx);
  return <g>{samples.map((sample) => <circle key={sample.index} cx={sample.x} cy={sample.y} r={Math.max(1, sample.radius * sample.scale)} fill={proceduralPaint(sample.hue, sample.saturation, sample.value, fallback)} opacity={sample.alpha} />)}</g>;
});

registerRenderer<ShaderEntity>("shader", (entity, _frame, ctx) => {
  const samples = shaderSamples(entity, ctx.doc);
  if (samples.length === 0) return <FormulaFallback entity={entity} label="FORMULA SHADER" detail="native formula preview" ctx={ctx} />;
  return <g shapeRendering="crispEdges">{samples.map((sample, index) => <rect key={index} x={sample.x} y={sample.y} width={sample.width} height={sample.height} fill={rgb(sample)} opacity={sample.alpha} />)}</g>;
});

registerRenderer<GlslEntity>("glsl", (entity, _frame, ctx) => {
  const box = entityBounds(entity, ctx.doc), uniforms = glslUniforms(entity, ctx.doc);
  const parameters = uniforms.filter((uniform) => uniform.binding === "parameter").length;
  const camera = uniforms.some((uniform) => uniform.binding === "camera");
  const unbound = uniforms.filter((uniform) => uniform.binding === "unbound").length;
  const detail = [parameters ? `${parameters} parameter${parameters === 1 ? "" : "s"}` : "no parameters", camera ? "camera3" : null, unbound ? `${unbound} unbound` : null].filter(Boolean).join(" · ");
  const stroke = resolveColor(ctx.template, unbound ? "gold" : "cyan"), panel = resolveColor(ctx.template, "panel"), fg = resolveColor(ctx.template, "fg");
  return <g className="mse-glsl-pass">
    <rect x={box.x} y={box.y} width={box.width} height={box.height} fill="transparent" />
    <rect x={box.x + 2} y={box.y + 2} width={Math.max(0, box.width - 4)} height={Math.max(0, box.height - 4)} fill="none" stroke={stroke} strokeOpacity={.38} strokeWidth={2} strokeDasharray="9 9" />
    <path d={`M ${box.x + 18} ${box.y + box.height - 18} L ${box.x + box.width - 18} ${box.y + 18}`} stroke={stroke} strokeOpacity={.08} strokeWidth={10} />
    <g transform={`translate(${box.x + 18} ${box.y + 18})`}>
      <rect width={264} height={62} rx={10} fill={panel} fillOpacity={.92} stroke={stroke} strokeOpacity={.7} />
      <text x={14} y={25} fontFamily={FONT} fontWeight={700} fontSize={13} fill={fg}>RAW GLSL · NATIVE GPU PREVIEW</text>
      <text x={14} y={46} fontFamily={FONT} fontSize={11} fill={fg} opacity={.72}>mainImage · {detail}</text>
    </g>
  </g>;
});

registerRenderer<Ifs2Entity>("ifs2", (entity, frame, ctx) => {
  const geometry = ifs2Geometry(entity);
  if (geometry.issue) return <FormulaFallback entity={entity} label="AFFINE IFS" detail={geometry.issue} ctx={ctx} />;
  const native = ["lime", "cyan", "magenta", "gold"], fallback = paintFor(entity, frame, ctx);
  const pointPaint = (rule: number) => resolveColor(ctx.template, native[rule % native.length]);
  const segmentPaint = (index: number) => {
    const t = index / Math.max(1, geometry.segments.length);
    return t < .5
      ? mixColors(resolveColor(ctx.template, "magenta"), resolveColor(ctx.template, "fg"), t * 2, ctx)
      : mixColors(resolveColor(ctx.template, "fg"), resolveColor(ctx.template, "cyan"), (t - .5) * 2, ctx);
  };
  return <g>
    {geometry.mode === "points"
      ? geometry.points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={1.25} fill={pointPaint(point.rule)} opacity={entity.opacity} />)
      : geometry.segments.map((segment, index) => <line key={index} x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y} stroke={segmentPaint(index)} strokeWidth={1.3} opacity={entity.opacity} />)}
    <text x={geometry.bounds.x + 6} y={geometry.bounds.y - 9} fontFamily={FONT} fontSize={11} fill={fallback}>IFS · Canvas {geometry.mode === "points" ? geometry.points.length : geometry.segments.length}/{geometry.total.toLocaleString()}</text>
  </g>;
});

registerRenderer<MandelbrotEntity>("mandelbrot", (entity, frame, ctx) => {
  const geometry = mandelbrotGeometry(entity), fg = resolveColor(ctx.template, "fg"), magenta = resolveColor(ctx.template, "magenta"), cyan = resolveColor(ctx.template, "cyan");
  const color = (escape: number) => escape < 0 ? "#000" : escape < .5 ? mixColors(magenta, fg, escape * 2, ctx) : mixColors(fg, cyan, (escape - .5) * 2, ctx);
  return <g shapeRendering="crispEdges">
    {geometry.cells.map((cell, index) => <rect key={index} x={cell.x} y={cell.y} width={cell.width} height={cell.height} fill={color(cell.escape)} opacity={entity.opacity} />)}
    <text x={geometry.bounds.x + 6} y={geometry.bounds.y - 9} fontFamily={FONT} fontSize={11} fill={paintFor(entity, frame, ctx)}>MANDELBROT · {geometry.nativeCells.toLocaleString()} native cells ▶</text>
  </g>;
});

registerRenderer<PolarPathEntity>("polarpath", (entity, frame, ctx) => {
  const geometry = polarPathGeometry(entity);
  if (geometry.points.length < 2) return <FormulaFallback entity={entity} label="POLAR PATH" detail={geometry.issue ?? "formula needs native Preview"} ctx={ctx} />;
  return <g><polyline points={geometry.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={paintFor(entity, frame, ctx)} strokeWidth={entity.strokeWidth ?? 3} strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray={partialDash(frame, entity)} />
    {geometry.nativePoints > geometry.points.length && <text x={geometry.bounds.x} y={geometry.bounds.y - 9} fontFamily={FONT} fontSize={11} fill={paintFor(entity, frame, ctx)}>POLAR · Canvas {geometry.points.length}/{geometry.nativePoints.toLocaleString()}</text>}
  </g>;
});

registerRenderer<Hull2Entity>("hull2", (entity, frame, ctx) => {
  const geometry = hull2Geometry(entity, ctx.doc);
  if (geometry.points.length < 3) return <FormulaFallback entity={entity} label="POINT-CLOUD HULL" detail={geometry.issue ?? `needs ${entity.cloud}`} ctx={ctx} />;
  const paint = paintFor(entity, frame, ctx);
  return <g><polygon points={geometry.points.map((point) => `${point.x},${point.y}`).join(" ")} fill={paint} fillOpacity={.32 * entity.opacity} stroke={paint} strokeWidth={entity.strokeWidth ?? 3} strokeLinejoin="round" />
    <text x={geometry.bounds.x} y={geometry.bounds.y - 9} fontFamily={FONT} fontSize={11} fill={paint}>HULL depth {entity.depth ?? 0} · sampled from {geometry.sourcePoints}</text>
  </g>;
});

registerRenderer<RepeatEntity>("repeat", (entity, frame, ctx) => {
  const geometry = repeatGeometry(entity, geometryContext(ctx.doc));
  if (!geometry.motifBox) return <FormulaFallback entity={entity} label="REPEAT MOTIF" detail={`missing ${entity.motif}`} ctx={ctx} />;
  const motif = geometry.motifBox, center = { x: motif.x + motif.width / 2, y: motif.y + motif.height / 2 };
  const paint = paintFor(entity, frame, ctx);
  return <g>{geometry.placements.map((placement) => (
    <g key={placement.index} transform={`translate(${placement.x} ${placement.y}) rotate(${placement.rotation} ${center.x} ${center.y}) translate(${center.x} ${center.y}) scale(${entity.instanceScale}) translate(${-center.x} ${-center.y})`}>
      <rect x={motif.x} y={motif.y} width={motif.width} height={motif.height} rx={Math.min(10, motif.width / 5, motif.height / 5)} fill={paint} fillOpacity={.16} stroke={paint} strokeWidth={entity.strokeWidth ?? 2} />
      <circle cx={center.x} cy={center.y} r={Math.max(1.5, Math.min(motif.width, motif.height) * .07)} fill={paint} />
    </g>
  ))}</g>;
});

registerRenderer<TrailEntity>("trail", (entity, frame, ctx) => {
  const target = geometryContext(ctx.doc).bounds(entity.target);
  if (!target) return <text x={18} y={32} fontFamily={FONT} fontSize={14} fill={paintFor(entity, frame, ctx)}>TRAIL → {entity.target} · unresolved</text>;
  const at = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const from = { x: at.x - Math.max(70, target.width * .8), y: at.y + Math.max(18, target.height * .22) };
  const control = { x: (from.x + at.x) / 2, y: Math.min(from.y, at.y) - 28 };
  return <g>
    <path d={`M ${from.x} ${from.y} Q ${control.x} ${control.y} ${at.x} ${at.y}`} fill="none" stroke={paintFor(entity, frame, ctx)} strokeWidth={entity.thickness} strokeDasharray="9 7" opacity={.72} />
    <circle cx={at.x} cy={at.y} r={5} fill={paintFor(entity, frame, ctx)} />
    <text x={from.x} y={from.y + 24} fontFamily={FONT} fontSize={12} fill={paintFor(entity, frame, ctx)}>TRAIL · records {entity.target} in Preview</text>
  </g>;
});

registerRenderer<SweepEntity>("sweep", (entity, frame, ctx) => {
  const geometry = sweepGeometry(entity), paint = paintFor(entity, frame, ctx), panel = resolveColor(ctx.template, "panel");
  const compact = entity.cellWidth < 92 || entity.cellHeight < 70;
  return <g>
    <rect x={geometry.bounds.x} y={geometry.bounds.y} width={geometry.bounds.width} height={geometry.bounds.height} rx={8} fill="none" stroke={paint} strokeWidth={2} strokeDasharray="10 7" opacity={.8} />
    {geometry.cells.map((cell) => <g key={`${cell.row}-${cell.col}`}>
      <rect x={cell.x + 3} y={cell.y + 3} width={Math.max(1, cell.width - 6)} height={Math.max(1, cell.height - 6)} rx={5} fill={panel} fillOpacity={.16} stroke={paint} strokeWidth={1} strokeOpacity={.48} />
      {!compact && <text x={cell.x + cell.width / 2} y={cell.y + cell.height / 2 - 7} textAnchor="middle" fontFamily={FONT} fontSize={11} fill={paint}>{entity.xParam}={Math.round(cell.xValue * 100) / 100}</text>}
      {!compact && <text x={cell.x + cell.width / 2} y={cell.y + cell.height / 2 + 10} textAnchor="middle" fontFamily={FONT} fontSize={11} fill={paint}>{entity.yParam}={Math.round(cell.yValue * 100) / 100}</text>}
    </g>)}
    <text x={geometry.bounds.x + 8} y={geometry.bounds.y - 10} fontFamily={FONT} fontSize={13} fill={paint}>SWEEP · {entity.template} · {geometry.total} native cells ▶</text>
    {geometry.cells.length < geometry.total && <text x={geometry.bounds.x + geometry.bounds.width - 8} y={geometry.bounds.y - 10} textAnchor="end" fontFamily={FONT} fontSize={11} fill={paint}>Canvas samples {geometry.cells.length}</text>}
  </g>;
});

registerRenderer<LSystemEntity>("lsystem", (entity, frame, ctx) => {
  const geometry = lsystemGeometry(entity);
  if (geometry.points.length === 0) return <FormulaFallback entity={entity} label="L-SYSTEM CURVE" detail={geometry.issue ?? "grammar needs native Preview"} ctx={ctx} />;
  const paint = paintFor(entity, frame, ctx);
  const points = geometry.points.map((point) => `${point.x},${point.y}`).join(" ");
  const common = { points, stroke: paint, strokeWidth: entity.strokeWidth ?? 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, pathLength: 100, strokeDasharray: partialDash(frame, entity) };
  return entity.boundary === "filled"
    ? <polygon {...common} fill={paint} fillOpacity={.28} />
    : <polyline {...common} fill="none" />;
});

// --- 3D: honest initial-camera projection ---------------------------------

registerRenderer<Camera3Entity>("camera3", (entity) => {
  const orbit = orbitFromPoints(entity.eye, entity.target);
  return (
    <g className="mse-camera3-card">
      <rect x={18} y={18} width={204} height={52} rx={10} />
      <circle cx={45} cy={44} r={12} />
      <path d="M 35 44 L 45 35 L 55 44 L 45 53 Z" />
      <text x={66} y={39}>3D CAMERA</text>
      <text className="detail" x={66} y={57}>az {Math.round(orbit.azimuth)}° · el {Math.round(orbit.elevation)}° · r {Math.round(orbit.radius * 10) / 10}</text>
    </g>
  );
});

registerRenderer<GridEntity>("grid", (entity, frame, ctx) => {
  const left=entity.x-entity.cols*entity.cellSize/2,top=entity.y-entity.rows*entity.cellSize/2,paint=paintFor(entity,frame,ctx),cells=gridDesignCells(entity),colors={open:"panel",wall:"dim",start:"lime",goal:"gold"} as const;
  return <g>{cells.map((kind,index)=>{const row=Math.floor(index/entity.cols),col=index%entity.cols;return <rect key={`${row}-${col}`} x={left+col*entity.cellSize} y={top+row*entity.cellSize} width={entity.cellSize} height={entity.cellSize} fill={resolveColor(ctx.template,colors[kind])} fillOpacity={kind==="open"?.16:.78} stroke={paint} strokeOpacity={.42} strokeWidth={1.25}/>;})}<text x={entity.x} y={top+entity.rows*entity.cellSize+18} textAnchor="middle" fontFamily={FONT} fontSize={11} fill={resolveColor(ctx.template,"dim")}>{gridOperationSummary(entity)} · Preview owns replay/search</text></g>;
});

registerRenderer<RaceChartEntity>("racechart",(entity,frame,ctx)=>{const box=raceBox(ctx.doc),rows=raceRows(entity),periods=racePeriods(entity),values=rows.map(row=>row.values[0]??0),max=Math.max(1,...values),palette=["cyan","magenta","lime","gold","purple","orange","teal","crimson"];if(entity.layout==="line"){const left=box.x+55,right=box.x+box.width-45,top=box.y+70,bottom=box.y+box.height-55,allMax=Math.max(1,...rows.flatMap(row=>row.values));return <g><line x1={left} y1={bottom} x2={right} y2={bottom} stroke={resolveColor(ctx.template,"dim")}/><line x1={left} y1={top} x2={left} y2={bottom} stroke={resolveColor(ctx.template,"dim")}/>{rows.slice(0,12).map((row,i)=><polyline key={i} points={row.values.map((v,k)=>`${left+k*(right-left)/Math.max(1,periods.length-1)},${bottom-v/allMax*(bottom-top)}`).join(" ")} fill="none" stroke={resolveColor(ctx.template,raceChildStyle(entity,`${entity.id}.lines`).color??palette[i%palette.length])} strokeWidth={2.5}/>) }<text x={box.x+box.width/2} y={box.y+28} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={22} fill={resolveColor(ctx.template,"fg")}>{entity.title??"Race chart"}</text><text x={right} y={bottom+24} textAnchor="end" fontFamily={FONT} fontSize={12} fill={resolveColor(ctx.template,"dim")}>{periods[0]} → {periods.at(-1)}</text></g>;}const column=entity.layout==="column",area={x:box.x+120,y:box.y+70,width:box.width-180,height:box.height-130};return <g><text x={box.x+box.width/2} y={box.y+28} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={22} fill={resolveColor(ctx.template,"fg")}>{entity.title??"Race chart"}</text>{rows.slice(0,12).map((row,i)=>{const color=resolveColor(ctx.template,raceChildStyle(entity,`${entity.id}.bar${i}`).color??palette[i%palette.length]);if(column){const w=area.width/Math.max(1,rows.length)*.72,h=values[i]/max*area.height;return <g key={i}><rect x={area.x+i*area.width/rows.length+(area.width/rows.length-w)/2} y={area.y+area.height-h} width={w} height={h} rx={4} fill={color} opacity={.82}/><text x={area.x+(i+.5)*area.width/rows.length} y={area.y+area.height+18} textAnchor="middle" fontFamily={FONT} fontSize={10} fill={resolveColor(ctx.template,"fg")}>{row.label}</text></g>;}const h=area.height/Math.max(1,rows.length)*.7,y=area.y+i*area.height/rows.length,w=values[i]/max*area.width;return <g key={i}><text x={area.x-10} y={y+h/2} textAnchor="end" dominantBaseline="central" fontFamily={FONT} fontSize={12} fill={resolveColor(ctx.template,"fg")}>{row.label}</text><rect x={area.x} y={y} width={w} height={h} rx={h*.24} fill={color} opacity={.82}/><text x={area.x+w+8} y={y+h/2} dominantBaseline="central" fontFamily={FONT} fontSize={11} fill={color}>{values[i]}</text></g>;})}<text x={box.x+box.width-20} y={box.y+box.height-18} textAnchor="end" fontFamily={FONT} fontSize={12} fill={resolveColor(ctx.template,"dim")}>{periods[0]} · Preview animates {periods.length} periods</text></g>;});

registerRenderer<LiveHistogramEntity>("livehistogram",(entity,frame,ctx)=>{const left=entity.x-entity.width/2,base=entity.y+entity.height/2,bar=entity.width/entity.bins,paint=entity.nativePaint?resolveColor(ctx.template,entity.constructorColor):paintFor(entity,frame,ctx),axis=processChildStyle(entity,`${entity.id}.axis`);return <g><line x1={left} y1={base} x2={left+entity.width} y2={base} stroke={resolveColor(ctx.template,axis.color??"dim")} strokeWidth={2}/>{Array.from({length:entity.bins},(_v,i)=><rect key={i} x={left+i*bar+bar*.07} y={base-.5} width={bar*.86} height={.5} fill={processChildStyle(entity,`${entity.id}.bar${i}`).color?resolveColor(ctx.template,processChildStyle(entity,`${entity.id}.bar${i}`).color!):paint} opacity={.88}/>) }<text x={left} y={base+24} fontFamily={FONT} fontSize={14} fill={resolveColor(ctx.template,"dim")}>{entity.min}</text><text x={left+entity.width} y={base+24} textAnchor="end" fontFamily={FONT} fontSize={14} fill={resolveColor(ctx.template,"dim")}>{entity.max}</text><text x={left+entity.width} y={entity.y-entity.height/2-12} textAnchor="end" fontFamily={FONT} fontSize={12} fill={resolveColor(ctx.template,"dim")}>n = 0 · live in Preview</text></g>;});

const CHEM_ATOM_COLOR:Record<string,string>={H:"fg",C:"dim",N:"cyan",O:"crimson",F:"lime",Cl:"lime",Br:"orange",I:"purple",S:"gold",P:"orange",Na:"purple",K:"purple",Mg:"lime",Ca:"orange"};

function chemistryRenderer(entity:ChemEntity,frame:EntityFrame,ctx:RenderCtx):ReactNode{
  const color=(name:string)=>resolveColor(ctx.template,name),dim=color("dim"),fg=color("fg");
  const child=(ref:string,fallback:string)=>color(chemChildStyle(entity,ref).color??fallback);
  if(entity.kind==="balance"){
    const sides=balanceSides(entity.equation),equation=`${sides.left.join("  +  ")}   →   ${sides.right.join("  +  ")}`;
    return <g>
      <text x={entity.x} y={entity.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={entity.size} fill={paintFor(entity,frame,ctx)}>{equation}</text>
      <text x={entity.x} y={entity.y+entity.size*.9} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={dim}>exact rational coefficients arrive in Preview</text>
      {entity.limiting&&<g>{sides.left.map((name,index)=>{const y=entity.limitY+(index-(sides.left.length-1)/2)*entity.limitRow,w=entity.limitWidth*(.3+.15*(index%3));return <g key={name}><text x={entity.limitX-entity.limitWidth*.48} y={y} dominantBaseline="central" fontFamily={FONT} fontSize={entity.limitSize} fill={fg}>{name}</text><rect x={entity.limitX-entity.limitWidth*.25} y={y-entity.limitSize*.3} width={w} height={entity.limitSize*.6} rx={4} fill={index===0?color("coral"):color("cyan")} opacity={.68}/></g>;})}<text x={entity.limitX} y={entity.limitY-entity.limitRow*(sides.left.length/2+.65)} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={dim}>{entity.supplied?"supplied amounts · Preview computes limiter":"add supplied amounts in Inspector"}</text></g>}
    </g>;
  }
  if(entity.kind==="lewis"){
    const atoms=formulaAtoms(entity.formula).slice(0,12),centre=atoms[0]??"?",outer=atoms.slice(1),radius=entity.unit*.7;
    return <g>{outer.map((atom,index)=>{const angle=Math.PI*2*index/Math.max(1,outer.length)-Math.PI/2,x=entity.x+Math.cos(angle)*radius,y=entity.y+Math.sin(angle)*radius;return <g key={index}><line x1={entity.x} y1={entity.y} x2={x} y2={y} stroke={child(`${entity.id}.bonds`,"dim")} strokeWidth={3}/><text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={entity.size} fill={child(`${entity.id}.a${index+1}`,CHEM_ATOM_COLOR[atom]??"fg")}>{atom}</text><circle cx={x+entity.size*.62} cy={y-4} r={2.5} fill={child(`${entity.id}.pairs`,"cyan")}/><circle cx={x+entity.size*.78} cy={y-4} r={2.5} fill={child(`${entity.id}.pairs`,"cyan")}/></g>;})}<text x={entity.x} y={entity.y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={entity.size*1.12} fill={child(`${entity.id}.a0`,CHEM_ATOM_COLOR[centre]??"fg")}>{centre}</text><text x={entity.x} y={entity.y+entity.unit} textAnchor="middle" fontFamily={FONT} fontSize={13} fill={dim}>{entity.formula} · Preview owns formal-charge working</text></g>;
  }
  if(entity.kind==="levels"){
    const bottom=entity.y+entity.height/2,top=entity.y-entity.height/2,ground=-13.606*entity.atomicNumber**2;
    const ys=Array.from({length:entity.nmax},(_v,index)=>{const n=index+1,e=ground/n**2;return bottom-(e-ground)/(-ground)*(bottom-top);});
    return <g>{ys.map((y,index)=><g key={index}><line x1={entity.x-entity.width/2} y1={y} x2={entity.x+entity.width/2} y2={y} stroke={child(`${entity.id}.n${index+1}`,index===0?"cyan":"dim")} strokeWidth={index===0?3:2}/><text x={entity.x+entity.width/2+12} y={y} dominantBaseline="central" fontFamily={FONT} fontSize={13} fill={dim}>n={index+1} · {(ground/(index+1)**2).toFixed(2)} eV</text></g>)}<circle cx={entity.x-entity.width*.28} cy={ys[0]} r={7} fill={child(`${entity.id}.electron`,"cyan")}/><text x={entity.x} y={bottom+34} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={dim}>one-electron atom · Z={entity.atomicNumber} · transitions in Preview</text></g>;
  }
  if(entity.kind==="emission"){
    const source=ctx.doc.entities.find((candidate)=>candidate.id===entity.levels&&candidate.kind==="levels"),z=source?.kind==="levels"?source.atomicNumber:1,nmax=source?.kind==="levels"?source.nmax:6,lines:Array<{nm:number;color:string}>=[];
    for(let from=2;from<=nmax;from++)for(let to=1;to<from;to++){const nm=1239.841984/(13.606*z*z*(1/to**2-1/from**2));if(nm>=entity.fromNm&&nm<=750)lines.push({nm,color:nm>620?"crimson":nm>580?"gold":nm>500?"lime":nm>450?"cyan":"purple"});}
    const left=entity.x-entity.width/2;
    return <g><rect x={left} y={entity.y-entity.height/2} width={entity.width} height={entity.height} rx={5} fill="#03030a" stroke={dim}/>{lines.map((line,index)=>{const x=left+(line.nm-entity.fromNm)/(750-entity.fromNm)*entity.width;return <g key={index}><rect x={x-2} y={entity.y-entity.height*.43} width={4} height={entity.height*.86} fill={child(`${entity.id}.line${index}`,line.color)}/><text x={x} y={entity.y+entity.height*.7} textAnchor="middle" fontFamily={FONT} fontSize={10} fill={color(line.color)}>{Math.round(line.nm)}</text></g>;})}<text x={entity.x} y={entity.y+entity.height/2+38} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={dim}>wavelength / nm · linked to {entity.levels}</text></g>;
  }
  if(entity.kind==="cell"){
    const [leftMetal="Zn",rightMetal="Cu"]=entity.metals.split("|"),bw=entity.width*.34,bh=entity.height*.6,left=entity.x-entity.width*.28,right=entity.x+entity.width*.28,top=entity.y-entity.height*.12;
    return <g><path d={`M ${left} ${top-bh*.55} L ${left} ${entity.y-entity.height/2} L ${right} ${entity.y-entity.height/2} L ${right} ${top-bh*.55}`} fill="none" stroke={child(`${entity.id}.wire`,"fg")} strokeWidth={3}/><circle cx={entity.x} cy={entity.y-entity.height/2} r={32} fill={color("panel")} stroke={fg}/><text x={entity.x} y={entity.y-entity.height/2} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={15} fill={fg}>E°</text>{[[left,leftMetal,"crimson"],[right,rightMetal,"cyan"]].map(([x,metal,fallback],index)=><g key={index}><rect x={Number(x)-bw/2} y={top-bh/2} width={bw} height={bh} rx={8} fill={color("panel")} fillOpacity={.24} stroke={dim}/><rect x={Number(x)-10} y={top-bh*.55} width={20} height={bh*.85} fill={color(CHEM_ATOM_COLOR[String(metal)]??String(fallback))}/><text x={Number(x)} y={top+bh*.7} textAnchor="middle" fontFamily={FONT} fontSize={16} fill={fg}>{metal} · {index?"cathode":"anode"}</text></g>)}<path d={`M ${left} ${top-bh*.15} Q ${entity.x} ${top-bh*.55} ${right} ${top-bh*.15}`} fill="none" stroke={child(`${entity.id}.bridge`,"dim")} strokeWidth={10}/><text x={entity.x} y={entity.y+entity.height/2+40} textAnchor="middle" fontFamily={FONT} fontSize={13} fill={dim}>EMF, current, charge and mass are computed in Preview</text></g>;
  }
  if(entity.kind==="lattice"){
    const x0=entity.x-(entity.cols-1)*entity.unit/2,y0=entity.y-(entity.rows-1)*entity.unit/2,elements=[...new Set(formulaAtoms(entity.formula))].slice(0,2);
    return <g>{Array.from({length:entity.cols*entity.rows},(_v,index)=>{const row=Math.floor(index/entity.cols),col=index%entity.cols,element=elements[(row+col)%2]??((row+col)%2?"Cl":"Na"),r=entity.unit*((row+col)%2?.34:.24);return <g key={index}><circle cx={x0+col*entity.unit} cy={y0+row*entity.unit} r={r} fill={child(`${entity.id}.i${index}`,CHEM_ATOM_COLOR[element]??((row+col)%2?"lime":"purple"))} opacity={.88}/><text x={x0+col*entity.unit} y={y0+row*entity.unit} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={Math.max(9,entity.unit*.2)} fill={color("void")}>{element}</text></g>;})}<text x={entity.x} y={y0+(entity.rows-1)*entity.unit+entity.unit*.8} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={dim}>coordination-driven dissolution in Preview</text></g>;
  }
  if(entity.kind==="newman"){
    const r=entity.unit*.5;
    return <g><circle cx={entity.x} cy={entity.y} r={r} fill={color("panel")} fillOpacity={.2} stroke={child(`${entity.id}.circle`,"dim")} strokeWidth={3}/>{[0,1].flatMap(side=>Array.from({length:3},(_v,index)=>{const angle=-Math.PI/2+index*Math.PI*2/3+side*Math.PI/3,inner=side?r:0,outer=side?r*1.55:r;return <line key={`${side}-${index}`} x1={entity.x+Math.cos(angle)*inner} y1={entity.y+Math.sin(angle)*inner} x2={entity.x+Math.cos(angle)*outer} y2={entity.y+Math.sin(angle)*outer} stroke={child(`${entity.id}.${side?"b":"f"}${index}`,side?"magenta":"cyan")} strokeWidth={side?3:4}/>;}))}<text x={entity.x} y={entity.y+entity.unit} textAnchor="middle" fontFamily={FONT} fontSize={13} fill={dim}>rigid torsion scan · Preview owns energy</text></g>;
  }
  if(entity.kind==="profile"){
    const left=entity.x-entity.width/2,bottom=entity.y+entity.height/2,points=Array.from({length:181},(_v,index)=>{const deg=index*2,e=(1+Math.cos(deg*Math.PI/60))*.42+(1+Math.cos(deg*Math.PI/180))*.08;return `${left+entity.width*deg/360},${bottom-e*entity.height*.82}`;}).join(" ");
    return <g><line x1={left} y1={bottom} x2={left+entity.width} y2={bottom} stroke={child(`${entity.id}.axis`,"dim")} strokeWidth={2}/><polyline points={points} fill="none" stroke={child(`${entity.id}.curve`,"gold")} strokeWidth={2.5}/><circle cx={left} cy={bottom-entity.height*.84} r={7} fill={child(`${entity.id}.marker`,"cyan")}/><text x={entity.x} y={entity.y-entity.height/2-12} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={dim}>torsional-energy proxy · exact SDF scan in Preview</text></g>;
  }
  if(entity.kind==="vibration"){
    const co2=/carbon[-_ ]?dioxide|co2/iu.test(entity.source),hcl=/hcl|hydrogen[-_ ]?chloride/iu.test(entity.source),atoms=hcl?["H","Cl"]:co2?["O","C","O"]:["H","O","H"],positions=hcl?[[-.5,0],[.5,0]]:co2?[[-.75,0],[0,0],[.75,0]]:[[-.62,.35],[0,-.18],[.62,.35]];
    return <g>{positions.slice(1).map((pos,index)=><line key={index} x1={entity.x+positions[0][0]*entity.unit} y1={entity.y+positions[0][1]*entity.unit} x2={entity.x+pos[0]*entity.unit} y2={entity.y+pos[1]*entity.unit} stroke={dim} strokeWidth={5}/>) }{positions.map((pos,index)=><g key={index}><circle cx={entity.x+pos[0]*entity.unit} cy={entity.y+pos[1]*entity.unit} r={Math.max(10,entity.unit*(atoms[index]==="H"?.11:.18))} fill={color(CHEM_ATOM_COLOR[atoms[index]]??"fg")}/><text x={entity.x+pos[0]*entity.unit} y={entity.y+pos[1]*entity.unit} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={entity.labelSize} fill={color("void")}>{atoms[index]}</text></g>)}<text x={entity.x} y={entity.y+entity.unit*.92} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={dim}>normal modes computed from 3D geometry in Preview</text></g>;
  }
  if(entity.kind==="irspectrum"){
    const left=entity.x-entity.width/2,bottom=entity.y+entity.height/2,peaks=[.18,.36,.58,.76],points=Array.from({length:241},(_v,index)=>{const t=index/240;let strength=0;for(const peak of peaks){const d=(t-peak)/.022;strength+=1/(1+d*d);}return `${left+t*entity.width},${bottom-Math.min(1.15,strength*.38)*entity.height*.76}`;}).join(" ");
    return <g><line x1={left} y1={bottom} x2={left+entity.width} y2={bottom} stroke={child(`${entity.id}.axis`,"dim")} strokeWidth={2}/><polyline points={points} fill="none" stroke={child(`${entity.id}.curve`,"cyan")} strokeWidth={2.5}/><line x1={left+entity.width*.48} y1={bottom} x2={left+entity.width*.48} y2={bottom-entity.height*.7} stroke={child(`${entity.id}.silent`,"coral")} strokeDasharray="5 5" opacity={.55}/><text x={entity.x} y={bottom+26} textAnchor="middle" fontFamily={FONT} fontSize={entity.labelSize} fill={dim}>4000 ← wavenumber / cm⁻¹ → 400 · linked to {entity.molecule}</text></g>;
  }
  const center=projectPoint3(entity.center,ctx.doc),scale=Math.max(18,entity.scaleFactor*30),points=[[0,0,1],[-1,0,0],[1,0,0],[0,.9,-.35],[0,-.9,-.35]] as const,projected=points.map(([x,y,z])=>projectPoint3({x:entity.center.x+x*entity.scaleFactor,y:entity.center.y+y*entity.scaleFactor,z:entity.center.z+z*entity.scaleFactor},ctx.doc));
  return <g>{projected.slice(1).map((point,index)=><line key={index} x1={center.x} y1={center.y} x2={point.x} y2={point.y} stroke={child(`${entity.id}.b${index}`,"dim")} strokeWidth={Math.max(2,scale*.12)}/>) }{projected.map((point,index)=><circle key={index} cx={point.x} cy={point.y} r={Math.max(5,scale*(index?.22:.3))} fill={child(`${entity.id}.a${index}`,index?"fg":"cyan")} opacity={.9}/>) }<text x={center.x} y={center.y+scale*1.75} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={dim}>SDF atoms/bonds resolved in native Preview</text></g>;
}
for(const kind of ["balance","lewis","levels","emission","cell","lattice","newman","profile","vibration","irspectrum","molecule3"] as const)registerRenderer<ChemEntity>(kind,chemistryRenderer);

registerRenderer<Grid3Entity>("grid3", (entity, frame, ctx) => {
  const paint = paintFor(entity, frame, ctx);
  const lines: ReactNode[] = [];
  const spacing = Math.max(.001, entity.spacing);
  const count = Math.min(160, Math.floor(entity.half / spacing));
  for (let index = -count; index <= count; index += 1) {
    const offset = index * spacing;
    const ax = projectPoint3({ x: entity.center.x - entity.half, y: entity.center.y + offset, z: entity.center.z }, ctx.doc);
    const bx = projectPoint3({ x: entity.center.x + entity.half, y: entity.center.y + offset, z: entity.center.z }, ctx.doc);
    const ay = projectPoint3({ x: entity.center.x + offset, y: entity.center.y - entity.half, z: entity.center.z }, ctx.doc);
    const by = projectPoint3({ x: entity.center.x + offset, y: entity.center.y + entity.half, z: entity.center.z }, ctx.doc);
    lines.push(<line key={`x-${index}`} x1={ax.x} y1={ax.y} x2={bx.x} y2={bx.y} stroke={paint} strokeWidth={index === 0 ? 2.2 : 1} opacity={index === 0 ? .75 : .28} />);
    lines.push(<line key={`y-${index}`} x1={ay.x} y1={ay.y} x2={by.x} y2={by.y} stroke={paint} strokeWidth={index === 0 ? 2.2 : 1} opacity={index === 0 ? .75 : .28} />);
  }
  return <g>{lines}</g>;
});

function stroke3Renderer(kind: "line3" | "arrow3"): EntityRenderer<Stroke3Entity> {
  return (entity, frame, ctx) => {
    const from = projectPoint3(entity.from, ctx.doc), target = projectPoint3(entity.to, ctx.doc);
    const to = { x: from.x + (target.x - from.x) * frame.draw, y: from.y + (target.y - from.y) * frame.draw };
    const width = entity.thickness3 ? Math.max(1.5, entity.thickness3 * (from.scale + target.scale)) : 3.5;
    const paint = paintFor(entity, frame, ctx);
    return <g>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={paint} strokeWidth={width} strokeLinecap="round" strokeDasharray={frame.draw < 1 ? undefined : dashPattern(entity)} />
      {kind === "arrow3" && frame.draw > .02 && <polygon points={arrowHead(from.x, from.y, to.x, to.y, Math.max(10, width * 3.2))} fill={paint} />}
      <line x1={from.x} y1={from.y} x2={target.x} y2={target.y} stroke="transparent" strokeWidth={Math.max(16, width * 3)} />
    </g>;
  };
}
registerRenderer<Stroke3Entity>("line3", stroke3Renderer("line3"));
registerRenderer<Stroke3Entity>("arrow3", stroke3Renderer("arrow3"));

registerRenderer<Curve3Entity>("curve3", (entity, frame, ctx) => {
  const points = curve3ScreenPoints(entity, ctx.doc);
  const averageScale = points.length ? points.reduce((sum, point) => sum + point.scale, 0) / points.length : 1;
  const width = entity.thickness3 ? Math.max(1.5, entity.thickness3 * averageScale * 2) : 3.5;
  return <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={paintFor(entity, frame, ctx)} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray={frame.draw < 1 ? `${frame.draw * 100} 100` : dashPattern(entity)} />;
});

registerRenderer<Point3Entity>("point3", (entity, frame, ctx) => {
  const point = projectPoint3(entity.at, ctx.doc);
  return <circle cx={point.x} cy={point.y} r={Math.max(4, entity.radius * point.scale)} fill={paintFor(entity, frame, ctx)} />;
});

const BOX3_EDGES: readonly [number, number][] = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
function mesh3Lines(points: Point3[], edges: readonly [number, number][], entity: SceneEntity, frame: EntityFrame, ctx: RenderCtx, width = 2.2) {
  const projected = points.map((point) => projectPoint3(point, ctx.doc)), paint = paintFor(entity, frame, ctx);
  return <g>{edges.map(([a, b], index) => <line key={index} x1={projected[a]?.x ?? 0} y1={projected[a]?.y ?? 0} x2={projected[b]?.x ?? 0} y2={projected[b]?.y ?? 0} stroke={paint} strokeWidth={width} opacity={.78} />)}</g>;
}

function child3Appearance(entity: Axes3Entity | Frame3Entity | Cross3Entity | Assembly3Entity | Pieces3Entity | Tree3Entity, ref: string, fallback: string, frame: EntityFrame, ctx: RenderCtx) {
  const style = entity.childStyles[ref], root = entity.nativePaint === false ? paintFor(entity, frame, ctx) : resolveColor(ctx.template, fallback);
  return { paint: style?.color ? resolveColor(ctx.template, style.color) : root, opacity: (style?.opacity ?? 1) * (style?.reveal ? .22 : 1) };
}

registerRenderer<Axes3Entity>("axes3", (entity, frame, ctx) => {
  const axes = [{ axis: "x" as const, color: "cyan", delta: { x: entity.length, y: 0, z: 0 } }, { axis: "y" as const, color: "magenta", delta: { x: 0, y: entity.length, z: 0 } }, { axis: "z" as const, color: "lime", delta: { x: 0, y: 0, z: entity.length } }];
  return <g>{axes.map(({ axis, color, delta }) => {
    const ref = `${entity.id}.${axis}`, appearance = child3Appearance(entity, ref, color, frame, ctx), from = projectPoint3(entity.worldOrigin, ctx.doc), target = projectPoint3({ x: entity.worldOrigin.x + delta.x, y: entity.worldOrigin.y + delta.y, z: entity.worldOrigin.z + delta.z }, ctx.doc), to = { x: from.x + (target.x - from.x) * frame.draw, y: from.y + (target.y - from.y) * frame.draw };
    const count = entity.step > 0 ? Math.min(512, Math.floor((entity.length + 1e-3) / entity.step)) : 0;
    return <g key={axis} opacity={appearance.opacity}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={appearance.paint} strokeWidth={3} /><polygon points={arrowHead(from.x, from.y, to.x, to.y, 10)} fill={appearance.paint} />{Array.from({ length: count }, (_unused, index) => { const value = (index + 1) * entity.step, at = projectPoint3({ ...entity.worldOrigin, [axis]: entity.worldOrigin[axis] + value }, ctx.doc), tickRef = `${entity.id}.tick.${axis}.${index + 1}`, tick = child3Appearance(entity, tickRef, color, frame, ctx); return <g key={index} opacity={tick.opacity}><circle cx={at.x} cy={at.y} r={2.5} fill={tick.paint} /><text x={at.x + (axis === "z" ? 12 : 0)} y={at.y + (axis === "x" ? 16 : -8)} textAnchor="middle" fontFamily={FONT} fontSize={11} fill={tick.paint}>{Number(value.toFixed(2))}</text></g>; })}</g>;
  })}</g>;
});

registerRenderer<Frame3Entity>("frame3", (entity, frame, ctx) => {
  const half = { x: entity.size.x / 2, y: entity.size.y / 2, z: entity.size.z / 2 }, corners = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => ({ x: entity.center.x + x * half.x, y: entity.center.y + y * half.y, z: entity.center.z + z * half.z }))));
  const rootPaint = entity.nativePaint === false ? paintFor(entity, frame, ctx) : resolveColor(ctx.template, entity.mode === "spatial" ? "blue" : "dim"), projected = corners.map((point) => projectPoint3(point, ctx.doc));
  const axisColors = entity.mode === "spatial" ? ["cyan", "magenta", "lime"] : ["fg", "fg", "fg"];
  return <g>{BOX3_EDGES.map(([a, b], index) => <line key={`box-${index}`} x1={projected[a].x} y1={projected[a].y} x2={projected[b].x} y2={projected[b].y} stroke={rootPaint} strokeWidth={1} opacity={.28} />)}{(["x", "y", "z"] as const).map((axis, index) => { const lo = entity[`${axis}Min` as "xMin"], hi = entity[`${axis}Max` as "xMax"], other = (["x", "y", "z"] as const).filter((item) => item !== axis), startData = { x: 0, y: 0, z: 0 }, endData = { x: 0, y: 0, z: 0 }; startData[other[0]] = Math.max(entity[`${other[0]}Min` as "xMin"], Math.min(0, entity[`${other[0]}Max` as "xMax"])); startData[other[1]] = Math.max(entity[`${other[1]}Min` as "xMin"], Math.min(0, entity[`${other[1]}Max` as "xMax"])); Object.assign(endData, startData); startData[axis] = lo; endData[axis] = hi; const mappedA = frame3Map(entity, startData) ?? entity.center, mappedB = frame3Map(entity, endData) ?? entity.center, a = projectPoint3(mappedA, ctx.doc), b = projectPoint3(mappedB, ctx.doc), ref = `${entity.id}.axis.${axis}.line`, appearance = child3Appearance(entity, ref, axisColors[index], frame, ctx); return <g key={axis} opacity={appearance.opacity}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={appearance.paint} strokeWidth={2.2} /><text x={b.x + 10} y={b.y - 8} fill={appearance.paint} fontFamily={FONT} fontSize={15}>{axis}</text></g>; })}</g>;
});

registerRenderer<Box3Entity>("cube3", (entity, frame, ctx) => mesh3Lines(cube3WorldVertices(entity), BOX3_EDGES, entity, frame, ctx));

registerRenderer<Sphere3Entity>("sphere3", (entity, frame, ctx) => {
  const paint = paintFor(entity, frame, ctx), ring = (plane: "xy" | "xz" | "yz") => Array.from({ length: 65 }, (_unused, index) => { const angle = Math.PI * 2 * index / 64, a = Math.cos(angle) * entity.radius, b = Math.sin(angle) * entity.radius; return projectPoint3({ x: entity.center.x + (plane === "yz" ? 0 : a), y: entity.center.y + (plane === "xz" ? 0 : plane === "yz" ? a : b), z: entity.center.z + (plane === "xy" ? 0 : b) }, ctx.doc); });
  return <g>{(["xy", "xz", "yz"] as const).map((plane) => <polyline key={plane} points={ring(plane).map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={paint} strokeWidth={2} opacity={plane === "xy" ? .9 : .52} />)}</g>;
});

for (const kind of ["prism3", "pyramid3"] as const) registerRenderer<PolySolid3Entity>(kind, (entity, frame, ctx) => { const geometry = polySolid3WorldGeometry(entity); return mesh3Lines(geometry.points, geometry.edges, entity, frame, ctx); });

registerRenderer<Midpoint3Entity>("midpoint3", (entity, frame, ctx) => { const point = worldAnchor3(entity.id, geometryContext(ctx.doc)) ?? { x: 0, y: 0, z: 0 }, projected = projectPoint3(point, ctx.doc); return <circle cx={projected.x} cy={projected.y} r={Math.max(4, entity.radius * projected.scale)} fill={paintFor(entity, frame, ctx)} />; });

registerRenderer<Cross3Entity>("cross3", (entity, frame, ctx) => {
  const geometry = cross3WorldGeometry(entity), defaults = { v: "lime", w: "red", p: entity.crossColor, e1: "dim", e2: "dim" } as const;
  return <g>{(Object.keys(geometry) as (keyof typeof geometry)[]).map((key) => { const [a3, b3] = geometry[key], a = projectPoint3(a3, ctx.doc), target = projectPoint3(b3, ctx.doc), b = { x: a.x + (target.x - a.x) * frame.draw, y: a.y + (target.y - a.y) * frame.draw }, ref = `${entity.id}.${key}`, appearance = child3Appearance(entity, ref, defaults[key], frame, ctx), arrow = key === "v" || key === "w" || key === "p"; return <g key={key} opacity={appearance.opacity}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={appearance.paint} strokeWidth={arrow ? 3 : 1.6} />{arrow && <polygon points={arrowHead(a.x, a.y, b.x, b.y, 10)} fill={appearance.paint} />}</g>; })}</g>;
});

registerRenderer<Link3Entity>("link3", (entity, frame, ctx) => { const geometry = link3WorldGeometry(entity, geometryContext(ctx.doc)), from = projectPoint3(geometry.from, ctx.doc), target = projectPoint3(geometry.to, ctx.doc), to = { x: from.x + (target.x - from.x) * frame.draw, y: from.y + (target.y - from.y) * frame.draw }, width = entity.thickness3 ? Math.max(1.5, entity.thickness3 * (from.scale + target.scale)) : 2.5; return <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={paintFor(entity, frame, ctx)} strokeWidth={width} strokeLinecap="round" />; });

function proxyCubePoints(center: Point3, extent: number): Point3[] {
  const half = Math.max(.1, Math.abs(extent)) / 2;
  return [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => ({ x: center.x + x * half, y: center.y + y * half, z: center.z + z * half }))));
}

registerRenderer<Model3Entity>("model3", (entity, frame, ctx) => {
  const center = projectPoint3(entity.center, ctx.doc), name = entity.path.split("/").at(-1) ?? entity.path;
  return <g>{mesh3Lines(proxyCubePoints(entity.center, entity.scaleFactor * 2), BOX3_EDGES, entity, frame, ctx, entity.finish3?.wire ? 3 : 2)}<text x={center.x} y={center.y - 16} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={paintFor(entity, frame, ctx)}>OBJ · {name}</text></g>;
});

registerRenderer<Assembly3Entity>("assembly3", (entity, frame, ctx) => {
  const parts = entity.parts.length ? entity.parts : ["Preview parts"];
  return <g>{parts.map((part, index) => { const ref = entity.parts.length ? `${entity.id}.${part}` : entity.id, center3 = assembly3PartCenter(entity, index), center = projectPoint3(center3, ctx.doc), appearance = child3Appearance(entity, ref, "fg", frame, ctx); return <g key={part} opacity={appearance.opacity}>{mesh3Lines(proxyCubePoints(center3, entity.scaleFactor * .75), BOX3_EDGES, { ...entity, color: entity.childStyles[ref]?.color ?? entity.color }, frame, ctx, 1.8)}<text x={center.x} y={center.y - 10} textAnchor="middle" fontFamily={FONT} fontSize={11} fill={appearance.paint}>{part}</text></g>; })}</g>;
});

registerRenderer<Extrude3Entity>("extrude3", (entity, frame, ctx) => mesh3Lines(extrude3WorldVertices(entity, geometryContext(ctx.doc)), BOX3_EDGES, entity, frame, ctx, entity.finish3?.wire ? 3 : 2.2));

registerRenderer<Revolve3Entity>("revolve3", (entity, frame, ctx) => {
  const geometry = revolve3WorldGeometry(entity, 24);
  if (geometry.points.length === 0) { const at = projectPoint3(entity.center, ctx.doc); return <text x={at.x} y={at.y} textAnchor="middle" fontFamily={FONT} fontSize={13} fill={paintFor(entity, frame, ctx)}>REVOLVE · Preview evaluates {entity.profile}</text>; }
  return mesh3Lines(geometry.points, geometry.edges, entity, frame, ctx, entity.finish3?.wire ? 2.6 : 1.15);
});

registerRenderer<Tube3Entity>("tube3", (entity, frame, ctx) => {
  const points = path3WorldPoints(entity.path, geometryContext(ctx.doc)).map((point) => projectPoint3(point, ctx.doc));
  const averageScale = points.length ? points.reduce((sum, point) => sum + point.scale, 0) / points.length : 1;
  return <g><polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={paintFor(entity, frame, ctx)} strokeWidth={Math.max(5, averageScale * .12)} strokeLinecap="round" strokeLinejoin="round" opacity={.72} /><polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={resolveColor(ctx.template, "fg")} strokeWidth={1} strokeDasharray="7 6" opacity={.42} /></g>;
});

registerRenderer<Project3Entity>("project3", (entity, frame, ctx) => {
  const context = geometryContext(ctx.doc), source3 = worldAnchor3(entity.source, context), projected3 = project3WorldPoint(entity, context);
  if (!projected3) return null;
  const point = projectPoint3(projected3, ctx.doc), source = source3 ? projectPoint3(source3, ctx.doc) : null, paint = paintFor(entity, frame, ctx);
  return <g>{source && <line x1={source.x} y1={source.y} x2={point.x} y2={point.y} stroke={paint} strokeWidth={1.5} strokeDasharray="6 5" opacity={.45} />}<circle cx={point.x} cy={point.y} r={Math.max(4, entity.radius * point.scale)} fill={paint} /></g>;
});

registerRenderer<ProjectPath3Entity>("projectpath3", (entity, frame, ctx) => {
  const points = path3WorldPoints(entity.id, geometryContext(ctx.doc)).map((point) => projectPoint3(point, ctx.doc));
  const averageScale = points.length ? points.reduce((sum, point) => sum + point.scale, 0) / points.length : 1, width = entity.thickness3 ? Math.max(1.5, entity.thickness3 * averageScale * 2) : 3;
  return <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={paintFor(entity, frame, ctx)} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray={frame.draw < 1 ? `${frame.draw * 100} 100` : undefined} />;
});

registerRenderer<Surface3Entity>("surface3", (entity, frame, ctx) => { const mesh=surface3Grid(entity); return mesh3Lines(mesh.points,mesh.edges,entity,frame,ctx,1.05); });
registerRenderer<ParamSurface3Entity>("param3", (entity, frame, ctx) => { const mesh=param3Grid(entity); return mesh3Lines(mesh.points,mesh.edges,entity,frame,ctx,1.05); });

registerRenderer<DomainSurface3Entity>("domainsurface", (entity, frame, ctx) => { const center={x:(entity.x0+entity.x1)/2,y:(entity.y0+entity.y1)/2,z:entity.height/2},at=projectPoint3(center,ctx.doc); return <g>{mesh3Lines(proxyCubePoints(center,Math.max(Math.abs(entity.x1-entity.x0),Math.abs(entity.y1-entity.y0),Math.abs(entity.height))),BOX3_EDGES,entity,frame,ctx,1.4)}<text x={at.x} y={at.y-12} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={paintFor(entity,frame,ctx)}>complex phase · Preview</text></g>; });
registerRenderer<Implicit3Entity>("implicit3", (entity, frame, ctx) => { const points=[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>({x:x<0?entity.x0:entity.x1,y:y<0?entity.y0:entity.y1,z:z<0?entity.z0:entity.z1})))); const at=projectPoint3({x:(entity.x0+entity.x1)/2,y:(entity.y0+entity.y1)/2,z:(entity.z0+entity.z1)/2},ctx.doc); return <g>{mesh3Lines(points,BOX3_EDGES,entity,frame,ctx,1.6)}<text x={at.x} y={at.y} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={paintFor(entity,frame,ctx)}>iso {entity.level} · Preview mesh</text></g>; });
registerRenderer<Heightmap3Entity>("heightmap3", (entity, frame, ctx) => { const center={x:0,y:0,z:.5},at=projectPoint3(center,ctx.doc); return <g>{mesh3Lines(proxyCubePoints(center,entity.size),BOX3_EDGES,entity,frame,ctx,1.25)}<text x={at.x} y={at.y} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={paintFor(entity,frame,ctx)}>grid {entity.grid} → height</text></g>; });

function path3Polyline(points3:Point3[],entity:SceneEntity,frame:EntityFrame,ctx:RenderCtx,width=3){const points=points3.map(point=>projectPoint3(point,ctx.doc));return <polyline points={points.map(point=>`${point.x},${point.y}`).join(" ")} fill="none" stroke={paintFor(entity,frame,ctx)} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray={frame.draw<1?`${frame.draw*100} 100`:undefined}/>;}
registerRenderer<SurfaceDependent3Entity>("contour3",(entity,frame,ctx)=>{const points=surfaceDependent3Points(entity,geometryContext(ctx.doc)),paint=paintFor(entity,frame,ctx);return <g>{Array.from({length:Math.floor(points.length/2)},(_u,index)=>{const a=projectPoint3(points[index*2],ctx.doc),b=projectPoint3(points[index*2+1],ctx.doc);return <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={paint} strokeWidth={2.5}/>;})}</g>;});
registerRenderer<SurfaceDependent3Entity>("gradient3",(entity,frame,ctx)=>{const points=surfaceDependent3Points(entity,geometryContext(ctx.doc));if(points.length<2)return null;const a=projectPoint3(points[0],ctx.doc),b=projectPoint3(points[1],ctx.doc),paint=paintFor(entity,frame,ctx);return <g><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={paint} strokeWidth={3}/><polygon points={arrowHead(a.x,a.y,b.x,b.y,10)} fill={paint}/></g>;});
registerRenderer<SurfaceDependent3Entity>("tangentplane3",(entity,frame,ctx)=>mesh3Lines(surfaceDependent3Points(entity,geometryContext(ctx.doc)),[[0,1],[0,2],[1,3],[2,3]],entity,frame,ctx,2));
registerRenderer<SurfaceDependent3Entity>("volume3",(entity,frame,ctx)=>{const points=surfaceDependent3Points(entity,geometryContext(ctx.doc)),at=points[Math.floor(points.length/2)]??{x:0,y:0,z:0},p=projectPoint3(at,ctx.doc);return <g opacity={.7}>{path3Polyline(points,entity,frame,ctx,1)}<text x={p.x} y={p.y} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={paintFor(entity,frame,ctx)}>{entity.resolution}×{entity.resolution} columns · Preview</text></g>;});
registerRenderer<SurfaceDependent3Entity>("descend3",(entity,frame,ctx)=>{const points=surfaceDependent3Points(entity,geometryContext(ctx.doc)),start=projectPoint3(points[0]??{x:0,y:0,z:0},ctx.doc);return <g>{path3Polyline(points,entity,frame,ctx,3)}<circle cx={start.x} cy={start.y} r={7} fill={paintFor(entity,frame,ctx)}/></g>;});
registerRenderer<Slice3Entity>("slice3",(entity,frame,ctx)=>path3Polyline(slice3WorldPoints(entity,geometryContext(ctx.doc)),entity,frame,ctx,3));

registerRenderer<VectorField3Entity>("vectorfield3",(entity,frame,ctx)=>{const paint=paintFor(entity,frame,ctx);return <g opacity={.7}>{vectorField3Segments(entity).map(([from,to],index)=>{const a=projectPoint3(from,ctx.doc),b=projectPoint3(to,ctx.doc);return <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={paint} strokeWidth={1.2}/>;})}</g>;});
registerRenderer<Trajectory3Entity>("trajectory3",(entity,frame,ctx)=>path3Polyline(trajectory3WorldPoints(entity),entity,frame,ctx,2.2));
registerRenderer<MatrixMap3Entity>("linmap3",(entity,frame,ctx)=>{const mesh=linmap3WorldGeometry(entity);return mesh3Lines(mesh.points,mesh.edges,entity,frame,ctx,2);});
registerRenderer<MatrixMap3Entity>("eigen3",(entity,frame,ctx)=>{const paint=paintFor(entity,frame,ctx),at=projectPoint3(entity.center,ctx.doc),axes=[{x:2.5,y:0,z:0},{x:0,y:2.5,z:0},{x:0,y:0,z:2.5}];return <g>{axes.map((delta,index)=>{const a=projectPoint3({x:entity.center.x-delta.x,y:entity.center.y-delta.y,z:entity.center.z-delta.z},ctx.doc),b=projectPoint3({x:entity.center.x+delta.x,y:entity.center.y+delta.y,z:entity.center.z+delta.z},ctx.doc);return <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={paint} strokeWidth={2} strokeDasharray="6 5" opacity={.55}/>;})}<text x={at.x} y={at.y+18} textAnchor="middle" fontFamily={FONT} fontSize={12} fill={paint}>Preview solves real λ axes</text></g>;});

function collectionRenderer(kind: Collection3Entity["kind"]): EntityRenderer<Collection3Entity> {
  return (entity, frame, ctx) => {
    const points = collection3Points(entity), paint = paintFor(entity, frame, ctx);
    return <g>{points.map((point, index) => { const projected = projectPoint3(point, ctx.doc); return <circle key={index} cx={projected.x} cy={projected.y} r={Math.max(1.5, Math.min(8, entity.radius * projected.scale))} fill={paint} opacity={Math.min(.9, entity.opacity * .72)} />; })}{entity.count > points.length && <text x={projectPoint3(entity.center, ctx.doc).x} y={projectPoint3(entity.center, ctx.doc).y - 18} textAnchor="middle" fontFamily={FONT} fontSize={11} fill={paint}>Canvas samples {points.length}/{entity.count.toLocaleString()} points</text>}</g>;
  };
}
registerRenderer<Collection3Entity>("collection3", collectionRenderer("collection3"));
registerRenderer<Collection3Entity>("collection3data", collectionRenderer("collection3data"));

registerRenderer<CollectionChild3Entity>("child3", (entity, frame, ctx) => {
  const world = collectionChild3Point(entity, geometryContext(ctx.doc)); if (!world) return null;
  const point = projectPoint3(world, ctx.doc), paint = paintFor(entity, frame, ctx);
  return <g><circle cx={point.x} cy={point.y} r={Math.max(4, entity.radius * point.scale)} fill={paint} /><text x={point.x + 10} y={point.y - 8} fontFamily={FONT} fontSize={11} fill={paint}>#{entity.index}</text></g>;
});

function collectionLinksRenderer(kind: CollectionLinks3Entity["kind"]): EntityRenderer<CollectionLinks3Entity> {
  return (entity, frame, ctx) => { const geometry = collectionLinks3Geometry(entity, geometryContext(ctx.doc)); return mesh3Lines(geometry.points, geometry.edges, entity, frame, ctx, 1.4); };
}
registerRenderer<CollectionLinks3Entity>("links3", collectionLinksRenderer("links3"));
registerRenderer<CollectionLinks3Entity>("links3data", collectionLinksRenderer("links3data"));

registerRenderer<Pieces3Entity>("pieces3", (entity, frame, ctx) => {
  const quads = pieces3Quads(entity, geometryContext(ctx.doc)), source = ctx.doc.entities.find((candidate) => candidate.id === entity.source), sourcePaint = source ? paintFor(source, frame, ctx) : paintFor(entity, frame, ctx);
  return <g>{quads.map((quad, index) => { const row = Math.floor(index / entity.cols), col = index % entity.cols, ref = `${entity.id}.r${row}c${col}`, style = entity.childStyles[ref], appearance = { paint: style?.color ? resolveColor(ctx.template, style.color) : sourcePaint, opacity: (style?.opacity ?? 1) * (style?.reveal ? .22 : 1) }, projected = quad.map((point) => projectPoint3(point, ctx.doc)); return <polygon key={ref} points={[projected[0], projected[1], projected[3], projected[2]].map((point) => `${point.x},${point.y}`).join(" ")} fill={appearance.paint} fillOpacity={.12 * appearance.opacity} stroke={appearance.paint} strokeOpacity={.72 * appearance.opacity} strokeWidth={1} />; })}</g>;
});

function collectionPathRenderer(kind: CollectionPath3Entity["kind"]): EntityRenderer<CollectionPath3Entity> {
  return (entity, frame, ctx) => { const points = collectionPath3Points(entity, geometryContext(ctx.doc)), paint = paintFor(entity, frame, ctx), content = path3Polyline(points, entity, frame, ctx, kind === "trail3" ? 3 : 2.2), anchor = points.at(-1) ? projectPoint3(points.at(-1)!, ctx.doc) : null; return <g>{content}{kind === "trail3" && anchor && <><circle cx={anchor.x} cy={anchor.y} r={5} fill={paint} /><text x={anchor.x + 10} y={anchor.y - 9} fontFamily={FONT} fontSize={11} fill={paint}>live trail in Preview</text></>}</g>; };
}
registerRenderer<CollectionPath3Entity>("ring3", collectionPathRenderer("ring3"));
registerRenderer<CollectionPath3Entity>("trail3", collectionPathRenderer("trail3"));

function historyWave(width: number, height: number, x: number, y: number): string { return Array.from({ length: 25 }, (_unused, index) => { const t = index / 24; return `${x - width / 2 + t * width},${y + Math.sin(t * Math.PI * 3) * height * .18}`; }).join(" "); }
registerRenderer<HistoryPlotEntity>("historyplot", (entity, frame, ctx) => { const paint = paintFor(entity, frame, ctx), panel = resolveColor(ctx.template, "panel"); return <g><rect x={entity.x - entity.width / 2} y={entity.y - entity.height / 2} width={entity.width} height={entity.height} rx={8} fill={panel} fillOpacity={.24} stroke={paint} strokeWidth={1.5} strokeDasharray="7 5" /><line x1={entity.x - entity.width / 2 + 10} y1={entity.y} x2={entity.x + entity.width / 2 - 10} y2={entity.y} stroke={paint} opacity={.28} /><polyline points={historyWave(entity.width - 20, entity.height, entity.x, entity.y)} fill="none" stroke={paint} strokeWidth={2.2} opacity={.7} /><text x={entity.x} y={entity.y - entity.height / 2 + 18} textAnchor="middle" fontFamily={FONT} fontSize={11} fill={paint}>{entity.collection}[{entity.child}].{entity.component} · live Preview history</text></g>; });

registerRenderer<HistoryPlot3Entity>("historyplot3", (entity, frame, ctx) => { const paint = paintFor(entity, frame, ctx), a = projectPoint3(entity.origin3, ctx.doc), b = projectPoint3({ x: entity.origin3.x + entity.width, y: entity.origin3.y, z: entity.origin3.z }, ctx.doc), c = projectPoint3({ x: entity.origin3.x, y: entity.origin3.y, z: entity.origin3.z + entity.height }, ctx.doc), d = projectPoint3({ x: entity.origin3.x + entity.width, y: entity.origin3.y, z: entity.origin3.z + entity.height }, ctx.doc); return <g><polygon points={[a,b,d,c].map((point) => `${point.x},${point.y}`).join(" ")} fill={paint} fillOpacity={.08} stroke={paint} strokeWidth={1.5} strokeDasharray="7 5" /><text x={(a.x+d.x)/2} y={(a.y+d.y)/2} textAnchor="middle" fontFamily={FONT} fontSize={11} fill={paint}>{entity.collection}[{entity.child}].{entity.component} · Preview history</text></g>; });

registerRenderer<RandomWalk3Entity>("randomwalk3", (entity, frame, ctx) => path3Polyline(randomWalk3Points(entity), entity, frame, ctx, 1.8));
registerRenderer<LSystem3Entity>("lsystem3", (entity, frame, ctx) => { const geometry = lsystem3Geometry(entity); return mesh3Lines(geometry.points, geometry.edges, entity, frame, ctx, 1.5); });
registerRenderer<Tree3Entity>("tree3", (entity, frame, ctx) => { const geometry = tree3Geometry(entity), palette = ["gold", "cyan", "magenta", "lime"]; return <g>{geometry.layers.map((layer, index) => { const ref = `${entity.id}.d${index}`, appearance = child3Appearance(entity, ref, palette[index % palette.length], frame, ctx), projected = layer.points.map((point) => projectPoint3(point, ctx.doc)); return <g key={ref} opacity={appearance.opacity}>{layer.edges.map(([a,b], edge) => <line key={edge} x1={projected[a].x} y1={projected[a].y} x2={projected[b].x} y2={projected[b].y} stroke={appearance.paint} strokeWidth={Math.max(1, 4-index*.42)} strokeLinecap="round" />)}</g>; })}{(() => { const appearance = child3Appearance(entity, `${entity.id}.leaves`, "lime", frame, ctx); return geometry.leaves.map((leaf, index) => { const point = projectPoint3(leaf, ctx.doc); return <circle key={index} cx={point.x} cy={point.y} r={3.5} fill={appearance.paint} opacity={appearance.opacity} />; }); })()}</g>; });
registerRenderer<Hilbert3Entity>("hilbert3", (entity, frame, ctx) => path3Polyline(hilbert3Points(entity), entity, frame, ctx, 1.7));

registerRenderer<WatermarkEntity>("watermark", (entity, frame, ctx) => (
  <text x={entity.x} y={entity.y} textAnchor="middle" dominantBaseline="central" fontSize={entity.size} fill={paintFor(entity, frame, ctx)} fontFamily={FONT} opacity={.72}>{entity.text}</text>
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

registerRenderer<LinkEntity>("link", (entity, frame, ctx) => {
  const { from, to, ctrl } = linkGeometry(entity, geometryContext(ctx.doc));
  const path = entity.bend ? `M ${from.x} ${from.y} Q ${ctrl.x} ${ctrl.y} ${to.x} ${to.y}` : `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  return <path d={path} fill="none" stroke={paintFor(entity, frame, ctx)} strokeWidth={entity.strokeWidth ?? 3} strokeLinecap="round" strokeDasharray={dashPattern(entity)} />;
});

function braceRenderer(entity: BraceEntity | BraceLabelEntity, frame: EntityFrame, ctx: RenderCtx) {
  const geometry = bracePoints(entity.x1, entity.y1, entity.x2, entity.y2, entity.depth, entity.kind === "brace" ? entity.direction : null);
  const paint = paintFor(entity, frame, ctx);
  return (
    <g>
      <path d={geometry.path} fill="none" stroke={paint} strokeWidth={entity.strokeWidth ?? 3} strokeLinecap="round" strokeLinejoin="round" />
      {entity.kind !== "brace" && (() => {
        const at = { x: geometry.tip.x + geometry.normal.x * 24, y: geometry.tip.y + geometry.normal.y * 24 };
        return <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" fontSize={entity.size} fill={paint} fontFamily={FONT}>{entity.text}</text>;
      })()}
    </g>
  );
}

registerRenderer<BraceEntity>("brace", braceRenderer);
registerRenderer<BraceLabelEntity>("bracelabel", braceRenderer);
registerRenderer<BraceLabelEntity>("bracetext", braceRenderer);

function arrowHead(x1: number, y1: number, x2: number, y2: number, length: number): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const spread = 0.44;
  const ax = x2 - length * Math.cos(angle - spread);
  const ay = y2 - length * Math.sin(angle - spread);
  const bx = x2 - length * Math.cos(angle + spread);
  const by = y2 - length * Math.sin(angle + spread);
  return `${x2},${y2} ${ax},${ay} ${bx},${by}`;
}

function particlePoints(entity: ParticlesEntity, doc: SceneDoc): { x: number; y: number }[] {
  const container = doc.entities.find((candidate) => candidate.id === entity.container);
  if (!container || (container.kind !== "circle" && container.kind !== "rect")) return [];
  const count = Math.max(1, Math.min(500, Math.round(entity.count)));
  const rotate = (x: number, y: number) => {
    const radians = container.rotation * Math.PI / 180;
    return { x: x * Math.cos(radians) - y * Math.sin(radians), y: x * Math.sin(radians) + y * Math.cos(radians) };
  };
  if (entity.layout === "ring" && container.kind === "circle") {
    const orbit = Math.max(0, container.r - entity.radius);
    return Array.from({ length: count }, (_unused, index) => {
      const angle = -Math.PI / 2 + Math.PI * 2 * index / count;
      return { x: container.x + Math.cos(angle) * orbit, y: container.y + Math.sin(angle) * orbit };
    });
  }
  if (entity.layout === "grid" && container.kind === "rect") {
    const width = Math.max(0, container.width - entity.radius * 2), height = Math.max(0, container.height - entity.radius * 2);
    const aspect = Math.max(0.01, width / Math.max(1, height));
    const cols = Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * aspect))));
    const rows = Math.ceil(count / cols), stepX = cols > 1 ? width / (cols - 1) : 0, stepY = rows > 1 ? height / (rows - 1) : 0;
    const points: { x: number; y: number }[] = [];
    for (let row = 0; row < rows; row += 1) {
      const rowCount = Math.min(cols, count - row * cols);
      for (let col = 0; col < rowCount; col += 1) {
        const local = rotate(-(rowCount - 1) * stepX / 2 + col * stepX, rows > 1 ? -height / 2 + row * stepY : 0);
        points.push({ x: container.x + local.x, y: container.y + local.y });
      }
    }
    return points;
  }
  const random = tinyRandom(entity.seed);
  return Array.from({ length: count }, () => {
    if (container.kind === "circle") {
      const angle = Math.PI * 2 * random(), distance = Math.max(0, container.r - entity.radius) * Math.sqrt(random());
      return { x: container.x + Math.cos(angle) * distance, y: container.y + Math.sin(angle) * distance };
    }
    const local = rotate((random() * 2 - 1) * Math.max(0, container.width / 2 - entity.radius), (random() * 2 - 1) * Math.max(0, container.height / 2 - entity.radius));
    return { x: container.x + local.x, y: container.y + local.y };
  });
}

function tinyRandom(seed: number): () => number {
  const mask = (1n << 64n) - 1n;
  let state = BigInt(Math.max(1, Math.round(seed))) & mask;
  return () => {
    let x = state;
    x ^= x >> 12n; x ^= (x << 25n) & mask; x ^= x >> 27n;
    state = x & mask;
    const value = (state * 0x2545_f491_4f6c_dd1dn) & mask;
    return Number(value >> 40n) / 2 ** 24;
  };
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
