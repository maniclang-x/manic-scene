// Hex color literals — every form the engine accepts (#rgb/#rgba/#rrggbb/
// #rrggbbaa) must survive parse ⇄ serialize and surgical patching exactly.

import { describe, expect, it } from "vitest";
import { parseSceneBlock, patchSceneSource, readSceneSource, serializeScene } from "./codec.js";
import { cloneDoc } from "./model.js";
import { resolveColor } from "./palette.js";

describe("hex colors", () => {
  it("round-trips every hex form through the block codec", () => {
    const block = [
      "// BEGIN WORKBENCH CANVAS",
      "circle(a, (100, 100), 40);",
      "color(a, #ff2d95);",
      "outline(a, #0f8);",
      "rect(b, (300, 100), 80, 60);",
      "color(b, #ff2d95aa);",
      'step("in") { flash(a, #abc4, 0.6); }',
      "// END WORKBENCH CANVAS",
    ].join("\n");
    const read = parseSceneBlock(block);
    expect(read.status, JSON.stringify(read)).toBe("ok");
    if (read.status !== "ok") return;
    expect(read.doc.entities[0]).toMatchObject({ color: "#ff2d95", outlineColor: "#0f8" });
    expect(read.doc.entities[1].color).toBe("#ff2d95aa");
    expect(read.doc.steps[0].actions[0].color).toBe("#abc4");
    const again = parseSceneBlock(serializeScene(read.doc));
    expect(again.status).toBe("ok");
    if (again.status === "ok") expect(again.doc).toEqual(read.doc);
  });

  it("patches a color change to hex surgically", () => {
    const source = 'circle(a, (100, 100), 40);\ncolor(a, cyan);\nshow(a, 0.5);\n';
    const scene = readSceneSource(source);
    const next = cloneDoc(scene.doc);
    next.entities[0].color = "#ff2d95";
    const updated = patchSceneSource(source, scene, next);
    expect(updated).toContain("color(a, #ff2d95);");
    expect(updated).toContain("show(a, 0.5);");
    expect(readSceneSource(updated).doc.entities[0].color).toBe("#ff2d95");
  });

  it("resolveColor passes hex through untouched on every template", () => {
    expect(resolveColor("black", "#ff2d95")).toBe("#ff2d95");
    expect(resolveColor("paper", "#0f8")).toBe("#0f8");
    expect(resolveColor("blueprint", "#ff2d95aa")).toBe("#ff2d95aa");
  });
});
