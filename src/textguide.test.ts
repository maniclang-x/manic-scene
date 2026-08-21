// The text-guide.manic vocabulary: text behaviour modifiers, caption,
// karaoke/wordpop, hue, and `to` — parsed, serialized, and timed correctly.

import { describe, expect, it } from "vitest";
import { parseSceneBlock, serializeScene } from "./codec.js";
import { compileScene } from "./timeline.js";
import { createAction, createEntity } from "./model.js";
import type { CaptionEntity, SceneDoc, TextEntity } from "./types.js";

describe("text-guide vocabulary", () => {
  it("parses the text behaviour modifiers and round-trips them", () => {
    const block = [
      "// BEGIN WORKBENCH CANVAS",
      'text(al, (640, 270), "align(id, left)\\nboth lines start here");',
      "size(al, 21);",
      "color(al, cyan);",
      "align(al, left);",
      "leading(al, 2.2);",
      "wrap(al, 300);",
      "bold(al);",
      "display(al);",
      "vertical(al);",
      "hue(al, 200);",
      "hidden(al);",
      "// END WORKBENCH CANVAS",
    ].join("\n");
    const read = parseSceneBlock(block);
    expect(read.status).toBe("ok");
    if (read.status !== "ok") return;
    const entity = read.doc.entities[0] as TextEntity;
    expect(entity).toMatchObject({
      kind: "text", align: "left", leading: 2.2, wrap: 300,
      bold: true, display: true, vertical: true,
      hue: { deg: 200, s: null, l: null }, reveal: "fade",
    });
    expect(entity.text).toContain("\n");
    const again = parseSceneBlock(serializeScene(read.doc));
    expect(again.status).toBe("ok");
    if (again.status === "ok") expect(again.doc).toEqual(read.doc);
  });

  it("parses caption + karaoke + wordpop + to(hue) like text-guide.manic", () => {
    const block = [
      "// BEGIN WORKBENCH CANVAS",
      'caption(perword, "one entity per word so each can be timed", (640, 440), 22, gold);',
      "hidden(perword);",
      'text(h1, (330, 300), "hue(h1, 200)");',
      "hue(h1, 200, 0.9, 0.55);",
      "show(perword, 0.4);",
      "karaoke(perword, 3.2);",
      "wordpop(perword, 0.12);",
      "to(h1, hue, 320, 2.4);",
      "// END WORKBENCH CANVAS",
    ].join("\n");
    const read = parseSceneBlock(block);
    expect(read.status, JSON.stringify(read)).toBe("ok");
    if (read.status !== "ok") return;
    const caption = read.doc.entities[0] as CaptionEntity;
    expect(caption).toMatchObject({ kind: "caption", size: 22, color: "gold", reveal: "fade" });
    expect(read.doc.steps.map((step) => step.actions[0].verb)).toEqual(["show", "karaoke", "wordpop", "to"]);
    expect(read.doc.steps[1].actions[0].dur).toBe(3.2);
    expect(read.doc.steps[3].actions[0]).toMatchObject({ prop: "hue", amount: 320, dur: 2.4 });
    const again = parseSceneBlock(serializeScene(read.doc));
    expect(again.status).toBe("ok");
    if (again.status === "ok") expect(again.doc).toEqual(read.doc);
  });

  it("derives karaoke/wordpop beat length from the word count", () => {
    const caption = createEntity("caption", "cap", 640, 400) as CaptionEntity;
    caption.text = "three little words";
    const doc: SceneDoc = {
      format: "16:9", template: "black", entities: [caption],
      steps: [{ name: "s", mode: "sequence", gap: 0.1, actions: [
        { ...createAction("karaoke", "cap"), dur: 0.5, color: "gold" },
        { ...createAction("wordpop", "cap"), dur: 0.2 },
      ] }],
    };
    const compiled = compileScene(doc);
    // karaoke: (3-1)*0.5 + 0.25 = 1.25 · wordpop: (3-1)*0.2 + 0.16 = 0.56
    expect(compiled.duration).toBeCloseTo(1.25 + 0.56, 5);
    const during = compiled.sample(0.8).get("cap")!;
    expect(during.words).not.toBeNull();
    expect(during.words!.highlightUpTo).toBe(1);
    const after = compiled.sample(compiled.duration).get("cap")!;
    expect(after.words!.highlightUpTo).toBe(2);
    expect(after.words!.pop?.every((p) => p === 1)).toBe(true);
  });

  it("animates hue through to(id, hue, …) as an aux channel", () => {
    const label = createEntity("text", "hued", 640, 660) as TextEntity;
    label.hue = { deg: 200, s: 0.95, l: 0.62 };
    const doc: SceneDoc = {
      format: "16:9", template: "black", entities: [label],
      steps: [{ name: "s", mode: "together", gap: 0.1, actions: [
        { ...createAction("to", "hued"), prop: "hue", amount: 320, dur: 2, ease: "linear" },
      ] }],
    };
    const compiled = compileScene(doc);
    expect(compiled.sample(0).get("hued")!.aux.hue).toBe(200);
    expect(compiled.sample(1).get("hued")!.aux.hue).toBeCloseTo(260, 5);
    expect(compiled.sample(2).get("hued")!.aux.hue).toBe(320);
  });

  it("accepts engine easing aliases", () => {
    const read = parseSceneBlock([
      "// BEGIN WORKBENCH CANVAS",
      "circle(a, (100, 100), 40);",
      "step(\"in\") { show(a, 0.5, back); shift(a, (10, 0), 0.4, inout); }",
      "// END WORKBENCH CANVAS",
    ].join("\n"));
    expect(read.status).toBe("ok");
    if (read.status !== "ok") return;
    expect(read.doc.steps[0].actions.map((action) => action.ease)).toEqual(["overshoot", "smooth"]);
  });
});
