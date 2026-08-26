import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  appendTimedAction, cloneDoc, createBeatAction, createEntity, createTimedStep,
  patchSceneSource, readSceneSource, serializeSceneFile, stepActions,
  timedPhaseUsage, vocabularyEntry,
} from "./index.js";
import type { TimingEntity } from "./types.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";
const FIXTURE = resolve("/Users/anish/git/manic/examples/timing-v2-scene.manic");

const SOURCE = `canvas(1280, 720);
template("mono");
text(a, (320, 180), "INTRO"); hidden(a);
text(b, (640, 360), "MAIN"); hidden(b);
text(c, (960, 540), "DONE"); hidden(c);
timing(clock, (1120, 70), "intro=1 main=3 outro=1");
timed(clock) {
  during("intro") {
    par { show(a, 0.5); pulse(a, 0.4); }
  }
  during("main") {
    seq { show(b, 0.4); pulse(b, 0.5); }
    stagger(0.2) { flash(a, cyan, 0.3); flash(b, gold, 0.3); }
  }
  during("outro") { show(c, 0.6); }
}
`;

describe("timed/during Story composition", () => {
  it("projects named phases and nested par/seq/stagger without flattening their semantics", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.steps).toHaveLength(1);
    const step = scene.doc.steps[0];
    expect(step.timed?.controller).toBe("clock");
    expect(step.timed?.phases.map((phase) => phase.name)).toEqual(["intro", "main", "outro"]);
    expect(step.timed?.phases[1].segments.map((segment) => [segment.mode, segment.wrapped])).toEqual([["sequence", true], ["stagger", true]]);
    expect(stepActions(step).map((action) => action.verb)).toEqual(["show", "pulse", "show", "pulse", "flash", "flash", "show"]);
    expect(timedPhaseUsage(step, 1, scene.doc)).toEqual({ seconds: 1.4, sourceOwned: false });
  });

  it("identity-patches exactly and regenerates one changed timed block safely", () => {
    const scene = readSceneSource(SOURCE);
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
    const next = cloneDoc(scene.doc);
    stepActions(next.steps[0])[0].dur = .65;
    next.steps[0].timed!.phases[1].segments[1].gap = .25;
    const updated = patchSceneSource(SOURCE, scene, next);
    expect(updated).toContain("par {");
    expect(updated).toContain("show(a, 0.65);");
    expect(updated).toContain("stagger(0.25) {");
    expect(readSceneSource(updated).skipped).toEqual([]);
  });

  it("creates a complete native-safe timed scaffold from Canvas", () => {
    const source = readSceneSource("canvas(1280, 720);\n");
    const title = createEntity("text", "title", 640, 160, source.doc);
    const controller = createEntity("timing", "clock", 1120, 70, source.doc) as TimingEntity;
    source.doc.entities.push(title, controller);
    const step = createTimedStep(controller);
    const show = createBeatAction(source.doc, "show", "title").action!;
    expect(appendTimedAction(step, 0, 0, show)).toBe(0);
    source.doc.steps.push(step);
    const serialized = serializeSceneFile(source.doc);
    expect(serialized).toContain("timed(clock) {");
    expect(serialized).toContain(`during("${controller.phases[0].name}") {`);
    expect(serialized).toContain("show(title");
    expect(readSceneSource(serialized).skipped).toEqual([]);
  });

  it("projects onboarded inner Physics beats as editable actions", () => {
    if (!existsSync(FIXTURE)) return;
    const source = readFileSync(FIXTURE, "utf8"), scene = readSceneSource(source);
    expect(patchSceneSource(source, scene, cloneDoc(scene.doc))).toBe(source);
    const step = scene.doc.steps.find((candidate) => candidate.timed?.controller === "showclock")!;
    expect(step.timed?.phases[1].segments[0].items).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "action", action: expect.objectContaining({ verb: "run", target: "p", dur: 6 }) }),
      expect.objectContaining({ kind: "action", action: expect.objectContaining({ verb: "draw", target: "p.path", dur: 6 }) }),
    ]));
    expect(stepActions(step).map((action) => action.target)).toEqual(expect.arrayContaining([
      "p", "p.path", "head", "sub", "law", "note", "done",
    ]));
  });

  it("onboards both control words semantically", () => {
    expect(vocabularyEntry("timed")).toMatchObject({ fidelity: "semantic", kind: "helper" });
    expect(vocabularyEntry("during")).toMatchObject({ fidelity: "semantic", kind: "helper" });
    expect(vocabularyEntry("speak")?.fidelity).toBe("semantic");
  });

  it.runIf(existsSync(MANIC))("passes the native Manic checker before and after a Canvas edit", () => {
    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    stepActions(next.steps[0])[0].dur = .6;
    const files = [SOURCE, patchSceneSource(SOURCE, scene, next)];
    files.forEach((source, index) => {
      const file = resolve(tmpdir(), `manic-workbench-timed-${process.pid}-${index}.manic`);
      writeFileSync(file, source);
      expect(execFileSync(MANIC, ["check", file], { encoding: "utf8" })).toContain("parses + validates");
    });
  });
});
