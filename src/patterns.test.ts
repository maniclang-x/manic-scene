import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canvasAnnotations, cloneDoc, entityReferences, geometryContext, lsystemGeometry, patchSceneSource, readSceneSource,
  repeatGeometry, replaceEntityReference, vocabularyEntry, LSYSTEM_CANVAS_POINT_CAP, REPEAT_CANVAS_INSTANCE_CAP,
} from "./index.js";
import type { LSystemEntity, RepeatEntity } from "./types.js";

const SOURCE = `canvas(800, 600);
polygon(tile, (380,310), (420,310), (400,270));
tag(tile, motif);
repeat(hexes, motif, "layout=hex rings=4 spacing=42 rotate=30 scale=0.8");
gradient(hexes, cyan, magenta);
repeat(grid, tile, "layout=grid rows=5 cols=7 gapx=48 gapy=42 rotate=-8");
repeat(sun, tile, "layout=radial count=18 radius=112 face=out rotate=10 scale=0.85");
lsystem(curve, (400,300), 500, "F+F+F+F", "F=FF+F+F+F+FF", "angle=90 heading=0 iterations=4");
stroke(curve, 2.5);
gradient(curve, cyan, magenta, gold);
untraced(curve);
`;

describe("structured generative patterns", () => {
  it("projects repeat relationships and L-system grammar without expanding scene entities", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map((entity) => entity.kind)).toEqual(["polygon", "repeat", "repeat", "repeat", "lsystem"]);
    const [hex, grid, sun] = scene.doc.entities.slice(1, 4) as RepeatEntity[];
    expect(entityReferences(hex)).toEqual(["motif"]);
    expect(hex.gradient).toMatchObject({ stops: ["cyan", "magenta"], mode: "auto" });
    expect(repeatGeometry(hex, geometryContext(scene.doc))).toMatchObject({ total: 37 });
    expect(repeatGeometry(grid, geometryContext(scene.doc))).toMatchObject({ total: 35 });
    expect(repeatGeometry(sun, geometryContext(scene.doc))).toMatchObject({ total: 18 });
    expect(repeatGeometry(sun, geometryContext(scene.doc)).placements[1].rotation).not.toBe(sun.rotate);
    expect(canvasAnnotations(hex, scene.doc)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "repeat-layout", icon: "⠿", representation: "semantic", refs: ["motif"] }),
    ]));

    const curve = scene.doc.entities[4] as LSystemEntity;
    const geometry = lsystemGeometry(curve);
    expect(geometry.issue).toBeNull();
    expect(geometry.drawnSegments).toBe(9_604);
    expect(geometry.points.length).toBeLessThanOrEqual(LSYSTEM_CANVAS_POINT_CAP);
    expect(curve).toMatchObject({ angle: 90, iterations: 4, boundary: "open", strokeWidth: 2.5, untraced: true, gradient: { stops: ["cyan", "magenta", "gold"], mode: "auto" } });
    expect(canvasAnnotations(curve, scene.doc)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "lsystem-grammar", icon: "⌁ƒ", representation: "semantic" }),
    ]));
    expect(vocabularyEntry("repeat")).toMatchObject({ kind: "entity", fidelity: "semantic" });
    expect(vocabularyEntry("lsystem")).toMatchObject({ kind: "entity", fidelity: "semantic" });
  });

  it("keeps an unchanged native source byte-identical", () => {
    const scene = readSceneSource(SOURCE);
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
  });

  it("writes inspector edits as valid native options and rewrites motif references", () => {
    const scene = readSceneSource(SOURCE);
    const draft = cloneDoc(scene.doc);
    const hex = draft.entities[1] as RepeatEntity;
    replaceEntityReference(hex, "motif", "tile");
    hex.layout = "radial";
    hex.count = 12;
    hex.radius = 150;
    hex.face = "out";
    const curve = draft.entities[4] as LSystemEntity;
    curve.iterations = 3;
    curve.drawSymbols = "FX";
    curve.boundary = "filled";
    const updated = patchSceneSource(SOURCE, scene, draft);
    expect(updated).toContain('repeat(hexes, tile, "layout=radial rings=4 rows=3 cols=3 count=12 spacing=42 gapx=42 gapy=42 radius=150 face=out rotate=30 scale=0.8");');
    expect(updated).toContain('"angle=90 heading=0 iterations=3 draw=FX padding=0.04 closed=true fill=true"');
    const again = readSceneSource(updated);
    expect(again.skipped).toEqual([]);
    expect((again.doc.entities[4] as LSystemEntity).boundary).toBe("filled");
    expect(again.doc).toEqual(draft);
  });

  it("bounds extreme inspector values instead of materialising huge SVG trees", () => {
    const scene = readSceneSource(SOURCE);
    const hex = cloneDoc(scene.doc).entities[1] as RepeatEntity;
    hex.rings = 1_000;
    const geometry = repeatGeometry(hex, geometryContext({ ...scene.doc, entities: [scene.doc.entities[0], hex] }));
    expect(geometry.total).toBe(2_997_001);
    expect(geometry.placements.length).toBeLessThanOrEqual(REPEAT_CANVAS_INSTANCE_CAP);
    expect(geometry.bounds.width).toBeGreaterThan(100_000);
    const warningDoc = { ...scene.doc, entities: [scene.doc.entities[0], hex] };
    expect(canvasAnnotations(hex, warningDoc)[0]).toMatchObject({ tone: "warning", detail: expect.stringContaining("12,000-entity repeat limit") });
  });

  it("keeps invalid or overgrown grammars inspectable with a repair message", () => {
    const scene = readSceneSource(SOURCE);
    const curve = cloneDoc(scene.doc).entities[4] as LSystemEntity;
    curve.axiom = "F[+F]";
    expect(lsystemGeometry(curve)).toMatchObject({ points: [], issue: expect.stringContaining("Branching") });
    curve.axiom = "F";
    curve.rules = "F=FFFFFFFF";
    curve.iterations = 16;
    expect(lsystemGeometry(curve)).toMatchObject({ points: [], issue: expect.stringContaining("symbol limit") });
  });
});

const EXAMPLES = resolve(import.meta.dirname, "../../../manic/examples");
const ACCEPTANCE = [
  "asymptote-tiling-reference.manic", "creator-one-tile-pattern-story.manic", "creator-incenter-dissection.manic",
  "lsystem-asymptote-curves.manic", "creator-lsystem-fractal-curve.manic", "lost-in-patterns.manic",
];

describe.skipIf(!existsSync(EXAMPLES))("pattern corpus acceptance", () => {
  it("onboards every representative repeat and L-system scene source-safely", () => {
    for (const file of ACCEPTANCE) {
      const source = readFileSync(resolve(EXAMPLES, file), "utf8");
      const scene = readSceneSource(source);
      expect(scene.skipped.filter((note) => /`(?:repeat|lsystem)`/u.test(note)), file).toEqual([]);
      expect(scene.doc.entities.some((entity) => entity.kind === "repeat" || entity.kind === "lsystem"), file).toBe(true);
      expect(patchSceneSource(source, scene, cloneDoc(scene.doc)), file).toBe(source);
    }
  });
});
