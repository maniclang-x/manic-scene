import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allVocabularyEntries, applyVocabularyFeature, beatTargetOptions, canvasAnnotations, cloneDoc, collection3Points,
  collectionLinks3Geometry, collectionPath3Points, createAction, createEntity, emptyDoc,
  geometryContext, hilbert3Points, lsystem3Geometry, patchSceneSource, pieces3Quads,
  randomWalk3Points, readSceneSource, referenceIds, serializeSceneFile, tree3Geometry,
  type Collection3Entity, type CollectionLinks3Entity, type CollectionPath3Entity,
  type EntityKind, type Hilbert3Entity, type LSystem3Entity, type Pieces3Entity,
  type RandomWalk3Entity, type Tree3Entity,
} from "./index.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";
const NAMES = ["collection3", "collection3data", "child3", "links3", "links3data", "pieces3", "ring3", "trail3", "historyplot", "historyplot3", "randomwalk3", "lsystem3", "tree3", "hilbert3", "attach3", "follow3"] as const;

const SOURCE = `canvas(1280, 720);
template("black");
camera3((8, -10, 7), (0, 0, 1), 42);
surface3(sheet, "0.12*(x*x-y*y)", (-2, 2), (-2, 2), 10);
collection3(nodes, (0, 0, 0), 12, (2, 1.5, 1), 17, 0.06);
collection3data(explicit, (3, 0, 0), "0 0 0; 1 0 0; 1 1 1; 0 1 0", 0.1);
child3(hero, nodes, 2, 0.14);
links3(net, nodes, nearest, 2);
links3data(edges, explicit, "0 1; 1 2; 2 3; 3 0");
pieces3(tiles, sheet, 4, 3, 0.1);
color(tiles.r0c0, gold);
ring3(orbit, nodes, 2, 64);
trail3(memory, nodes, 2, 0.03);
historyplot(chart, nodes, 2, y, (1040, 150), (360, 130));
historyplot3(worldchart, nodes, 2, z, (-3, -4, 2), (6, 2));
randomwalk3(walk, (0, 0, 0), 300, 21, "mode=axis color=direction scale=0.1");
lsystem3(grammar, (0, 0, 0), 0.2, 25, 4, "F", "F=F[+F][-F][^F]", 100000);
tree3(tree, (0, 0, -2), 1.5, 28, 0.72, 5, 42);
color(tree.d0, lime);
hilbert3(spacefill, (0, 0, 0), 4, 3, "color=gradient shade=depth");
follow3(hero, tiles.r0c0, (0, 0, 1));
attach3(hero, explicit, (0.2, 0, 0), rigid);
attach3(hero, none);
`;

