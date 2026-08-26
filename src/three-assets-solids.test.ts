import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allVocabularyEntries, applyVocabularyFeature, cloneDoc, createEntity, emptyDoc,
  entityDef, extrude3WorldVertices, geometryContext, patchSceneSource,
  path3WorldPoints, project3WorldPoint, readSceneSource, referenceIds,
  replaceEntityReference, revolve3WorldGeometry, serializeSceneFile,
  type Assembly3Entity, type EntityKind, type Extrude3Entity, type Model3Entity,
  type Project3Entity, type ProjectPath3Entity, type Revolve3Entity, type Tube3Entity,
} from "./index.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";
const NAMES = ["model3", "assembly3", "extrude3", "revolve3", "tube3", "project3", "projectpath3", "finish3"] as const;

const SOURCE = `canvas(1280, 720);
template("black");
camera3((8, -10, 7), (0, 0, 1), 42);

rect(face, (0, 0), 2, 1);
curve3(spine, "2*t-1", "0", "0.4+1.6*t", (0, 1));
point3(probe, (1, 2, 3), 0.12);

model3(beacon, "asset:models/manic-pyramid.obj", (-2, 0, 1), 0.8);
finish3(beacon, "material=metal shading=flat mesh=0.2 depth=0.18 shadow=0.3");
assembly3(console, "asset:models/manic-console.obj", (2, 0, 1), 1.2);
color(console.screen, cyan);
finish3(console.screen, "material=glass shading=smooth");
extrude3(block, face, 1.2, (0, -2, 0.6));
revolve3(vase, (0, 2, 1.5), "0.7+0.2*sin(2*t)", (0, 3), 24);
tube3(pipe, spine, "0.05+0.08*t", 10);
project3(shadow, probe, "xy");
projectpath3(flat, spine, xz);
thick(flat, 0.025);
`;

