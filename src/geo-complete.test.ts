import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allVocabularyEntries, beatTargetOptions, cloneDoc, commonTangentGeometry, createEntity, emptyDoc,
  entityDef, geoCircleGeometry, geoDerivedPoint, geoIntersectionPoints,
  geometryContext, hyperbolaBranches, parabolaPoints, patchSceneSource,
  readSceneSource, referenceIds, replaceEntityReference, serializeSceneFile, tangentPointGeometry,
  type EntityKind, type GeoCircleEntity, type GeoDerivedPointEntity,
  type GeoIntersectionEntity, type TangentEntity,
} from "./index.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";
const NAMES = [
  "anglepoint", "between", "bisector", "centroid", "circlecircle", "circumcenter",
  "circumcircle", "commontangent", "foot", "fullline", "hyperbola", "incenter",
  "incircle", "linecircle", "meet", "orthocenter", "parabola", "reflect", "rotpoint",
] as const;

const SOURCE = `canvas(1280, 720);
template("black");

point(A, (260, 180), "A");
point(B, (520, 170), "B");
point(C, (400, 450), "C");
point(D, (760, 460), "D");
point(P, (480, 70), "P");
point(O1, (300, 360));
point(R1, (380, 360));
point(O2, (420, 360));
point(R2, (500, 360));
point(O3, (720, 360));
point(R3, (770, 360));

anglepoint(ap, O1, R1, 60);
between(bt, A, B, 0.25);
bisector(bi, A, B, C);
centroid(g, A, B, C);
circumcenter(o, A, B, C);
incenter(i, A, B, C);
orthocenter(hc, A, B, C);
foot(ft, P, A, B);
meet(x, A, D, B, C);
reflect(rp, P, A, B);
rotpoint(rr, A, B, 90);
circumcircle(ccirc, A, B, C);
incircle(icirc, A, B, C);
linecircle(lc, A, D, O1, R1);
circlecircle(cc, O1, R1, O2, R2);
fullline(fl, A, B);
parabola(pa, (650, 610), 140, 110);
hyperbola(hy, (960, 260), 55, 42, 1.4);
commontangent(ct, O1, R1, O3, R3, "external");
color(lc0, red);
color(ct.a, lime);
`;

