import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canvasAnnotations, cloneDoc, createEntity, defFor, determinantGeometry, diagonaliseGeometry,
  eigenGeometry, linearSolveGeometry, mappedGrid, matrixGrid, patchSceneSource,
  projectionGeometry, readSceneSource, referenceIds, rrefStates, serializeSceneFile,
  spanGeometry, squishGeometry, verbPropertyOptions, vocabularyEntry,
} from "./index.js";
import type {
  DeterminantEntity, DiagonaliseEntity, GridMapEntity, LinearMapEntity,
  LinearSolveEntity, MatrixEntity, ProjectionEntity, RrefEntity, SpanEntity, SquishEntity,
} from "./types.js";

const SOURCE = `canvas("16:9");
template("black");
matrix(M, "a b; c d", (170, 120), 64, 50);
linmap(lm, (330, 330), 38, 2, 1, 1, 2, 3);
gridmap(gm, (650, 330), 38, 2, 1, 1, 2, 3, 1, 0.5, 0, 1);
determinant(det, (910, 250), 45, 2, 1, 1, 2, lime);
eigen(ev, (1120, 250), 40, 2, 1, 1, 2, gold);
diagonalise(dg, (930, 500), 38, 2, 1, 1, 2, cyan);
diagonalize(dz, (1130, 500), 32, 3, 0, 0, 1);
linsolve(sys, (300, 610), 35, 2, 1, 1, 3, 5, 10, 4);
span(sp, (560, 610), 35, (3, 1), (-1, 2), gold);
project(pr, (790, 610), 35, (1, 3), (3, 1), cyan);
rref(rr, "2 1 5; 1 3 10", (1010, 650), 75, 50);
squish(sq, (1170, 620), 30, 2, 1, 3);
`;

