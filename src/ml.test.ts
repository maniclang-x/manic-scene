import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allEntityDefs, allVerbDefs, canvasAnnotations, cloneDoc, mlOutputShape, mlTensorGrid, mlTokens,
  patchSceneSource, readSceneSource, referenceIds, serializeSceneFile, verbDef, type MlEntity,
} from "./index.js";

const source = `title("ML kit");
canvas("16:9");
network(net, (310, 230), "3 5 3", "relu softmax", 520, 300, 7);
activation(act, (920, 180), sigmoid, 360, 220);
tensor(input, (180, 520), "0 1 0 1; 1 0 1 0; 0 1 0 1; 1 0 1 0", 30, cyan);
digit(digit5, (390, 520), "5", 16, cyan);
kernel(edge, (560, 520), "1 0; 0 -1", 30, magenta);
convolve(conv, input, edge, (760, 510), 1, 0, 0, relu, 28);
pool(down, conv, (970, 510), max, 2, 1, 0, 28);
tokenize(tokens, (370, 760), "the model learns", word, 620);
embedding(embed, tokens, (880, 760), "seeded 6 37", sinusoidal, 660, 300);
transformer(block, embed, (380, 1030), "heads=2 mask=causal mlp=12", 720, 340);
logits(next, block, 2, (900, 1020), "yes | no | maybe", 0.8, 500, 280, 73);
attention(focus, (370, 1320), "the | model | learns", "1 0 0; 0 1 0; 0 0 1", 700, 320, 17);
topk(best, focus, 2, (900, 1320), "the | model | learns", 2, 420, 230, 29);
color(input.c0.r0c0, gold);
forward(net, "0.2 0.5 0.9", 3.2);
feed(net, digit5, 3.2);
loss(net, "1 0 0", crossentropy, 1.6);
backward(net, 3.2);
checkpoint(beforeUpdate, net);
update(net, 0.12, 2.4);
restore(net, beforeUpdate, 2.3);
scan(conv);
encode(block, 5.4);
sample(next, "top-p 0.9 seed=17", 3.6);
attend(focus, 2, 4.2);
`;

describe("ML kit onboarding", () => {
  it("registers all 13 entities and 11 runtime verbs", () => {
    const entities = allEntityDefs().filter((def) => def.group === "ML");
    expect(new Set(entities.map((def) => def.ctor))).toEqual(new Set([
      "network", "activation", "tensor", "digit", "kernel", "convolve", "pool", "tokenize",
      "embedding", "transformer", "logits", "attention", "topk",
    ]));
    const verbs = new Set(allVerbDefs().map((def) => def.name));
    for (const name of ["forward", "feed", "loss", "backward", "checkpoint", "update", "restore", "scan", "encode", "sample", "attend"]) expect(verbs.has(name), name).toBe(true);
  });

  it("parses every ML form without skips and serializes positional tails correctly", () => {
    const scene = readSceneSource(source);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.filter((entity) => allEntityDefs().find((def) => def.group === "ML" && def.kind === entity.kind))).toHaveLength(13);
    expect(scene.doc.steps.flatMap((step) => step.actions)).toHaveLength(11);
    const text = serializeSceneFile(scene.doc);
    expect(text).toContain("convolve(conv, input, edge, (760, 510), 1, 0, 0, relu, 28);");
    expect(text).toContain("checkpoint(beforeUpdate, net);");
    expect(text).toContain("restore(net, beforeUpdate, 2.3);");
    expect(text).toContain("scan(conv);");
  });

  it("keeps checkpoint identifiers literal even when a variable has the same name", () => {
    const scene = readSceneSource('let saved = 42; network(net, (300, 200), "2 2", "relu"); checkpoint(saved, net); restore(net, saved, 2.3);');
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.steps.flatMap((step) => step.actions)).toEqual(expect.arrayContaining([
      expect.objectContaining({ verb: "checkpoint", target: "net", text: "saved" }),
      expect.objectContaining({ verb: "restore", target: "net", text: "saved" }),
    ]));
  });

  it("builds deterministic tensor children, token children, dependencies, and output shape", () => {
    const doc = readSceneSource(source).doc, input = doc.entities.find((entity): entity is MlEntity => entity.id === "input")!, conv = doc.entities.find((entity): entity is MlEntity => entity.id === "conv")!, tokens = doc.entities.find((entity): entity is MlEntity => entity.id === "tokens")!;
    expect(mlTensorGrid(input)).toMatchObject({ channels: 1, rows: 4, cols: 4, issue: null });
    expect(referenceIds(input)).toEqual(expect.arrayContaining(["input.cells", "input.c0.r0c0", "input.row3", "input.col3"]));
    expect(mlTokens(tokens)).toEqual(["the", "model", "learns"]);
    expect(referenceIds(tokens)).toEqual(expect.arrayContaining(["tokens.token0", "tokens.token2.text"]));
    expect(mlOutputShape(conv, doc)).toEqual({ channels: 1, rows: 3, cols: 3, steps: 9, issue: null });
    expect(verbDef("scan")!.beatDur(doc.steps.flatMap((step) => step.actions).find((action) => action.verb === "scan")!, conv, doc)).toBeCloseTo(3.78);
  });

  it("reports exact authoring figures, semantic runtime contracts, and broken dependencies honestly", () => {
    const doc = readSceneSource(source).doc, tensor = doc.entities.find((entity) => entity.id === "input")!, network = doc.entities.find((entity) => entity.id === "net")!, conv = doc.entities.find((entity): entity is MlEntity => entity.id === "conv")!;
    expect(canvasAnnotations(tensor, doc).find((note) => note.id === "ml-contract")).toMatchObject({ representation: "exact", tone: "info" });
    expect(canvasAnnotations(network, doc).find((note) => note.id === "ml-contract")).toMatchObject({ representation: "semantic", tone: "info", label: expect.stringContaining("runtime beats") });
    expect(canvasAnnotations({ ...conv, ref2: "missingKernel" }, doc).find((note) => note.id === "ml-contract")).toMatchObject({ tone: "warning", label: expect.stringContaining("Missing dependency") });
  });
});

const EXAMPLES = resolve(import.meta.dirname, "../../../manic/examples");
describe.skipIf(!existsSync(EXAMPLES))("native ML examples", () => {
  for (const file of [
    "manic-ml-activation-focus.manic", "manic-ml-cnn-edge-story.manic", "manic-ml-forward-pass.manic",
    "manic-ml-learning-step.manic", "manic-ml-logits-sampling.manic", "manic-ml-scalar-to-tensor.manic",
    "manic-ml-token-embedding.manic", "manic-ml-transformer-attention.manic", "manic-ml-transformer-block.manic",
  ]) it(`${file} projects its ML vocabulary and remains byte-identical`, () => {
    const original = readFileSync(resolve(EXAMPLES, file), "utf8"), scene = readSceneSource(original);
    expect(scene.skipped.filter((note) => /`(network|activation|tensor|digit|kernel|convolve|pool|tokenize|embedding|transformer|logits|attention|topk|forward|feed|loss|backward|checkpoint|update|restore|scan|encode|sample|attend)` isn't canvas vocabulary yet/u.test(note))).toEqual([]);
    expect(patchSceneSource(original, scene, cloneDoc(scene.doc))).toBe(original);
  });
});
