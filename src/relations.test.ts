// Relational entities — the generic contract:
//   1. Creation attaches to the CURRENT SELECTION (else the newest candidate),
//      never silently the first entity in the file.
//   2. The user can re-point any reference afterwards; replaceReference
//      cascades (label re-attach renames the child id).

import { describe, expect, it } from "vitest";
import { createEntity, replaceEntityReference } from "./model.js";
import { readSceneSource } from "./codec.js";
import type { FrameboxEntity, LabelEntity, LinkEntity, SceneDoc } from "./types.js";

const TWO_TEXTS = [
  'text(first, (300, 300), "one");',
  "size(first, 28);",
  'text(second, (700, 300), "two");',
  "size(second, 28);",
  "",
].join("\n");

function docWithTwoTexts(): SceneDoc {
  return readSceneSource(TWO_TEXTS).doc;
}

describe("relational creation follows selection", () => {
  it("framebox frames the SELECTED entity, not the first", () => {
    const doc = docWithTwoTexts();
    const framed = createEntity("framebox", "box", 0, 0, doc, "second") as FrameboxEntity;
    expect(framed.target).toBe("second");
  });

  it("framebox falls back to the newest entity when nothing is selected", () => {
    const doc = docWithTwoTexts();
    const framed = createEntity("framebox", "box", 0, 0, doc, undefined) as FrameboxEntity;
    expect(framed.target).toBe("second"); // newest, not first
  });

  it("label pins to the selection and takes its child id", () => {
    const doc = docWithTwoTexts();
    const label = createEntity("label", "ignored", 0, 0, doc, "second") as LabelEntity;
    expect(label.target).toBe("second");
    expect(label.id).toBe("second.label");
  });

  it("link runs from the selection to the nearest other entity", () => {
    const doc = docWithTwoTexts();
    const link = createEntity("link", "wire", 0, 0, doc, "first") as LinkEntity;
    expect(link.from).toBe("first");
    expect(link.to).toBe("second");
    const reversed = createEntity("link", "wire2", 0, 0, doc, "second") as LinkEntity;
    expect(reversed.from).toBe("second");
    expect(reversed.to).toBe("first");
  });
});

describe("re-pointing a reference (the user stays in control)", () => {
  it("framebox re-points via replaceReference", () => {
    const doc = docWithTwoTexts();
    const framed = createEntity("framebox", "box", 0, 0, doc, "first") as FrameboxEntity;
    expect(framed.target).toBe("first");
    replaceEntityReference(framed, "first", "second");
    expect(framed.target).toBe("second");
  });

  it("label re-attach renames the child id so the engine addressing stays valid", () => {
    const doc = docWithTwoTexts();
    const label = createEntity("label", "ignored", 0, 0, doc, "first") as LabelEntity;
    expect(label.id).toBe("first.label");
    replaceEntityReference(label, "first", "second");
    expect(label.target).toBe("second");
    expect(label.id).toBe("second.label");
  });
});