describe("linear algebra vocabulary", () => {
  it("projects every constructor, preserves both diagonalisation spellings, and round-trips", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map((entity) => entity.kind)).toEqual(["matrix", "linmap", "gridmap", "determinant", "eigen", "diagonalise", "diagonalise", "linsolve", "span", "project", "rref", "squish"]);
    expect(scene.doc.entities[5]).toMatchObject({ spelling: "diagonalise", constructorColor: "cyan" });
    expect(scene.doc.entities[6]).toMatchObject({ spelling: "diagonalize", constructorColor: null });
    expect(scene.doc.entities[2]).toMatchObject({ customFrom: true, fromA: 1, fromB: .5, fromC: 0, fromD: 1 });
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
    const generated = serializeSceneFile(scene.doc), reparsed = readSceneSource(generated);
    expect(reparsed.skipped).toEqual([]);
    expect(reparsed.doc).toEqual(scene.doc);
    expect(generated).toContain("diagonalize(dz");
  });

  it("computes deterministic algebra geometry and native RREF states", () => {
    const scene = readSceneSource(SOURCE);
    expect(matrixGrid((scene.doc.entities[0] as MatrixEntity).source)).toEqual({ rows: [["a", "b"], ["c", "d"]], issue: null });
    expect(mappedGrid(scene.doc.entities[1] as LinearMapEntity)).toHaveLength(14);
    expect(mappedGrid(scene.doc.entities[2] as GridMapEntity, true)).toHaveLength(14);
    expect(determinantGeometry(scene.doc.entities[3] as DeterminantEntity).det).toBe(3);
    expect(eigenGeometry(scene.doc.entities[4] as never).map((pair) => pair.value)).toEqual([3, 1]);
    expect(diagonaliseGeometry(scene.doc.entities[5] as DiagonaliseEntity).pairs).toHaveLength(2);
    expect(linearSolveGeometry(scene.doc.entities[7] as LinearSolveEntity).solution).toEqual({ x: 1, y: 3 });
    expect(spanGeometry(scene.doc.entities[8] as SpanEntity).independent).toBe(true);
    expect(projectionGeometry(scene.doc.entities[9] as ProjectionEntity)?.projection).toBeTruthy();
    const reduction = rrefStates((scene.doc.entities[10] as RrefEntity).source);
    expect(reduction.issue).toBeNull();
    expect(reduction.states.at(-1)?.rows.map((row) => row.map((value) => Math.round(value * 1000) / 1000))).toEqual([[1, 0, 1], [0, 1, 3]]);
    expect(squishGeometry(scene.doc.entities[11] as SquishEntity).collapsed).toHaveLength(14);
  });

  it("indexes native children and semantic playback intent", () => {
    const scene = readSceneSource(SOURCE);
    expect(referenceIds(scene.doc.entities[0])).toEqual(expect.arrayContaining(["M.entries", "M.row0", "M.col1", "M.r1c1", "M.lbrack", "M.rbrack"]));
    expect(referenceIds(scene.doc.entities[2])).toEqual(expect.arrayContaining(["gm.bg", "gm.h-3", "gm.v3", "gm.i", "gm.j"]));
    expect(referenceIds(scene.doc.entities[3])).toEqual(["det.unit", "det.val"]);
    expect(referenceIds(scene.doc.entities[5])).toEqual(expect.arrayContaining(["dg.axis1", "dg.cell", "dg.img", "dg.v2l"]));
    expect(referenceIds(scene.doc.entities[7])).toEqual(expect.arrayContaining(["sys.r1", "sys.r2", "sys.val"]));
    expect(referenceIds(scene.doc.entities[9])).toEqual(expect.arrayContaining(["pr.line", "pr.b", "pr.p", "pr.res", "pr.rt"]));
    expect(referenceIds(scene.doc.entities[10])).toEqual(expect.arrayContaining(["rr.s0", "rr.op0", "rr.s0r0c0"]));
    expect(referenceIds(scene.doc.entities[11])).toEqual(expect.arrayContaining(["sq.line", "sq.axis", "sq.dual", "sq.t-3"]));
    expect(canvasAnnotations(scene.doc.entities[2], scene.doc)[0]).toMatchObject({ id: "gridmap-morph", representation: "semantic" });
    expect(canvasAnnotations(scene.doc.entities[10], scene.doc)[0]).toMatchObject({ id: "rref-states", label: expect.stringContaining("states") });
    expect(canvasAnnotations(scene.doc.entities[11], scene.doc)[0]).toMatchObject({ id: "squish-morph", representation: "semantic" });
    expect(verbPropertyOptions("to", scene.doc.entities[2])).toContain("morph");
    expect(verbPropertyOptions("to", scene.doc.entities[11])).toContain("morph");
  });

  it("exposes all Inspector parameters and normalized fidelity", () => {
    const exact = ["determinant", "diagonalise", "diagonalize", "eigen", "linmap", "linsolve", "matrix", "project", "span"];
    const semantic = ["gridmap", "rref", "squish"];
    for (const name of exact) expect(vocabularyEntry(name), name).toMatchObject({ fidelity: "exact", kind: "entity" });
    for (const name of semantic) expect(vocabularyEntry(name), name).toMatchObject({ fidelity: "semantic", kind: "entity" });
    const scene = readSceneSource(SOURCE);
    expect(defFor(scene.doc.entities[0]).fields.map((field) => field.key)).toEqual(["source", "cellWidth", "cellHeight"]);
    expect(defFor(scene.doc.entities[2]).fields.map((field) => field.key)).toEqual(["unit", "a", "b", "c", "d", "span", "customFrom", "fromA", "fromB", "fromC", "fromD"]);
    expect(defFor(scene.doc.entities[8]).fields.map((field) => field.key)).toEqual(["unit", "vx", "vy", "twoVectors", "wx", "wy"]);
  });

  it("serializes Canvas-created entities and surgically edits every family", () => {
    const empty = readSceneSource('canvas("16:9");\ntemplate("black");\n').doc;
    for (const kind of ["matrix", "linmap", "gridmap", "determinant", "eigen", "diagonalise", "linsolve", "span", "project", "rref", "squish"] as const) empty.entities.push(createEntity(kind, kind, 640, 360, empty));
    const generated = serializeSceneFile(empty), reparsed = readSceneSource(generated);
    expect(reparsed.skipped).toEqual([]);
    expect(reparsed.doc).toEqual(empty);

    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    (next.entities[0] as MatrixEntity).source = "1 2; 3 4";
    (next.entities[1] as LinearMapEntity).a = 3;
    (next.entities[2] as GridMapEntity).fromB = .25;
    (next.entities[3] as DeterminantEntity).d = 4;
    (next.entities[5] as DiagonaliseEntity).spelling = "diagonalize";
    (next.entities[7] as LinearSolveEntity).f = 11;
    (next.entities[8] as SpanEntity).twoVectors = false;
    (next.entities[9] as ProjectionEntity).ax = 2;
    (next.entities[10] as RrefEntity).source = "1 2 3; 0 1 4";
    (next.entities[11] as SquishEntity).b = -1;
    const patched = patchSceneSource(SOURCE, scene, next);
    for (const snippet of ['matrix(M, "1 2; 3 4"', "linmap(lm, (330, 330), 38, 3", "gridmap(gm, (650, 330), 38, 2, 1, 1, 2, 3, 1, 0.25", "determinant(det, (910, 250), 45, 2, 1, 1, 4", "diagonalize(dg", "linsolve(sys, (300, 610), 35, 2, 1, 1, 3, 5, 11", "span(sp, (560, 610), 35, (3, 1), gold", "project(pr, (790, 610), 35, (1, 3), (2, 1)", 'rref(rr, "1 2 3; 0 1 4"', "squish(sq, (1170, 620), 30, 2, -1"]) expect(patched).toContain(snippet);
    expect(readSceneSource(patched).skipped).toEqual([]);
  });
});

const LINEAR_ALGEBRA = resolve(import.meta.dirname, "../../../manic/examples/linear-algebra.manic");
describe.skipIf(!existsSync(LINEAR_ALGEBRA))("linear algebra corpus acceptance", () => {
  it("keeps the representative file byte-identical and onboards every constructor it uses", () => {
    const source = readFileSync(LINEAR_ALGEBRA, "utf8"), scene = readSceneSource(source);
    for (const name of ["linmap", "determinant", "diagonalise", "linsolve", "rref", "project"]) expect(scene.skipped.some((note) => note.includes(`\`${name}\` isn't canvas vocabulary yet`)), name).toBe(false);
    expect(patchSceneSource(source, scene, cloneDoc(scene.doc))).toBe(source);
  });
});
