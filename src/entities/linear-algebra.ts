// Linear-algebra diagrams. Native constructors expand to tagged child families;
// this module keeps their algebra, editable parameters, and child identities in
// one logical Canvas entity.

import { argName, argNumber, argPoint, argString, escapeString, num, pt } from "../args.js";
import { registerEntity, type Box, type FieldSpec } from "../registry.js";
import type {
  DeterminantEntity, DiagonaliseEntity, EigenEntity, GridMapEntity, LinearMapEntity,
  LinearSolveEntity, MatrixEntity, Point, ProjectionEntity, RrefEntity, SpanEntity, SquishEntity,
} from "../types.js";
import { baseEntity } from "./base.js";

export interface Segment2 { from: Point; to: Point; }
export interface MatrixGrid { rows: string[][]; issue: string | null; }
export interface NumericMatrix { rows: number[][]; issue: string | null; }
export interface RrefState { rows: number[][]; operation: string; }
export interface EigenPair { value: number; vector: Point; }

const round = (value: number, places = 6) => Math.round(value * 10 ** places) / 10 ** places;
const effectiveSpan = (value: number | null) => Math.max(1, Math.min(10, Math.trunc(value ?? 4)));
const screen = (x: number, y: number, unit: number, p: Point): Point => ({ x: x + p.x * unit, y: y - p.y * unit });
const mapPoint = (a: number, b: number, c: number, d: number, p: Point): Point => ({ x: a * p.x + b * p.y, y: c * p.x + d * p.y });
const add = (p: Point, q: Point): Point => ({ x: p.x + q.x, y: p.y + q.y });
const scale = (p: Point, amount: number): Point => ({ x: p.x * amount, y: p.y * amount });
const length = (p: Point) => Math.hypot(p.x, p.y);
const normalized = (p: Point): Point => length(p) < 1e-9 ? { x: 1, y: 0 } : scale(p, 1 / length(p));

function boxOf(points: Point[], padding = 12): Box {
  if (!points.length) return { x: 0, y: 0, width: 1, height: 1 };
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y), left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  return { x: left - padding, y: top - padding, width: Math.max(1, right - left + padding * 2), height: Math.max(1, bottom - top + padding * 2) };
}

export function matrixGrid(source: string): MatrixGrid {
  const rows = source.split(";").map((row) => row.split(/[\s,]+/u).filter(Boolean)).filter((row) => row.length > 0);
  if (!rows.length) return { rows, issue: "Matrix has no entries." };
  const columns = rows[0].length;
  return { rows, issue: rows.some((row) => row.length !== columns) ? "Every matrix row must contain the same number of entries." : null };
}

export function numericMatrix(source: string): NumericMatrix {
  const parsed = matrixGrid(source);
  if (parsed.issue) return { rows: [], issue: parsed.issue };
  const rows = parsed.rows.map((row) => row.map(Number));
  return rows.some((row) => row.some((value) => !Number.isFinite(value))) ? { rows: [], issue: "RREF entries must be numbers." } : { rows, issue: null };
}

export function matrixLayout(entity: MatrixEntity | RrefEntity, rowCount: number, columnCount: number) {
  const cellWidth = entity.cellWidth ?? (entity.kind === "matrix" ? 88 : 96);
  const cellHeight = entity.kind === "matrix" ? entity.cellHeight ?? 70 : entity.rowHeight ?? 64;
  const totalWidth = Math.max(0, columnCount - 1) * cellWidth, totalHeight = Math.max(0, rowCount - 1) * cellHeight;
  const x0 = entity.x - totalWidth / 2, y0 = entity.y - totalHeight / 2;
  const pad = cellHeight * .45, margin = cellWidth * .5, serif = 14;
  return { cellWidth, cellHeight, x0, y0, totalWidth, totalHeight, top: y0 - pad, bottom: y0 + totalHeight + pad, left: x0 - margin, right: x0 + totalWidth + margin, serif };
}

export function fmtMatrixValue(value: number): string {
  const snapped = Math.round(value * 100) / 100;
  if (Math.abs(snapped) < 1e-6) return "0";
  if (Math.abs(snapped - Math.round(snapped)) < 1e-6) return String(Math.round(snapped));
  return snapped.toFixed(2).replace(/0+$/u, "").replace(/\.$/u, "");
}

export function rrefStates(source: string): { states: RrefState[]; issue: string | null } {
  const parsed = numericMatrix(source);
  if (parsed.issue) return { states: [], issue: parsed.issue };
  const matrix = parsed.rows.map((row) => [...row]), states: RrefState[] = [{ rows: matrix.map((row) => [...row]), operation: "start" }];
  let pivotRow = 0;
  for (let column = 0; column < matrix[0].length && pivotRow < matrix.length; column += 1) {
    let pivot = pivotRow;
    for (let row = pivotRow + 1; row < matrix.length; row += 1) if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    if (Math.abs(matrix[pivot][column]) < 1e-9) continue;
    if (pivot !== pivotRow) { [matrix[pivot], matrix[pivotRow]] = [matrix[pivotRow], matrix[pivot]]; states.push({ rows: matrix.map((row) => [...row]), operation: `swap R${pivotRow + 1} <-> R${pivot + 1}` }); }
    const divisor = matrix[pivotRow][column];
    if (Math.abs(divisor - 1) > 1e-9) { for (let j = 0; j < matrix[0].length; j += 1) matrix[pivotRow][j] /= divisor; states.push({ rows: matrix.map((row) => [...row]), operation: `R${pivotRow + 1} -> R${pivotRow + 1} / ${fmtMatrixValue(divisor)}` }); }
    for (let row = 0; row < matrix.length; row += 1) {
      if (row === pivotRow) continue;
      const factor = matrix[row][column];
      if (Math.abs(factor) <= 1e-9) continue;
      for (let j = 0; j < matrix[0].length; j += 1) matrix[row][j] -= factor * matrix[pivotRow][j];
      states.push({ rows: matrix.map((one) => [...one]), operation: `R${row + 1} -> R${row + 1} ${factor > 0 ? "-" : "+"} ${fmtMatrixValue(Math.abs(factor))} R${pivotRow + 1}` });
    }
    pivotRow += 1;
  }
  return { states, issue: null };
}

