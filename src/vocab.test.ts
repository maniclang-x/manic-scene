// The hardening batch: z/glow/sticky/dashed modifiers, say/recolor/section/cue
// verbs, polygon/counter entities, nested block flattening, child targets.

import { describe, expect, it } from "vitest";
import { parseSceneBlock, readSceneSource, serializeScene } from "./codec.js";
import type { CounterEntity, PolygonEntity } from "./types.js";

describe("hardening vocabulary", () => {
  it("round-trips z / glow / sticky / dashed", () => {
    const block = [
      "// BEGIN WORKBENCH CANVAS",
      "circle(a, (100, 100), 40);",
      "color(a, cyan);",
      "z(a, 5);",
      "glow(a, 2);",
      "sticky(a);",
      "dashed(a, 12, 6);",
      "line(b, (0, 0), (50, 50));",
      "color(b, dim);",
      "dashed(b);",
      "// END WORKBENCH CANVAS",
    ].join("\n");
    const read = parseSceneBlock(block);
    expect(read.status, JSON.stringify(read)).toBe("ok");
    if (read.status !== "ok") return;
    expect(read.doc.entities[0]).toMatchObject({ z: 5, glow: 2, sticky: true, dashed: { dash: 12, gap: 6 } });
    expect(read.doc.entities[1].dashed).toEqual({ dash: null, gap: null });
    const again = parseSceneBlock(serializeScene(read.doc));
    expect(again.status).toBe("ok");
    if (again.status === "ok") expect(again.doc).toEqual(read.doc);
  });

  it("round-trips polygon and counter", () => {
    const block = [
      "// BEGIN WORKBENCH CANVAS",
      "polygon(tri, (100, 20), (40, 120), (160, 120));",
      "outlined(tri);",
      "color(tri, gold);",
      'counter(total, (300, 100), 42, 1, "area = ", " px");',
      "color(total, fg);",
      "// END WORKBENCH CANVAS",
    ].join("\n");
    const read = parseSceneBlock(block);
    expect(read.status, JSON.stringify(read)).toBe("ok");
    if (read.status !== "ok") return;
    const polygon = read.doc.entities[0] as PolygonEntity;
    expect(polygon.points).toHaveLength(3);
    expect(polygon.paint).toBe("outlined");
    const counter = read.doc.entities[1] as CounterEntity;
    expect(counter).toMatchObject({ value: 42, decimals: 1, prefix: "area = ", suffix: " px" });
    const again = parseSceneBlock(serializeScene(read.doc));
    expect(again.status).toBe("ok");
    if (again.status === "ok") expect(again.doc).toEqual(read.doc);
  });

  it("round-trips say / recolor / section / cue", () => {
    const block = [
      "// BEGIN WORKBENCH CANVAS",
      'text(cap, (640, 660), "");',
      "size(cap, 26);",
      "color(cap, dim);",
      'step("beats") {',
      '  say(cap, "a coordinate frame on the void", 0.4);',
      "  recolor(cap, gold, 0.6);",
      "  cue(pop);",
      "}",
      'section("Vectors");',
      "// END WORKBENCH CANVAS",
    ].join("\n");
    const read = parseSceneBlock(block);
    expect(read.status, JSON.stringify(read)).toBe("ok");
    if (read.status !== "ok") return;
    const [say, recolor, cue] = read.doc.steps[0].actions;
    expect(say).toMatchObject({ verb: "say", text: "a coordinate frame on the void", dur: 0.4 });
    expect(recolor).toMatchObject({ verb: "recolor", color: "gold" });
    expect(cue).toMatchObject({ verb: "cue", prop: "pop" });
    expect(read.doc.steps[1].actions[0]).toMatchObject({ verb: "section", text: "Vectors" });
    const again = parseSceneBlock(serializeScene(read.doc));
    expect(again.status).toBe("ok");
    if (again.status === "ok") expect(again.doc).toEqual(read.doc);
  });

  it("flattens nested par/seq inside a step into a locked step", () => {
    const source = [
      "circle(a, (100, 100), 40);",
      "color(a, cyan);",
      "par {",
      "  show(a, 0.5);",
      "  seq { pulse(a, 0.8); fade(a, 0.4); }",
      "}",
      "",
    ].join("\n");
    const scene = readSceneSource(source);
    expect(scene.skipped).toHaveLength(0);
    expect(scene.doc.steps).toHaveLength(1);
    expect(scene.doc.steps[0].actions.map((action) => action.verb)).toEqual(["show", "pulse", "fade"]);
    expect(scene.doc.steps[0].origin).toBe("computed"); // locked: nested timing can't be re-serialized
  });

  it("accepts child part targets when the parent exists", () => {
    const source = [
      'caption(cap, "one two three", (640, 400), 24, gold);',
      "show(cap.w0, 0.3);",
      "",
    ].join("\n");
    const scene = readSceneSource(source);
    expect(scene.skipped).toHaveLength(0);
  });
});