describe("complete Geo kit", () => {
  it("projects all remaining constructors and their addressable children", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.slice(-NAMES.length).map((entity) => entity.kind).sort()).toEqual([...NAMES].sort());
    const lineCircle = scene.doc.entities.find((entity) => entity.kind === "linecircle") as GeoIntersectionEntity;
    const circleCircle = scene.doc.entities.find((entity) => entity.kind === "circlecircle") as GeoIntersectionEntity;
    const tangent = scene.doc.entities.find((entity) => entity.kind === "commontangent")!;
    const hyperbola = scene.doc.entities.find((entity) => entity.kind === "hyperbola")!;
    expect(referenceIds(lineCircle)).toEqual(["lc0", "lc1"]);
    expect(referenceIds(circleCircle)).toEqual(["cc0", "cc1"]);
    expect(referenceIds(tangent)).toEqual(["ct.a", "ct.b"]);
    expect(referenceIds(hyperbola)).toEqual(["hy.r", "hy.l"]);
    expect(lineCircle.point0Color).toBe("red");
    expect(tangent.kind === "commontangent" && tangent.touchAColor).toBe("lime");
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
  });

  it("matches native construction geometry for points, circles, intersections, conics, and tangency", () => {
    const doc = readSceneSource(SOURCE).doc, ctx = geometryContext(doc);
    const derived = (kind: GeoDerivedPointEntity["kind"]) => doc.entities.find((entity) => entity.kind === kind) as GeoDerivedPointEntity;
    expect(geoDerivedPoint(derived("centroid"), ctx)).toEqual({ x: expect.closeTo(393.333, 3), y: expect.closeTo(266.667, 3) });
    expect(geoDerivedPoint(derived("between"), ctx)).toEqual({ x: 325, y: 177.5 });
    expect(geoDerivedPoint(derived("rotpoint"), ctx)).toEqual({ x: 510, y: -90 });
    const circumcircle = doc.entities.find((entity) => entity.kind === "circumcircle") as GeoCircleEntity;
    expect(geoCircleGeometry(circumcircle, ctx).radius).toBeGreaterThan(100);
    for (const entity of doc.entities.filter((candidate): candidate is GeoIntersectionEntity => candidate.kind === "linecircle" || candidate.kind === "circlecircle")) {
      expect(geoIntersectionPoints(entity, ctx).points).toHaveLength(2);
    }
    const tangent = doc.entities.find((entity) => entity.kind === "commontangent")!;
    expect(tangent.kind === "commontangent" && commonTangentGeometry(tangent, ctx).valid).toBe(true);
    const parabola = doc.entities.find((entity) => entity.kind === "parabola")!;
    const hyperbola = doc.entities.find((entity) => entity.kind === "hyperbola")!;
    expect(parabola.kind === "parabola" && parabolaPoints(parabola)).toHaveLength(81);
    expect(hyperbola.kind === "hyperbola" && hyperbolaBranches(hyperbola).right).toHaveLength(65);
  });

  it("patches constructor values and dependency references surgically", () => {
    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    const between = next.entities.find((entity) => entity.kind === "between") as GeoDerivedPointEntity;
    between.scalar = .4;
    const parabola = next.entities.find((entity) => entity.kind === "parabola")!;
    if (parabola.kind === "parabola") parabola.height = -90;
    const tangent = next.entities.find((entity) => entity.kind === "commontangent")!;
    if (tangent.kind === "commontangent") tangent.tangentType = "internal";
    const patched = patchSceneSource(SOURCE, scene, next);
    expect(patched).toContain("between(bt, A, B, 0.4);");
    expect(patched).toContain("parabola(pa, (650, 610), 140, -90);");
    expect(patched).toContain('commontangent(ct, O1, R1, O3, R3, "internal");');
    expect(readSceneSource(patched).skipped).toEqual([]);

    const dependent = next.entities.find((entity) => entity.kind === "centroid")!;
    replaceEntityReference(dependent, "A", "A2");
    expect(dependent.kind === "centroid" && dependent.a).toBe("A2");
  });

  it("creates every Geo constructor from Canvas with complete dependency defaults", () => {
    const doc = emptyDoc();
    [[260, 180], [520, 170], [400, 450], [760, 460], [480, 70], [300, 360], [380, 360], [720, 360], [770, 360]].forEach(([x, y], index) => {
      doc.entities.push(createEntity("point", `P${index}`, x, y, doc));
    });
    for (const name of NAMES) {
      const def = entityDef(name)!;
      expect(def.canCreate?.(doc) ?? true, name).toBe(true);
      doc.entities.push(createEntity(name as EntityKind, name, 640, 360, doc, "P0"));
    }
    const source = serializeSceneFile(doc);
    expect(readSceneSource(source).skipped).toEqual([]);
    for (const name of NAMES) expect(source).toContain(`${name}(`);
  });

  it("closes the Geo catalog at 26/26 exact builtins", () => {
    const geo = allVocabularyEntries().filter((entry) => entry.kit === "geo");
    expect(geo).toHaveLength(26);
    expect(geo.filter((entry) => entry.fidelity === "exact")).toHaveLength(26);
    expect(geo.filter((entry) => entry.fidelity === "source-only")).toEqual([]);
  });

  it("supports the native point-to-circle tangent overload and child semantics", () => {
    const source = `canvas(1280, 720);\npoint(P, (500, 100));\npoint(O, (500, 360));\npoint(R, (600, 360));\ntangent(t, P, O, R);\ncolor(t0, cyan);\nhidden(t1);\ntag(t0, fig);\ntag(t1, fig);\n`;
    const scene = readSceneSource(source), tangent = scene.doc.entities.find((entity) => entity.kind === "tangent") as TangentEntity;
    expect(scene.skipped).toEqual([]);
    expect(tangent.mode).toBe("circle");
    expect(referenceIds(tangent)).toEqual(["t0", "t1"]);
    expect(tangent.point0Color).toBe("cyan");
    expect(tangent.point1Reveal).toBe("fade");
    expect(tangent.point0Tags).toEqual(["fig"]);
    expect(tangentPointGeometry(tangent, geometryContext(scene.doc)).valid).toBe(true);
    const showTargets = beatTargetOptions(scene.doc, "show");
    expect(showTargets.some((option) => option.id === "t")).toBe(false);
    expect(showTargets.filter((option) => option.ownerId === "t").map((option) => option.id)).toEqual(["t0", "t1"]);
    expect(patchSceneSource(source, scene, cloneDoc(scene.doc))).toBe(source);
  });

  it("projects the repository's 2-D Geo showcases without skipped vocabulary", () => {
    for (const name of ["conics.manic", "creator-geometry-language-showcase.manic", "creator-v2-olympiad-geometry.manic", "equilateral.manic", "orthocenter.manic", "tangent-length-short.manic", "tangents.manic", "triangle.manic"]) {
      const path = resolve("/Users/anish/git/manic/examples", name);
      if (!existsSync(path)) continue;
      const source = readFileSync(path, "utf8"), scene = readSceneSource(source);
      expect(scene.skipped, name).toEqual([]);
      expect(patchSceneSource(source, scene, cloneDoc(scene.doc)), name).toBe(source);
    }
  });

  it.runIf(existsSync(MANIC))("passes the native Manic checker", () => {
    const file = resolve(tmpdir(), `manic-workbench-geo-complete-${process.pid}.manic`);
    writeFileSync(file, SOURCE);
    expect(execFileSync(MANIC, ["check", file], { encoding: "utf8" })).toContain("parses + validates");
  });
});
