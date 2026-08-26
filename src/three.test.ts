import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  actionReferences, canvasAnnotations, cloneDoc, entityAnchor, entityReferences, patchSceneSource, projectPoint3,
  readSceneSource, replaceActionReference, replaceEntityReference,
} from "./index.js";

const SOURCE = `canvas("16:9");
template("plain");
watermark(mark, (1120, 30), "Made With Manic");
camera3((0, 0, 10), (0, 0, 0), 8, orthographic);
grid3(grid, (0, 0, 0), 4, 1);
line3(a, (-2, 0, 0), (2, 0, 0));
line3(b, (0, -2, 0), (0, 2, 0));
arrow3(axis, (0, 0, 0), (0, 0, 2));
curve3(curve, "t", "exp(t)", "0", (-2, 1));
curve3(curveTarget, "t", "0", "exp(t)", (-2, 1));
point3(p, (1, 2, 0), 0.08);
equation(note, (0,0), "P", 28);
circle(planeX, (200, 200), 20, cyan);
circle(planeY, (400, 200), 20, magenta);
pin3(note, (1, 2, 0), (4, -8));
thick(a, 0.02);
morph3(curve, curveTarget, 180);
tag(a, world); tag(b, world); hidden(world);
par { orbit3(-90, -90, 12, 7, smooth); roll3(90, 7, smooth); }
cycle(planeX, planeY, 1.4, 70, smooth);
erase(a, 0.7, smooth);
`;

describe("3D authoring vocabulary", () => {
  it("projects every constructor, modifier, relationship and runtime verb", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map((entity) => entity.kind)).toEqual([
      "watermark", "camera3", "grid3", "line3", "line3", "arrow3", "curve3", "curve3", "point3", "equation", "circle", "circle",
    ]);
    const a = scene.doc.entities.find((entity) => entity.id === "a")!;
    const curve = scene.doc.entities.find((entity) => entity.id === "curve")!;
    const note = scene.doc.entities.find((entity) => entity.id === "note")!;
    expect(a).toMatchObject({ thickness3: .02, reveal: "fade" });
    expect(curve).toMatchObject({ morph3: { target: "curveTarget", spin: 180 } });
    expect(scene.doc.entities.find((entity) => entity.id === "b")).toMatchObject({ reveal: "fade" });
    expect(entityReferences(curve)).toContain("curveTarget");
    expect(note.pin3).toEqual({ at: { x: 1, y: 2, z: 0 }, target: null, offset: { x: 4, y: -8 }, worldHeight: null, form: "pin3" });
    const projected = projectPoint3(note.pin3!.at, scene.doc);
    expect(entityAnchor(note, scene.doc)).toEqual({ x: projected.x + 4, y: projected.y - 8 });
    expect(canvasAnnotations(curve, scene.doc)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "morph3", refs: ["curveTarget"] }),
      expect.objectContaining({ id: "projection3", representation: "semantic" }),
    ]));
    expect(scene.doc.steps.flatMap((step) => step.actions)).toEqual(expect.arrayContaining([
      expect.objectContaining({ verb: "orbit3", target: "__camera3", amount: -90, values: [-90, 12], dur: 7 }),
      expect.objectContaining({ verb: "roll3", target: "__camera3", amount: 90, dur: 7 }),
      expect.objectContaining({ verb: "cycle", target: "planeX", refs: ["planeY"], amount: 70, dur: 1.4 }),
      expect.objectContaining({ verb: "erase", target: "a", dur: .7 }),
    ]));
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
  });

  it("matches native portrait projection and responsive watermark placement", () => {
    const source = `canvas(720,1280); watermark(mark); camera3((0,0,10),(0,0,0),8,orthographic); point3(p,(1,2,0));`;
    const scene = readSceneSource(source);
    expect(scene.skipped).toEqual([]);
    expect(projectPoint3({ x: 1, y: 2, z: 0 }, scene.doc)).toMatchObject({ x: 520, y: 320, scale: 160 });
    const mark = scene.doc.entities.find((entity) => entity.id === "mark")!;
    expect(mark).toMatchObject({ responsive: true });
    expect("x" in mark ? mark.x : 0).toBeCloseTo(601.8);
    expect("y" in mark ? mark.y : 0).toBeCloseTo(1254.8);
    expect(patchSceneSource(source, scene, cloneDoc(scene.doc))).toBe(source);
  });

  it("keeps unsupported native combinations out of the editable model", () => {
    const source = `canvas("16:9"); camera3((0,0,10),(0,0,0),8,orthographic,(640,360),600); grid3(g,(0,0,0),0,1); line3(a,(0,0,0),(1,0,0)); line3(b,(0,0,0),(0,1,0)); curve3(c,"t","0","0",(0,1)); morph3(a,b); morph3(c,a); rot(a,45);`;
    const scene = readSceneSource(source);
    expect(scene.skipped).toHaveLength(5);
    const line = scene.doc.entities.find((entity) => entity.id === "a")!;
    expect(line.rotation).toBe(0);
    expect(line.morph3).toBeUndefined();
  });

  it("renames primary and secondary action relationships and survives an edited round trip", () => {
    const scene = readSceneSource(SOURCE);
    const next = cloneDoc(scene.doc);
    const target = next.entities.find((entity) => entity.id === "planeY")!;
    target.id = "planeZ";
    for (const entity of next.entities) replaceEntityReference(entity, "planeY", "planeZ");
    for (const action of next.steps.flatMap((step) => step.actions)) replaceActionReference(action, "planeY", "planeZ");
    const cycle = next.steps.flatMap((step) => step.actions).find((action) => action.verb === "cycle")!;
    expect(actionReferences(cycle)).toEqual(["planeX", "planeZ"]);
    const patched = patchSceneSource(SOURCE, scene, next);
    const reparsed = readSceneSource(patched);
    expect(reparsed.skipped).toEqual([]);
    expect(reparsed.doc.entities.some((entity) => entity.id === "planeZ")).toBe(true);
    expect(reparsed.doc.steps.flatMap((step) => step.actions).find((action) => action.verb === "cycle")?.refs).toEqual(["planeZ"]);
  });
});

const DERIVATIVE = resolve(import.meta.dirname, "../../../manic/examples/derivative-of-ln-x.manic");

describe.skipIf(!existsSync(DERIVATIVE))("derivative-of-ln-x.manic acceptance", () => {
  it("projects the complete animation without skips and preserves every byte", () => {
    const source = readFileSync(DERIVATIVE, "utf8");
    const scene = readSceneSource(source);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities).toHaveLength(75);
    expect(scene.doc.steps).toHaveLength(32);
    expect(scene.doc.steps.reduce((count, step) => count + step.actions.length, 0)).toBe(98);
    expect(scene.doc.steps.flatMap((step) => step.actions).map((action) => action.verb)).toEqual(expect.arrayContaining(["erase", "orbit3", "roll3", "cycle"]));
    expect(patchSceneSource(source, scene, cloneDoc(scene.doc))).toBe(source);
  });
});
