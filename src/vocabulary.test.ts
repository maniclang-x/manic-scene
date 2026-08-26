import { describe, expect, it } from "vitest";
import { createEntity, emptyDoc } from "./model.js";
import { serializeSceneFile } from "./codec.js";
import {
  allVocabularyEntries, applyVocabularyFeature, entriesForSurface, searchVocabulary, validateVocabulary,
  vocabularyAvailability,
} from "./vocabulary.js";

describe("normalized vocabulary", () => {
  it("covers the engine catalog with valid unique metadata", () => {
    const entries = allVocabularyEntries(true);
    expect(entries.length).toBeGreaterThanOrEqual(490);
    expect(validateVocabulary(entries)).toEqual([]);
    expect(new Set(entries.map((entry) => entry.name)).size).toBe(entries.length);
  });

  it("projects registered entities and verbs into their authoring surfaces", () => {
    const add = entriesForSurface("add");
    const animate = entriesForSurface("animate");
    expect(add.find((entry) => entry.name === "text")).toMatchObject({ kind: "entity", fidelity: "exact" });
    expect(animate.find((entry) => entry.name === "fade")).toMatchObject({ kind: "verb", fidelity: "semantic" });
    expect(entriesForSurface("feature").map((entry) => entry.name)).toContain("gradient");
  });

  it("ranks native names and task-language aliases", () => {
    const entries = allVocabularyEntries();
    expect(searchVocabulary(entries, "gradient")[0]?.name).toBe("gradient");
    expect(searchVocabulary(entries, "connect two things")[0]?.name).toBe("link");
    expect(searchVocabulary(entries, "readable background")[0]?.name).toBe("plate");
  });

  it("keeps source-only vocabulary discoverable but not falsely actionable", () => {
    const sourceOnly = allVocabularyEntries().find((entry) => entry.fidelity === "source-only");
    expect(sourceOnly).toBeDefined();
    expect(vocabularyAvailability(sourceOnly!, emptyDoc())).toMatchObject({ enabled: false, recovery: { action: "source" } });
  });

  it("filters feature availability from scene context", () => {
    const gradient = allVocabularyEntries().find((entry) => entry.name === "gradient")!;
    const doc = emptyDoc();
    expect(vocabularyAvailability(gradient, doc)).toMatchObject({ enabled: false });
  });

  it("applies native-valid feature defaults that serialize immediately", () => {
    const doc = emptyDoc();
    const circle = createEntity("circle", "shape", 320, 240, doc);
    doc.entities.push(circle);
    expect(applyVocabularyFeature(circle, "gradient", doc)).toBe(true);
    expect(serializeSceneFile(doc)).toContain("gradient(shape, cyan, magenta, 90);");

    const text = createEntity("text", "title", 320, 80, doc);
    doc.entities.push(text);
    expect(applyVocabularyFeature(text, "plate", doc)).toBe(true);
    expect(serializeSceneFile(doc)).toContain("plate(title, 0.55);");
  });

  it("searches a synthetic 1,000-entry catalog without changing the API", () => {
    const seed = allVocabularyEntries()[0];
    const entries = Array.from({ length: 1_000 }, (_, index) => ({ ...seed, name: `synthetic_${index}`, label: `Synthetic ${index}`, summary: `Generated item ${index}` }));
    expect(searchVocabulary(entries, "synthetic 777")[0]?.name).toBe("synthetic_777");
  });
});
