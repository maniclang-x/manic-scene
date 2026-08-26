import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canvasAnnotations, cloneDoc, createBeatAction, createEntity, derivedPathPoints, geometryContext,
  featureAvailability, patchSceneSource, readSceneSource, serializeSceneFile, supportGeometry,
  vocabularyAvailability, vocabularyEntry,
} from "./index.js";
import type { InvertPathEntity, ReflectPathEntity, SupportEntity } from "./types.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";
const SOURCE = `canvas(1280, 720);
template("black");

circle(body, (300, 300), 70);
dot(O, (520, 300), 7);
line(mirror, (640, 120), (640, 600));
support(ground, (360, 560), 280, "up");
color(ground, dim);
invertpath(inv, body, O, 150, 96);
stroke(inv, 4);
reflectpath(reflected, body, mirror, 96);
stroke(reflected, 4);
framebox(focus, body, 8, gold);

step("Move the highlight") {
  surround(focus, reflected, 0.8, inout);
}
`;

describe("Core geometry relationship batch", () => {
  it("round-trips and passes native validation", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map((entity) => entity.kind)).toEqual([
      "circle", "dot", "line", "support", "invertpath", "reflectpath", "framebox",
    ]);
    expect(scene.doc.entities[3]).toMatchObject({ kind: "support", length: 280, direction: "up", color: "dim" });
    expect(scene.doc.entities[4]).toMatchObject({ kind: "invertpath", source: "body", center: "O", radius: 150, samples: 96, strokeWidth: 4 });
    expect(scene.doc.entities[5]).toMatchObject({ kind: "reflectpath", source: "body", mirror: "mirror", samples: 96, strokeWidth: 4 });
    expect(scene.doc.steps[0].actions[0]).toMatchObject({ verb: "surround", target: "focus", ref: "reflected", dur: .8 });

    const regenerated = serializeSceneFile(scene.doc);
    const roundTrip = readSceneSource(regenerated);
    expect(roundTrip.skipped).toEqual([]);
    expect(roundTrip.doc).toEqual(scene.doc);
    if (existsSync(MANIC)) {
      const path = join(tmpdir(), "manic-core-geometry-relations.manic");
      writeFileSync(path, regenerated);
      expect(() => execFileSync(MANIC, ["check", path], { stdio: "pipe" })).not.toThrow();
    }
  });

  it("keeps support and derived geometry live when dependencies change", () => {
    const scene = readSceneSource(SOURCE), context = geometryContext(scene.doc);
    const support = scene.doc.entities[3] as SupportEntity;
    const inverted = scene.doc.entities[4] as InvertPathEntity;
    const reflected = scene.doc.entities[5] as ReflectPathEntity;
    expect(supportGeometry(support).ticks).toHaveLength(Math.floor(280 / 15) + 1);
    expect(derivedPathPoints(inverted, context)).toHaveLength(96);
    expect(derivedPathPoints(reflected, context)).toHaveLength(96);

    const next = cloneDoc(scene.doc);
    const body = next.entities.find((entity) => entity.id === "body") as Extract<typeof next.entities[number], { kind: "circle" }>;
    body.x += 80;
    expect(derivedPathPoints(next.entities[4] as InvertPathEntity, geometryContext(next))).not.toEqual(derivedPathPoints(inverted, context));
    expect(derivedPathPoints(next.entities[5] as ReflectPathEntity, geometryContext(next))).not.toEqual(derivedPathPoints(reflected, context));
  });

  it("surgically patches editable native arguments", () => {
    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    (next.entities[3] as SupportEntity).direction = "left";
    (next.entities[4] as InvertPathEntity).radius = 190;
    (next.entities[5] as ReflectPathEntity).samples = 144;
    const updated = patchSceneSource(SOURCE, scene, next);
    expect(updated).toContain('support(ground, (360, 560), 280, "left");');
    expect(updated).toContain("invertpath(inv, body, O, 190, 96);");
    expect(updated).toContain("reflectpath(reflected, body, mirror, 144);");
    expect(readSceneSource(updated).skipped).toEqual([]);
  });

  it("exposes honest vocabulary, creation prerequisites, and semantic meaning", () => {
    const doc = readSceneSource(SOURCE).doc;
    expect(vocabularyEntry("support")).toMatchObject({ fidelity: "exact", surfaces: expect.arrayContaining(["add", "language"]) });
    for (const name of ["invertpath", "reflectpath", "surround"]) expect(vocabularyEntry(name), name).toMatchObject({ fidelity: "semantic" });
    expect(createBeatAction(doc, "surround", "focus").action).toMatchObject({ target: "focus", verb: "surround" });
    expect(canvasAnnotations(doc.entities[4], doc)).toEqual(expect.arrayContaining([expect.objectContaining({ representation: "semantic", refs: expect.arrayContaining(["body", "O"]) })]));
    expect(canvasAnnotations(doc.entities[6], doc)).toEqual(expect.arrayContaining([expect.objectContaining({ label: "Surrounds reflected", refs: ["reflected"] })]));

    for (const name of ["draw", "erase", "flow", "travel"]) {
      expect(vocabularyAvailability(vocabularyEntry(name)!, doc, "inv"), name).toMatchObject({ enabled: true });
    }
    for (const name of ["gradient", "dashed"] as const) {
      expect(featureAvailability(name, doc, doc.entities[4]), name).toMatchObject({ enabled: true });
    }

    const empty = { format: "16:9", template: "black", entities: [], steps: [] } as const;
    expect(() => createEntity("support", "wall", 100, 100, empty)).not.toThrow();
  });
});
