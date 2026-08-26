import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allVocabularyEntries, canvasAnnotations, cloneDoc, createEntity, emptyDoc, entityDef, geometryContext,
  linmap3WorldGeometry, param3Grid, patchSceneSource, readSceneSource, referenceIds,
  serializeSceneFile, slice3WorldPoints, surface3Grid, surfaceDependent3Points,
  trajectory3WorldPoints, vectorField3Segments,
  type EntityKind, type MatrixMap3Entity, type ParamSurface3Entity, type Slice3Entity,
  type Surface3Entity, type SurfaceDependent3Entity, type Trajectory3Entity,
  type VectorField3Entity,
} from "./index.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";
const NAMES = ["surface3", "domainsurface", "param3", "implicit3", "heightmap3", "contour3", "slice3", "tangentplane3", "gradient3", "vectorfield3", "volume3", "trajectory3", "descend3", "linmap3", "eigen3"] as const;

const SOURCE = `canvas(1280, 720);
template("black");
camera3((8, -10, 7), (0, 0, 0), 42);
grid(cells, "# . .; . # .; . . #", (320, 240), 3, 3, 32);
surface3(hill, "0.3*(x*x+y*y)", (-2, 2), (-2, 2), 12);
domainsurface(domain, "1/(z*z+1)", (-2, 2), (-2, 2), 24, 0.4);
param3(torus, "(2+0.5*cos(v))*cos(u)", "(2+0.5*cos(v))*sin(u)", "0.5*sin(v)", (0, 6.283), (0, 6.283), 16);
implicit3(iso, "x*x+y*y+z*z", (-2, 2), (-2, 2), (-2, 2), 1, 12);
heightmap3(terrain, cells, "h+0.1*sin(x)", 4);
contour3(ring, hill, 0.6);
slice3(cut, hill, x, 0.5, 0, magenta);
hidden(cut.slope);
gradient3(uphill, hill, 1, 0, gold);
tangentplane3(tanplane, hill, 0.5, 0.5, cyan);
vectorfield3(flow3, (0, 0, 0), (2, 2, 2), "-y", "x", "0.2*z", 4);
volume3(vol, hill, 3, cyan);
color(vol0, lime);
trajectory3(orbit3, "-y", "x", "0", (1, 0, 0), 100, 0.02);
descend3(down, hill, 1.5, 1.5, 0.15, 30, lime);
glow(down.ball, 0.5);
linmap3(map3, (0, 0, 0), 1, 0.5, 0, 0, 1, 0.2, 0, 0, 1, lime);
color(map3.i, cyan);
eigen3(eig3, (0, 0, 0), 2, 0, 0, 0, 1, 0, 0, 0, -1);
`;

describe("Three surfaces and fields batch", () => {
  it("parses every constructor, dependency, and generated child byte-exactly", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.some((entity) => entity.kind === "grid")).toBe(true);
    for (const name of NAMES) expect(scene.doc.entities.some((entity) => entity.kind === name), name).toBe(true);
    const slice = scene.doc.entities.find((entity) => entity.kind === "slice3") as Slice3Entity;
    const volume = scene.doc.entities.find((entity) => entity.kind === "volume3") as SurfaceDependent3Entity;
    const map = scene.doc.entities.find((entity) => entity.kind === "linmap3") as MatrixMap3Entity;
    expect(referenceIds(slice)).toEqual(["cut.slope"]);
    expect(referenceIds(volume)).toHaveLength(9);
    expect(volume.childStyles["vol0"]?.color).toBe("lime");
    expect(map.childStyles["map3.i"]?.color).toBe("cyan");
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
  });

  it("keeps bounded Canvas sampling deterministic and dependency-aware", () => {
    const doc = readSceneSource(SOURCE).doc, ctx = geometryContext(doc);
    const surface = doc.entities.find((entity) => entity.kind === "surface3") as Surface3Entity;
    const param = doc.entities.find((entity) => entity.kind === "param3") as ParamSurface3Entity;
    const contour = doc.entities.find((entity) => entity.kind === "contour3") as SurfaceDependent3Entity;
    const slice = doc.entities.find((entity) => entity.kind === "slice3") as Slice3Entity;
    const field = doc.entities.find((entity) => entity.kind === "vectorfield3") as VectorField3Entity;
    const trajectory = doc.entities.find((entity) => entity.kind === "trajectory3") as Trajectory3Entity;
    const map = doc.entities.find((entity) => entity.kind === "linmap3") as MatrixMap3Entity;
    expect(surface3Grid(surface).points).toHaveLength(169);
    expect(param3Grid(param).points).toHaveLength(289);
    expect(surfaceDependent3Points(contour, ctx).length).toBeGreaterThan(0);
    expect(slice3WorldPoints(slice, ctx)).toHaveLength(81);
    expect(vectorField3Segments(field)).toHaveLength(64);
    expect(trajectory3WorldPoints(trajectory).length).toBeGreaterThan(20);
    expect(linmap3WorldGeometry(map).points).toHaveLength(8);
    expect(canvasAnnotations(contour, doc).some((note) => note.id === "surface3-dependency" && note.refs.includes("hill"))).toBe(true);
    expect(canvasAnnotations(trajectory, doc).some((note) => note.id === "native-three-solver")).toBe(true);
  });

  it("creates the dependency grid and all 15 requested constructors from Canvas", () => {
    const doc = emptyDoc();
    doc.entities.push(createEntity("camera3", "camera", 0, 0, doc));
    doc.entities.push(createEntity("grid", "cells", 320, 240, doc));
    doc.entities.push(createEntity("surface3", "surface", 0, 0, doc));
    for (const name of NAMES) {
      if (name === "surface3") continue;
      const def = entityDef(name)!;
      expect(def.canCreate?.(doc) ?? true, name).toBe(true);
      doc.entities.push(createEntity(name as EntityKind, name, 0, 0, doc, name === "heightmap3" ? "cells" : "surface"));
    }
    const source = serializeSceneFile(doc);
    expect(readSceneSource(source).skipped).toEqual([]);
    expect(source).toContain("grid(cells");
    for (const name of NAMES) expect(source).toContain(`${name}(`);
  });

  it("keeps every surface and field name semantic after later Three batches", () => {
    const three = allVocabularyEntries(true).filter((entry) => entry.kit === "three");
    expect(three).toHaveLength(75);
    for (const name of NAMES) expect(three.find((entry) => entry.name === name)?.fidelity, name).toBe("semantic");
    expect(allVocabularyEntries(true).find((entry) => entry.name === "grid")?.fidelity).toBe("semantic");
  });

  it.runIf(existsSync(MANIC))("passes the native Manic checker", () => {
    const file = resolve(tmpdir(), `manic-workbench-three-surfaces-fields-${process.pid}.manic`);
    writeFileSync(file, SOURCE);
    expect(execFileSync(MANIC, ["check", file], { encoding: "utf8" })).toContain("parses + validates");
  });
});
