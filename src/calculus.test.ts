import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  bandGeometry, canvasAnnotations, cloneDoc, createEntity, defFor, entityReferences, geometryContext, graphPoint,
  patchSceneSource, readSceneSource, replaceEntityReference, serializeSceneFile, vocabularyEntry,
} from "./index.js";
import type { BandEntity, PlotEntity } from "./types.js";

const SOURCE = `canvas("16:9");
template("black");
plot(f, (640, 430), 100, 60, "x^3/3-x", (-2.2, 2.2));
gradient(f, blue, lime, gold, 270);
deriv(df, f, magenta);
accum(F, f, 0, gold);
tangent(t, f, -1, 220);
slope(m, f, -1, (18, -24));
extrema(ex, f, gold);
inflections(ip, f, magenta);
area(a, f, 0, 1, 40);
integral(I, f, 0, 1, (980, 220));
limit(L, f, 1, cyan);
dot(rider, (640, 430), 6);
circle(confbox, (1040, 520), 60);
particles(confetti, confbox, 12, 3, 9, "ring");

mark("calculus");
par { cam((720, 390), 1.2, smooth); zoom(1.5, 1.2, smooth); }
travel(rider, f, 1.4, smooth);
disintegrate(I, 0.8);
burst(confetti, 1.4);
breathe(L, 3, 0.05, 0, 7);
`;

describe("calculus authoring vocabulary", () => {
  it("projects calculus entities, dependencies, gradients, and semantic verbs", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map((entity) => entity.kind)).toEqual([
      "plot", "deriv", "accum", "tangent", "slope", "extrema", "inflections", "area", "integral", "limit", "dot", "circle", "particles",
    ]);
    for (const entity of scene.doc.entities.slice(1, 10)) expect(entityReferences(entity)).toContain("f");
    expect(scene.doc.entities[0].gradient).toEqual({ stops: ["blue", "lime", "gold"], mode: "linear", angle: 270 });
    expect(scene.doc.steps.flatMap((step) => step.actions).map((action) => action.verb)).toEqual([
      "mark", "cam", "zoom", "travel", "disintegrate", "burst", "breathe",
    ]);
    const travel = scene.doc.steps.flatMap((step) => step.actions).find((action) => action.verb === "travel");
    const breathe = scene.doc.steps.flatMap((step) => step.actions).find((action) => action.verb === "breathe");
    expect(travel).toMatchObject({ target: "rider", ref: "f", dur: 1.4, ease: "smooth" });
    expect(breathe).toMatchObject({ target: "L", amount: 3, values: [0.05, 0], dur: 7 });
  });

  it("keeps an unchanged calculus scene byte-identical", () => {
    const scene = readSceneSource(SOURCE);
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
  });

  it("recomputes dependents and surgically serializes a plot formula edit", () => {
    const scene = readSceneSource(SOURCE);
    const before = graphPoint(scene.doc.entities[0] as PlotEntity, 1.5, geometryContext(scene.doc));
    const next = cloneDoc(scene.doc);
    (next.entities[0] as PlotEntity).formula = "x^2";
    const after = graphPoint(next.entities[0] as PlotEntity, 1.5, geometryContext(next));
    expect(before?.value).not.toBe(after?.value);
    const updated = patchSceneSource(SOURCE, scene, next);
    expect(updated).toContain('plot(f, (640, 430), 100, 60, "x^2", (-2.2, 2.2));');
    expect(updated).toContain("deriv(df, f, magenta);");
    expect(updated).toContain("gradient(f, blue, lime, gold, 270);");
    expect(readSceneSource(updated).skipped).toEqual([]);
  });

  it("shows a travel relationship as semantic Canvas intent", () => {
    const scene = readSceneSource(SOURCE);
    const rider = scene.doc.entities.find((entity) => entity.id === "rider")!;
    expect(canvasAnnotations(rider, scene.doc)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "timeline", representation: "semantic", refs: ["f"] }),
    ]));
  });

  it("supports limits at both positive and negative infinity", () => {
    const scene = readSceneSource('plot(f, (300,300), 80, 50, "1/(1+exp(-x))", (-3,3));\nlimit(left, f, -inf);\nlimit(right, f, inf);\n');
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.slice(1).map((entity) => entity.kind === "limit" ? entity.at : null)).toEqual([-Infinity, Infinity]);
  });
});