export function eigenPairs(a: number, b: number, c: number, d: number): EigenPair[] {
  const trace = a + d, determinant = a * d - b * c, discriminant = trace * trace - 4 * determinant;
  if (discriminant < -1e-6) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  const values = root < 1e-5 ? [trace / 2] : [(trace + root) / 2, (trace - root) / 2];
  return values.map((value) => {
    const vector = Math.abs(b) > 1e-6 ? { x: b, y: value - a }
      : Math.abs(c) > 1e-6 ? { x: value - d, y: c }
        : Math.abs(value - a) < Math.abs(value - d) ? { x: 1, y: 0 } : { x: 0, y: 1 };
    return { value, vector: normalized(vector) };
  });
}

type MatrixLike = LinearMapEntity | GridMapEntity | DeterminantEntity | EigenEntity | DiagonaliseEntity;
export function mappedGrid(entity: LinearMapEntity | GridMapEntity, from = false): Segment2[] {
  const span = effectiveSpan(entity.span), result: Segment2[] = [];
  const matrix = entity.kind === "gridmap" && from ? [entity.fromA, entity.fromB, entity.fromC, entity.fromD] : [entity.a, entity.b, entity.c, entity.d];
  for (let k = -span; k <= span; k += 1) {
    const h0 = mapPoint(...matrix as [number, number, number, number], { x: -span, y: k }), h1 = mapPoint(...matrix as [number, number, number, number], { x: span, y: k });
    const v0 = mapPoint(...matrix as [number, number, number, number], { x: k, y: -span }), v1 = mapPoint(...matrix as [number, number, number, number], { x: k, y: span });
    result.push({ from: screen(entity.x, entity.y, entity.unit, h0), to: screen(entity.x, entity.y, entity.unit, h1) }, { from: screen(entity.x, entity.y, entity.unit, v0), to: screen(entity.x, entity.y, entity.unit, v1) });
  }
  return result;
}

export function identityGrid(entity: LinearMapEntity | GridMapEntity | SquishEntity): Segment2[] {
  const span = effectiveSpan(entity.span), result: Segment2[] = [];
  for (let k = -span; k <= span; k += 1) result.push(
    { from: screen(entity.x, entity.y, entity.unit, { x: -span, y: k }), to: screen(entity.x, entity.y, entity.unit, { x: span, y: k }) },
    { from: screen(entity.x, entity.y, entity.unit, { x: k, y: -span }), to: screen(entity.x, entity.y, entity.unit, { x: k, y: span }) },
  );
  return result;
}

export function determinantGeometry(entity: DeterminantEntity) {
  const sc = (p: Point) => screen(entity.x, entity.y, entity.unit, p), det = entity.a * entity.d - entity.b * entity.c;
  const unit = [sc({ x: 0, y: 0 }), sc({ x: 1, y: 0 }), sc({ x: 1, y: 1 }), sc({ x: 0, y: 1 })];
  const image = [sc({ x: 0, y: 0 }), sc({ x: entity.a, y: entity.c }), sc({ x: entity.a + entity.b, y: entity.c + entity.d }), sc({ x: entity.b, y: entity.d })];
  return { det, unit, image, label: sc({ x: (entity.a + entity.b) / 2, y: (entity.c + entity.d) / 2 }) };
}

export function eigenGeometry(entity: EigenEntity) {
  const pairs = eigenPairs(entity.a, entity.b, entity.c, entity.d), ext = 4;
  return pairs.map((pair) => ({ ...pair, from: screen(entity.x, entity.y, entity.unit, scale(pair.vector, -ext)), to: screen(entity.x, entity.y, entity.unit, scale(pair.vector, ext)), label: screen(entity.x, entity.y, entity.unit, scale(pair.vector, ext - .6)) }));
}

