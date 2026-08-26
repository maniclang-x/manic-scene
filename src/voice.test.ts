import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyBeatOnAdd, cloneDoc, createBeatAction, createEntity, emptyDoc,
  estimateSpeakDuration, patchSceneSource, readSceneSource, reconcileVoicePairing,
  serializeSceneFile, vocabularyEntry,
} from "./index.js";

const SOURCE = `title("Narrated scene");
canvas(1280, 720);
template("black");
voice("cartesia", "katie", "slow", "hi");
caption(cap, "Waiting", (640, 650));
step("Intro") {
  seq {
    speak("Voice only");
    speak(cap, "Voice and caption");
  }
}
`;

describe("voice and Speak authoring", () => {
  it("projects the global configuration and both native Speak forms", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.voice).toEqual({ service: "cartesia", voice: "katie", tone: "slow", language: "hi" });
    expect(scene.doc.steps[0].actions).toEqual([
      expect.objectContaining({ verb: "speak", target: "", text: "Voice only", durationExplicit: false }),
      expect.objectContaining({ verb: "speak", target: "cap", text: "Voice and caption", durationExplicit: false }),
    ]);
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
    expect(vocabularyEntry("speak")?.fidelity).toBe("semantic");
    expect(vocabularyEntry("voice")).toBeUndefined();
  });

  it("writes narration and global voice edits surgically", () => {
    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    next.voice = { service: "elevenlabs", voice: "alice", tone: "fast", language: "en" };
    next.steps[0].actions[1].text = "A revised narrated caption";
    next.steps[0].actions[1].dur = estimateSpeakDuration(next.steps[0].actions[1].text!);
    const patched = patchSceneSource(SOURCE, scene, next);
    expect(patched).toContain('voice("elevenlabs", "alice", "fast", "en");');
    expect(patched).toContain('speak(cap, "A revised narrated caption");');
    expect(readSceneSource(patched).skipped).toEqual([]);
  });

  it("adds and removes the native pair atomically", () => {
    const doc = emptyDoc();
    doc.entities.push(createEntity("caption", "cap", 640, 650, doc));
    const speak = createBeatAction(doc, "speak", "").action!;
    speak.target = "cap";
    doc.steps.push({ name: "Narration", mode: "together", gap: .15, actions: [speak] });
    applyBeatOnAdd(doc, speak);
    expect(doc.voice).toEqual({ service: "gtts", voice: null, tone: null, language: null });
    const source = serializeSceneFile(doc);
    expect(source).toContain('voice("gtts");');
    expect(source).toContain('speak(cap, "Write narration here");');
    expect(readSceneSource(source).skipped).toEqual([]);

    doc.steps = [];
    reconcileVoicePairing(doc);
    expect(doc.voice).toBeUndefined();
  });

  it("flags source-authored half-pairs instead of pretending they are valid", () => {
    expect(readSceneSource('voice("gtts");').skipped).toEqual([expect.stringContaining("no matching")]);
    expect(readSceneSource('speak("Hello");').skipped).toEqual([expect.stringContaining("needs one global")]);
  });

  it("accepts a representative narrated corpus file byte-exactly", () => {
    const file = resolve("/Users/anish/git/manic/examples/creator-race-quiz.manic");
    if (!existsSync(file)) return;
    const source = readFileSync(file, "utf8"), scene = readSceneSource(source);
    expect(scene.skipped.some((note) => note.includes("`speak` isn't canvas vocabulary yet"))).toBe(false);
    expect(patchSceneSource(source, scene, cloneDoc(scene.doc))).toBe(source);
  });
});
