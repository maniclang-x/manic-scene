import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allVocabularyEntries, cloneDoc, createEntity, cross3WorldGeometry, cube3WorldVertices,
  emptyDoc, entityDef, geometryContext, link3WorldGeometry, patchSceneSource,
  polySolid3WorldGeometry, readSceneSource, referenceIds, serializeSceneFile,
  threePointReferences, worldAnchor3,
  type Axes3Entity, type Box3Entity, type Cross3Entity, type EntityKind,
  type Frame3Entity, type Link3Entity, type Midpoint3Entity, type PolySolid3Entity,
} from "./index.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";
const NAMES = ["axes3", "frame3", "cube3", "sphere3", "prism3", "pyramid3", "midpoint3", "cross3", "link3", "label3"] as const;

const SOURCE = `canvas(1280, 720);
template("black");
camera3((7, -7, 6), (0, 0, 0), 45, perspective);

point3(A, (-2, 0, 1), 0.12);
point3(B, (2, 0, 3), 0.12);
axes3(ax, (0, 0, 0), 3, 1);
frame3(fr, (0, 0, 1.5), (8, 8, 6), "x=-2..2 y=-2..2 z=0..3 planes=xy:min,xz:min major=1 minor=0.5 mode=spatial");
cube3(box, (-2, 2, 1), (1.5, 2, 2));
sphere3(ball, (2, 2, 1), 0.8);
prism3(hex, (-2, -2, 1), 6, 0.9, 2);
pyramid3(cone, (2, -2, 1.2), 12, 1, 2.4);
midpoint3(M, A, B);
cross3(cr, (0, 0, 0), (2, 1, 0), (-1, 2, 0));
hidden(cr.p);
hidden(cr.e1);
link3(edge, A, B, 0.1);
thick(edge, 0.025);

text(note, (0, 0), "midpoint");
label3(note, M, 0.34);
`;

describe("Three foundation batch", () => {
  it("projects every constructor, generated child, and label relationship", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    for (const name of NAMES.slice(0, -1)) expect(scene.doc.entities.some((entity) => entity.kind === name), name).toBe(true);
    const axes = scene.doc.entities.find((entity) => entity.kind === "axes3") as Axes3Entity;
    const cross = scene.doc.entities.find((entity) => entity.kind === "cross3") as Cross3Entity;
    const note = scene.doc.entities.find((entity) => entity.id === "note")!;
    expect(referenceIds(axes)).toContain("ax.num.z.3");
    expect(referenceIds(cross)).toEqual(["cr.v", "cr.w", "cr.p", "cr.e1", "cr.e2"]);
    expect(cross.childStyles["cr.p"]?.reveal).toBe("fade");
    expect(note.pin3).toMatchObject({ target: "M", form: "label3", worldHeight: .34 });
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
  });

  it("keeps projected foundation geometry deterministic and dependency-aware", () => {
    const doc = readSceneSource(SOURCE).doc, ctx = geometryContext(doc);
    const box = doc.entities.find((entity) => entity.kind === "cube3") as Box3Entity;
    const prism = doc.entities.find((entity) => entity.kind === "prism3") as PolySolid3Entity;
    const cross = doc.entities.find((entity) => entity.kind === "cross3") as Cross3Entity;
    const midpoint = doc.entities.find((entity) => entity.kind === "midpoint3") as Midpoint3Entity;
    const link = doc.entities.find((entity) => entity.kind === "link3") as Link3Entity;
    expect(cube3WorldVertices(box)).toHaveLength(8);
    expect(polySolid3WorldGeometry(prism).points).toHaveLength(12);
    expect(cross3WorldGeometry(cross).p[1]).toEqual({ x: 0, y: 0, z: 5 });
    expect(worldAnchor3(midpoint.id, ctx)).toEqual({ x: 0, y: 0, z: 2 });
    const edge = link3WorldGeometry(link, ctx);
    expect(edge.from.x).toBeGreaterThan(-2);
    expect(edge.to.x).toBeLessThan(2);
    expect(threePointReferences(doc)).toEqual(expect.arrayContaining(["A", "B", "M", "cr.v", "ax.x"]));
  });

  it("patches constructor and relationship values surgically", () => {
    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    const box = next.entities.find((entity) => entity.kind === "cube3") as Box3Entity;
    box.size.z = 3;
    const frame = next.entities.find((entity) => entity.kind === "frame3") as Frame3Entity;
    frame.zMax = 6; frame.mode = "textbook";
    const link = next.entities.find((entity) => entity.kind === "link3") as Link3Entity;
    link.trim = .2;
    const note = next.entities.find((entity) => entity.id === "note")!;
    if (note.pin3) note.pin3.worldHeight = .5;
    const patched = patchSceneSource(SOURCE, scene, next);
    expect(patched).toContain("cube3(box, (-2, 2, 1), (1.5, 2, 3));");
    expect(patched).toContain("z=0..6");
    expect(patched).toContain("mode=textbook");
    expect(patched).toContain("link3(edge, A, B, 0.2);");
    expect(patched).toContain("label3(note, M, 0.5);");
    expect(readSceneSource(patched).skipped).toEqual([]);
  });

  it("creates all nine object constructors from Canvas with safe dependencies", () => {
    const doc = emptyDoc();
    doc.entities.push(createEntity("camera3", "camera", 0, 0, doc));
    doc.entities.push(createEntity("point3", "A", 0, 0, doc));
    doc.entities.push(createEntity("point3", "B", 0, 0, doc));
    for (const name of NAMES.slice(0, -1)) {
      const def = entityDef(name)!;
      expect(def.canCreate?.(doc) ?? true, name).toBe(true);
      doc.entities.push(createEntity(name as EntityKind, name, 0, 0, doc, "A"));
    }
    const source = serializeSceneFile(doc);
    expect(readSceneSource(source).skipped).toEqual([]);
    for (const name of NAMES.slice(0, -1)) expect(source).toContain(`${name}(`);
  });

  it("keeps every foundational name semantic after later Three batches", () => {
    const three = allVocabularyEntries(true).filter((entry) => entry.kit === "three");
    expect(three).toHaveLength(75);
    for (const name of NAMES) expect(three.find((entry) => entry.name === name)?.fidelity, name).toBe("semantic");
  });

  it("accepts the representative cross-product scene byte-exactly", () => {
    const path = "/Users/anish/git/manic/examples/3b1b-eval/cross-product-3d.manic";
    const source = readFileSync(path, "utf8");
    const scene = readSceneSource(source);
    expect(scene.skipped).toEqual([]);
    expect(patchSceneSource(source, scene, cloneDoc(scene.doc))).toBe(source);
  });

  it("does not skip foundation vocabulary in the broader 3D examples", () => {
    const foundation = new RegExp(`\\b(?:${NAMES.join("|")})\\s*\\(`);
    for (const path of [
      "/Users/anish/git/manic/examples/frame3-grid-policies.manic",
      "/Users/anish/git/manic/examples/solids3.manic",
      "/Users/anish/git/manic/examples/three_d.manic",
    ]) {
      const scene = readSceneSource(readFileSync(path, "utf8"));
      expect(scene.skipped.filter((statement) => foundation.test(statement.source)), path).toEqual([]);
    }
  });

  it.runIf(existsSync(MANIC))("passes the native Manic checker", () => {
    const file = resolve(tmpdir(), `manic-workbench-three-foundation-${process.pid}.manic`);
    writeFileSync(file, SOURCE);
    expect(execFileSync(MANIC, ["check", file], { encoding: "utf8" })).toContain("parses + validates");
  });
});