export function diagonaliseGeometry(entity: DiagonaliseEntity) {
  const pairs = eigenPairs(entity.a, entity.b, entity.c, entity.d), sc = (p: Point) => screen(entity.x, entity.y, entity.unit, p);
  if (pairs.length < 2) return { pairs, grid: [] as Segment2[], axes: [] as Segment2[], cell: [] as Point[], image: [] as Point[] };
  const [p1, p2] = pairs, span = 3, grid: Segment2[] = [];
  for (let k = -span; k <= span; k += 1) grid.push(
    { from: sc(add(scale(p1.vector, -span), scale(p2.vector, k))), to: sc(add(scale(p1.vector, span), scale(p2.vector, k))) },
    { from: sc(add(scale(p1.vector, k), scale(p2.vector, -span))), to: sc(add(scale(p1.vector, k), scale(p2.vector, span))) },
  );
  const ext = span + .5;
  return {
    pairs, grid,
    axes: [{ from: sc(scale(p1.vector, -ext)), to: sc(scale(p1.vector, ext)) }, { from: sc(scale(p2.vector, -ext)), to: sc(scale(p2.vector, ext)) }],
    cell: [sc({ x: 0, y: 0 }), sc(p1.vector), sc(add(p1.vector, p2.vector)), sc(p2.vector)],
    image: [sc({ x: 0, y: 0 }), sc(scale(p1.vector, p1.value)), sc(add(scale(p1.vector, p1.value), scale(p2.vector, p2.value))), sc(scale(p2.vector, p2.value))],
  };
}

function equationLine(a: number, b: number, value: number, extent: number): [Point, Point] | null {
  if (Math.abs(a) < 1e-6 && Math.abs(b) < 1e-6) return null;
  return Math.abs(b) >= Math.abs(a) ? [{ x: -extent, y: (value + a * extent) / b }, { x: extent, y: (value - a * extent) / b }]
    : [{ x: (value + b * extent) / a, y: -extent }, { x: (value - b * extent) / a, y: extent }];
}

export function linearSolveGeometry(entity: LinearSolveEntity) {
  const extent = entity.span ?? 5, sc = (p: Point) => screen(entity.x, entity.y, entity.unit, p), first = equationLine(entity.a, entity.b, entity.e, extent), second = equationLine(entity.c, entity.d, entity.f, extent);
  const det = entity.a * entity.d - entity.b * entity.c;
  const solution = Math.abs(det) < 1e-6 ? null : { x: (entity.e * entity.d - entity.b * entity.f) / det, y: (entity.a * entity.f - entity.e * entity.c) / det };
  return { first: first ? { from: sc(first[0]), to: sc(first[1]) } : null, second: second ? { from: sc(second[0]), to: sc(second[1]) } : null, solution, screenSolution: solution ? sc(solution) : null };
}

export function spanGeometry(entity: SpanEntity) {
  const sc = (p: Point) => screen(entity.x, entity.y, entity.unit, p), v = { x: entity.vx, y: entity.vy }, w = { x: entity.wx, y: entity.wy }, independent = entity.twoVectors && Math.abs(v.x * w.y - v.y * w.x) >= 1e-6, extent = 5;
  const direction = normalized(v), line = { from: sc(scale(direction, -extent)), to: sc(scale(direction, extent)) };
  const plane = [sc({ x: -extent, y: -extent }), sc({ x: extent, y: -extent }), sc({ x: extent, y: extent }), sc({ x: -extent, y: extent })];
  return { origin: sc({ x: 0, y: 0 }), v: sc(v), w: sc(w), independent, line, plane };
}

export function projectionGeometry(entity: ProjectionEntity) {
  const a = { x: entity.ax, y: entity.ay }, b = { x: entity.bx, y: entity.by }, denominator = a.x * a.x + a.y * a.y, sc = (p: Point) => screen(entity.x, entity.y, entity.unit, p);
  if (denominator < 1e-9) return null;
  const amount = (b.x * a.x + b.y * a.y) / denominator, projection = scale(a, amount), ah = normalized(a), residual = { x: b.x - projection.x, y: b.y - projection.y }, eh = normalized(residual), d1 = scale(ah, amount >= 0 ? -.3 : .3), d2 = scale(eh, .3);
  return { origin: sc({ x: 0, y: 0 }), b: sc(b), projection: sc(projection), line: { from: sc(scale(ah, -4.5)), to: sc(scale(ah, 4.5)) }, rightAngle: [sc(add(projection, d1)), sc(add(add(projection, d1), d2)), sc(add(projection, d2))] };
}

export function squishGeometry(entity: SquishEntity) {
  const span = effectiveSpan(entity.span), sc = (p: Point) => screen(entity.x, entity.y, entity.unit, p), collapsed: Segment2[] = [];
  const collapse = (p: Point) => sc({ x: entity.a * p.x + entity.b * p.y, y: 0 });
  for (let k = -span; k <= span; k += 1) collapsed.push({ from: collapse({ x: -span, y: k }), to: collapse({ x: span, y: k }) }, { from: collapse({ x: k, y: -span }), to: collapse({ x: k, y: span }) });
  return { identity: identityGrid(entity), collapsed, origin: sc({ x: 0, y: 0 }), i: collapse({ x: 1, y: 0 }), j: collapse({ x: 0, y: 1 }), dual: sc({ x: entity.a, y: entity.b }), axis: { from: sc({ x: -span, y: 0 }), to: sc({ x: span, y: 0 }) } };
}

