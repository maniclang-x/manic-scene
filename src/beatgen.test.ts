// Beat generation — the "+ Beat" contract:
//   every registered verb, created through the same path the Story panel uses,
//   must produce a complete payload that round-trips and (when the engine is
//   built next door) validates with `manic check`.

import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { patchSceneSource, readSceneSource, serializeSceneFile } from "./codec.js";
import {
  applyBeatOnAdd, beatAvailability, cloneDoc, createBeatAction, createEntity,
} from "./model.js";
import { allVerbDefs } from "./registry.js";
import type { SceneDoc, SceneEntity } from "./types.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";

/** A rich scene offering a compatible target for every verb family. */
function richDoc(): SceneDoc {
  const doc: SceneDoc = { format: "16:9", template: "black", entities: [], steps: [] };
  const add = (entity: SceneEntity) => doc.entities.push(entity);
  add(createEntity("text", "title", 640, 100, doc));
  add(createEntity("caption", "cap", 640, 200, doc));
  add(createEntity("equation", "eq", 640, 300, doc));
  add(createEntity("circle", "ball", 400, 420, doc));
  add(createEntity("rect", "panel", 880, 420, doc));
  add(createEntity("line", "rule", 300, 560, doc));
  add(createEntity("arrow", "point", 700, 560, doc));
  add(createEntity("counter", "n", 640, 640, doc));
  return doc;
}

describe("+ Beat generation", () => {
  it("creates a complete, round-trippable beat for every applicable verb", () => {
    const doc = richDoc();
    const step = { name: "All beats", mode: "together" as const, gap: 0.12, actions: [] as SceneDoc["steps"][0]["actions"] };
    const skippedVerbs: string[] = [];
    for (const verb of allVerbDefs()) {
      const target = doc.entities.find((entity) => verb.appliesTo(entity.kind));
      const selected = verb.targetless ? "" : target?.id ?? "";
      const availability = beatAvailability(doc, verb.name, selected);
      if (!availability.enabled) { skippedVerbs.push(`${verb.name} (${availability.reason})`); continue; }
      const out = createBeatAction(doc, verb.name, selected);
      expect(out.action, `${verb.name}: ${out.error}`).not.toBeNull();
      step.actions.push(out.action!);
      applyBeatOnAdd(doc, out.action!);
    }
    expect(step.actions.length).toBeGreaterThanOrEqual(20);
    doc.steps.push(step);

    const text = serializeSceneFile(doc);
    const again = readSceneSource(text);
    expect(again.skipped, again.skipped.join("\n")).toEqual([]);
    const back = again.doc.steps.find((candidate) => candidate.name === "All beats");
    expect(back?.actions.length).toBe(step.actions.length);

    if (existsSync(MANIC)) {
      const path = join(tmpdir(), "beatgen-all.manic");
      writeFileSync(path, text);
      expect(() => execFileSync(MANIC, ["check", path], { stdio: "pipe" })).not.toThrow();
    }
  });

  it("blocks a second disintegrate on the same target (engine dust-id collision)", () => {
    const doc = richDoc();
    const first = createBeatAction(doc, "disintegrate", "eq");
    expect(first.action).not.toBeNull();
    doc.steps.push({ name: "s", mode: "together", gap: 0.12, actions: [first.action!] });
    const second = beatAvailability(doc, "disintegrate", "eq");
    expect(second.enabled).toBe(false);
    expect(second.reason).toContain("already disintegrates");
    // …but a different target is fine.
    expect(beatAvailability(doc, "disintegrate", "title").enabled).toBe(true);
  });

  it("accum with no start point never puts the color in the numeric slot", () => {
    const source = [
      'plot(f, (640, 400), 90, 60, sin, 6.28);',
      "accum(bigF, f);",
      "color(bigF, lime);",
      "",
    ].join("\n");
    const scene = readSceneSource(source);
    const accum = scene.doc.entities.find((entity) => entity.kind === "accum");
    expect(accum).toBeDefined();
    const next = cloneDoc(scene.doc);
    next.entities.find((entity) => entity.kind === "accum")!.color = "gold";
    const updated = patchSceneSource(source, scene, next);
    expect(updated).toContain("accum(bigF, f);");
    expect(updated).toContain("color(bigF, gold);");
    expect(updated).not.toMatch(/accum\(bigF, f, (lime|gold)\)/u);
  });

  it("creation durations are corpus-tuned while parse fallbacks stay engine-true", () => {
    const doc = richDoc();
    expect(createBeatAction(doc, "show", "title").action?.dur).toBe(0.4);
    expect(createBeatAction(doc, "fade", "title").action?.dur).toBe(0.4);
    expect(createBeatAction(doc, "draw", "rule").action?.dur).toBe(0.7);
    expect(createBeatAction(doc, "move", "ball").action?.dur).toBe(0.6);
    expect(createBeatAction(doc, "wait", "").action?.dur).toBe(0.8);
    // Parse fallback unchanged: a bare `show(a);` still reads as the engine's 0.5.
    const read = readSceneSource('circle(a, (100, 100), 40);\nshow(a);\n');
    expect(read.doc.steps[0].actions[0].dur).toBe(0.5);
  });
});
