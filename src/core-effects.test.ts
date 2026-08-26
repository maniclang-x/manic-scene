import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allVocabularyEntries, canvasAnnotations, cloneDoc, compileScene, emptyDoc,
  entriesForSurface, patchSceneSource, readSceneSource, serializeSceneFile,
  sweepGeometry, vocabularyAvailability, vocabularyEntry,
} from "./index.js";
import type { SweepEntity, TrailEntity } from "./types.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";
const SOURCE = `canvas(1000, 760);
template("black");

plot(card, (160, 120), 90, 70, sin, 6.28);
circle(marker, (350, 320), 44);
line(pointer, (120, 500), (300, 500));
tag(marker, focus);
tag(pointer, focus);
trail(trace, marker, gold, 3);
sweep(grid, card, sx, (60, 160), sy, (50, 130), (720, 330), 3, 2, 170, 145, 0, 0.9);

step("grow") { grow(pointer, marker, 0.8, inout); }
step("blink") { blink(marker, 0.8); }
step("wiggle") { wiggle(marker, 0.6); }
step("box") { circumscribe(focus, magenta, 1); }
step("light") { spotlight(focus, 1.2); }
step("pass") { passflash(pointer, cyan, 1); }
step("spiral") { spiralin(focus, 1.4); }
`;

describe("Core reveal and emphasis batch", () => {
  it("parses all constructors and verbs, round-trips, and passes native validation", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.find((entity) => entity.kind === "trail")).toMatchObject({ target: "marker", color: "gold", thickness: 3 });
    expect(scene.doc.entities.find((entity) => entity.kind === "sweep")).toMatchObject({ template: "card", xParam: "sx", yParam: "sy", cols: 3, rows: 2, keepOverlays: false, fit: .9 });
    expect(scene.doc.steps.flatMap((step) => step.actions).map((action) => action.verb)).toEqual(["grow", "blink", "wiggle", "circumscribe", "spotlight", "passflash", "spiralin"]);

    const regenerated = serializeSceneFile(scene.doc), roundTrip = readSceneSource(regenerated);
    expect(roundTrip.skipped).toEqual([]);
    expect(roundTrip.doc).toEqual(scene.doc);
    if (existsSync(MANIC)) {
      const path = join(tmpdir(), "manic-core-effects.manic");
      writeFileSync(path, regenerated);
      expect(() => execFileSync(MANIC, ["check", path], { stdio: "pipe" })).not.toThrow();
    }
  });

  it("uses bounded deterministic sweep geometry and exact Canvas blink/wiggle tracks", () => {
    const doc = readSceneSource(SOURCE).doc;
    const sweep = doc.entities.find((entity): entity is SweepEntity => entity.kind === "sweep")!;
    const geometry = sweepGeometry(sweep);
    expect(geometry.total).toBe(6);
    expect(geometry.cells).toHaveLength(6);
    expect(geometry.bounds).toEqual({ x: 465, y: 185, width: 510, height: 290 });
    expect(geometry.cells[0]).toMatchObject({ xValue: 60, yValue: 50 });
    expect(geometry.cells.at(-1)).toMatchObject({ xValue: 160, yValue: 130 });

    const timeline = compileScene(doc);
    expect(timeline.sample(1).get("marker")?.opacity).toBeCloseTo(0, 5);
    expect(timeline.sample(1.2).get("marker")?.opacity).toBeCloseTo(1, 5);
    expect(timeline.sample(1.4).get("marker")?.opacity).toBeCloseTo(0, 5);
    expect(timeline.sample(1.6).get("marker")?.opacity).toBeCloseTo(1, 5);
    expect(timeline.sample(1.9).get("marker")?.scale).toBeGreaterThan(1);
    expect(timeline.sample(2.2).get("marker")?.scale).toBeCloseTo(1, 5);
    expect(timeline.sample(2.2).get("marker")?.rotation).toBeCloseTo(0, 5);
  });

  it("surgically edits dependency fields and action destinations", () => {
    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    const trail = next.entities.find((entity): entity is TrailEntity => entity.kind === "trail")!;
    trail.target = "pointer";
    const sweep = next.entities.find((entity): entity is SweepEntity => entity.kind === "sweep")!;
    sweep.cols = 4;
    sweep.xParam = "sy";
    const grow = next.steps[0].actions[0];
    grow.ref = null;
    grow.point = { x: 610, y: 510 };
    const updated = patchSceneSource(SOURCE, scene, next);
    expect(updated).toContain("trail(trace, pointer, gold, 3);");
    expect(updated).toContain("sweep(grid, card, sy, (60, 160), sy, (50, 130), (720, 330), 4, 2, 170, 145, 0, 0.9);");
    expect(updated).toContain("grow(pointer, (610, 510), 0.8");
    expect(readSceneSource(updated).skipped).toEqual([]);
  });

  it("indexes the batch on Add/Animate surfaces with honest semantic notes", () => {
    const doc = readSceneSource(SOURCE).doc;
    for (const name of ["trail", "sweep", "grow", "blink", "wiggle", "circumscribe", "passflash", "spotlight", "spiralin"]) {
      expect(vocabularyEntry(name), name).toMatchObject({ fidelity: "semantic" });
    }
    expect(entriesForSurface("add").map((entry) => entry.name)).toEqual(expect.arrayContaining(["trail", "sweep"]));
    expect(entriesForSurface("animate").map((entry) => entry.name)).toEqual(expect.arrayContaining(["grow", "blink", "wiggle", "circumscribe", "passflash", "spotlight", "spiralin"]));
    expect(canvasAnnotations(doc.entities.find((entity) => entity.id === "trace")!, doc)).toEqual(expect.arrayContaining([expect.objectContaining({ label: "Records marker" })]));
    expect(canvasAnnotations(doc.entities.find((entity) => entity.id === "grid")!, doc)).toEqual(expect.arrayContaining([expect.objectContaining({ label: "6 evaluations of card" })]));

    const empty = emptyDoc();
    expect(vocabularyAvailability(vocabularyEntry("trail")!, empty)).toMatchObject({ enabled: false });
    expect(vocabularyAvailability(vocabularyEntry("sweep")!, empty)).toMatchObject({ enabled: false });
    expect(allVocabularyEntries(true).filter((entry) => entry.fidelity !== "source-only").length).toBeGreaterThanOrEqual(175);
  });
});