function matrixFields(): FieldSpec[] { return [
  { key: "a", label: "a · row 1 col 1", input: "number", step: .1 }, { key: "b", label: "b · row 1 col 2", input: "number", step: .1 },
  { key: "c", label: "c · row 2 col 1", input: "number", step: .1 }, { key: "d", label: "d · row 2 col 2", input: "number", step: .1 },
]; }
function unitField(): FieldSpec { return { key: "unit", label: "Pixels per unit", input: "number", min: 1 }; }
function spanField(): FieldSpec { return { key: "span", label: "Grid span", input: "number", nullable: true, min: 1, max: 10, hint: "Blank uses the native default of 4; Manic clamps this to 1…10." }; }
function colorTail(entity: { constructorColor: string | null }): string { return entity.constructorColor ? `, ${entity.constructorColor}` : ""; }
function matrixHandle(entity: MatrixLike) { return [{ name: "column1", x: entity.x + entity.a * entity.unit, y: entity.y - entity.c * entity.unit }, { name: "column2", x: entity.x + entity.b * entity.unit, y: entity.y - entity.d * entity.unit }]; }
function dragMatrix(entity: MatrixLike, handle: string, px: number, py: number) { const x = round((px - entity.x) / entity.unit, 3), y = round((entity.y - py) / entity.unit, 3); if (handle === "column1") { entity.a = x; entity.c = y; } else { entity.b = x; entity.d = y; } }
function move(entity: { x: number; y: number }, dx: number, dy: number) { entity.x += dx; entity.y += dy; }

registerEntity<MatrixEntity>({
  kind: "matrix", ctor: "matrix", anchorArgIndex: 2, group: "Math", label: "Matrix", icon: "[aᵢⱼ]", order: 40, hint: "Bracketed editable entries with addressable rows and columns",
  create: (id, x, y) => ({ ...baseEntity(id, "fg"), nativePaint: true, kind: "matrix", x, y, source: "1 0; 0 1", cellWidth: 88, cellHeight: 70 }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), source = argString(stmt.args, 1), at = argPoint(stmt.args, 2), cellWidth = argNumber(stmt.args, 3), cellHeight = argNumber(stmt.args, 4); if (!id || source === null || !at || stmt.args.length < 3 || stmt.args.length > 5 || (stmt.args.length >= 4 && cellWidth === null) || (stmt.args.length === 5 && cellHeight === null) || matrixGrid(source).issue) return null; return { ...baseEntity(id, "fg"), nativePaint: true, kind: "matrix", x: at.x, y: at.y, source, cellWidth, cellHeight }; },
  ctorLine(entity) { const tail = entity.cellHeight !== null ? `, ${num(entity.cellWidth ?? 88)}, ${num(entity.cellHeight)}` : entity.cellWidth !== null ? `, ${num(entity.cellWidth)}` : ""; return `matrix(${entity.id}, "${escapeString(entity.source)}", ${pt(entity.x, entity.y)}${tail});`; }, extraLines: () => [], modifiers: {},
  referenceIds(entity) { const grid = matrixGrid(entity.source); if (grid.issue) return []; return [`${entity.id}.entries`, `${entity.id}.lbrack`, `${entity.id}.rbrack`, ...grid.rows.flatMap((row, i) => [`${entity.id}.row${i}`, ...row.flatMap((_v, j) => i === 0 ? [`${entity.id}.col${j}`, `${entity.id}.r${i}c${j}`] : [`${entity.id}.r${i}c${j}`])])]; },
  anchor: (entity) => ({ x: entity.x, y: entity.y }), translate: move,
  bounds(entity) { const grid = matrixGrid(entity.source), layout = matrixLayout(entity, grid.rows.length, grid.rows[0]?.length ?? 1); return { x: layout.left - layout.serif, y: layout.top - 8, width: layout.right - layout.left + layout.serif * 2, height: layout.bottom - layout.top + 16 }; }, handles: () => [], dragHandle() {},
  fields: [{ key: "source", label: "Entries", input: "textarea", hint: "Separate rows with ; and entries with spaces or commas. Every row must have equal length." }, { key: "cellWidth", label: "Cell width", input: "number", nullable: true, min: 20 }, { key: "cellHeight", label: "Cell height", input: "number", nullable: true, min: 20 }],
});

registerEntity<LinearMapEntity>({
  kind: "linmap", ctor: "linmap", anchorArgIndex: 1, group: "Math", label: "Linear map", icon: "A↦▦", order: 40.1, hint: "Static identity and transformed grids with draggable matrix columns",
  create: (id, x, y) => ({ ...baseEntity(id, "fg"), nativePaint: true, kind: "linmap", x, y, unit: 50, a: 2, b: 1, c: 1, d: 2, span: 4 }),
  parseArgs(stmt) { const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1), unit = argNumber(stmt.args, 2), values = [3,4,5,6].map((i) => argNumber(stmt.args, i)), span = argNumber(stmt.args, 7); return id && at && unit !== null && values.every((v) => v !== null) && stmt.args.length >= 7 && stmt.args.length <= 8 && (stmt.args.length === 7 || span !== null) ? { ...baseEntity(id, "fg"), nativePaint: true, kind: "linmap", x: at.x, y: at.y, unit, a: values[0]!, b: values[1]!, c: values[2]!, d: values[3]!, span } : null; },
  ctorLine: (e) => `linmap(${e.id}, ${pt(e.x,e.y)}, ${num(e.unit)}, ${num(e.a)}, ${num(e.b)}, ${num(e.c)}, ${num(e.d)}${e.span === null ? "" : `, ${num(e.span)}`});`, extraLines: () => [], modifiers: {}, referenceIds(e) { const s = effectiveSpan(e.span); return [...Array.from({length:s*2+1},(_v,i)=>i-s).flatMap((k)=>[`${e.id}.ih${k}`,`${e.id}.iv${k}`,`${e.id}.h${k}`,`${e.id}.v${k}`]),`${e.id}.i`,`${e.id}.j`,`${e.id}.li`,`${e.id}.lj`]; },
  anchor: (e)=>({x:e.x,y:e.y}), translate: move, bounds(e){ return boxOf([...identityGrid(e),...mappedGrid(e)].flatMap((s)=>[s.from,s.to]),24); }, handles: matrixHandle, dragHandle: dragMatrix, fields:[unitField(),...matrixFields(),spanField()],
});