describe("Three collections and procedural systems batch", () => {
  it("projects all 16 builtins and preserves unchanged source byte-exactly", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    for (const name of NAMES.slice(0, 14)) expect(scene.doc.entities.some((entity) => entity.kind === name), name).toBe(true);
    const hero = scene.doc.entities.find((entity) => entity.kind === "child3")!;
    const pieces = scene.doc.entities.find((entity) => entity.kind === "pieces3") as Pieces3Entity;
    const tree = scene.doc.entities.find((entity) => entity.kind === "tree3") as Tree3Entity;
    expect(hero.follow3).toEqual({ target: "tiles.r0c0", offset: { x: 0, y: 0, z: 1 } });
    expect(referenceIds(pieces)).toContain("tiles.r0c0");
    expect(pieces.childStyles["tiles.r0c0"]?.color).toBe("gold");
    expect(referenceIds(tree)).toContain("tree.leaves");
    expect(tree.childStyles["tree.d0"]?.color).toBe("lime");
    expect(beatTargetOptions(scene.doc, "attach3").some((target) => target.id === "tiles.r0c0")).toBe(true);
    expect(beatTargetOptions(scene.doc, "attach3").some((target) => target.id === "tiles.row0")).toBe(false);
    expect(scene.doc.steps.flatMap((step) => step.actions).map((action) => action.verb)).toEqual(["attach3", "attach3"]);
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
  });

  it("keeps bounded procedural samples deterministic and dependency-aware", () => {
    const doc = readSceneSource(SOURCE).doc, ctx = geometryContext(doc);
    const nodes = doc.entities.find((entity) => entity.kind === "collection3") as Collection3Entity;
    const links = doc.entities.find((entity) => entity.kind === "links3") as CollectionLinks3Entity;
    const ring = doc.entities.find((entity) => entity.kind === "ring3") as CollectionPath3Entity;
    const pieces = doc.entities.find((entity) => entity.kind === "pieces3") as Pieces3Entity;
    const walk = doc.entities.find((entity) => entity.kind === "randomwalk3") as RandomWalk3Entity;
    const grammar = doc.entities.find((entity) => entity.kind === "lsystem3") as LSystem3Entity;
    const tree = doc.entities.find((entity) => entity.kind === "tree3") as Tree3Entity;
    const hilbert = doc.entities.find((entity) => entity.kind === "hilbert3") as Hilbert3Entity;
    expect(collection3Points(nodes)).toEqual(collection3Points(nodes));
    expect(collection3Points(nodes)).toHaveLength(12);
    expect(collectionLinks3Geometry(links, ctx).edges.length).toBeGreaterThanOrEqual(12);
    expect(collectionPath3Points(ring, ctx)).toHaveLength(65);
    expect(pieces3Quads(pieces, ctx)).toHaveLength(12);
    expect(randomWalk3Points(walk)).toHaveLength(301);
    expect(lsystem3Geometry(grammar).edges.length).toBeGreaterThan(100);
    expect(tree3Geometry(tree).layers).toHaveLength(5);
    expect(hilbert3Points(hilbert).length).toBeGreaterThan(100);
    expect(canvasAnnotations(ring, doc).some((note) => note.id === "procedural3")).toBe(true);
    expect(canvasAnnotations(doc.entities.find((entity) => entity.kind === "child3")!, doc).some((note) => note.id === "follow3" && note.refs.includes("tiles.r0c0"))).toBe(true);
  });

  it("matches native defaults and rejects malformed explicit datasets", () => {
    const defaults = readSceneSource(`collection3(c, (0,0,0), 3, (1,1,1), 7);\nrandomwalk3(w, (0,0,0), 8);\nlsystem3(l, (0,0,0), 1, 270, 1, "F", "F=F");\n`);
    expect(defaults.skipped).toEqual([]);
    expect((defaults.doc.entities.find((entity) => entity.kind === "randomwalk3") as RandomWalk3Entity).seed).toBe(21);
    expect((defaults.doc.entities.find((entity) => entity.kind === "lsystem3") as LSystem3Entity).maxSymbols).toBe(250000);
    expect(serializeSceneFile(defaults.doc)).toContain('lsystem3(l, (0, 0, 0), 1, 270, 1, "F", "F=F");');
    expect(readSceneSource('collection3data(c, (0,0,0), "0 0 0; bad");').skipped).not.toEqual([]);
    expect(readSceneSource('links3data(e, c, "0 nope");').skipped).not.toEqual([]);
  });

  it("creates every constructor plus follow3 and attach3 from visual controls", () => {
    const doc = emptyDoc();
    doc.entities.push(createEntity("camera3", "camera", 0, 0, doc));
    doc.entities.push(createEntity("surface3", "sheet", 0, 0, doc));
    doc.entities.push(createEntity("collection3", "nodes", 0, 0, doc));
    for (const name of NAMES.slice(1, 14)) {
      const entity = createEntity(name as EntityKind, name, 320, 220, doc, name === "pieces3" ? "sheet" : "nodes");
      doc.entities.push(entity);
    }
    const hero = doc.entities.find((entity) => entity.kind === "child3")!;
    expect(applyVocabularyFeature(hero, "follow3", doc)).toBe(true);
    const action = createAction("attach3", hero.id);
    action.ref = "nodes";
    action.values = [.2, 0, 1];
    action.prop = "rigid";
    doc.steps.push({ name: "Attach", mode: "together", gap: 0, actions: [action] });
    const source = serializeSceneFile(doc);
    expect(readSceneSource(source).skipped).toEqual([]);
    for (const name of NAMES) expect(source).toContain(`${name}(`);
  });

  it("keeps every collection/procedural name on the semantic Canvas surface", () => {
    const three = allVocabularyEntries(true).filter((entry) => entry.kit === "three");
    expect(three).toHaveLength(75);
    for (const name of NAMES) expect(three.find((entry) => entry.name === name)?.fidelity, name).toBe("semantic");
  });

  it("does not skip this batch in representative native examples", () => {
    const batch = new RegExp(`\\b(?:${NAMES.join("|")})\\s*\\(`);
    for (const path of [
      "/Users/anish/git/manic/examples/story-living-dependency-cloud.manic",
      "/Users/anish/git/manic/examples/fourier-series-live-wave.manic",
      "/Users/anish/git/manic/examples/three-d-v2-lab.manic",
      "/Users/anish/git/manic/examples/sphere-area.manic",
      "/Users/anish/git/manic/examples/creator-randomwalk3-diffusion.manic",
      "/Users/anish/git/manic/examples/creator-hilbert3-spatial-index.manic",
      "/Users/anish/git/manic/examples/creator-branch-counting-tree3.manic",
    ]) {
      const scene = readSceneSource(readFileSync(path, "utf8"));
      expect(scene.skipped.filter((statement) => batch.test(statement)), path).toEqual([]);
    }
  });

  it.runIf(existsSync(MANIC))("passes the native Manic checker", () => {
    const file = resolve(tmpdir(), `manic-workbench-three-collections-procedural-${process.pid}.manic`);
    writeFileSync(file, SOURCE);
    expect(execFileSync(MANIC, ["check", file], { encoding: "utf8" })).toContain("parses + validates");
  });
});
