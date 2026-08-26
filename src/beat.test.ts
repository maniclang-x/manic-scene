import { describe, expect, it } from "vitest";
import {
  allVerbDefs, applyBeatOnAdd, beatAvailability, cloneDoc, createAction, createBeatAction,
  createEntity, emptyDoc, patchSceneSource, readSceneSource, serializeSceneFile, verbPropertyOptions,
  type SceneDoc,
} from "./index.js";

function beatDoc(): SceneDoc {
  const doc = emptyDoc();
  const text = createEntity("text", "words", 180, 120, doc);
  const caption = createEntity("caption", "caption", 300, 120, doc);
  const equation = createEntity("equation", "formula", 460, 120, doc);
  const path = createEntity("line", "path", 180, 260, doc);
  const box = createEntity("rect", "focus", 300, 260, doc);
  box.savedState = true;
  const a = createEntity("circle", "a", 420, 260, doc);
  const b = createEntity("circle", "b", 560, 260, doc);
  const particles = createEntity("particles", "dust", 0, 0, doc);
  const sliders = createEntity("sliders", "coordinates", 720, 260, doc);
  const camera = createEntity("camera3", "camera", 0, 0, doc);
  const curve = createEntity("curve3", "curve", 0, 0, doc);
  const curveTarget = createEntity("curve3", "curveTarget", 0, 0, doc);
  const edge3 = createEntity("line3", "edge3", 0, 0, doc);
  const frame3 = createEntity("frame3", "frame3", 0, 0, doc);
  const collection3 = createEntity("collection3", "collection3", 0, 0, doc);
  const vectorfield3 = createEntity("vectorfield3", "vectorfield3", 0, 0, doc);
  const quiz = createEntity("quiz", "quiz", 0, 0, doc);
  const array = createEntity("array", "array", 220, 440, doc);
  doc.entities.push(array);
  const pointer = createEntity("pointer", "pointer", 0, 0, doc, array.id);
  const stack = createEntity("stack", "stack", 520, 500, doc);
  const queue = createEntity("queue", "queue", 700, 500, doc);
  const list = createEntity("list", "list", 940, 500, doc);
  const hashmap = createEntity("hashmap", "hashmap", 1060, 420, doc);
  const graph = createEntity("graph", "graph", 1080, 560, doc);
  const network = createEntity("network", "network", 320, 760, doc);
  const tensor = createEntity("tensor", "tensor", 580, 760, doc);
  const kernel = createEntity("kernel", "kernel", 760, 760, doc);
  doc.entities.push(network, tensor, kernel);
  const convolution = createEntity("convolve", "convolution", 940, 760, doc, tensor.id);
  const tokens = createEntity("tokenize", "tokens", 320, 980, doc);
  doc.entities.push(convolution, tokens);
  const embedding = createEntity("embedding", "embedding", 650, 980, doc, tokens.id);
  doc.entities.push(embedding);
  const transformer = createEntity("transformer", "transformer", 980, 980, doc, embedding.id);
  doc.entities.push(transformer);
  const logits = createEntity("logits", "logits", 1120, 980, doc, transformer.id);
  const attention = createEntity("attention", "attention", 500, 1180, doc);
  doc.entities.push(logits, attention);
  const topk = createEntity("topk", "topk", 900, 1180, doc, attention.id);
  const pendulum = createEntity("pendulum", "pendulum", 320, 1420, doc);
  const ramp = createEntity("ramp", "ramp", 760, 1420, doc);
  const architecture = createEntity("architecture", "platform", 640, 1640, doc);
  doc.entities.push(architecture);
  const systemA = createEntity("node", "systemA", 0, 0, doc, architecture.id);
  doc.entities.push(systemA);
  const systemB = createEntity("node", "systemB", 0, 0, doc, architecture.id);
  doc.entities.push(systemB);
  const connection = createEntity("connect", "connection", 0, 0, doc, systemB.id);
  doc.entities.push(connection);
  const message = createEntity("message", "message", 0, 0, doc, systemA.id);
  const circuit = createEntity("circuit", "circuit", 640, 1880, doc);
  const grid = createEntity("grid", "grid", 300, 2080, doc);
  const racechart = createEntity("racechart", "racechart", 640, 2080, doc);
  const histogram = createEntity("livehistogram", "histogram", 980, 2080, doc);
  const vectorfield = createEntity("vectorfield", "field", 640, 2300, doc);
  const balance = createEntity("balance", "balance", 640, 2500, doc);
  balance.supplied = "Fe=10g O2=5g";
  balance.limiting = true;
  const lewis = createEntity("lewis", "lewis", 300, 2700, doc);
  const levels = createEntity("levels", "levels", 640, 2700, doc);
  const cell = createEntity("cell", "cell", 900, 2700, doc);
  const lattice = createEntity("lattice", "lattice", 1120, 2700, doc);
  curve.morph3 = { target: curveTarget.id, spin: null };
  doc.entities.push(topk, pendulum, ramp, message, circuit, grid, racechart, histogram, vectorfield, balance, lewis, levels, cell, lattice, pointer, stack, queue, list, hashmap, graph, text, caption, equation, path, box, a, b, particles, sliders, camera, curve, curveTarget, edge3, frame3, collection3, vectorfield3, quiz);
  doc.steps.push({ name: "Step 1", mode: "together", gap: .15, actions: [createAction("push", stack.id), createAction("enqueue", queue.id)] });
  return doc;
}