registerEntity<GridMapEntity>({
  kind:"gridmap",ctor:"gridmap",anchorArgIndex:1,group:"Math",label:"Animated grid map",icon:"▦⇢",order:40.2,fidelity:"semantic",hint:"Morphs a grid between two editable 2×2 matrices in native Preview",
  create:(id,x,y)=>({...baseEntity(id,"cyan"),nativePaint:true,kind:"gridmap",x,y,unit:50,a:2,b:1,c:1,d:2,span:4,customFrom:false,fromA:1,fromB:0,fromC:0,fromD:1}),
  parseArgs(stmt){ const id=argName(stmt.args,0),at=argPoint(stmt.args,1),unit=argNumber(stmt.args,2),v=[3,4,5,6].map(i=>argNumber(stmt.args,i)),span=argNumber(stmt.args,7),from=[8,9,10,11].map(i=>argNumber(stmt.args,i)); if(!id||!at||unit===null||v.some(x=>x===null)||stmt.args.length<7||stmt.args.length>12||(stmt.args.length>=8&&span===null)||from.slice(0,Math.max(0,stmt.args.length-8)).some(x=>x===null)) return null; return {...baseEntity(id,"cyan"),nativePaint:true,kind:"gridmap",x:at.x,y:at.y,unit,a:v[0]!,b:v[1]!,c:v[2]!,d:v[3]!,span,customFrom:stmt.args.length>8,fromA:from[0]??1,fromB:from[1]??0,fromC:from[2]??0,fromD:from[3]??1}; },
  ctorLine(e){ const from=e.customFrom?`, ${num(e.fromA)}, ${num(e.fromB)}, ${num(e.fromC)}, ${num(e.fromD)}`:""; return `gridmap(${e.id}, ${pt(e.x,e.y)}, ${num(e.unit)}, ${num(e.a)}, ${num(e.b)}, ${num(e.c)}, ${num(e.d)}${e.span===null&&!e.customFrom?"":`, ${num(e.span??4)}`}${from});`; },extraLines:()=>[],modifiers:{},
  referenceIds(e){const s=effectiveSpan(e.span);return[`${e.id}.bg`,...Array.from({length:s*2+1},(_v,i)=>i-s).flatMap(k=>[`${e.id}.bgh${k}`,`${e.id}.bgv${k}`,`${e.id}.h${k}`,`${e.id}.v${k}`]),`${e.id}.i`,`${e.id}.j`];},anchor:e=>({x:e.x,y:e.y}),translate:move,bounds(e){return boxOf([...identityGrid(e),...mappedGrid(e,true),...mappedGrid(e)].flatMap(s=>[s.from,s.to]),24);},handles:matrixHandle,dragHandle:dragMatrix,
  fields:[unitField(),...matrixFields(),spanField(),{key:"customFrom",label:"Custom from-matrix",input:"checkbox",hint:"Off morphs from identity."},{key:"fromA",label:"From a",input:"number",step:.1,visibleWhen:{key:"customFrom",equals:true}},{key:"fromB",label:"From b",input:"number",step:.1,visibleWhen:{key:"customFrom",equals:true}},{key:"fromC",label:"From c",input:"number",step:.1,visibleWhen:{key:"customFrom",equals:true}},{key:"fromD",label:"From d",input:"number",step:.1,visibleWhen:{key:"customFrom",equals:true}}],
});

