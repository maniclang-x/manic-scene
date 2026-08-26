import { describe, expect, it } from "vitest";
import {
  allEntityDefs, allVerbDefs, beatAvailability, canvasAnnotations, createBeatAction, createEntity,
  emptyDoc, entityBounds, geometryContext, readSceneSource, referenceIds, serializeSceneFile, verbDef,
  type ArrayEntity, type ListEntity, type PointerEntity, type SceneAction,
} from "./index.js";

const source = `
array(a, "5 2 8 1", (300, 180), 74, 68);
pointer(i, a, 1, "i");
caret(top, (560, 210), "top", left);
stack(st, (560, 420), 84, 64);
queue(qu, (760, 420), 84, 64);
list(xs, "3 8 5", (600, 590), doubly, 74, 56);
step("Algorithms") {
  seq {
    compare(a, 0, 2, lime);
    pointat(i, a, 3, 0.7);
    push(st, "5", 0.5);
    pop(st, 0.45);
    enqueue(qu, "A", 0.5);
    dequeue(qu, 0.5);
    insert(xs, 1, "7", 0.6);
    remove(xs, 0, 0.55);
  }
}
`;

describe("Algo structures onboarding", () => {
  it("registers the complete 14-builtin batch", () => {
    const entities = new Set(allEntityDefs().map((def) => def.ctor));
    const verbs = new Set(allVerbDefs().map((def) => def.name));
    for (const name of ["array", "pointer", "caret", "stack", "queue", "list"]) expect(entities.has(name), name).toBe(true);
    for (const name of ["compare", "pointat", "push", "pop", "enqueue", "dequeue", "insert", "remove"]) expect(verbs.has(name), name).toBe(true);
  });

  it("parses every constructor and operation without Source-only fallback", () => {
    const parsed = readSceneSource(source);
    expect(parsed.skipped).toEqual([]);
    expect(parsed.doc.entities.map((entity) => entity.kind)).toEqual(["array", "pointer", "caret", "stack", "queue", "list"]);
    expect(parsed.doc.steps[0].actions.map((action) => action.verb)).toEqual(["compare", "pointat", "push", "pop", "enqueue", "dequeue", "insert", "remove"]);
    expect(parsed.doc.steps[0].actions[0]).toMatchObject({ values: [0, 2], color: "lime", dur: 1 });
    expect(parsed.doc.steps[0].actions[1]).toMatchObject({ ref: "a", amount: 3, dur: .7 });
  });

  it("serializes editable payloads as valid native calls", () => {
    const text = serializeSceneFile(readSceneSource(source).doc);
    expect(text).toContain('array(a, "5 2 8 1", (300, 180), 74, 68);');
    expect(text).toContain('pointer(i, a, 1, "i");');
    expect(text).toContain('caret(top, (560, 210), "top", left);');
    expect(text).toContain("compare(a, 0, 2, lime);");
    expect(text).toContain("pointat(i, a, 3, 0.7);");
    expect(text).toContain('insert(xs, 1, "7", 0.6);');
    expect(text).toContain("remove(xs, 0, 0.55);");
  });

  it("exposes stable initial children and dependency-aware bounds", () => {
    const doc = readSceneSource(source).doc;
    const array = doc.entities.find((entity): entity is ArrayEntity => entity.kind === "array")!;
    const pointer = doc.entities.find((entity): entity is PointerEntity => entity.kind === "pointer")!;
    const list = doc.entities.find((entity): entity is ListEntity => entity.kind === "list")!;
    expect(referenceIds(array)).toEqual(expect.arrayContaining(["a.box0", "a.box3", "a.c0", "a.c3", "a.boxes", "a.cells"]));
    expect(referenceIds(pointer)).toContain("i.label");
    expect(referenceIds(list)).toEqual(expect.arrayContaining(["xs.node0", "xs.node0.v", "xs.node0.pp", "xs.node0.pn", "xs.ar0", "xs.head", "xs.null", "xs.nullL"]));
    const slot = geometryContext(doc).bounds("a.box1")!;
    const pointerBox = entityBounds(pointer, doc);
    expect(pointerBox.x + pointerBox.width / 2).toBeCloseTo(slot.x + slot.width / 2);
    expect(pointerBox.y).toBeGreaterThan(slot.y + slot.height);
  });

  it("generates complete Story relationships and bounded static indexes", () => {
    const doc = readSceneSource(source).doc;
    expect(createBeatAction(doc, "pointat", "i").action).toMatchObject({ target: "i", ref: "a", amount: 0 });
    expect(beatAvailability(doc, "compare", "a").enabled).toBe(true);
    expect(beatAvailability(doc, "compare", "i").enabled).toBe(false);
    const compare = verbDef("compare")!, action = compare.create("a");
    const max = compare.ui.numbers?.[0].max;
    expect(typeof max === "function" ? max(doc.entities.find((entity) => entity.id === "a")!, doc, action) : max).toBe(3);
    const pointat = verbDef("pointat")!, pointAction = { ...pointat.create("i"), ref: "a" } as SceneAction;
    const slotMax = pointat.ui.amount?.max;
    expect(typeof slotMax === "function" ? slotMax(doc.entities.find((entity) => entity.id === "i")!, doc, pointAction) : slotMax).toBe(3);

    const one = readSceneSource('array(one, "x", (200,200));').doc;
    expect(createBeatAction(one, "compare", "one").action?.values).toEqual([0, 0]);
  });

  it("blocks empty-container removals when Canvas creates a new beat", () => {
    const doc = emptyDoc(), stack = createEntity("stack", "st", 300, 300, doc), queue = createEntity("queue", "qu", 500, 300, doc);
    doc.entities.push(stack, queue); doc.steps.push({ name: "Start", mode: "sequence", gap: .15, actions: [] });
    expect(beatAvailability(doc, "pop", "st")).toMatchObject({ enabled: false });
    expect(beatAvailability(doc, "dequeue", "qu")).toMatchObject({ enabled: false });
    doc.steps[0].actions.push(createBeatAction(doc, "push", "st").action!, createBeatAction(doc, "enqueue", "qu").action!);
    expect(beatAvailability(doc, "pop", "st").enabled).toBe(true);
    expect(beatAvailability(doc, "dequeue", "qu").enabled).toBe(true);
  });

  it("reports runtime occupancy and list-index mistakes honestly", () => {
    const parsed = readSceneSource(`stack(st, (300,300)); list(xs, "1", (500,300), singly); step("bad") { pop(st); remove(xs, 2); }`);
    const stack = parsed.doc.entities.find((entity) => entity.kind === "stack")!, list = parsed.doc.entities.find((entity) => entity.kind === "list")!;
    expect(canvasAnnotations(stack, parsed.doc).find((note) => note.id === "algo-stack")).toMatchObject({ tone: "warning", representation: "semantic" });
    expect(canvasAnnotations(list, parsed.doc).find((note) => note.id === "algo-list")).toMatchObject({ tone: "warning", representation: "semantic" });
  });
});
