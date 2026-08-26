import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyVocabularyFeature, cloneDoc, createBeatAction, patchSceneSource, readSceneSource,
  replaceActionReference, replaceEntityReference, serializeSceneFile, vocabularyAvailability, vocabularyEntry,
} from "./index.js";
import type { ParameterEntity, SceneAction } from "./types.js";

const SOURCE = `canvas(1280, 720);
template("black");

parameter(speed, (160, 90), 0.5, 0, 1, "speed", 2);
circle(source, (280, 330), 55);
circle(blueprint, (560, 330), 90);
hidden(blueprint);
morph(source, blueprint, 120);
bind(speed, source, x, 240, 720);
bind(speed, source, scale, "0.8+0.4*p");
line(path, (220, 560), (980, 560));
text(tag, (280, 230), "subject");

step("Motion relationships") {
  seq {
    turn(source, (420, 330), 90, 1.2, smooth);
    flow(path, 1.4, both, continuous);
    become(source, blueprint, 0.8, out);
    attach(tag, source, (0, -78));
    oscillate(source, hue, 2.5, 35, 0.25, 5);
    shake(source, 0.6);
    followshot(source, (20, 0));
    followshot(none);
  }
}
`;
const MANIC = "/Users/anish/git/manic/target/debug/manic";

describe("motion and live relationships", () => {
  it("projects native parameter, bind, morph, and Story payloads", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    const parameter = scene.doc.entities[0] as ParameterEntity;
    expect(parameter).toMatchObject({ kind: "parameter", value: .5, min: 0, max: 1, label: "speed", decimals: 2 });
    expect(parameter.bindings).toEqual([
      { target: "source", property: "x", formulas: [], from: 240, to: 720 },
      { target: "source", property: "scale", formulas: ["0.8+0.4*p"], from: null, to: null },
    ]);
    expect(scene.doc.entities[1].morph2).toEqual({ target: "blueprint", spin: 120 });
    const actions = scene.doc.steps[0].actions;
    expect(actions.map((action) => action.verb)).toEqual(["turn", "flow", "become", "attach", "oscillate", "shake", "followshot", "followshot"]);
    expect(actions[0]).toMatchObject({ target: "source", point: { x: 420, y: 330 }, amount: 90, dur: 1.2 });
    expect(actions[1]).toMatchObject({ target: "path", prop: "both", text: "continuous", dur: 1.4 });
    expect(actions[3]).toMatchObject({ target: "tag", ref: "source", point: { x: 0, y: -78 }, dur: 0 });
    expect(actions[4]).toMatchObject({ prop: "hue", values: [2.5, 35, .25], dur: 5 });
    expect(actions[7]).toMatchObject({ target: "none", dur: 0 });
  });

  it("identity-patches exactly and surgically edits relationships", () => {
    const scene = readSceneSource(SOURCE);
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
    const next = cloneDoc(scene.doc);
    const parameter = next.entities[0] as ParameterEntity;
    parameter.value = .75;
    parameter.bindings[0].to = 840;
    next.entities[1].morph2 = { target: "blueprint", spin: -90 };
    next.steps[0].actions[0].ref = "blueprint";
    next.steps[0].actions[0].point = null;
    next.steps[0].actions[1].prop = "reverse";
    next.steps[0].actions[1].text = "once";
    next.steps[0].actions[4].values = [3, 20, .5];
    const updated = patchSceneSource(SOURCE, scene, next);
    expect(updated).toContain('parameter(speed, (160, 90), 0.75, 0, 1, "speed");');
    expect(updated).toContain("bind(speed, source, x, 240, 840);");
    expect(updated).toContain("morph(source, blueprint, -90);");
    expect(updated).toContain("turn(source, blueprint, 90, 1.2);");
    expect(updated).toContain("flow(path, 1.4, reverse, once);");
    expect(updated).toContain("oscillate(source, hue, 3, 20, 0.5, 5);");
    expect(readSceneSource(updated).skipped).toEqual([]);
  });

  it("creates complete native-valid Canvas payloads and feature defaults", () => {
    const scene = readSceneSource(SOURCE), doc = cloneDoc(scene.doc);
    for (const name of ["turn", "flow", "become", "attach", "oscillate", "shake", "followshot"]) {
      const target = name === "flow" ? "path" : "source";
      const entry = vocabularyEntry(name)!;
      expect(vocabularyAvailability(entry, doc, target).enabled, name).toBe(true);
      const created = createBeatAction(doc, name, target);
      expect(created.error, name).toBe("");
      expect(created.action, name).not.toBeNull();
      doc.steps.push({ name, mode: "together", gap: .1, actions: [created.action!] });
    }
    const fresh = cloneDoc(doc);
    delete fresh.entities[1].morph2;
    expect(applyVocabularyFeature(fresh.entities[1], "morph", fresh)).toBe(true);
    const source = serializeSceneFile(fresh);
    const reparsed = readSceneSource(source);
    expect(reparsed.skipped).toEqual([]);
    expect(reparsed.doc.steps.slice(-7).map((step) => step.actions[0].verb)).toEqual(["turn", "flow", "become", "attach", "oscillate", "shake", "followshot"]);
  });

  it("renames every persistent and Story relationship", () => {
    const scene = readSceneSource(SOURCE), parameter = scene.doc.entities[0] as ParameterEntity, source = scene.doc.entities[1];
    replaceEntityReference(parameter, "source", "hero");
    replaceEntityReference(source, "blueprint", "goal");
    expect(parameter.bindings.every((binding) => binding.target === "hero")).toBe(true);
    expect(source.morph2?.target).toBe("goal");
    const actions = scene.doc.steps[0].actions.map((action) => structuredClone(action)) as SceneAction[];
    for (const action of actions) replaceActionReference(action, "source", "hero");
    expect(actions.some((action) => action.target === "hero")).toBe(true);
    expect(actions.find((action) => action.verb === "attach")?.ref).toBe("hero");
  });

  it("keeps bind properties literal when a variable has the same name", () => {
    const scene = readSceneSource(`let x = 42;\nparameter(p, (100, 100), 0, -1, 1);\ncircle(ball, (200, 200), 30);\nbind(p, ball, x, "p");\n`);
    expect(scene.skipped).toEqual([]);
    expect((scene.doc.entities[0] as ParameterEntity).bindings[0].property).toBe("x");
  });

  it("passes native validation before and after a surgical relationship edit", () => {
    if (!existsSync(MANIC)) return;
    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    (next.entities[0] as ParameterEntity).bindings[0].to = 840;
    next.entities[1].morph2 = { target: "blueprint", spin: -90 };
    const variants = [SOURCE, patchSceneSource(SOURCE, scene, next)];
    variants.forEach((source, index) => {
      const path = resolve(tmpdir(), `manic-live-${index}.manic`);
      writeFileSync(path, source);
      expect(() => execFileSync(MANIC, ["check", path], { stdio: "pipe" })).not.toThrow();
    });
  });
});

const EXAMPLES = [
  "motion-graphics-v2-story.manic",
  "parameter-journeys.manic",
  "morph.manic",
  "manim-vs/moving-camera-follow.manic",
  "integrals.manic",
].map((name) => resolve(import.meta.dirname, "../../../manic/examples", name));

describe.skipIf(EXAMPLES.some((file) => !existsSync(file)))("motion/live corpus acceptance", () => {
  it("onboards the batch vocabulary without disturbing representative files", () => {
    const names = ["parameter", "bind", "morph", "turn", "flow", "become", "attach", "oscillate", "shake", "followshot"];
    for (const file of EXAMPLES) {
      const source = readFileSync(file, "utf8"), scene = readSceneSource(source);
      for (const name of names) expect(scene.skipped.some((note) => note.includes(`\`${name}\` isn't canvas vocabulary yet`)), `${file}: ${name}`).toBe(false);
      expect(patchSceneSource(source, scene, cloneDoc(scene.doc)), file).toBe(source);
    }
  });
});
