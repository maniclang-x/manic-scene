import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { patchConditionalCondition, patchSceneSource, readSceneSource } from "./codec.js";
import { cloneDoc } from "./model.js";

const RESPONSIVE = `canvas(1280, 720);
template("black");

if h > 1.45*w {
  text(portrait, (cx, cy), "Portrait");
}
else if w > 1.25*h {
  text(landscape, (cx, cy), "Landscape");
  step("Reveal") { if w > h { show(landscape, 0.5); } }
}
else {
  text(square, (cx, cy), "Square");
}
`;

describe("conditional canvas semantics", () => {
  it("keeps every branch visible in metadata while projecting only the selected branch", () => {
    const scene = readSceneSource(RESPONSIVE);
    expect(scene.doc.entities.map((entity) => entity.id)).toEqual(["landscape"]);
    expect(scene.meta.conditionals).toHaveLength(2);
    const outer = scene.meta.conditionals[0];
    expect(outer).toMatchObject({ evaluations: 1, unresolved: 0 });
    expect(outer.branches.map((branch) => ({ condition: branch.condition, selected: branch.selected, statements: branch.statementCount }))).toEqual([
      { condition: "h > 1.45*w", selected: 0, statements: 1 },
      { condition: "w > 1.25*h", selected: 1, statements: 2 },
      { condition: null, selected: 0, statements: 1 },
    ]);
    expect(outer.branches[1].entityIds).toContain("landscape");
    expect(outer.branches[1].stepIndexes).toContain(0);
    expect(scene.meta.conditionals[1].branches[0].stepIndexes).toContain(0);
    expect(patchSceneSource(RESPONSIVE, scene, cloneDoc(scene.doc))).toBe(RESPONSIVE);
  });

  it("re-evaluates responsive branches when the real canvas format changes", () => {
    const scene = readSceneSource(RESPONSIVE);
    const next = cloneDoc(scene.doc);
    next.format = "portrait";
    delete next.size;
    const updated = patchSceneSource(RESPONSIVE, scene, next);
    const again = readSceneSource(updated);
    expect(updated).toContain("canvas(720, 1280);");
    expect(again.doc.entities.map((entity) => entity.id)).toEqual(["portrait"]);
    expect(again.meta.conditionals[0].branches[0].selected).toBe(1);
  });

  it("surgically edits a condition and rejects malformed expressions", () => {
    const scene = readSceneSource(RESPONSIVE);
    const updated = patchConditionalCondition(RESPONSIVE, scene, scene.meta.conditionals[0].id, 0, "h > w");
    expect(updated).toContain("if h > w {");
    expect(updated).toContain("else if w > 1.25*h {");
    expect(updated).toContain('text(portrait, (cx, cy), "Portrait");');
    expect(() => patchConditionalCondition(RESPONSIVE, scene, scene.meta.conditionals[0].id, 0, "h >"))
      .toThrow();
  });

  it("reports repeated loop selections as counts rather than one fake active branch", () => {
    const source = `canvas(800, 800);\nfor i in 0..5 { if i != 0 { dot(d{i}, (i*20, 40)); } else { dot(zero, (0, 40)); } }\n`;
    const scene = readSceneSource(source);
    const conditional = scene.meta.conditionals[0];
    expect(conditional.evaluations).toBe(5);
    expect(conditional.branches.map((branch) => branch.selected)).toEqual([4, 1]);
    expect(conditional.branches[0].entityIds).toHaveLength(4);
    expect(conditional.branches[1].entityIds).toEqual(["zero"]);
  });
});

const EXAMPLES = resolve(import.meta.dirname, "../../manic/examples");

describe.skipIf(!existsSync(EXAMPLES))("conditional acceptance examples", () => {
  it("identity-projects responsive, loop-local, and conditional-modifier scenes", () => {
    for (const file of ["parameter-journeys.manic", "reactive-multiformat.manic", "derivative-of-ln-x.manic", "pascal-triangle.manic"]) {
      const source = readFileSync(resolve(EXAMPLES, file), "utf8");
      const scene = readSceneSource(source);
      expect(scene.meta.conditionals.length, file).toBeGreaterThan(0);
      expect(scene.meta.conditionals.some((conditional) => conditional.evaluations > 0), file).toBe(true);
      expect(patchSceneSource(source, scene, cloneDoc(scene.doc)), file).toBe(source);
    }
  });

  it("selects all three real parameter-journey layout branches through canvas formats", () => {
    const source = readFileSync(resolve(EXAMPLES, "parameter-journeys.manic"), "utf8");
    const selected: number[] = [];
    for (const format of ["portrait", "16:9", "square"] as const) {
      const scene = readSceneSource(source);
      const next = cloneDoc(scene.doc);
      next.format = format;
      delete next.size;
      const again = readSceneSource(patchSceneSource(source, scene, next));
      selected.push(again.meta.conditionals[0].branches.findIndex((branch) => branch.selected === 1));
    }
    expect(selected).toEqual([0, 1, 2]);
  });
});
