import { describe, expect, it } from "vitest";
import {
  arcGeometry, cloneDoc, createEntity, defFor, featureAvailability, numberLineValues, patchSceneSource,
  planeGrid, polarPlaneCounts, readSceneSource, referenceIds, serializeSceneFile,
  vocabularyEntry,
} from "./index.js";
import type {
  AnnulusEntity, ArcEntity, ComplexPlaneEntity, NumberLineEntity, PlaneEntity,
  PolarPlaneEntity, SectorEntity,
} from "./types.js";

const SOURCE = `canvas("16:9");
template("black");
plane(grid, (320, 250), 240, 160, 40);
numberplane(aliasGrid, (960, 250), 220, 150);
complexplane(zplane, (320, 540), 240, 130, 50);
polarplane(polarGrid, (730, 510), 130, 5, 16);
numberline(line, (930, 640), 220, -2, 3, 0.5);
arc(curve, (1060, 430), 90, 190, 140);
stroke(curve, 5);
outline(curve, magenta);
sector(slice, (830, 300), 95, 210, 110);
outlined(slice);
stroke(slice, 4);
outline(slice, gold);
annulus(ring, (1080, 160), 90, 52);
gradient(ring, cyan, magenta, radial);
`;

describe("coordinate systems and circular regions", () => {
  it("projects all native signatures, preserves aliases, and round-trips exactly", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map((entity) => entity.kind)).toEqual([
      "plane", "plane", "complexplane", "polarplane", "numberline", "arc", "sector", "annulus",
    ]);
    expect(scene.doc.entities[0]).toMatchObject({ spelling: "plane", unit: 40 });
    expect(scene.doc.entities[1]).toMatchObject({ spelling: "numberplane", unit: null });
    expect(scene.doc.entities[6]).toMatchObject({ paint: "outlined", strokeWidth: 4, outlineColor: "gold" });
    expect(scene.doc.entities[7]).toMatchObject({ gradient: { stops: ["cyan", "magenta"], mode: "radial" } });
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
    const regenerated = serializeSceneFile(scene.doc), reparsed = readSceneSource(regenerated);
    expect(reparsed.skipped).toEqual([]);
    expect(reparsed.doc).toEqual(scene.doc);
    expect(regenerated).toContain("numberplane(aliasGrid");
  });

  it("exposes deterministic native child ids and bounded Canvas geometry", () => {
    const scene = readSceneSource(SOURCE);
    const plane = scene.doc.entities[0] as PlaneEntity, complex = scene.doc.entities[2] as ComplexPlaneEntity;
    const polar = scene.doc.entities[3] as PolarPlaneEntity, line = scene.doc.entities[4] as NumberLineEntity;
    expect(planeGrid(plane).vertical).toHaveLength(12);
    expect(referenceIds(plane)).toEqual(expect.arrayContaining(["grid.grid", "grid.x", "grid.y", "grid.gv-6", "grid.gh4"]));
    expect(referenceIds(complex)).toEqual(expect.arrayContaining(["zplane.re", "zplane.im", "zplane.grid"]));
    expect(polarPlaneCounts(polar)).toEqual({ rings: 5, spokes: 16 });
    expect(referenceIds(polar)).toEqual(expect.arrayContaining(["polarGrid.grid", "polarGrid.ring5", "polarGrid.spoke15"]));
    expect(numberLineValues(line)).toEqual([-2, -1.5, -1, -.5, 0, .5, 1, 1.5, 2, 2.5, 3]);
    expect(referenceIds(line)).toEqual(expect.arrayContaining(["line.axis", "line.t10", "line.l10"]));
    const arc = arcGeometry(100, 100, 50, 20, 0, 360);
    expect(arc.full).toBe(true);
    expect(arc.outer).toHaveLength(61);
    expect(arc.path).toMatch(/^M /);
  });

  it("offers complete Inspector controls and exact Add/Language vocabulary", () => {
    const scene = readSceneSource(SOURCE);
    expect(defFor(scene.doc.entities[0]).fields.map((field) => field.key)).toEqual(["halfw", "halfh", "unit"]);
    expect(defFor(scene.doc.entities[3]).fields.map((field) => field.key)).toEqual(["radius", "rings", "spokes"]);
    expect(defFor(scene.doc.entities[4]).fields.map((field) => field.key)).toEqual(["halfw", "from", "to", "step"]);
    expect(defFor(scene.doc.entities[5]).fields.map((field) => field.key)).toEqual(["r", "start", "sweep", "strokeWidth", "outlineColor"]);
    expect(defFor(scene.doc.entities[6]).fields.map((field) => field.key)).toEqual(["r", "start", "sweep", "paint", "strokeWidth", "outlineColor"]);
    expect(defFor(scene.doc.entities[7]).fields.map((field) => field.key)).toEqual(["outer", "inner", "paint", "strokeWidth", "outlineColor"]);
    for (const name of ["annulus", "arc", "complexplane", "numberline", "numberplane", "plane", "polarplane", "sector"]) {
      expect(vocabularyEntry(name), name).toMatchObject({ fidelity: "exact", kind: "entity", surfaces: expect.arrayContaining(["language"]) });
    }
    expect(vocabularyEntry("plane")?.surfaces).toContain("add");
    expect(vocabularyEntry("numberplane")?.surfaces).not.toContain("add");
    expect(featureAvailability("gradient", scene.doc, scene.doc.entities[5])).toMatchObject({ enabled: true });
    expect(featureAvailability("gradient", scene.doc, scene.doc.entities[6])).toMatchObject({ enabled: true });
    expect(featureAvailability("dashed", scene.doc, scene.doc.entities[7])).toMatchObject({ enabled: true });
  });

  it("serializes Canvas-created entities and reparses the same editable document", () => {
    const doc = readSceneSource('canvas("16:9");\ntemplate("black");\n').doc;
    for (const kind of ["plane", "complexplane", "polarplane", "numberline", "arc", "sector", "annulus"] as const) doc.entities.push(createEntity(kind, kind, 640, 360, doc));
    const source = serializeSceneFile(doc), reparsed = readSceneSource(source);
    expect(reparsed.skipped).toEqual([]);
    expect(reparsed.doc).toEqual(doc);
    for (const ctor of ["plane", "complexplane", "polarplane", "numberline", "arc", "sector", "annulus"]) expect(source).toContain(`${ctor}(`);
  });

  it("surgically patches dimensions, ranges, angles, and radii", () => {
    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    (next.entities[0] as PlaneEntity).unit = 32;
    (next.entities[3] as PolarPlaneEntity).spokes = 20;
    (next.entities[4] as NumberLineEntity).to = 4;
    (next.entities[5] as ArcEntity).sweep = -120;
    (next.entities[6] as SectorEntity).start = 180;
    (next.entities[7] as AnnulusEntity).inner = 44;
    const patched = patchSceneSource(SOURCE, scene, next);
    expect(patched).toContain("plane(grid, (320, 250), 240, 160, 32);");
    expect(patched).toContain("polarplane(polarGrid, (730, 510), 130, 5, 20);");
    expect(patched).toContain("numberline(line, (930, 640), 220, -2, 4, 0.5);");
    expect(patched).toContain("arc(curve, (1060, 430), 90, 190, -120);");
    expect(patched).toContain("sector(slice, (830, 300), 95, 180, 110);");
    expect(patched).toContain("annulus(ring, (1080, 160), 90, 44);");
    expect(readSceneSource(patched).skipped).toEqual([]);
  });
});