describe("Three assets and derived solids batch", () => {
  it("projects all eight names and preserves unchanged source byte-exactly", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    for (const name of NAMES.slice(0, -1)) expect(scene.doc.entities.some((entity) => entity.kind === name), name).toBe(true);
    const model = scene.doc.entities.find((entity) => entity.kind === "model3") as Model3Entity;
    const assembly = scene.doc.entities.find((entity) => entity.kind === "assembly3") as Assembly3Entity;
    expect(model.finish3).toMatchObject({ material: "metal", shading: "flat", mesh: .2, depth: .18, shadow: .3 });
    expect(referenceIds(assembly)).toEqual(["console.base", "console.screen", "console.key"]);
    expect(assembly.childStyles["console.screen"]).toMatchObject({ color: "cyan", finish3: { material: "glass", shading: "smooth" } });
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
  });

  it("keeps deterministic Canvas geometry and live dependencies", () => {
    const doc = readSceneSource(SOURCE).doc, ctx = geometryContext(doc);
    const extrude = doc.entities.find((entity) => entity.kind === "extrude3") as Extrude3Entity;
    const revolve = doc.entities.find((entity) => entity.kind === "revolve3") as Revolve3Entity;
    const tube = doc.entities.find((entity) => entity.kind === "tube3") as Tube3Entity;
    const projection = doc.entities.find((entity) => entity.kind === "project3") as Project3Entity;
    const projectedPath = doc.entities.find((entity) => entity.kind === "projectpath3") as ProjectPath3Entity;
    expect(extrude3WorldVertices(extrude, ctx)).toHaveLength(8);
    expect(revolve3WorldGeometry(revolve, 12).points.length).toBeGreaterThan(100);
    expect(path3WorldPoints(tube.id, ctx).length).toBeGreaterThan(100);
    expect(project3WorldPoint(projection, ctx)).toEqual({ x: 1, y: 2, z: 0 });
    expect(path3WorldPoints(projectedPath.id, ctx).every((point) => point.y === 0)).toBe(true);
    const assembly = cloneDoc(doc).entities.find((entity) => entity.kind === "assembly3") as Assembly3Entity;
    assembly.id = "device";
    replaceEntityReference(assembly, "console.screen", "device.screen");
    expect(assembly.childStyles["device.screen"]?.color).toBe("cyan");
    expect(assembly.childStyles["console.screen"]).toBeUndefined();
  });

  it("patches asset, formula, relationship, and finish values surgically", () => {
    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    const model = next.entities.find((entity) => entity.kind === "model3") as Model3Entity;
    model.scaleFactor = 1.1;
    if (model.finish3) { model.finish3.material = "glass"; if (!model.finish3.keys.includes("material")) model.finish3.keys.push("material"); }
    const tube = next.entities.find((entity) => entity.kind === "tube3") as Tube3Entity;
    tube.radiusProfile = "0.1+0.04*t";
    const projection = next.entities.find((entity) => entity.kind === "project3") as Project3Entity;
    replaceEntityReference(projection, "probe", "beacon");
    const patched = patchSceneSource(SOURCE, scene, next);
    expect(patched).toContain('model3(beacon, "asset:models/manic-pyramid.obj", (-2, 0, 1), 1.1);');
    expect(patched).toContain("material=glass");
    expect(patched).toContain('tube3(pipe, spine, "0.1+0.04*t", 10);');
    expect(patched).toContain('project3(shadow, beacon, "xy");');
    expect(readSceneSource(patched).skipped).toEqual([]);
  });

  it("creates all seven object constructors and finish3 from Canvas", () => {
    const doc = emptyDoc();
    doc.entities.push(createEntity("camera3", "camera", 0, 0, doc));
    doc.entities.push(createEntity("rect", "face", 0, 0, doc));
    doc.entities.push(createEntity("curve3", "spine", 0, 0, doc));
    doc.entities.push(createEntity("point3", "probe", 0, 0, doc));
    for (const name of NAMES.slice(0, -1)) {
      const def = entityDef(name)!;
      expect(def.canCreate?.(doc) ?? true, name).toBe(true);
      const entity = createEntity(name as EntityKind, name, 0, 0, doc, name === "extrude3" ? "face" : name === "tube3" || name === "projectpath3" ? "spine" : "probe");
      doc.entities.push(entity);
    }
    const revolve = doc.entities.find((entity) => entity.kind === "revolve3")!;
    expect(applyVocabularyFeature(revolve, "finish3", doc)).toBe(true);
    const source = serializeSceneFile(doc);
    expect(readSceneSource(source).skipped).toEqual([]);
    for (const name of NAMES) expect(source).toContain(`${name}(`);
  });

  it("keeps every asset and derived-solid name semantic after later Three batches", () => {
    const three = allVocabularyEntries(true).filter((entry) => entry.kit === "three");
    expect(three).toHaveLength(75);
    for (const name of NAMES) expect(three.find((entry) => entry.name === name)?.fidelity, name).toBe("semantic");
  });

  it("does not skip this batch in representative native examples", () => {
    const batch = new RegExp(`\\b(?:${NAMES.join("|")})\\s*\\(`);
    for (const path of [
      "/Users/anish/git/manic/examples/three-d-v2-lab.manic",
      "/Users/anish/git/manic/examples/extrude3.manic",
      "/Users/anish/git/manic/examples/story-addressable-asset-cues.manic",
      "/Users/anish/git/manic/examples/creator-three-shadows-of-a-curve.manic",
    ]) {
      const scene = readSceneSource(readFileSync(path, "utf8"));
      expect(scene.skipped.filter((statement) => batch.test(statement.source)), path).toEqual([]);
    }
  });

  it.runIf(existsSync(MANIC))("passes the native Manic checker", () => {
    const file = resolve(tmpdir(), `manic-workbench-three-assets-solids-${process.pid}.manic`);
    writeFileSync(file, SOURCE);
    expect(execFileSync(MANIC, ["check", file], { encoding: "utf8" })).toContain("parses + validates");
  });
});
