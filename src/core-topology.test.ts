import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allVocabularyEntries, canvasAnnotations, cloneDoc, createEntity, dualGeometry,
  emptyDoc, entriesForSurface, entityDef, geometryContext, patchSceneSource,
  readSceneSource, referenceIds, regionsGeometry, serializeSceneFile,
  spanTreeGeometry, vocabularyAvailability, vocabularyEntry,
} from "./index.js";
import type { BooleanRegionEntity, DualEntity, RegionsEntity, SpanTreeEntity } from "./types.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";
const SOURCE = `canvas(1000, 760);
template("black");

rect(boundary, (430, 360), 400, 400);
circle(overlap, (550, 320), 170);
union(u, boundary, overlap, cyan);
intersect(i0, boundary, overlap, gold);
intersection(i1, boundary, overlap, lime);
difference(d0, boundary, overlap, magenta);
subtract(d1, boundary, overlap, violet);
exclusion(x0, boundary, overlap, orange);
xor(x1, boundary, overlap, red);

line(cut0, (230, 160), (630, 560));
tag(cut0, cuts);
line(cut1, (630, 160), (230, 560));
tag(cut1, cuts);
regions(cells, boundary, cuts);
spantree(primal, cuts, boundary);
dual(du, boundary, cuts);
spantree(dualTree, du);
`;

describe("Core boolean and planar topology batch", () => {
  it("parses every boolean spelling, round-trips, and passes native validation", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    const booleans = scene.doc.entities.filter((entity): entity is BooleanRegionEntity => entity.kind === "boolean");
    expect(booleans.map((entity) => entity.spelling)).toEqual(["union", "intersect", "intersection", "difference", "subtract", "exclusion", "xor"]);
    expect(scene.doc.entities.filter((entity) => ["regions", "spantree", "dual"].includes(entity.kind))).toHaveLength(4);

    const regenerated = serializeSceneFile(scene.doc), roundTrip = readSceneSource(regenerated);
    expect(roundTrip.skipped).toEqual([]);
    expect(roundTrip.doc).toEqual(scene.doc);
    if (existsSync(MANIC)) {
      const path = join(tmpdir(), "manic-core-topology.manic");
      writeFileSync(path, regenerated);
      expect(() => execFileSync(MANIC, ["check", path], { stdio: "pipe" })).not.toThrow();
    }
  });

  it("matches the native arrangement, tree/co-tree, and dual structure on a crossed square", () => {
    const doc = readSceneSource(SOURCE).doc, ctx = geometryContext(doc);
    const regions = doc.entities.find((entity): entity is RegionsEntity => entity.kind === "regions")!;
    const primal = doc.entities.find((entity): entity is SpanTreeEntity => entity.kind === "spantree" && entity.id === "primal")!;
    const dual = doc.entities.find((entity): entity is DualEntity => entity.kind === "dual")!;
    const faces = regionsGeometry(regions, ctx), tree = spanTreeGeometry(primal, ctx), graph = dualGeometry(dual, ctx);
    expect(faces.totalFaces).toBe(4);
    expect(tree.tree).toHaveLength(3);
    expect(tree.cotree).toHaveLength(3);
    expect(graph.faces).toHaveLength(4);
    expect(graph.nodes).toHaveLength(5);
    expect(graph.edges).toHaveLength(4);
    expect(referenceIds(primal)).toEqual(["primal.co"]);
    expect(referenceIds(dual)).toEqual(["du.nodes"]);
  });

  it("surgically edits aliases and ordered multi-reference constructor arguments", () => {
    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    const intersection = next.entities.find((entity): entity is BooleanRegionEntity => entity.kind === "boolean" && entity.id === "i0")!;
    intersection.spelling = "subtract";
    const regions = next.entities.find((entity): entity is RegionsEntity => entity.kind === "regions")!;
    regions.dividers = ["cut0"];
    const primal = next.entities.find((entity): entity is SpanTreeEntity => entity.kind === "spantree" && entity.id === "primal")!;
    primal.edges = ["boundary", "cuts"];
    const updated = patchSceneSource(SOURCE, scene, next);
    expect(updated).toContain("subtract(i0, boundary, overlap, gold);");
    expect(updated).toContain("regions(cells, boundary, cut0);");
    expect(updated).toContain("spantree(primal, boundary, cuts);");
    expect(readSceneSource(updated).skipped).toEqual([]);
  });

  it("indexes aliases without duplicating the Add toolbar and exposes honest annotations", () => {
    const doc = readSceneSource(SOURCE).doc;
    for (const name of ["union", "intersect", "intersection", "difference", "subtract", "exclusion", "xor", "regions", "spantree", "dual"]) {
      expect(vocabularyEntry(name), name).toMatchObject({ fidelity: "semantic" });
    }
    const booleanAddEntries = entriesForSurface("add").filter((entry) => ["union", "intersect", "intersection", "difference", "subtract", "exclusion", "xor"].includes(entry.name));
    expect(booleanAddEntries.map((entry) => entry.name)).toEqual(["union"]);
    expect(vocabularyAvailability(vocabularyEntry("subtract")!, doc)).toMatchObject({ enabled: true });
    expect(entityDef("regions")?.fields.find((field) => field.key === "dividers")).toMatchObject({ input: "entities", includeTags: true });
    expect(canvasAnnotations(doc.entities.find((entity) => entity.id === "cells")!, doc)).toEqual(expect.arrayContaining([expect.objectContaining({ label: "4 bounded regions", refs: ["boundary", "cuts"] })]));
    expect(canvasAnnotations(doc.entities.find((entity) => entity.id === "primal")!, doc)).toEqual(expect.arrayContaining([expect.objectContaining({ label: "3 tree · 3 co-tree edges" })]));

    const empty = emptyDoc();
    expect(vocabularyAvailability(vocabularyEntry("union")!, empty)).toMatchObject({ enabled: false });
    empty.entities.push(createEntity("rect", "a", 200, 200, empty), createEntity("circle", "b", 260, 200, empty));
    expect(() => createEntity("boolean", "combined", 0, 0, empty, "a")).not.toThrow();
    expect(allVocabularyEntries(true).filter((entry) => entry.fidelity !== "source-only").length).toBeGreaterThanOrEqual(166);
  });

  it("accepts the representative native boolean and Euler topology examples byte-exactly", () => {
    for (const path of [
      "/Users/anish/git/manic/examples/boolean.manic",
      "/Users/anish/git/manic/examples/3b1b-eval/euler-proof.manic",
      "/Users/anish/git/manic/examples/3b1b-eval/region-partition.manic",
    ]) {
      const source = readFileSync(path, "utf8"), scene = readSceneSource(source);
      expect(scene.skipped, path).toEqual([]);
      expect(patchSceneSource(source, scene, cloneDoc(scene.doc)), path).toBe(source);
    }
  });
});
