import { describe, expect, it } from "vitest";
import {
  allEntityDefs, allVerbDefs, canvasAnnotations, createBeatAction, graphAlgorithmPlan, hashmapLayout,
  hashmapLookupPlan, readSceneSource, referenceIds, serializeSceneFile, verbDef,
  type GraphEntity, type HashMapEntity,
} from "./index.js";

const source = `
hashmap(ht, 5, (280, 330), 128, 46);
graph(g, "a b c d e f", "a-b:2 a-c:5 b-c:1 b-d:4 c-e:3 d-e:1 d-f:2 e-f:6", circular, (850, 330), 190, 30);
step("Algorithms") {
  seq {
    put(ht, "cat", "7", 0.5);
    put(ht, "dog", "3", 0.5);
    put(ht, "act", "9", 0.5);
    get(ht, "act", 0.45);
    get(ht, "xyz", 0.45);
    bfs(g, a);
    dfs(g, a);
    dijkstra(g, a);
  }
}
`;

describe("Hash maps and graph algorithms", () => {
  it("closes the seven remaining Algo catalog names", () => {
    const entities = new Set(allEntityDefs().map((def) => def.ctor)), verbs = new Set(allVerbDefs().map((def) => def.name));
    expect(entities.has("hashmap")).toBe(true); expect(entities.has("graph")).toBe(true);
    for (const name of ["put", "get", "bfs", "dfs", "dijkstra"]) expect(verbs.has(name), name).toBe(true);
  });

  it("parses and serializes every native signature", () => {
    const parsed = readSceneSource(source);
    expect(parsed.skipped).toEqual([]);
    expect(parsed.doc.entities.map((entity) => entity.kind)).toEqual(["hashmap", "graph"]);
    expect(parsed.doc.steps[0].actions.map((action) => action.verb)).toEqual(["put", "put", "put", "get", "get", "bfs", "dfs", "dijkstra"]);
    const text = serializeSceneFile(parsed.doc);
    expect(text).toContain("hashmap(ht, 5, (280, 330), 128, 46);");
    expect(text).toContain('put(ht, "cat", "7", 0.5);');
    expect(text).toContain('get(ht, "act", 0.45);');
    expect(text).toContain('graph(g, "a b c d e f", "a-b:2 a-c:5 b-c:1 b-d:4 c-e:3 d-e:1 d-f:2 e-f:6", circular, (850, 330), 190, 30);');
    expect(text).toContain("bfs(g, a);"); expect(text).toContain("dfs(g, a);"); expect(text).toContain("dijkstra(g, a);");
  });

  it("reproduces UTF-8 hashing, collision chains, and lookup duration", () => {
    const doc = readSceneSource(source).doc, hashmap = doc.entities.find((entity): entity is HashMapEntity => entity.kind === "hashmap")!;
    const layout = hashmapLayout(hashmap, doc);
    expect(layout.entries.map((entry) => [entry.key, entry.bucket, entry.chainIndex])).toEqual([["cat", 2, 0], ["dog", 4, 0], ["act", 2, 1]]);
    const [hitAction, missAction] = doc.steps[0].actions.filter((action) => action.verb === "get");
    expect(hashmapLookupPlan(hashmap, hitAction, doc)).toMatchObject({ bucket: 2, hit: 1, duration: 2 });
    expect(hashmapLookupPlan(hashmap, missAction, doc)).toMatchObject({ bucket: 3, hit: null, duration: 1.1 });
    expect(verbDef("get")!.beatDur(hitAction, hashmap, doc)).toBeCloseTo(2);
  });

  it("matches native BFS, DFS, and Dijkstra declaration-order plans", () => {
    const graph = readSceneSource(source).doc.entities.find((entity): entity is GraphEntity => entity.kind === "graph")!;
    expect(graphAlgorithmPlan(graph, "a", "bfs").order).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(graphAlgorithmPlan(graph, "a", "dfs").order).toEqual(["a", "c", "e", "f", "d", "b"]);
    const shortest = graphAlgorithmPlan(graph, "a", "dijkstra");
    expect(shortest.order).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(shortest.distances).toMatchObject({ a: 0, b: 2, c: 3, d: 6, e: 6, f: 8 });
    expect(shortest.treeEdges).toHaveLength(5);
  });

  it("exposes static native children and dynamic start-vertex choices", () => {
    const doc = readSceneSource(source).doc, hashmap = doc.entities.find((entity): entity is HashMapEntity => entity.kind === "hashmap")!, graph = doc.entities.find((entity): entity is GraphEntity => entity.kind === "graph")!;
    expect(referenceIds(hashmap)).toEqual(expect.arrayContaining(["ht.buckets", "ht.bucket0", "ht.bucket4.v"]));
    expect(referenceIds(graph)).toEqual(expect.arrayContaining(["g.nodes", "g.edges", "g.a", "g.a.label", "g.a-b", "g.a-b.w"]));
    const bfs = createBeatAction(doc, "bfs", "g").action!;
    expect(bfs).toMatchObject({ target: "g", text: "a", durationExplicit: false });
    expect(bfs.dur).toBeCloseTo(graphAlgorithmPlan(graph, "a", "bfs").duration);
  });

  it("reports planned mutation and invalid traversal semantics", () => {
    const parsed = readSceneSource(source), hashmap = parsed.doc.entities.find((entity) => entity.kind === "hashmap")!, graph = parsed.doc.entities.find((entity) => entity.kind === "graph")!;
    expect(canvasAnnotations(hashmap, parsed.doc).find((note) => note.id === "algo-hashmap")).toMatchObject({ representation: "semantic", tone: "info" });
    expect(canvasAnnotations(graph, parsed.doc).find((note) => note.id === "algo-graph")).toMatchObject({ representation: "semantic", tone: "info" });
    const invalid = readSceneSource('graph(g, "a b", "a-b", row, (300,300), 100); bfs(g, z);');
    expect(canvasAnnotations(invalid.doc.entities[0], invalid.doc).find((note) => note.id === "algo-graph")).toMatchObject({ tone: "warning" });
  });
});
