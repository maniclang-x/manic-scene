import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allVocabularyEntries, beatAvailability, beatTargetOptions, canvasAnnotations, cloneDoc, compileScene, createBeatAction,
  defFor, entriesForSurface, patchSceneSource, readSceneSource, referenceIds,
  serializeSceneFile, vocabularyEntry,
} from "./index.js";
import type { LoupeEntity, SlidersEntity } from "./types.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";
const SOURCE = `canvas(1280, 720);
template("black");

rect(chamber, (250, 420), 300, 190);
particles(dots, chamber, 12, 5, 7, "random");
sliders(coords, 4, (430, 240), 420, 220, gold);
loupe(detail, (250, 420), 120, 80, (930, 350), 2.5, violet, red);

step("coordinates") { setsliders(coords, "0.5 -0.25 0.8 0.1", 1.2, inout); }
step("ambient") { wander(dots, 2.4); }
`;

describe("Core UI and control batch", () => {
  it("round-trips the full batch and passes native validation", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.find((entity): entity is SlidersEntity => entity.kind === "sliders")).toMatchObject({ id: "coords", count: 4, x: 430, y: 240, width: 420, height: 220, color: "gold" });
    expect(scene.doc.entities.find((entity): entity is LoupeEntity => entity.kind === "loupe")).toMatchObject({ id: "detail", sourceX: 250, sourceY: 420, panelX: 930, panelY: 350, magnification: 2.5, panelColor: "red" });
    expect(scene.doc.steps.flatMap((step) => step.actions)).toEqual(expect.arrayContaining([
      expect.objectContaining({ verb: "setsliders", target: "coords", values: [.5, -.25, .8, .1], dur: 1.2 }),
      expect.objectContaining({ verb: "wander", target: "dots", dur: 2.4 }),
    ]));
    const regenerated = serializeSceneFile(scene.doc), roundTrip = readSceneSource(regenerated);
    expect(roundTrip.skipped).toEqual([]);
    expect(roundTrip.doc).toEqual(scene.doc);
    if (existsSync(MANIC)) {
      const path = join(tmpdir(), "manic-core-controls.manic");
      writeFileSync(path, regenerated);
      expect(() => execFileSync(MANIC, ["check", path], { stdio: "pipe" })).not.toThrow();
    }
  });

  it("compiles slider values as editable semantic Canvas channels", () => {
    const frame = compileScene(readSceneSource(SOURCE).doc).sample(1.2).get("coords")!;
    expect(frame.aux["slider-0"]).toBeCloseTo(.5, 5);
    expect(frame.aux["slider-1"]).toBeCloseTo(-.25, 5);
    expect(frame.aux["slider-2"]).toBeCloseTo(.8, 5);
    expect(frame.aux["slider-3"]).toBeCloseTo(.1, 5);
  });

  it("builds one compact Story value control per target dial", () => {
    const doc = readSceneSource(SOURCE).doc;
    const result = createBeatAction(doc, "setsliders", "coords");
    expect(result.error).toBe("");
    expect(result.action).toMatchObject({ target: "coords", values: [0, 0, 0, 0] });
  });

  it("preserves native child identities and direct loupe manipulation", () => {
    const doc = readSceneSource(SOURCE).doc;
    const rack = doc.entities.find((entity): entity is SlidersEntity => entity.kind === "sliders")!;
    expect(referenceIds(rack)).toEqual(expect.arrayContaining(["coords.dials", "coords.d0", "coords.line3", "coords.label2", "coords.sum"]));
    const loupe = doc.entities.find((entity): entity is LoupeEntity => entity.kind === "loupe")!;
    expect(referenceIds(loupe)).toEqual(["detail.frame", "detail.panel"]);
    const def = defFor(loupe), handles = def.handles(loupe);
    expect(handles.map((handle) => handle.name)).toEqual(["source-size", "panel-position"]);
    def.dragHandle(loupe, "panel-position", 1000, 410);
    def.dragHandle(loupe, "source-size", 330, 475);
    expect(loupe).toMatchObject({ panelX: 1000, panelY: 410, sourceWidth: 160, sourceHeight: 110 });
  });

  it("targets real loupe children for Canvas-authored motion", () => {
    const doc = readSceneSource(SOURCE).doc;
    expect(beatAvailability(doc, "move", "detail")).toMatchObject({ enabled: true });
    expect(beatTargetOptions(doc, "move").filter((option) => option.ownerId === "detail").map((option) => option.id)).toEqual(["detail.frame", "detail.panel"]);
    const move = createBeatAction(doc, "move", "detail").action!;
    expect(move).toMatchObject({ target: "detail.frame", point: { x: 370, y: 420 } });
    doc.steps.push({ name: "move loupe", mode: "together", gap: .1, actions: [move] });
    const source = serializeSceneFile(doc);
    expect(source).toContain("move(detail.frame, (370, 420)");
    expect(readSceneSource(source).skipped).toEqual([]);
  });

  it("surgically edits values, rack geometry, loupe placement, and wander duration", () => {
    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    const rack = next.entities.find((entity): entity is SlidersEntity => entity.kind === "sliders")!;
    rack.count = 3; rack.width = 360;
    next.steps[0].actions[0].values = [.2, .4, .6];
    const loupe = next.entities.find((entity): entity is LoupeEntity => entity.kind === "loupe")!;
    loupe.panelX = 1040; loupe.magnification = 3;
    next.steps[1].actions[0].dur = 4;
    const updated = patchSceneSource(SOURCE, scene, next);
    expect(updated).toContain("sliders(coords, 3, (430, 240), 360, 220, gold);");
    expect(updated).toContain('setsliders(coords, "0.2 0.4 0.6", 1.2');
    expect(updated).toContain("loupe(detail, (250, 420), 120, 80, (1040, 350), 3, violet, red);");
    expect(updated).toContain("wander(dots, 4);");
    expect(readSceneSource(updated).skipped).toEqual([]);
  });

  it("keeps invalid slider vectors Source-owned instead of misrepresenting them", () => {
    const scene = readSceneSource('canvas("16:9"); sliders(s, 3, (400, 300)); step("bad") { setsliders(s, "1 0", 1); }');
    expect(scene.doc.steps[0]?.actions).toEqual([]);
    expect(scene.skipped.join("\n")).toContain("setsliders");
  });

  it("indexes the batch and explains Canvas versus Preview fidelity", () => {
    const doc = readSceneSource(SOURCE).doc;
    for (const name of ["sliders", "setsliders", "loupe", "wander"]) expect(vocabularyEntry(name), name).toMatchObject({ fidelity: "semantic" });
    expect(entriesForSurface("add").map((entry) => entry.name)).toEqual(expect.arrayContaining(["sliders", "loupe"]));
    expect(entriesForSurface("animate").map((entry) => entry.name)).toEqual(expect.arrayContaining(["setsliders", "wander"]));
    expect(canvasAnnotations(doc.entities.find((entity) => entity.id === "coords")!, doc)).toEqual(expect.arrayContaining([expect.objectContaining({ label: "4 addressable dials" })]));
    expect(canvasAnnotations(doc.entities.find((entity) => entity.id === "detail")!, doc)).toEqual(expect.arrayContaining([expect.objectContaining({ label: "2.5× live magnifier" })]));
    expect(allVocabularyEntries(true).filter((entry) => entry.fidelity !== "source-only").length).toBeGreaterThanOrEqual(186);
  });

  it("accepts the native sliders, moving-loupe, and particle-flow examples byte-exactly", () => {
    for (const path of [
      "/Users/anish/git/manic/examples/3b1b-eval/high-dimensions.manic",
      "/Users/anish/git/manic/examples/manim-vs/moving-zoomed-scene.manic",
      "/Users/anish/git/manic/examples/particles-flow.manic",
    ]) {
      const source = readFileSync(path, "utf8"), scene = readSceneSource(source);
      expect(scene.skipped, path).toEqual([]);
      expect(patchSceneSource(source, scene, cloneDoc(scene.doc)), path).toBe(source);
    }
  });
});