function registerMatrixDiagram(kind:"determinant"|"eigen"|"diagonalise",order:number){
  type E=DeterminantEntity|EigenEntity|DiagonaliseEntity;
  const defaults={determinant:"lime",eigen:"gold",diagonalise:"cyan"} as const;
  registerEntity<E>({kind,ctor:kind,aliases:kind==="diagonalise"?["diagonalize"]:undefined,anchorArgIndex:1,group:"Math",label:kind==="determinant"?"Determinant area":kind==="eigen"?"Eigen directions":"Diagonalisation",icon:kind==="determinant"?"det A":kind==="eigen"?"λv":"PDP⁻¹",order,hint:kind==="determinant"?"Unit area and its signed transformed parallelogram":kind==="eigen"?"Real invariant directions and eigenvalues":"Eigen-grid, eigen-cell, and pure stretches",
    create(id,x,y){const common={...baseEntity(id,defaults[kind]),nativePaint:true,x,y,unit:50,a:2,b:1,c:1,d:2,constructorColor:null};return(kind==="diagonalise"?{...common,kind,spelling:"diagonalise"}:{...common,kind}) as E;},
    parseArgs(stmt){const id=argName(stmt.args,0),at=argPoint(stmt.args,1),unit=argNumber(stmt.args,2),v=[3,4,5,6].map(i=>argNumber(stmt.args,i)),color=argName(stmt.args,7);if(!id||!at||unit===null||v.some(x=>x===null)||stmt.args.length<7||stmt.args.length>8||(stmt.args.length===8&&!color))return null;const common={...baseEntity(id,color??defaults[kind]),nativePaint:true,x:at.x,y:at.y,unit,a:v[0]!,b:v[1]!,c:v[2]!,d:v[3]!,constructorColor:color};return(kind==="diagonalise"?{...common,kind,spelling:stmt.name as DiagonaliseEntity["spelling"]}:{...common,kind}) as E;},
    ctorLine(e){const spelling=e.kind==="diagonalise"?e.spelling:kind;return`${spelling}(${e.id}, ${pt(e.x,e.y)}, ${num(e.unit)}, ${num(e.a)}, ${num(e.b)}, ${num(e.c)}, ${num(e.d)}${colorTail(e)});`;},extraLines:()=>[],modifiers:{},
    referenceIds(e){if(e.kind==="determinant")return[`${e.id}.unit`,`${e.id}.val`];if(e.kind==="eigen"){const n=eigenPairs(e.a,e.b,e.c,e.d).length;return n?[...Array.from({length:n},(_v,i)=>[`${e.id}.line${i}`,`${e.id}.l${i}`]).flat()]:[`${e.id}.note`];}const g=diagonaliseGeometry(e);return g.pairs.length<2?[`${e.id}.note`]:[...Array.from({length:7},(_v,i)=>i-3).flatMap(k=>[`${e.id}.g${k}a`,`${e.id}.g${k}b`]),`${e.id}.axis1`,`${e.id}.axis2`,`${e.id}.cell`,`${e.id}.img`,`${e.id}.v1`,`${e.id}.v1l`,`${e.id}.v2`,`${e.id}.v2l`];},
    anchor:e=>({x:e.x,y:e.y}),translate:move,bounds(e){if(e.kind==="determinant"){const g=determinantGeometry(e);return boxOf([...g.unit,...g.image,g.label],35);}if(e.kind==="eigen"){const g=eigenGeometry(e);return g.length?boxOf(g.flatMap(x=>[x.from,x.to,x.label]),30):{x:e.x-180,y:e.y-30,width:360,height:e.unit*3};}const g=diagonaliseGeometry(e);return g.pairs.length<2?{x:e.x-220,y:e.y-30,width:440,height:e.unit*3}:boxOf([...g.grid.flatMap(s=>[s.from,s.to]),...g.image],30);},handles:matrixHandle,dragHandle:dragMatrix,fields:[unitField(),...matrixFields()],
  });
}
registerMatrixDiagram("determinant",40.3); registerMatrixDiagram("eigen",40.4); registerMatrixDiagram("diagonalise",40.5);

registerEntity<LinearSolveEntity>({
  kind:"linsolve",ctor:"linsolve",anchorArgIndex:1,group:"Math",label:"Linear system",icon:"Ax=b",order:40.6,hint:"Row-picture lines and their unique solution",
  create:(id,x,y)=>({...baseEntity(id,"gold"),nativePaint:true,kind:"linsolve",x,y,unit:45,a:2,b:1,c:1,d:3,e:5,f:10,span:5}),
  parseArgs(stmt){const id=argName(stmt.args,0),at=argPoint(stmt.args,1),unit=argNumber(stmt.args,2),v=[3,4,5,6,7,8].map(i=>argNumber(stmt.args,i)),span=argNumber(stmt.args,9);return id&&at&&unit!==null&&v.every(x=>x!==null)&&stmt.args.length>=9&&stmt.args.length<=10&&(stmt.args.length===9||span!==null)?{...baseEntity(id,"gold"),nativePaint:true,kind:"linsolve",x:at.x,y:at.y,unit,a:v[0]!,b:v[1]!,c:v[2]!,d:v[3]!,e:v[4]!,f:v[5]!,span}:null;},
  ctorLine:e=>`linsolve(${e.id}, ${pt(e.x,e.y)}, ${num(e.unit)}, ${num(e.a)}, ${num(e.b)}, ${num(e.c)}, ${num(e.d)}, ${num(e.e)}, ${num(e.f)}${e.span===null?"":`, ${num(e.span)}`});`,extraLines:()=>[],modifiers:{},referenceIds(e){const g=linearSolveGeometry(e);return[...(g.first?[`${e.id}.r1`]:[]),...(g.second?[`${e.id}.r2`]:[]),...(g.solution?[e.id,`${e.id}.val`]:[`${e.id}.note`])];},anchor:e=>({x:e.x,y:e.y}),translate:move,bounds(e){const g=linearSolveGeometry(e),pts=[g.first?.from,g.first?.to,g.second?.from,g.second?.to,g.screenSolution].filter((p):p is Point=>!!p);return boxOf(pts.length?pts:[{x:e.x-150,y:e.y},{x:e.x+150,y:e.y+e.unit*2.6}],35);},handles:()=>[],dragHandle(){},fields:[unitField(),...matrixFields(),{key:"e",label:"Right side e",input:"number",step:.1},{key:"f",label:"Right side f",input:"number",step:.1},{key:"span",label:"Line extent",input:"number",nullable:true,min:.1,hint:"Blank uses 5 units."}],
});

