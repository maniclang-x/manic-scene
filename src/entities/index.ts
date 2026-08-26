// Importing this module registers every built-in entity definition.
import "./text.js";
import "./caption.js";
import "./equation.js";
import "./shapes.js";
import "./assets.js";
import "./polygon.js";
import "./counter.js";
import "./live.js";
import "./publishing.js";
import "./quiz.js";
import "./strokes.js";
import "./dependent.js";
import "./core.js";
import "./topology.js";
import "./generative.js";
import "./generative-next.js";
import "./patterns.js";
import "./effects.js";
import "./core-controls.js";
import "./geometry.js";
import "./coordinate-regions.js";
import "./linear-algebra.js";
import "./math-fields.js";
import "./math-data.js";
import "./stats.js";
import "./ml.js";
import "./optics.js";
import "./physics.js";
import "./systems.js";
import "./circuit.js";
import "./race.js";
import "./process.js";
import "./chem.js";
import "./algo.js";
import "./calculus.js";
import "./calculus-next.js";
import "./three.js";

export { layoutTextLines, textBounds, textWrapWidth } from "./text.js";
export { captionWords } from "./caption.js";
export { equationBounds } from "./equation.js";
export { imageSize, svgSize } from "./assets.js";
export { counterText } from "./counter.js";
export { creatorEndcardBox, creatorFooterBox, creatorHasFooter, publishingSafeBox } from "./publishing.js";
export { defaultTimerStyle, effectiveQuizTiming, parseTimerStyle, quizOptionBoxes, quizRegions, timerStyleSpec, timingPreset, workflowDuration } from "./quiz.js";
export { bracePoints, linkGeometry, mathPartBoxes } from "./dependent.js";
export { derivedPathPoints, supportGeometry, CANVAS_DERIVED_PATH_SAMPLE_CAP } from "./core.js";
export {
  booleanGeometry, booleanOperation, dualGeometry, regionsGeometry, spanTreeGeometry,
  topologyFaces, topologyRings, topologySegments, TOPOLOGY_CANVAS_FACE_CAP,
  TOPOLOGY_CANVAS_SEGMENT_CAP,
} from "./topology.js";
export { cloud3Samples, cloudSamples, glslUniformNames, glslUniforms, shaderSamples, GENERATIVE_SAMPLE_CAP } from "./generative.js";
export type { GlslUniform, GlslUniformBinding } from "./generative.js";
export { hull2Geometry, ifs2Geometry, mandelbrotGeometry, polarPathGeometry, IFS2_CANVAS_POINT_CAP, IFS2_CANVAS_SEGMENT_CAP, MANDELBROT_CANVAS_COLUMN_CAP, MANDELBROT_CANVAS_ROW_CAP, POLARPATH_CANVAS_POINT_CAP } from "./generative-next.js";
export { lsystemGeometry, repeatGeometry, LSYSTEM_CANVAS_POINT_CAP, REPEAT_CANVAS_INSTANCE_CAP } from "./patterns.js";
export { sweepGeometry, SWEEP_CANVAS_CELL_CAP } from "./effects.js";
export { loupeBoxes, sliderX, slidersBox } from "./core-controls.js";
export {
  angleMarkGeometry, axisTickGeometry, circle2Geometry, coordsAxisValues,
  circleTangentPoints, commonTangentGeometry, fullLineGeometry, geoCircleGeometry, geoDerivedPoint,
  geoIntersectionPoints, geoPointField, geoPointReferences, geometryPoint, hyperbolaBranches, midpointGeometry,
  parabolaPoints, rightAnglePoints, segmentGeometry,
} from "./geometry.js";
export {
  arcGeometry, numberLineValues, planeGrid, planeUnit, polarPlaneCounts,
  COORDINATE_CHILD_CAP,
} from "./coordinate-regions.js";
export {
  determinantGeometry, diagonaliseGeometry, eigenGeometry, eigenPairs,
  fmtMatrixValue, identityGrid, linearSolveGeometry, mappedGrid, matrixGrid,
  matrixLayout, numericMatrix, projectionGeometry, rrefStates, spanGeometry,
  squishGeometry,
} from "./linear-algebra.js";
export {
  domainColorSamples, scalarFieldCard, vectorFieldShape, warpLines,
} from "./math-fields.js";
export {
  leastSquaresGeometry, tableGrid, tableLayout, tableReferences,
} from "./math-data.js";
export { statsGeometry, STATS_CANVAS_POINT_CAP, STATS_CANVAS_TRIAL_CAP } from "./stats.js";
export type { StatsGeometry, StatsPrimitive } from "./stats.js";
export { mlLayers, mlOutputShape, mlTensorGrid, mlTokens, ML_CANVAS_UNIT_CAP } from "./ml.js";
export type { MlTensorGrid } from "./ml.js";
export { opticsGeometry } from "./optics.js";
export type { OpticsGeometry, OpticsPrimitive } from "./optics.js";
export { physicsGeometry, PHYSICS_KINDS } from "./physics.js";
export type { PhysicsGeometry, PhysicsPrimitive } from "./physics.js";
export { systemChildStyle, systemConnectionGeometry, systemDiagramFor, systemItemBox, SYSTEM_DIAGRAM_KINDS, SYSTEM_ENTITY_KINDS } from "./systems.js";
export type { SystemConnectionGeometry } from "./systems.js";
export { circuitChildStyle, circuitGeometry, circuitPartAnchor, circuitParts, circuitScreenPoint } from "./circuit.js";
export type { CircuitGeometry, CircuitPart } from "./circuit.js";
export { gridDesignCells, gridOperationSummary } from "./grid-kit.js";
export { raceBox, raceChildStyle, racePeriods, raceRows } from "./race.js";
export type { RaceRow } from "./race.js";
export { processChildStyle } from "./process.js";
export { balanceSides, chemChildStyle, chemReferences, formulaAtoms } from "./chem.js";
export {
  algoHash, algoValues, arrayLayout, caretShape, graphAlgorithmPlan, graphGeometry, graphStartVertices, graphVertices,
  hashmapLayout, hashmapLookupPlan, listLayout, pointerPosition,
  ALGO_POINTER_FIELD_WIDTH,
} from "./algo.js";
export {
  areaPoints, bandGeometry, calculusMarkPoints, graphEntityBounds, graphPoint, graphSamples,
  integralValue, limitGeometry, slopeGeometry, tangentGeometry, tangentPointGeometry,
} from "./calculus.js";
export {
  boxToPoints, curveDotPoint, graphLabelPosition, newtonPoints, normalGeometry,
  parametricCurvePoints, riemannBars, rootsPoints, slopeTriangleGeometry,
  splinePoints, taylorPoints, trajectoryPoints, verticalLineGeometry,
} from "./calculus-next.js";
export {
  collection3Points, collectionChild3Point, collectionLinks3Geometry, collectionPath3Points,
  hilbert3Points, lsystem3Geometry, pieces3Quads, randomWalk3Points, tree3Geometry,
  linmap3WorldGeometry, param3Grid, param3Value, slice3WorldPoints, surface3Grid,
  surface3Value, surfaceDependent3Points, trajectory3WorldPoints, vectorField3Segments,
} from "./three.js";
export { assembly3PartCenter, cross3WorldGeometry, cube3WorldVertices, curve3ScreenPoints, curve3WorldPoints, DEFAULT_FINISH3, extrude3WorldVertices, finish3SpecText, frame3Map, link3WorldGeometry, parseFinish3Spec, path3WorldPoints, polySolid3WorldGeometry, project3WorldPoint, projectPoint3, revolve3WorldGeometry, threePointReferences, worldAnchor3 } from "./three.js";
