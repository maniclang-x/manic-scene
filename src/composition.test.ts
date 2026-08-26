import { describe, expect, it } from "vitest";
import { appliedFeatures, canvasAnnotations, cloneDoc, entityReferences, patchSceneSource, readSceneSource, replaceEntityReference } from "./index.js";
import type { CircleEntity, LineEntity, TextEntity } from "./types.js";

const SOURCE = `// styling and composition stay surgical
canvas(1280, 720);
template("black");

rect(window, (640, 360), 520, 260);
circle(lens, (640, 360), 150);
circle(orb, (520, 360), 110);
gradient(orb, cyan, magenta, gold, 35);
mask(orb, lens);

line(ray, (120, 580), (1160, 580));
gradient(ray, red, gold, cyan, along);

text(prompt, (640, 160), "manic >");
plate(prompt);
cursor(prompt);
clip(prompt, window);
`;

describe("styling and composition vocabulary", () => {
  it("projects gradients, plates, cursors, clips, and masks", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    const orb = scene.doc.entities[2] as CircleEntity;
    expect(orb.gradient).toEqual({ stops: ["cyan", "magenta", "gold"], mode: "linear", angle: 35 });
    expect(orb.mask).toBe("lens");
    expect(entityReferences(orb)).toEqual(["lens"]);
    const ray = scene.doc.entities[3] as LineEntity;
    expect(ray.gradient).toEqual({ stops: ["red", "gold", "cyan"], mode: "along", angle: 90 });
    const prompt = scene.doc.entities[4] as TextEntity;
    expect(prompt).toMatchObject({ plate: 0.55, cursor: true, clip: "window" });
    expect(entityReferences(prompt)).toEqual(["window"]);
  });

  it("keeps an unchanged file byte-identical", () => {
    const scene = readSceneSource(SOURCE);
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
  });

  it("round-trips every gradient mode exactly", () => {
    const source = `circle(a, (100, 100), 40);\npolygon(b, (0,0), (50,0), (25,40));\nline(c, (0,0), (100,0));\nline(d, (0,0), (100,0));\nline(speed_path, (0,0), (100,0));\ngradient(a, cyan, magenta);\ngradient(b, red, gold, radial);\ngradient(c, cyan, gold, along);\ngradient(d, cyan, gold, "curvature");\ngradient(speed_path, blue, gold, "speed");\n`;
    const scene = readSceneSource(source);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map((entity) => entity.gradient?.mode)).toEqual(["auto", "radial", "along", "curvature", "speed"]);
    expect(patchSceneSource(source, scene, cloneDoc(scene.doc))).toBe(source);
  });

  it("surgically patches composition changes", () => {
    const scene = readSceneSource(SOURCE);
    const next = cloneDoc(scene.doc);
    const orb = next.entities[2];
    orb.gradient = { stops: ["violet", "cyan"], mode: "radial", angle: 90 };
    orb.mask = "window";
    const prompt = next.entities[4];
    prompt.plate = 0.8;
    delete prompt.cursor;
    delete prompt.clip;
    prompt.mask = "lens";
    const updated = patchSceneSource(SOURCE, scene, next);
    expect(updated).toContain("// styling and composition stay surgical");
    expect(updated).toContain("gradient(orb, violet, cyan, radial);");
    expect(updated).toContain("mask(orb, window);");
    expect(updated).not.toContain("color(orb,");
    expect(updated).toContain("plate(prompt, 0.8);");
    expect(updated).not.toContain("cursor(prompt);");
    expect(updated).not.toContain("clip(prompt, window);");
    expect(updated).toContain("mask(prompt, lens);");
    expect(readSceneSource(updated).skipped).toEqual([]);
  });

  it("preserves an explicitly authored color while editing composition", () => {
    const source = "circle(orb, (100, 100), 40);\ncolor(orb, cyan);\ngradient(orb, cyan, gold, 25);\n";
    const scene = readSceneSource(source);
    const next = cloneDoc(scene.doc);
    next.entities[0].gradient = { stops: ["cyan", "gold"], mode: "linear", angle: 60 };
    const updated = patchSceneSource(source, scene, next);
    expect(updated).toContain("color(orb, cyan);");
    expect(updated).toContain("gradient(orb, cyan, gold, 60);");
  });

  it("rewrites clip and mask dependencies when a region is renamed", () => {
    const scene = readSceneSource(SOURCE);
    const draft = cloneDoc(scene.doc);
    for (const entity of draft.entities) replaceEntityReference(entity, "lens", "aperture");
    expect(draft.entities[2].mask).toBe("aperture");
  });

  it("describes runtime styling, relationships, and animation without claiming pixel fidelity", () => {
    const scene = readSceneSource(`rect(window, (300, 200), 240, 120);\nline(path, (100,200), (500,200));\ngradient(path, blue, gold, "speed");\nmask(path, window);\nstep("Travel") { move(path, (500, 300), 1); }\n`);
    const annotations = canvasAnnotations(scene.doc.entities[1], scene.doc);
    expect(annotations).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "gradient-speed", icon: "⚡", representation: "semantic" }),
      expect.objectContaining({ id: "mask", refs: ["window"] }),
      expect.objectContaining({ id: "timeline", label: "1 animation action", representation: "semantic" }),
    ]));
  });

  it("indexes applied features so Inspector controls remain discoverable", () => {
    const scene = readSceneSource(SOURCE);
    expect(appliedFeatures(scene.doc.entities[2])).toEqual([
      { id: "gradient", label: "Gradient", detail: "Linear 35° · 3 stops", controlId: "mse-gradient-controls" },
      { id: "crop", label: "Mask", detail: "lens", controlId: "mse-crop-controls" },
    ]);
    expect(appliedFeatures(scene.doc.entities[4])).toEqual([
      { id: "plate", label: "Text plate", detail: "55% opacity", controlId: "mse-text-composition-controls" },
      { id: "cursor", label: "Typewriter cursor", detail: "Enabled", controlId: "mse-text-composition-controls" },
      { id: "crop", label: "Clip", detail: "window", controlId: "mse-crop-controls" },
    ]);
  });

  it("reports invalid styling targets and missing composition regions", () => {
    const invalid = readSceneSource('text(t, (10, 10), "hello");\nline(path, (0,0), (10,10));\ngradient(t, cyan, gold);\ngradient(path, cyan, gold, radial);\nclip(t, absent);\n');
    expect(invalid.doc.entities).toHaveLength(2);
    expect(invalid.skipped.join(" ")).toContain("gradient");
    expect(invalid.skipped.join(" ")).toContain("depends on missing entity or group `absent`");
  });
});
