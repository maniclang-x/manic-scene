import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IFS2_CANVAS_POINT_CAP, IFS2_CANVAS_SEGMENT_CAP, MANDELBROT_CANVAS_COLUMN_CAP, MANDELBROT_CANVAS_ROW_CAP, POLARPATH_CANVAS_POINT_CAP,
  canvasAnnotations, cloneDoc, createEntity, hull2Geometry, ifs2Geometry, mandelbrotGeometry,
  patchSceneSource, polarPathGeometry, readSceneSource, replaceEntityReference, serializeSceneFile,
  vocabularyEntry,
} from "./index.js";
import type { Hull2Entity, Ifs2Entity, MandelbrotEntity, PolarPathEntity } from "./types.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";
const RULES = "0 0 0 .16 0 0 .01; .85 .04 -.04 .85 0 1.6 .85; .2 -.26 .23 .22 0 1.6 .07; -.15 .28 .26 .24 0 .44 .07";
const SOURCE = `canvas(1280, 720);
template("black");

ifs2(fern, (260, 370), (340, 520), 12000, 7, "${RULES}", "mode=points burn=80");
hull2(shell, fern, 1, 2);
stroke(shell, 2.5);
mandelbrot(set, (650, 350), (380, 300), (-2.25, .75), (-1.3, 1.3), 48, 160);
polarpath(flower, (1050, 350), 90, "1 + .35*cos(5*t)", (0, 6.283), 320, 1);
stroke(flower, 4);
`;

describe("Generative Fields III", () => {
  it("projects every constructor and preserves untouched source exactly", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map((entity) => entity.kind)).toEqual(["ifs2", "hull2", "mandelbrot", "polarpath"]);
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
    expect(vocabularyEntry("ifs2")?.fidelity).toBe("semantic");
    expect(vocabularyEntry("mandelbrot")?.fidelity).toBe("semantic");
    expect(vocabularyEntry("polarpath")?.fidelity).toBe("semantic");
    expect(vocabularyEntry("hull2")?.fidelity).toBe("semantic");
  });

  it("keeps Canvas geometry deterministic and bounded below native budgets", () => {
    const scene = readSceneSource(SOURCE);
    const [ifs, hull, mandelbrot, polar] = scene.doc.entities as [Ifs2Entity, Hull2Entity, MandelbrotEntity, PolarPathEntity];
    const first = ifs2Geometry(ifs), second = ifs2Geometry(structuredClone(ifs));
    expect(first).toEqual(second);
    expect(first.points).toHaveLength(IFS2_CANVAS_POINT_CAP);
    expect(first.total).toBe(12_000);
    const segments = ifs2Geometry({ ...ifs, options: "mode=segments depth=6" });
    expect(segments.segments).toHaveLength(IFS2_CANVAS_SEGMENT_CAP);
    expect(segments.total).toBe(4_096);
    const invalidSegments = ifs2Geometry({ ...ifs, options: "mode=segments depth=10" });
    expect(invalidSegments.issue).toContain("200,000");
    expect(readSceneSource(SOURCE.replace("mode=points burn=80", "mode=segments depth=10")).doc.entities.some((entity) => entity.kind === "ifs2")).toBe(false);
    expect(hull2Geometry(hull, scene.doc).points.length).toBeGreaterThan(3);
    const field = mandelbrotGeometry(mandelbrot);
    expect(field.cells.length).toBeLessThanOrEqual(MANDELBROT_CANVAS_COLUMN_CAP * MANDELBROT_CANVAS_ROW_CAP);
    const tallField = mandelbrotGeometry({ ...mandelbrot, width: 20, height: 2_000 });
    expect(tallField.cells.length).toBeLessThanOrEqual(MANDELBROT_CANVAS_COLUMN_CAP * MANDELBROT_CANVAS_ROW_CAP);
    expect(field.nativeCells).toBeGreaterThan(field.cells.length);
    const curve = polarPathGeometry({ ...polar, samples: 20_000 });
    expect(curve.points.length).toBeLessThanOrEqual(POLARPATH_CANVAS_POINT_CAP + 1);
    expect(curve.nativePoints).toBe(20_001);
  });

  it("patches constructor state and preserves portable dependencies surgically", () => {
    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    const ifs = next.entities[0] as Ifs2Entity, hull = next.entities[1] as Hull2Entity;
    const mandelbrot = next.entities[2] as MandelbrotEntity, polar = next.entities[3] as PolarPathEntity;
    ifs.count = 24_000; hull.depth = 2; mandelbrot.iterations = 72; polar.formula = "1 + .5*cos(7*t)";
    const patched = patchSceneSource(SOURCE, scene, next);
    expect(patched).toContain("(340, 520), 24000, 7");
    expect(patched).toContain("hull2(shell, fern, 2, 2);");
    expect(patched).toContain("(-1.3, 1.3), 72, 160);");
    expect(patched).toContain('"1 + .5*cos(7*t)"');
    expect(readSceneSource(patched).skipped).toEqual([]);
  });

  it("exposes bounded-preview meaning and keeps the hull reference rename-safe", () => {
    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    const ids = scene.doc.entities.flatMap((entity) => canvasAnnotations(entity, scene.doc).map((annotation) => annotation.id));
    expect(ids).toEqual(expect.arrayContaining(["ifs2-sample", "hull2-sample", "mandelbrot-sample", "polarpath-sample"]));
    next.entities[0].id = "leaf";
    replaceEntityReference(next.entities[1], "fern", "leaf");
    const patched = patchSceneSource(SOURCE, scene, next);
    expect(patched).toContain("ifs2(leaf,");
    expect(patched).toContain("hull2(shell, leaf, 1, 2);");
    expect(readSceneSource(patched).skipped).toEqual([]);
  });

  it("creates native-valid defaults without flattening native multicolour paint", () => {
    const scene = readSceneSource("canvas(1280, 720);\n");
    const ifs = createEntity("ifs2", "fern", 350, 360, scene.doc);
    scene.doc.entities.push(ifs);
    scene.doc.entities.push(createEntity("hull2", "hull", 0, 0, scene.doc, "fern"));
    scene.doc.entities.push(createEntity("mandelbrot", "set", 850, 360, scene.doc));
    scene.doc.entities.push(createEntity("polarpath", "rose", 1100, 360, scene.doc));
    const source = serializeSceneFile(scene.doc);
    expect(source).not.toContain("color(fern,");
    expect(source).not.toContain("color(set,");
    expect(source).toContain("hull2(hull, fern);");
    expect(readSceneSource(source).skipped).toEqual([]);
    if (existsSync(MANIC)) {
      const file = resolve(tmpdir(), `manic-generative-defaults-${process.pid}.manic`);
      writeFileSync(file, source);
      expect(execFileSync(MANIC, ["check", file], { encoding: "utf8" })).toContain("parses + validates");
    }
  });

  it.runIf(existsSync(MANIC))("passes the native Manic checker", () => {
    const file = resolve(tmpdir(), `manic-generative-next-${process.pid}.manic`);
    writeFileSync(file, SOURCE);
    expect(execFileSync(MANIC, ["check", file], { encoding: "utf8" })).toContain("parses + validates");
  });
});
