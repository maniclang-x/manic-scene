import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  angleMarkGeometry, circle2Geometry, cloneDoc, createEntity, entityBounds, entityReferences,
  geometryContext, midpointGeometry, patchSceneSource, readSceneSource, referenceIds, segmentGeometry,
  vocabularyAvailability, vocabularyEntry,
} from "./index.js";
import type {
  AngleMarkEntity, AxisTickEntity, Circle2Entity, CoordsEntity, EllipseEntity, PointEntity,
  SceneDoc, SegmentEntity, VectorEntity,
} from "./types.js";

const SOURCE = `// coordinate and geometry authoring stays native Manic
canvas(1280, 720);
template("black");

axes(ax, (220, 360), 170, 130, 40);
coords(frame, (650, 390), (-3, 4), (-2, 3), 55, 60, 0, 0.5, 0, "u", "v");
xtick(tx, frame, 1.5, "π/2");
size(tx, 18);
color(tx.mark, gold);
stroke(tx.mark, 2);
hidden(tx.mark);
ytick(ty, frame, 2);

point(A, (780, 520), "A");
size(A.label, 30);
color(A.label, gold);
hidden(A.label);
point(B, (1050, 520), "B");
point(C, (900, 250), "C");
segment(ab, A, B);
stroke(ab, 4);
vector(v, (260, 590), (120, 80), cyan);
stroke(v, 5);
ellipse(oval, (420, 190), 110, 55, -18);
stroke(oval, 3);
circle2(circ, A, B);
outlined(circ);
stroke(circ, 3);
outline(circ, magenta);
midpoint(M, A, B);
anglemark(ang, A, C, B, "θ");
size(ang.label, 28);
color(ang.label, cyan);
hidden(ang.label);
stroke(ang, 4);
rightangle(square, A, C, B);
stroke(square, 3);
`;

describe("coordinate and geometry vocabulary", () => {
  it("projects the whole batch, child ids, dependencies, and native arguments", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map((entity) => entity.kind)).toEqual([
      "axes", "coords", "xtick", "ytick", "point", "point", "point", "segment",
      "vector", "ellipse", "circle2", "midpoint", "anglemark", "rightangle",
    ]);
    expect(scene.doc.entities[1]).toMatchObject({
      kind: "coords", xmin: -3, xmax: 4, ymin: -2, ymax: 3, sx: 55, sy: 60,
      tips: false, step: .5, numbers: false, xname: "u", yname: "v",
    });
    expect(scene.doc.entities[2]).toMatchObject({
      kind: "xtick", coords: "frame", value: 1.5, text: "π/2", size: 18,
      markColor: "gold", markWidth: 2, markReveal: "fade",
    });
    expect(scene.doc.entities[4]).toMatchObject({
      kind: "point", label: "A", labelSize: 30, labelColor: "gold", labelReveal: "fade",
    });
    expect(referenceIds(scene.doc.entities[4])).toEqual(["A.label"]);
    expect(referenceIds(scene.doc.entities[12])).toEqual(["ang.label"]);
    expect(entityReferences(scene.doc.entities[7])).toEqual(["A", "B"]);
    expect(entityReferences(scene.doc.entities[13])).toEqual(["A", "C", "B"]);
    for (const name of ["axes", "coords", "xtick", "ytick", "point", "segment", "vector", "ellipse", "circle2", "midpoint", "anglemark", "rightangle"]) {
      expect(vocabularyEntry(name)).toMatchObject({ fidelity: "exact", surfaces: expect.arrayContaining(["add", "language"]) });
    }
  });

  it("is byte-identical when unchanged and surgically patches every entity family", () => {
    const scene = readSceneSource(SOURCE);
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
    const next = cloneDoc(scene.doc);
    (next.entities[1] as CoordsEntity).xmax = 5;
    (next.entities[2] as AxisTickEntity).value = 2.5;
    (next.entities[4] as PointEntity).label = "P";
    (next.entities[7] as SegmentEntity).to = "C";
    (next.entities[8] as VectorEntity).dy = -40;
    (next.entities[9] as EllipseEntity).angle = 25;
    (next.entities[10] as Circle2Entity).through = "C";
    (next.entities[12] as AngleMarkEntity).label = "α";
    const updated = patchSceneSource(SOURCE, scene, next);
    expect(updated).toContain('coords(frame, (650, 390), (-3, 5), (-2, 3), 55, 60, 0, 0.5, 0, "u", "v");');
    expect(updated).toContain('xtick(tx, frame, 2.5, "π/2");');
    expect(updated).toContain('point(A, (780, 520), "P");');
    expect(updated).toContain("segment(ab, A, C);");
    expect(updated).toContain("vector(v, (260, 590), (120, -40), cyan);");
    expect(updated).toContain("ellipse(oval, (420, 190), 110, 55, 25);");
    expect(updated).toContain("circle2(circ, A, C);");
    expect(updated).toContain('anglemark(ang, A, C, B, "α");');
    expect(readSceneSource(updated).skipped).toEqual([]);
  });

  it("recomputes dependent geometry when a source point moves", () => {
    const scene = readSceneSource(SOURCE);
    const context = geometryContext(scene.doc);
    const segment = scene.doc.entities[7] as SegmentEntity;
    const circle = scene.doc.entities[10] as Circle2Entity;
    const midpoint = scene.doc.entities[11] as Extract<SceneDoc["entities"][number], { kind: "midpoint" }>;
    const angle = scene.doc.entities[12] as AngleMarkEntity;
    const before = {
      segment: segmentGeometry(segment, context), circle: circle2Geometry(circle, context),
      midpoint: midpointGeometry(midpoint, context), angle: angleMarkGeometry(angle, context),
    };
    const next = cloneDoc(scene.doc);
    const pointB = next.entities.find((entity): entity is PointEntity => entity.id === "B" && entity.kind === "point")!;
    pointB.x += 100;
    pointB.y -= 40;
    const nextContext = geometryContext(next);
    expect(segmentGeometry(next.entities[7] as SegmentEntity, nextContext).to).toEqual({ x: 1150, y: 480 });
    expect(circle2Geometry(next.entities[10] as Circle2Entity, nextContext).radius).not.toBe(before.circle.radius);
    expect(midpointGeometry(next.entities[11] as typeof midpoint, nextContext)).toEqual({ x: 965, y: 500 });
    expect(angleMarkGeometry(next.entities[12] as AngleMarkEntity, nextContext).sweep).not.toBe(before.angle.sweep);
    expect(entityBounds(next.entities[13], next).width).toBeGreaterThan(1);
  });

  it("enforces authoring prerequisites while keeping the free primitives available", () => {
    const empty: SceneDoc = { format: "16:9", template: "black", entities: [], steps: [] };
    expect(() => createEntity("point", "A", 100, 100, empty)).not.toThrow();
    const point = createEntity("point", "A", 100, 100, empty);
    const one = { ...empty, entities: [point] };
    const segmentEntry = vocabularyEntry("segment")!;
    const tickEntry = vocabularyEntry("xtick")!;
    expect(segmentEntry.fidelity).toBe("exact");
    expect(vocabularyAvailability(segmentEntry, empty)).toMatchObject({ enabled: false, reason: expect.stringContaining("two Point") });
    expect(vocabularyAvailability(segmentEntry, one)).toMatchObject({ enabled: false });
    expect(vocabularyAvailability(tickEntry, one)).toMatchObject({ enabled: false, reason: expect.stringContaining("Coordinate frame") });
    expect(createEntity("vector", "v", 100, 100, empty).kind).toBe("vector");
    expect(() => createEntity("segment", "s", 0, 0, one)).not.toThrow();
    expect(tickEntry.registryRef).toBe("entity:xtick");
  });
});