describe("Beat generation", () => {
  it("keeps section and mark as standalone timeline events", () => {
    const doc = beatDoc();
    expect(beatAvailability(doc, "section", "")).toMatchObject({ enabled: false });
    expect(beatAvailability(doc, "mark", "")).toMatchObject({ enabled: false });
    doc.steps = [
      { name: "Beat 1", mode: "together", gap: .15, actions: [createAction("section", "")] },
      { name: "Beat 2", mode: "together", gap: .15, actions: [createAction("mark", "")] },
    ];
    const source = serializeSceneFile(doc);
    expect(source).toContain('section("Next chapter");');
    expect(source).toContain('mark("chapter");');
    expect(source).not.toContain('step("Beat');

    const invalid = readSceneSource('step("bad") { mark("inside"); wait(1); }');
    expect(invalid.skipped).toEqual(expect.arrayContaining([expect.stringContaining("top-level timeline event")]));
    expect(invalid.doc.steps[0].actions.map((action) => action.verb)).toEqual(["wait"]);
  });

  it("uses native-compatible target and property choices", () => {
    const doc = beatDoc();
    for (const verb of ["move", "shift", "spin", "travel", "cycle", "disintegrate"]) {
      expect(beatAvailability(doc, verb, "curve").enabled, verb).toBe(false);
    }
    expect(beatAvailability(doc, "move", "caption").enabled).toBe(false);
    expect(beatAvailability(doc, "shift", "caption").enabled).toBe(true);
    expect(beatAvailability(doc, "travel", "caption").enabled).toBe(false);
    for (const verb of ["show", "draw", "erase", "scale", "to", "breathe"]) {
      expect(beatAvailability(doc, verb, "curve").enabled, verb).toBe(true);
    }
    expect(verbPropertyOptions("to", doc.entities.find((entity) => entity.id === "curve")!)).toEqual(["opacity", "scale", "trace", "morph"]);
    expect(verbPropertyOptions("to", doc.entities.find((entity) => entity.id === "a")!)).toEqual(["x", "y", "opacity", "scale", "angle", "hue"]);
    expect(verbPropertyOptions("to", doc.entities.find((entity) => entity.id === "caption")!)).toEqual(["opacity", "scale", "angle", "hue"]);
    expect(createBeatAction(doc, "to", "curve").action).toMatchObject({ target: "curve", prop: "scale", amount: 1.5 });
  });

  it("creates complete relationships and uses the document-aware move anchor", () => {
    const doc = beatDoc();
    const travel = createBeatAction(doc, "travel", "words").action!;
    expect(travel).toMatchObject({ target: "words", ref: "path" });
    expect(travel.ref).not.toBe(travel.target);
    const cycle = createBeatAction(doc, "cycle", "a").action!;
    expect(cycle.refs).toHaveLength(1);
    expect(cycle.refs).not.toContain("a");
    const move = createBeatAction(doc, "move", "words").action!;
    expect(move.point).toEqual({ x: 300, y: 120 });
  });

  it("arms reveal state required by generated show, draw, type, and word-pop beats", () => {
    const doc = beatDoc();
    const text = doc.entities.find((entity) => entity.id === "words")!;
    text.reveal = "grow";
    const show = createBeatAction(doc, "show", "words").action!;
    expect(show.ease).toBe("out");
    const type = createBeatAction(doc, "type", "words").action!;
    applyBeatOnAdd(doc, type);
    expect(text.untraced).toBe(true);
    const caption = doc.entities.find((entity) => entity.id === "caption")!;
    const pop = createBeatAction(doc, "wordpop", "caption").action!;
    applyBeatOnAdd(doc, pop);
    expect(caption.reveal).toBe("fade");
    const line = doc.entities.find((entity) => entity.id === "path")!;
    applyBeatOnAdd(doc, createBeatAction(doc, "draw", "path").action!);
    expect(line.untraced).toBe(true);
  });

  it("round-trips flash duration and easing instead of showing inert controls", () => {
    const parsed = readSceneSource('circle(a, (100,100), 20); step("flash") { flash(a, gold, 1.7, bounce); }');
    expect(parsed.skipped).toEqual([]);
    expect(parsed.doc.steps[0].actions[0]).toMatchObject({ verb: "flash", target: "a", color: "gold", dur: 1.7, ease: "bounce" });
    expect(serializeSceneFile(parsed.doc)).toContain("flash(a, gold, 1.7, bounce);");
  });

  it("can generate a complete payload for every offered Beat verb", () => {
    const doc = beatDoc();
    for (const verb of allVerbDefs().filter((candidate) => candidate.placement !== "timeline")) {
      const selected = verb.targetless ? "" : doc.entities.find((entity) => beatAvailability(doc, verb.name, entity.id).enabled)?.id ?? "";
      const availability = beatAvailability(doc, verb.name, selected);
      expect(availability.enabled, `${verb.name}: ${availability.reason}`).toBe(true);
      expect(createBeatAction(cloneDoc(doc), verb.name, selected).action, verb.name).not.toBeNull();
    }
  });

  it("patches a newly generated Beat into an existing source step", () => {
    const source = 'circle(a, (100,100), 20);\nstep("Start") { show(a, 0.5); }\n';
    const parsed = readSceneSource(source);
    const next = cloneDoc(parsed.doc);
    next.steps[0].actions.push(createBeatAction(next, "flash", "a").action!);
    const patched = patchSceneSource(source, parsed, next);
    expect(patched).toContain("show(a, 0.5);");
    expect(patched).toContain("flash(a, gold, 0.8);");
  });
});
