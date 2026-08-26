import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cloneDoc, createBeatAction, createEntity, patchSceneSource, readSceneSource, referenceIds,
  serializeSceneFile, vocabularyEntry, workflowDuration,
} from "./index.js";
import type { CountdownEntity, QuizEntity, TimingEntity } from "./types.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";
const SOURCE = `canvas(720, 1280);
template("shorts");

quiz(q, "What is 7 x 8?", "studio layout=grid density=comfortable motion=calm safe=reels accent=cyan");
option(q, "54");
option(q, "56", correct);
option(q, "48");
option(q, "63");
explain(q, "Seven groups of eight make fifty-six.", "Mental multiplication");
timing(q, "calm ask=1.2 options=1 think=4.8 reveal=0.8 hold=2.2 stagger=0.06");
timerstyle(q, "look=bar position=below number=outside direction=drain color=cyan track=dim label=THINK finish=pulse");

timing(clock, (620, 90), "intro=1.2 experiment=6 insight=2 outro=1.2");
timerstyle(clock, (610, 100), "ring size=small label=SCENE finish=hold");
countdown(short, (360, 1040), 6, "ticks direction=fill color=gold label=SOLVE finish=flash");

step("Play") { seq { run(q); run(clock); run(short, 4); } }
`;

describe("quiz and timing workflow vocabulary", () => {
  it("projects overloaded timing, answers, generated targets, and inferred run durations", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map((entity) => entity.kind)).toEqual(["quiz", "timing", "countdown"]);
    const quiz = scene.doc.entities[0] as QuizEntity, timing = scene.doc.entities[1] as TimingEntity, countdown = scene.doc.entities[2] as CountdownEntity;
    expect(quiz.options).toEqual([{ text: "54", correct: false }, { text: "56", correct: true }, { text: "48", correct: false }, { text: "63", correct: false }]);
    expect(quiz.explanationSource).toBe("Mental multiplication");
    expect(quiz.timing).toMatchObject({ pace: "calm", ask: 1.2, think: 4.8, stagger: .06 });
    expect(quiz.timerStyle).toMatchObject({ look: "bar", position: "below", number: "outside", label: "THINK", finish: "pulse" });
    expect(timing).toMatchObject({ x: 610, y: 100, responsive: false });
    expect(timing.phases.map((phase) => phase.name)).toEqual(["intro", "experiment", "insight", "outro"]);
    expect(countdown).toMatchObject({ seconds: 6, timerStyle: expect.objectContaining({ look: "ticks", direction: "fill", finish: "flash" }) });
    expect(referenceIds(quiz)).toEqual(expect.arrayContaining(["q.parts", "q.question", "q.options", "q.option.b", "q.option.correct", "q.explanation", "q.source"]));
    expect(scene.doc.steps[0].actions.map((action) => [action.target, action.dur, action.durationExplicit])).toEqual([
      ["q", workflowDuration(quiz), false], ["clock", workflowDuration(timing), false], ["short", 4, true],
    ]);
  });

  it("keeps identity patches exact and regenerates the whole workflow surgically", () => {
    const scene = readSceneSource(SOURCE);
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
    const next = cloneDoc(scene.doc), quiz = next.entities[0] as QuizEntity;
    quiz.question = "What is eight times seven?";
    quiz.options[1].text = "Fifty-six";
    quiz.timing!.think = 5.2;
    const updated = patchSceneSource(SOURCE, scene, next);
    expect(updated).toContain("quiz(q, `What is eight times seven?`");
    expect(updated).toContain("option(q, `Fifty-six`, correct);");
    expect(updated).toContain("think=5.2");
    expect(readSceneSource(updated).skipped).toEqual([]);
  });

  it("creates native-valid quiz, timing, and countdown defaults", () => {
    const source = readSceneSource("canvas(720, 1280);\n");
    const quiz = createEntity("quiz", "quiz1", 0, 0, source.doc);
    source.doc.entities.push(quiz);
    source.doc.entities.push(createEntity("timing", "clock", 600, 90, source.doc));
    source.doc.entities.push(createEntity("countdown", "timer", 360, 1000, source.doc));
    source.doc.steps.push({ name: "Run quiz", mode: "sequence", gap: .1, actions: [createBeatAction(source.doc, "run", "quiz1").action!] });
    const serialized = serializeSceneFile(source.doc);
    expect(readSceneSource(serialized).skipped).toEqual([]);
    expect(serialized).toContain("option(quiz1, `Correct answer`, correct);");
    expect(serialized).toContain("run(quiz1);");
  });

  it("marks the entire batch and Speak Canvas-semantic", () => {
    for (const name of ["quiz", "option", "timing", "timerstyle", "countdown", "explain", "run"]) expect(vocabularyEntry(name)?.fidelity, name).toBe("semantic");
    expect(vocabularyEntry("speak")?.fidelity).toBe("semantic");
    expect(vocabularyEntry("voice")).toBeUndefined();
  });

  it.runIf(existsSync(MANIC))("passes the native Manic checker", () => {
    const file = resolve(tmpdir(), `manic-workbench-quiz-${process.pid}.manic`);
    writeFileSync(file, SOURCE);
    expect(execFileSync(MANIC, ["check", file], { encoding: "utf8" })).toContain("parses + validates");
  });
});

const EXAMPLES = ["creator-v2-options-socials.manic", "creator-v2-timers.manic", "timing-v2-scene.manic", "creator-rule90-sierpinski.manic"]
  .map((name) => resolve("/Users/anish/git/manic/examples", name));

describe.skipIf(EXAMPLES.some((file) => !existsSync(file)))("quiz workflow corpus acceptance", () => {
  it("understands the batch without changing representative files", () => {
    const names = ["quiz", "option", "timing", "timerstyle", "countdown", "explain", "run"];
    for (const file of EXAMPLES) {
      const source = readFileSync(file, "utf8"), scene = readSceneSource(source);
      expect(patchSceneSource(source, scene, cloneDoc(scene.doc)), file).toBe(source);
      for (const name of names) expect(scene.skipped.some((note) => note.includes(`\`${name}\` isn't canvas vocabulary yet`)), `${file}: ${name}`).toBe(false);
    }
  });
});