const CALCULUS_ONE = resolve(import.meta.dirname, "../../../manic/examples/calculus-one.manic");

describe.skipIf(!existsSync(CALCULUS_ONE))("calculus-one.manic acceptance", () => {
  it("projects the whole animation without skips and preserves every byte", () => {
    const source = readFileSync(CALCULUS_ONE, "utf8");
    const scene = readSceneSource(source);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities).toHaveLength(71);
    expect(scene.doc.steps).toHaveLength(150);
    expect(scene.doc.steps.reduce((count, step) => count + step.actions.length, 0)).toBe(227);
    expect(patchSceneSource(source, scene, cloneDoc(scene.doc))).toBe(source);
  });
});

const BAND_FILE = resolve(import.meta.dirname, "../../../manic/examples/band.manic");

describe.skipIf(!existsSync(BAND_FILE))("band.manic acceptance", () => {
  it("projects the complete scene, exposes both plots, and preserves every byte", () => {
    const source = readFileSync(BAND_FILE, "utf8"), scene = readSceneSource(source);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map((entity) => entity.kind)).toEqual(["text", "axes", "plot", "plot", "band", "text"]);
    const plots = scene.doc.entities.filter((entity): entity is PlotEntity => entity.kind === "plot");
    expect(plots.map((plot) => plot.id)).toEqual(["upper", "lower"]);
    expect(defFor(plots[0]).fields.map((field) => field.key)).toEqual(["formula", "sx", "sy", "x0", "x1", "strokeWidth"]);
    const band = scene.doc.entities.find((entity): entity is BandEntity => entity.kind === "band")!;
    expect(band).toMatchObject({ top: "upper", bottom: "lower", color: "lime", opacity: .28, reveal: "fade", restricted: false });
    expect(bandGeometry(band, geometryContext(scene.doc))).toMatchObject({ x0: 0, x1: 6.3, issue: null });
    expect(bandGeometry(band, geometryContext(scene.doc)).points).toHaveLength(322);
    expect(canvasAnnotations(band, scene.doc)).toEqual(expect.arrayContaining([
      expect.objectContaining({ representation: "semantic", refs: ["upper", "lower"] }),
      expect.objectContaining({ id: "reveal", detail: expect.stringContaining("opacity") }),
    ]));
    expect(scene.doc.steps.flatMap((step) => step.actions).some((action) => action.verb === "to" && action.target === "gap")).toBe(true);
    expect(patchSceneSource(source, scene, cloneDoc(scene.doc))).toBe(source);
    expect(vocabularyEntry("band")?.fidelity).toBe("semantic");
  });

  it("supports constructor colour/range, Canvas defaults, and rename-safe curve references", () => {
    const parsed = readSceneSource('plot(top, (300,300), 80, 60, "x+1", (0,4));\nplot(bottom, (300,300), 80, 60, "sin(x)", (0,4));\nband(slice, top, bottom, gold, (1,3));\n');
    expect(parsed.skipped).toEqual([]);
    const slice = parsed.doc.entities[2] as BandEntity;
    expect(slice).toMatchObject({ constructorColor: "gold", color: "gold", restricted: true, a: 1, b: 3 });
    const next = cloneDoc(parsed.doc), renamed = next.entities[2] as BandEntity;
    next.entities[0].id = "ceiling";
    replaceEntityReference(renamed, "top", "ceiling");
    const patched = patchSceneSource('plot(top, (300,300), 80, 60, "x+1", (0,4));\nplot(bottom, (300,300), 80, 60, "sin(x)", (0,4));\nband(slice, top, bottom, gold, (1,3));\n', parsed, next);
    expect(patched).toContain("band(slice, ceiling, bottom, gold, (1, 3));");
    expect(readSceneSource(patched).skipped).toEqual([]);

    const doc = readSceneSource('plot(top, (300,300), 80, 60, "x+1", (0,4));\nplot(bottom, (300,300), 80, 60, "sin(x)", (0,4));\n').doc;
    doc.entities.push(createEntity("band", "gap", 0, 0, doc, "top"));
    const created = serializeSceneFile(doc);
    expect(created).toContain("band(gap, top, bottom);");
    expect(created).not.toContain("opacity(gap,");
    expect(created).not.toContain("color(gap,");
    expect(readSceneSource(created).skipped).toEqual([]);
  });
});