const SHOWCASE = resolve(import.meta.dirname, "../../../manic/examples/creator-geometry-language-showcase.manic");
const THALES = resolve(import.meta.dirname, "../../../manic/examples/thales-semicircle-short.manic");

describe.skipIf(!existsSync(SHOWCASE) || !existsSync(THALES))("geometry corpus acceptance", () => {
  it("onboards the representative geometry statements without changing either file", () => {
    const showcaseSource = readFileSync(SHOWCASE, "utf8"), showcase = readSceneSource(showcaseSource);
    const thalesSource = readFileSync(THALES, "utf8"), thales = readSceneSource(thalesSource);
    for (const name of ["point", "segment", "midpoint", "anglemark", "rightangle", "circle2"]) {
      expect(showcase.skipped.some((note) => note.includes(`\`${name}\` isn't canvas vocabulary yet`))).toBe(false);
      expect(thales.skipped.some((note) => note.includes(`\`${name}\` isn't canvas vocabulary yet`))).toBe(false);
    }
    expect(showcase.doc.entities.filter((entity) => ["point", "segment", "midpoint", "anglemark", "rightangle"].includes(entity.kind)).length).toBeGreaterThan(20);
    expect(thales.doc.entities.filter((entity) => ["point", "segment", "midpoint", "circle2", "rightangle"].includes(entity.kind))).toHaveLength(9);
    expect(thales.doc.entities.find((entity) => entity.kind === "midpoint")).toMatchObject({ id: "O", a: "A", b: "B" });
    expect(thales.doc.entities.find((entity) => entity.kind === "label")).toMatchObject({ id: "O.label", target: "O" });
    expect(patchSceneSource(showcaseSource, showcase, cloneDoc(showcase.doc))).toBe(showcaseSource);
    expect(patchSceneSource(thalesSource, thales, cloneDoc(thales.doc))).toBe(thalesSource);
  });
});
