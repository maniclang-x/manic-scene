import { describe, expect, it } from "vitest";
import { compileScene } from "./timeline.js";
import { createAction, createEntity, emptyDoc, type SceneDoc } from "./model.js";

function docWith(partial: Partial<SceneDoc>): SceneDoc {
  return { ...emptyDoc(), ...partial };
}

describe("timeline", () => {
  it("computes durations for together, sequence, and stagger", () => {
    const a = createEntity("circle", "a", 100, 100);
    const b = createEntity("circle", "b", 200, 100);
    const show = (target: string, dur: number) => ({ ...createAction("show", target), dur });
    const together = compileScene(docWith({ entities: [a, b], steps: [{ name: "s", mode: "together", gap: 0.1, actions: [show("a", 1), show("b", 2)] }] }));
    expect(together.duration).toBe(2);
    const sequence = compileScene(docWith({ entities: [a, b], steps: [{ name: "s", mode: "sequence", gap: 0.1, actions: [show("a", 1), show("b", 2)] }] }));
    expect(sequence.duration).toBe(3);
    const stagger = compileScene(docWith({ entities: [a, b], steps: [{ name: "s", mode: "stagger", gap: 0.5, actions: [show("a", 1), show("b", 2)] }] }));
    expect(stagger.duration).toBe(2.5);
  });

  it("fades a hidden entity in through show", () => {
    const a = { ...createEntity("text", "a", 100, 100), reveal: "fade" as const };
    const compiled = compileScene(docWith({ entities: [a], steps: [{ name: "s", mode: "together", gap: 0.1, actions: [{ ...createAction("show", "a"), dur: 1, ease: "linear" }] }] }));
    expect(compiled.sample(0).get("a")!.opacity).toBe(0);
    expect(compiled.sample(0.5).get("a")!.opacity).toBeCloseTo(0.5, 5);
    expect(compiled.sample(1).get("a")!.opacity).toBe(1);
  });

  it("moves and then shifts from the moved position", () => {
    const a = createEntity("dot", "a", 100, 100);
    const move = { ...createAction("move", "a"), point: { x: 300, y: 100 }, dur: 1, ease: "linear" as const };
    const shift = { ...createAction("shift", "a"), point: { x: 50, y: 0 }, dur: 1, ease: "linear" as const };
    const compiled = compileScene(docWith({
      entities: [a],
      steps: [
        { name: "one", mode: "together", gap: 0.1, actions: [move] },
        { name: "two", mode: "together", gap: 0.1, actions: [shift] },
      ],
    }));
    expect(compiled.sample(1).get("a")!.x).toBe(300);
    expect(compiled.sample(2).get("a")!.x).toBe(350);
    expect(compiled.steps.map((step) => step.name)).toEqual(["one", "two"]);
  });

  it("traces untraced strokes with draw and settles pulse back to base", () => {
    const line = { ...createEntity("line", "l", 100, 100), untraced: true };
    const compiled = compileScene(docWith({
      entities: [line],
      steps: [
        { name: "draw", mode: "together", gap: 0.1, actions: [{ ...createAction("draw", "l"), dur: 1 }] },
        { name: "pulse", mode: "together", gap: 0.1, actions: [{ ...createAction("pulse", "l"), dur: 1 }] },
      ],
    }));
    expect(compiled.sample(0).get("l")!.draw).toBe(0);
    expect(compiled.sample(1).get("l")!.draw).toBe(1);
    expect(compiled.sample(1.5).get("l")!.scale).toBeGreaterThan(1);
    expect(compiled.sample(2).get("l")!.scale).toBeCloseTo(1, 5);
  });

  it("keeps a never-shown hidden entity invisible", () => {
    const a = { ...createEntity("text", "a", 100, 100), reveal: "fade" as const };
    const compiled = compileScene(docWith({ entities: [a], steps: [] }));
    expect(compiled.duration).toBe(0);
    expect(compiled.sample(0).get("a")!.opacity).toBe(0);
  });
});