registerEntity<SpanEntity>({
  kind:"span",ctor:"span",anchorArgIndex:1,group:"Math",label:"Vector span",icon:"span⟨⟩",order:40.7,hint:"One vector spans a line; two independent vectors span the plane",
  create:(id,x,y)=>({...baseEntity(id,"gold"),nativePaint:true,kind:"span",x,y,unit:45,vx:3,vy:1,twoVectors:true,wx:-1,wy:2,constructorColor:null}),
  parseArgs(stmt){const id=argName(stmt.args,0),at=argPoint(stmt.args,1),unit=argNumber(stmt.args,2),v=argPoint(stmt.args,3),w=argPoint(stmt.args,4),color=argName(stmt.args,w?5:4);if(!id||!at||unit===null||!v||stmt.args.length<4||stmt.args.length>6||(stmt.args.length>=5&&!w&&!color)||(stmt.args.length===6&&(!w||!color)))return null;return{...baseEntity(id,color??"gold"),nativePaint:true,kind:"span",x:at.x,y:at.y,unit,vx:v.x,vy:v.y,twoVectors:!!w,wx:w?.x??-1,wy:w?.y??2,constructorColor:color};},
  ctorLine:e=>`span(${e.id}, ${pt(e.x,e.y)}, ${num(e.unit)}, ${pt(e.vx,e.vy)}${e.twoVectors?`, ${pt(e.wx,e.wy)}`:""}${colorTail(e)});`,extraLines:()=>[],modifiers:{},referenceIds(e){const g=spanGeometry(e);return[`${e.id}.v`,...(e.twoVectors?[`${e.id}.w`]:[]),g.independent?`${e.id}.plane`:`${e.id}.line`];},anchor:e=>({x:e.x,y:e.y}),translate:move,bounds(e){const g=spanGeometry(e);return boxOf(g.independent?[...g.plane,g.v,g.w]:[g.line.from,g.line.to,g.v,...(e.twoVectors?[g.w]:[])],25);},handles:e=>[{name:"v",x:e.x+e.vx*e.unit,y:e.y-e.vy*e.unit},...(e.twoVectors?[{name:"w",x:e.x+e.wx*e.unit,y:e.y-e.wy*e.unit}]:[])],dragHandle(e,h,px,py){const x=round((px-e.x)/e.unit,3),y=round((e.y-py)/e.unit,3);if(h==="v"){e.vx=x;e.vy=y;}else{e.wx=x;e.wy=y;}},fields:[unitField(),{key:"vx",label:"Vector v · x",input:"number",step:.1},{key:"vy",label:"Vector v · y",input:"number",step:.1},{key:"twoVectors",label:"Second vector",input:"checkbox"},{key:"wx",label:"Vector w · x",input:"number",step:.1,visibleWhen:{key:"twoVectors",equals:true}},{key:"wy",label:"Vector w · y",input:"number",step:.1,visibleWhen:{key:"twoVectors",equals:true}}],
});

registerEntity<ProjectionEntity>({
  kind:"project",ctor:"project",anchorArgIndex:1,group:"Math",label:"Orthogonal projection",icon:"b↘span",order:40.8,hint:"Projection, residual, subspace line, and right-angle relationship",
  create:(id,x,y)=>({...baseEntity(id,"cyan"),nativePaint:true,kind:"project",x,y,unit:45,bx:1,by:3,ax:3,ay:1,constructorColor:null}),
  parseArgs(stmt){const id=argName(stmt.args,0),at=argPoint(stmt.args,1),unit=argNumber(stmt.args,2),b=argPoint(stmt.args,3),a=argPoint(stmt.args,4),color=argName(stmt.args,5);return id&&at&&unit!==null&&b&&a&&stmt.args.length>=5&&stmt.args.length<=6&&(stmt.args.length===5||color)?{...baseEntity(id,color??"cyan"),nativePaint:true,kind:"project",x:at.x,y:at.y,unit,bx:b.x,by:b.y,ax:a.x,ay:a.y,constructorColor:color}:null;},
  ctorLine:e=>`project(${e.id}, ${pt(e.x,e.y)}, ${num(e.unit)}, ${pt(e.bx,e.by)}, ${pt(e.ax,e.ay)}${colorTail(e)});`,extraLines:()=>[],modifiers:{},referenceIds:e=>[`${e.id}.line`,`${e.id}.b`,`${e.id}.p`,`${e.id}.res`,`${e.id}.rt`,`${e.id}.blabel`,`${e.id}.plabel`],anchor:e=>({x:e.x,y:e.y}),translate:move,bounds(e){const g=projectionGeometry(e);return g?boxOf([g.origin,g.b,g.projection,g.line.from,g.line.to,...g.rightAngle],30):{x:e.x-100,y:e.y-40,width:200,height:80};},handles:e=>[{name:"b",x:e.x+e.bx*e.unit,y:e.y-e.by*e.unit},{name:"a",x:e.x+e.ax*e.unit,y:e.y-e.ay*e.unit}],dragHandle(e,h,px,py){const x=round((px-e.x)/e.unit,3),y=round((e.y-py)/e.unit,3);if(h==="b"){e.bx=x;e.by=y;}else{e.ax=x;e.ay=y;}},fields:[unitField(),{key:"bx",label:"Vector b · x",input:"number",step:.1},{key:"by",label:"Vector b · y",input:"number",step:.1},{key:"ax",label:"Subspace a · x",input:"number",step:.1},{key:"ay",label:"Subspace a · y",input:"number",step:.1}],
});

