import { describe, expect, it } from "vitest";
import {
  boxToPoints, cloneDoc, createEntity, curveDotPoint, defFor, entityReferences,
  geometryContext, graphLabelPosition, newtonPoints, normalGeometry,
  parametricCurvePoints, patchSceneSource, readSceneSource, riemannBars,
  replaceEntityReference, rootsPoints, serializeSceneFile, slopeTriangleGeometry, splinePoints,
  taylorPoints, trajectoryPoints, verticalLineGeometry, vocabularyEntry,
} from "./index.js";
import type { SceneEntity } from "./types.js";

const SOURCE = `canvas("16:9");
template("black");
plot(f, (640, 390), 90, 55, "x*x-2", (-3, 3));
param(loop, (220, 170), 55, 55, "cos(t)", "sin(t)", (0, 6.283185));
polar(rose, (470, 170), 52, 52, "2*cos(3*t)", 6.283185);
normal(n, f, 1.5, 150);
slopetri(tri, f, 1, 0.8);
roots(zero, f, lime);
vline(guide, f, 1.5, yellow, dashed);
curvedot(rider, f, 1.5, cyan);
graphlabel(lbl, f, \`x^2-2\`, 2.2, upright, cyan);
boxto(box, f, 1.4, blue);
riemann(bars, f, 0, 2, 0.25, lime);
taylor(poly, f, 0, 4, gold);
newton(walk, f, 2.5, 7);
spline(route, (120, 620), (300, 520), (500, 650), (710, 530));
trajectory(orbit, "-y", "x", (2, 0), (1030, 470), 70, 320);
`;

const KINDS = ["plot", "param", "polar", "normal", "slopetri", "roots", "vline", "curvedot", "graphlabel", "boxto", "riemann", "taylor", "newton", "spline", "trajectory"];
const ONBOARDED = KINDS.slice(1);

describe("curve and calculus expansion", () => {
  it("projects all fourteen constructors and preserves unchanged source", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map((entity) => entity.kind)).toEqual(KINDS);
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
    for (const name of ONBOARDED) expect(vocabularyEntry(name), name).toMatchObject({ fidelity: "semantic", kind: "entity" });
  });

  it("retains every plot dependency and exposes editable Inspector schemas", () => {
    const scene = readSceneSource(SOURCE);
    for (const entity of scene.doc.entities.slice(3, 13)) {
      expect(entityReferences(entity), entity.id).toContain("f");
      expect(defFor(entity).fields.length, entity.id).toBeGreaterThan(0);
    }
    expect(defFor(scene.doc.entities[1]).fields.map((field) => field.key)).toEqual(["fx", "fy", "sx", "sy", "t0", "t1", "strokeWidth"]);
    expect(defFor(scene.doc.entities[2]).fields.map((field) => field.key)).toEqual(["fx", "sx", "sy", "t0", "t1", "strokeWidth"]);
    expect(defFor(scene.doc.entities[8]).fields.map((field) => field.key)).toEqual(["source", "latex", "graphX", "direction", "size"]);
    expect(defFor(scene.doc.entities[13]).fields.map((field) => [field.key, field.input])).toEqual([["points", "point-list"], ["strokeWidth", "number"]]);
    expect(defFor(scene.doc.entities[14]).fields.map((field) => [field.key, field.input])).toContainEqual(["start", "point"]);
  });

  it("computes bounded deterministic Canvas geometry for every pattern", () => {
    const scene = readSceneSource(SOURCE), ctx = geometryContext(scene.doc), byKind = (kind: string) => scene.doc.entities.find((entity) => entity.kind === kind) as SceneEntity;
    expect(parametricCurvePoints(byKind("param") as never).length).toBe(321);
    expect(parametricCurvePoints(byKind("polar") as never).length).toBe(321);
    expect(normalGeometry(byKind("normal") as never, ctx).touch.x).toBeGreaterThan(0);
    expect(slopeTriangleGeometry(byKind("slopetri") as never, ctx).slope).toBeGreaterThan(1);
    expect(rootsPoints(byKind("roots") as never, ctx)).toHaveLength(2);
    expect(verticalLineGeometry(byKind("vline") as never, ctx).to.y).not.toBe(verticalLineGeometry(byKind("vline") as never, ctx).from.y);
    expect(curveDotPoint(byKind("curvedot") as never, ctx)).not.toBeNull();
    expect(graphLabelPosition(byKind("graphlabel") as never, ctx).x).toBeGreaterThan(640);
    expect(boxToPoints(byKind("boxto") as never, ctx)).toHaveLength(4);
    expect(riemannBars(byKind("riemann") as never, ctx)).toHaveLength(8);
    expect(taylorPoints(byKind("taylor") as never, ctx).length).toBeGreaterThan(200);
    expect(newtonPoints(byKind("newton") as never, ctx).length).toBeGreaterThan(4);
    expect(splinePoints(byKind("spline") as never)).toHaveLength(73);
    expect(trajectoryPoints(byKind("trajectory") as never)).toHaveLength(321);
  });

  it("serializes Canvas-created independent and dependent entities as native Manic", () => {
    const doc = readSceneSource('plot(f, (640,390), 90, 55, "x*x-2", (-3,3));\n').doc;
    for (const kind of ONBOARDED) doc.entities.push(createEntity(kind, kind, 500, 300, doc, kind === "spline" || kind === "trajectory" || kind === "param" || kind === "polar" ? "" : "f"));
    const source = serializeSceneFile(doc), parsed = readSceneSource(source);
    expect(parsed.skipped).toEqual([]);
    for (const kind of ONBOARDED) expect(source).toContain(`${kind}(`);
  });

  it("keeps plot references rename-safe during surgical regeneration", () => {
    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    next.entities[0].id = "curve";
    for (const entity of next.entities.slice(3, 13)) replaceEntityReference(entity, "f", "curve");
    const patched = patchSceneSource(SOURCE, scene, next), reparsed = readSceneSource(patched);
    expect(reparsed.skipped).toEqual([]);
    for (const entity of reparsed.doc.entities.slice(3, 13)) expect(entityReferences(entity), entity.id).toContain("curve");
  });
});
