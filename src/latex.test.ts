// equation + rewrite: LaTeX must survive raw — every backslash intact through
// parse ⇄ serialize and surgical patching (backticks in source).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSceneBlock, patchSceneSource, readSceneSource, serializeScene } from "./codec.js";
import { canvasAnnotations, cloneDoc, createEntity } from "./model.js";
import type { EquationEntity } from "./types.js";

const LATEX = String.raw`S_{8} \;=\; \sum_{i=1}^{8} f(x_i^{*})\,\textcolor{cyan}{\Delta x}`;

describe("equation + rewrite (LaTeX)", () => {
  it("round-trips backtick LaTeX with every backslash intact", () => {
    const block = [
      "// BEGIN WORKBENCH CANVAS",
      "equation(eqR, (640, 190), `" + LATEX + "`, 40);",
      "hidden(eqR);",
      'step("refine") { rewrite(eqR, `\\int_0^{4} f\\,dx \\;=\\; \\lim_{n\\to\\infty} S_n`, 0.9); }',
      "// END WORKBENCH CANVAS",
    ].join("\n");
    const read = parseSceneBlock(block);
    expect(read.status, JSON.stringify(read)).toBe("ok");
    if (read.status !== "ok") return;
    const equation = read.doc.entities[0] as EquationEntity;
    expect(equation.latex).toBe(LATEX);
    expect(equation.size).toBe(40);
    expect(read.doc.steps[0].actions[0]).toMatchObject({ verb: "rewrite", dur: 0.9 });
    expect(read.doc.steps[0].actions[0].text).toContain(String.raw`\lim_{n\to\infty}`);
    const text = serializeScene(read.doc);
    expect(text).toContain("`" + LATEX + "`");
    const again = parseSceneBlock(text);
    expect(again.status).toBe("ok");
    if (again.status === "ok") expect(again.doc).toEqual(read.doc);
  });

  it("patches a LaTeX edit surgically into hand-written source", () => {
    const source = [
      "// a hand-written derivation",
      "equation(q, (640, 300), `x^{2}+2x+1`, 48);",
      "color(q, fg);",
      "show(q, 0.5);",
      "",
    ].join("\n");
    const scene = readSceneSource(source);
    const next = cloneDoc(scene.doc);
    (next.entities[0] as EquationEntity).latex = String.raw`(x+1)^{2}`;
    const updated = patchSceneSource(source, scene, next);
    expect(updated).toContain("equation(q, (640, 300), `(x+1)^{2}`, 48);");
    expect(updated).toContain("// a hand-written derivation");
    expect(updated).toContain("show(q, 0.5);");
    const again = readSceneSource(updated);
    expect((again.doc.entities[0] as EquationEntity).latex).toBe(String.raw`(x+1)^{2}`);
  });

  it("falls back to a quoted string only when the LaTeX contains a backtick", () => {
    const entity = createEntity("equation", "q", 100, 100) as EquationEntity;
    entity.latex = "a ` b";
    const text = serializeScene({ format: "16:9", template: "black", entities: [entity], steps: [] });
    expect(text).toContain('"a ` b"');
    const read = parseSceneBlock(text);
    expect(read.status).toBe("ok");
    if (read.status === "ok") expect((read.doc.entities[0] as EquationEntity).latex).toBe("a ` b");
  });

  it("marks an equation with its editable rewrite chain", () => {
    const source = "equation(q, (640, 300), `x^2`, 48);\nrewrite(q, `x^2+1`, 0.8);\nrewrite(q, `x^2+2`, 0.9);\n";
    const read = readSceneSource(source);
    expect(canvasAnnotations(read.doc.entities[0], read.doc)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "rewrite-chain", label: "2 authored rewrite states", representation: "semantic" }),
    ]));
  });
});

const QUADRATIC = resolve(import.meta.dirname, "../../../manic/examples/quadratic-formula-continuity.manic");

describe.skipIf(!existsSync(QUADRATIC))("quadratic-formula-continuity.manic acceptance", () => {
  it("projects every entity and beat without skips and preserves every byte", () => {
    const source = readFileSync(QUADRATIC, "utf8");
    const scene = readSceneSource(source);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.title).toBe("The Quadratic Formula by Completing the Square");
    expect(scene.doc.entities).toHaveLength(4);
    expect(scene.doc.steps).toHaveLength(23);
    expect(scene.doc.steps.flatMap((step) => step.actions).filter((action) => action.verb === "rewrite")).toHaveLength(9);
    expect(patchSceneSource(source, scene, cloneDoc(scene.doc))).toBe(source);
  });
});