registerEntity<RrefEntity>({
  kind:"rref",ctor:"rref",anchorArgIndex:2,group:"Math",label:"Row reduction",icon:"RREF",order:40.9,fidelity:"semantic",hint:"Editable matrix and addressable Gaussian-elimination states",
  create:(id,x,y)=>({...baseEntity(id,"fg"),nativePaint:true,kind:"rref",x,y,source:"2 1 5; 1 3 10",cellWidth:96,rowHeight:64}),
  parseArgs(stmt){const id=argName(stmt.args,0),source=argString(stmt.args,1),at=argPoint(stmt.args,2),cw=argNumber(stmt.args,3),rh=argNumber(stmt.args,4);if(!id||source===null||!at||stmt.args.length<3||stmt.args.length>5||(stmt.args.length>=4&&cw===null)||(stmt.args.length===5&&rh===null)||numericMatrix(source).issue)return null;return{...baseEntity(id,"fg"),nativePaint:true,kind:"rref",x:at.x,y:at.y,source,cellWidth:cw,rowHeight:rh};},
  ctorLine(e){const tail=e.rowHeight!==null?`, ${num(e.cellWidth??96)}, ${num(e.rowHeight)}`:e.cellWidth!==null?`, ${num(e.cellWidth)}`:"";return`rref(${e.id}, "${escapeString(e.source)}", ${pt(e.x,e.y)}${tail});`;},extraLines:()=>[],modifiers:{},referenceIds(e){const result=rrefStates(e.source),rows=result.states[0]?.rows.length??0,cols=result.states[0]?.rows[0]?.length??0;return[`${e.id}.lbrack`,`${e.id}.rbrack`,...result.states.flatMap((_s,k)=>[`${e.id}.s${k}`,`${e.id}.op${k}`,...Array.from({length:rows},(_v,i)=>Array.from({length:cols},(_w,j)=>`${e.id}.s${k}r${i}c${j}`)).flat()])];},anchor:e=>({x:e.x,y:e.y}),translate:move,bounds(e){const parsed=numericMatrix(e.source),layout=matrixLayout(e,parsed.rows.length,parsed.rows[0]?.length??1);return{x:layout.left-layout.serif,y:layout.top-8,width:layout.right-layout.left+layout.serif*2,height:layout.bottom-layout.top+layout.cellHeight+24};},handles:()=>[],dragHandle(){},fields:[{key:"source",label:"Numeric matrix",input:"textarea",hint:"Separate rows with ;. Native Preview reveals every Gaussian-elimination state."},{key:"cellWidth",label:"Cell width",input:"number",nullable:true,min:20},{key:"rowHeight",label:"Row height",input:"number",nullable:true,min:20}],
});

registerEntity<SquishEntity>({
  kind:"squish",ctor:"squish",anchorArgIndex:1,group:"Math",label:"Dot-product squish",icon:"▦→—",order:41,fidelity:"semantic",hint:"Morphs the plane onto a number line under the row vector [a b]",
  create:(id,x,y)=>({...baseEntity(id,"cyan"),nativePaint:true,kind:"squish",x,y,unit:50,a:2,b:1,span:4}),
  parseArgs(stmt){const id=argName(stmt.args,0),at=argPoint(stmt.args,1),unit=argNumber(stmt.args,2),a=argNumber(stmt.args,3),b=argNumber(stmt.args,4),span=argNumber(stmt.args,5);return id&&at&&unit!==null&&a!==null&&b!==null&&stmt.args.length>=5&&stmt.args.length<=6&&(stmt.args.length===5||span!==null)?{...baseEntity(id,"cyan"),nativePaint:true,kind:"squish",x:at.x,y:at.y,unit,a,b,span}:null;},
  ctorLine:e=>`squish(${e.id}, ${pt(e.x,e.y)}, ${num(e.unit)}, ${num(e.a)}, ${num(e.b)}${e.span===null?"":`, ${num(e.span)}`});`,extraLines:()=>[],modifiers:{},referenceIds(e){const s=effectiveSpan(e.span);return[...Array.from({length:s*2+1},(_v,i)=>i-s).flatMap(k=>[`${e.id}.h${k}`,`${e.id}.v${k}`,`${e.id}.t${k}`]),`${e.id}.i`,`${e.id}.j`,`${e.id}.line`,`${e.id}.axis`,`${e.id}.dual`];},anchor:e=>({x:e.x,y:e.y}),translate:move,bounds(e){const g=squishGeometry(e);return boxOf([...g.identity.flatMap(s=>[s.from,s.to]),...g.collapsed.flatMap(s=>[s.from,s.to]),g.dual],25);},handles:e=>[{name:"dual",x:e.x+e.a*e.unit,y:e.y-e.b*e.unit}],dragHandle(e,_h,px,py){e.a=round((px-e.x)/e.unit,3);e.b=round((e.y-py)/e.unit,3);},fields:[unitField(),{key:"a",label:"Row vector a",input:"number",step:.1},{key:"b",label:"Row vector b",input:"number",step:.1},spanField()],
});
