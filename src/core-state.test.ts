import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allVocabularyEntries, applyVocabularyFeature, canvasAnnotations, cloneDoc, compileScene,
  createAction, createEntity, emptyDoc, entriesForSurface, patchSceneSource, readSceneSource,
  serializeSceneFile, vocabularyAvailability, vocabularyEntry,
} from "./index.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";
const SOURCE = `canvas(1000, 720);
template("black");

rect(panel, (280, 300), 180, 120);
circle(token, (700, 330), 55);
savestate(panel);

step("absolute angle") { rotate(panel, 45, 0.6, smooth); }
step("property alias") { set(panel, opacity, 0.65, 0.4, linear); }
step("matrix") { transform(panel, (500, 360), 1, 0.25, 0, 1, 0.8, smooth); }
step("exchange") { swap(panel, token, 0.7, smooth); }
step("homotopy") { deform(token, "x", "y + 24*sin(x*0.05 + t*8)*sin(pi*t)", 1, smooth); }
step("return") { restore(panel, 0.8, smooth); }
`;

describe("Core state and transform batch", () => {
  it("round-trips the full batch and passes native validation", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.find((entity) => entity.id === "panel")?.savedState).toBe(true);
    expect(scene.doc.steps.flatMap((step) => step.actions).map((action) => action.verb)).toEqual(["rotate", "set", "transform", "swap", "deform", "restore"]);
    expect(scene.doc.steps[2].actions[0]).toMatchObject({ point: { x: 500, y: 360 }, values: [1, .25, 0, 1] });
    expect(scene.doc.steps[4].actions[0].texts).toEqual(["x", "y + 24*sin(x*0.05 + t*8)*sin(pi*t)"]);

    const regenerated = serializeSceneFile(scene.doc), roundTrip = readSceneSource(regenerated);
    expect(roundTrip.skipped).toEqual([]);
    expect(roundTrip.doc).toEqual(scene.doc);
    if (existsSync(MANIC)) {
      const path = join(tmpdir(), "manic-core-state.manic");
      writeFileSync(path, regenerated);
      expect(() => execFileSync(MANIC, ["check", path], { stdio: "pipe" })).not.toThrow();
    }
  });

  it("tracks absolute rotation, Set, matrix anchor motion, and Restore on Canvas", () => {
    const timeline = compileScene(readSceneSource(SOURCE).doc);
    expect(timeline.sample(.6).get("panel")?.rotation).toBeCloseTo(45, 5);
    expect(timeline.sample(1).get("panel")?.opacity).toBeCloseTo(.65, 5);
    expect(timeline.sample(1.8).get("panel")?.x).toBeCloseTo(265, 5);
    expect(timeline.sample(4.3).get("panel")).toMatchObject({ x: 280, y: 300, opacity: 1, scale: 1, rotation: 0 });
  });

  it("broadcasts absolute rotation across an authored tag in the Canvas timeline", () => {
    const doc = emptyDoc(), a = createEntity("circle", "a", 220, 260, doc), b = createEntity("rect", "b", 520, 260, doc);
    a.tags = ["pair"]; b.tags = ["pair"];
    doc.entities.push(a, b);
    doc.steps.push({ name: "turn group", mode: "together", gap: .1, actions: [{ ...createAction("rotate", "pair"), amount: 72, dur: .5 }] });
    const end = compileScene(doc).sample(.5);
    expect(end.get("a")?.rotation).toBeCloseTo(72, 5);
    expect(end.get("b")?.rotation).toBeCloseTo(72, 5);
  });

  it("surgically edits snapshot state, matrices, relationships, and formulas", () => {
    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    delete next.entities.find((entity) => entity.id === "panel")!.savedState;
    next.steps[0].actions[0].amount = 90;
    next.steps[1].actions[0].prop = "scale";
    next.steps[1].actions[0].amount = 1.2;
    next.steps[2].actions[0].point = { x: 480, y: 350 };
    next.steps[2].actions[0].values = [.8, -.2, .2, .8];
    next.steps[4].actions[0].texts = ["x + 8*sin(pi*t)", "y"];
    const updated = patchSceneSource(SOURCE, scene, next);
    expect(updated).not.toContain("savestate(panel);");
    expect(updated).toContain("rotate(panel, 90, 0.6");
    expect(updated).toContain("set(panel, scale, 1.2, 0.4, linear);");
    expect(updated).toContain("transform(panel, (480, 350), 0.8, -0.2, 0.2, 0.8, 0.8");
    expect(updated).toContain('deform(token, "x + 8*sin(pi*t)", "y", 1);');
    expect(readSceneSource(updated).skipped).toEqual([]);
  });

  it("offers Saved state contextually and exposes honest vocabulary annotations", () => {
    const doc = emptyDoc(), panel = createEntity("rect", "panel", 260, 240, doc), token = createEntity("circle", "token", 620, 240, doc);
    doc.entities.push(panel, token);
    expect(vocabularyAvailability(vocabularyEntry("restore")!, doc, "panel")).toMatchObject({ enabled: false });
    expect(applyVocabularyFeature(panel, "savestate", doc)).toBe(true);
    expect(vocabularyAvailability(vocabularyEntry("restore")!, doc, "panel")).toMatchObject({ enabled: true });
    expect(vocabularyAvailability(vocabularyEntry("savestate")!, doc, "panel")).toMatchObject({ enabled: false });
    expect(serializeSceneFile(doc)).toContain("savestate(panel);");

    const parsed = readSceneSource(SOURCE).doc, parsedPanel = parsed.entities.find((entity) => entity.id === "panel")!;
    expect(canvasAnnotations(parsedPanel, parsed)).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Transform and style state saved" }),
      expect.objectContaining({ label: "2×2 matrix transform" }),
      expect.objectContaining({ label: "Returns to saved state" }),
    ]));
    for (const name of ["savestate", "rotate", "set", "swap", "transform", "deform", "restore"]) expect(vocabularyEntry(name), name).toMatchObject({ fidelity: "semantic" });
    expect(entriesForSurface("feature").map((entry) => entry.name)).toContain("savestate");
    expect(entriesForSurface("animate").map((entry) => entry.name)).toEqual(expect.arrayContaining(["rotate", "set", "swap", "transform", "deform", "restore"]));
    expect(allVocabularyEntries(true).filter((entry) => entry.fidelity !== "source-only").length).toBeGreaterThanOrEqual(182);
  });

  it("accepts the native deform and save/cycle/restore examples byte-exactly", () => {
    for (const path of [
      "/Users/anish/git/manic/examples/manim-vs/deform-homotopy.manic",
      "/Users/anish/git/manic/examples/manim-vs/spiral-cycle-restore.manic",
    ]) {
      const source = readFileSync(path, "utf8"), scene = readSceneSource(source);
      expect(scene.skipped, path).toEqual([]);
      expect(patchSceneSource(source, scene, cloneDoc(scene.doc)), path).toBe(source);
    }
  });
});
