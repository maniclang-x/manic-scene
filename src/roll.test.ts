import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allVocabularyEntries, beatAvailability, canvasAnnotations, cloneDoc, createBeatAction,
  patchSceneSource, readSceneSource, serializeSceneFile,
} from "./index.js";

const source = `title("Rolling without slipping");
canvas("16:9");
line(rail, (100, 400), (700, 400));
circle(wheel, (180, 340), 60);
circle(pen, (180, 300), 6);
tag(wheel, rig);
tag(pen, rig);
step("roll") {
  roll(rig, rail, 600, 4, linear);
}
`;

describe("Roll onboarding", () => {
  it("syncs the 491st engine builtin as semantic Story vocabulary", () => {
    const entries = allVocabularyEntries(true);
    expect(entries.filter((entry) => entry.kit !== "editor")).toHaveLength(491);
    expect(entries.find((entry) => entry.name === "roll")).toMatchObject({ kind: "verb", kit: "std", fidelity: "semantic" });
  });

  it("round-trips a tagged rolling rig and keeps its track rename-safe", () => {
    const scene = readSceneSource(source);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.steps[0].actions[0]).toMatchObject({ verb: "roll", target: "rig", ref: "rail", amount: 600, dur: 4, ease: "linear", amountExplicit: true, durationExplicit: true });
    expect(serializeSceneFile(scene.doc)).toContain("roll(rig, rail, 600, 4);");
    expect(patchSceneSource(source, scene, cloneDoc(scene.doc))).toBe(source);
  });

  it("derives the native omitted amount from the selected track", () => {
    const line = readSceneSource("line(rail, (0, 0), (300, 400)); circle(wheel, (0, -20), 20); roll(wheel, rail);");
    expect(line.skipped).toEqual([]);
    expect(line.doc.steps[0].actions[0]).toMatchObject({ amount: 500, amountExplicit: false, dur: 2, durationExplicit: false, ease: "linear" });
    expect(serializeSceneFile(line.doc)).toContain("roll(wheel, rail);");

    const circle = readSceneSource("circle(track, (300, 300), 180); circle(wheel, (300, 80), 40); roll(wheel, track);");
    expect(circle.skipped).toEqual([]);
    expect(circle.doc.steps[0].actions[0]).toMatchObject({ amount: 1, amountExplicit: false });
  });

  it("creates a complete Canvas beat and marks native Preview authority", () => {
    const scene = readSceneSource("line(rail, (100, 400), (700, 400)); circle(wheel, (180, 340), 60);");
    expect(beatAvailability(scene.doc, "roll", "wheel")).toEqual({ enabled: true, reason: "" });
    const action = createBeatAction(scene.doc, "roll", "wheel").action!;
    expect(action).toMatchObject({ target: "wheel", ref: "rail", amount: 600, amountExplicit: false, dur: 2, ease: "linear" });
    scene.doc.steps.push({ name: "Roll", mode: "together", gap: .15, actions: [action] });
    expect(canvasAnnotations(scene.doc.entities.find((entity) => entity.id === "wheel")!, scene.doc).find((note) => note.id.startsWith("roll-"))).toMatchObject({ representation: "semantic", refs: ["rail"], detail: expect.stringContaining("Preview") });
  });
});

const examples = resolve(import.meta.dirname, "../../../manic/examples");
for (const file of ["roulettes.manic", "hypotrochoid.manic", "prolate-cycloid.manic", "centered-trochoid.manic"]) {
  it.skipIf(!existsSync(resolve(examples, file)))(`${file} projects roll and remains byte-identical`, () => {
    const original = readFileSync(resolve(examples, file), "utf8"), scene = readSceneSource(original);
    expect(scene.skipped.filter((note) => /`roll` isn't canvas vocabulary yet/u.test(note))).toEqual([]);
    expect(patchSceneSource(original, scene, cloneDoc(scene.doc))).toBe(original);
  });
}
