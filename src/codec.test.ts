import { describe, expect, it } from "vitest";
import { applySceneToSource, extractSceneBlock, parseSceneBlock, readScene, serializeScene } from "./codec.js";
import { STARTERS } from "./starters.js";
import { emptyDoc } from "./model.js";

describe("scene codec", () => {
  it("round-trips every starter exactly", () => {
    for (const starter of STARTERS) {
      const text = serializeScene(starter.doc);
      const read = parseSceneBlock(text);
      expect(read.status, `${starter.id}: ${JSON.stringify(read)}`).toBe("ok");
      if (read.status === "ok") expect(read.doc).toEqual(starter.doc);
    }
  });

  it("round-trips again after a second serialize", () => {
    const doc = STARTERS[1].doc;
    const once = serializeScene(doc);
    const read = parseSceneBlock(once);
    expect(read.status).toBe("ok");
    if (read.status !== "ok") return;
    expect(serializeScene(read.doc)).toBe(once);
  });

  it("appends a block to fresh source and replaces it in place", () => {
    const doc = STARTERS[0].doc;
    const first = applySceneToSource("", doc);
    expect(extractSceneBlock(first)).not.toBeNull();
    const withHeader = `title("My story");\n\n${first}`;
    const changed = structuredClone(doc);
    changed.entities[0].x = 500;
    const next = applySceneToSource(withHeader, changed);
    expect(next.startsWith('title("My story");')).toBe(true);
    expect(next.match(/BEGIN WORKBENCH CANVAS/gu)).toHaveLength(1);
    const read = readScene(next);
    expect(read.status).toBe("ok");
    if (read.status === "ok") expect(read.doc.entities[0]).toMatchObject({ x: 500 });
  });

  it("respects canvas/template declared outside the block", () => {
    const doc = structuredClone(STARTERS[0].doc);
    doc.format = "portrait";
    const source = applySceneToSource('canvas("portrait");\ntemplate("paper");\n', doc);
    expect(source.split("canvas(").length - 1).toBe(1);
    expect(source.split("template(").length - 1).toBe(1);
    const read = readScene(source);
    expect(read.status).toBe("ok");
    if (read.status === "ok") {
      expect(read.doc.format).toBe("portrait");
      expect(read.doc.template).toBe("paper");
    }
  });

  it("reports unsupported vocabulary instead of destroying it", () => {
    const block = [
      "// BEGIN WORKBENCH CANVAS",
      "nebula(field, 600) { let x = i; let y = i; }",
      "circle(a, (100, 100), 40);",
      "color(a, cyan);",
      "// END WORKBENCH CANVAS",
    ].join("\n");
    const read = parseSceneBlock(block);
    expect(read.status).toBe("unsupported");
    if (read.status === "unsupported") expect(read.reasons.join(" ")).toContain("nebula");
  });

  it("reads hand-written steps, bare blocks, and top-level verbs", () => {
    const block = [
      "// BEGIN WORKBENCH CANVAS",
      "circle(a, (100, 100), 40);",
      "color(a, cyan);",
      "hidden(a, center);",
      'step("in") { stagger(0.2) { show(a, 0.5, overshoot); } }',
      "par { pulse(a, 0.8); }",
      "shift(a, (20, -30), 0.4);",
      "wait(0.5);",
      "// END WORKBENCH CANVAS",
    ].join("\n");
    const read = parseSceneBlock(block);
    expect(read.status).toBe("ok");
    if (read.status !== "ok") return;
    expect(read.doc.entities[0]).toMatchObject({ kind: "circle", reveal: "grow" });
    expect(read.doc.steps).toHaveLength(4);
    expect(read.doc.steps[0]).toMatchObject({ name: "in", mode: "stagger", gap: 0.2 });
    expect(read.doc.steps[0].actions[0]).toMatchObject({ verb: "show", ease: "overshoot" });
    expect(read.doc.steps[2].actions[0]).toMatchObject({ verb: "shift", point: { x: 20, y: -30 } });
    expect(read.doc.steps[3].actions[0]).toMatchObject({ verb: "wait", dur: 0.5 });
  });

  it("returns none when there is no scene block", () => {
    expect(readScene('title("plain file");\ncircle(a, (1, 2), 3);\n')).toEqual({ status: "none" });
  });

  it("serializes an empty scene without steps", () => {
    const text = serializeScene(emptyDoc());
    expect(text).toContain("canvas(1280, 720);");
    expect(text).not.toContain("step(");
  });
});
