import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allVocabularyEntries, beatTargetOptions, canvasAnnotations, cloneDoc, createAction, createBeatAction,
  patchSceneSource, readSceneSource, serializeSceneFile, verbDef,
} from "./index.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";
const NAMES = ["move3", "shift3", "rotate3", "turn3", "grow3", "become3", "travel3", "look3", "view3", "present3", "followshot3", "drift3", "advect3", "chain3"] as const;

const SOURCE = `canvas(1280, 720);
template("black");
camera3((8, -10, 7), (0, 0, 1), 42);
frame3(world, (0,0,0), (8,8,6), "x=-3..3 y=-3..3 z=-2..2 planes=xy:min,xz:min,yz:min major=1 mode=textbook");
cube3(box, (0,0,0), (1,1,1));
cube3(goal, (2,1,1), (1.5,0.8,1.2)); hidden(goal);
line3(edge, (-1,0,0), (1,0,0));
point3(probe, (0,0,0), 0.12);
curve3(route, "3*t", "sin(pi*t)", "0.5*t", (0,1));
collection3(nodes, (0,0,0), 3, (0.8,0.8,0.8), 17, 0.06);
vectorfield3(flow, (0,0,0), (4,4,4), "-y", "x", "0.1*sin(p*tau)", 4);

move3(box, (1,0,0), 0.7, linear);
shift3(box, (0,1,0), 0.7, smooth);
rotate3(box, (10,20,30), 0.8, smooth);
grow3(edge, (2,0,0), 0.7, out);
turn3(box, probe, z, 90, 0.9, smooth);
become3(box, goal, 1.0, smooth);
travel3(probe, route, 1.2, smooth);
look3((0.5,0.2,1.1), 0.8, smooth);
view3(world, "isometric", 1.0, smooth, 1.25);
present3(world, spatial, 0.65, smooth);
followshot3(probe, (0,0,0.2));
followshot3(none);
drift3(nodes, 1.0, 0.25);
chain3(nodes, "1 0.8 0.6", "1 -2 3", 1.0);
advect3(nodes, flow, 1.0, 0.7);
`;

describe("Three motion and camera workflows batch", () => {
  it("projects every workflow with native payloads and a byte-exact identity patch", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    const actions = scene.doc.steps.flatMap((step) => step.actions);
    expect(new Set(actions.map((action) => action.verb))).toEqual(new Set(NAMES));
    expect(actions.find((action) => action.verb === "turn3")).toMatchObject({ target: "box", ref: "probe", prop: "z", amount: 90, values: [0, 0, 0, 0, 0, 1] });
    expect(actions.find((action) => action.verb === "view3")).toMatchObject({ target: "world", prop: "isometric", amount: 1.25 });
    expect(actions.find((action) => action.verb === "chain3")?.valueLists).toEqual([[1, .8, .6], [1, -2, 3]]);
    expect(actions.filter((action) => action.verb === "followshot3").map((action) => action.target)).toEqual(["probe", "none"]);
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
  });

  it("offers logical families only where native semantics permit them", () => {
    const doc = readSceneSource(SOURCE).doc;
    expect(beatTargetOptions(doc, "present3").map((option) => option.id)).toContain("world");
    expect(beatTargetOptions(doc, "view3").map((option) => option.id)).toContain("world");
    expect(beatTargetOptions(doc, "turn3").map((option) => option.id)).toContain("world");
    expect(beatTargetOptions(doc, "move3").map((option) => option.id)).not.toContain("world");
    expect(beatTargetOptions(doc, "grow3").map((option) => option.id)).toContain("edge");
    expect(beatTargetOptions(doc, "grow3").map((option) => option.id)).not.toContain("box");
  });

  it("creates complete visual-control payloads, including per-child chain lists", () => {
    const doc = readSceneSource(SOURCE).doc;
    const chain = createBeatAction(doc, "chain3", "nodes").action!;
    expect(chain.valueLists).toEqual([[1, 1, 1], [1, 1, 1]]);
    const turn = createAction("turn3", "box");
    turn.ref = "probe";
    turn.prop = "custom";
    turn.values = [0, 0, 0, 1, 1, 0];
    const view = createAction("view3", "world");
    const follow = createAction("followshot3", "probe");
    doc.steps.push({ name: "Canvas workflows", mode: "sequence", gap: .1, actions: [chain, turn, view, follow] });
    const source = serializeSceneFile(doc);
    expect(source).toContain('chain3(nodes, "1 1 1", "1 1 1", 6);');
    expect(source).toContain("turn3(box, probe, (1, 1, 0), 90, 0.9);");
    expect(source).toContain('view3(world, "isometric", 1, smooth, 1.18);');
    expect(source).toContain("followshot3(probe);");
    expect(readSceneSource(source).skipped).toEqual([]);
  });

  it("marks Preview-authoritative motion and camera relationships on Canvas", () => {
    const doc = readSceneSource(SOURCE).doc;
    const box = doc.entities.find((entity) => entity.id === "box")!;
    const nodes = doc.entities.find((entity) => entity.id === "nodes")!;
    const camera = doc.entities.find((entity) => entity.kind === "camera3")!;
    expect(canvasAnnotations(box, doc).map((note) => note.id)).toEqual(expect.arrayContaining([expect.stringMatching(/^move3-/u), expect.stringMatching(/^turn3-/u), expect.stringMatching(/^become3-/u)]));
    expect(canvasAnnotations(nodes, doc).map((note) => note.id)).toEqual(expect.arrayContaining([expect.stringMatching(/^drift3-/u), expect.stringMatching(/^chain3-/u), expect.stringMatching(/^advect3-/u)]));
    expect(canvasAnnotations(camera, doc).map((note) => note.id)).toEqual(expect.arrayContaining([expect.stringMatching(/^look3-/u), expect.stringMatching(/^view3-/u), expect.stringMatching(/^followshot3-/u)]));
  });

  it("closes the Three kit with all 75 catalog builtins on semantic controls", () => {
    const three = allVocabularyEntries(true).filter((entry) => entry.kit === "three");
    expect(three).toHaveLength(75);
    expect(three.filter((entry) => entry.fidelity === "semantic")).toHaveLength(75);
    expect(three.filter((entry) => entry.fidelity === "source-only")).toEqual([]);
    for (const name of NAMES) {
      expect(verbDef(name), name).toBeDefined();
      expect(three.find((entry) => entry.name === name)?.fidelity, name).toBe("semantic");
    }
  });

  it("does not skip these workflows in representative native examples", () => {
    const batch = new RegExp(`\\b(?:${NAMES.join("|")})\\s*\\(`, "u");
    for (const path of [
      "/Users/anish/git/manic/examples/three-d-v2-lab.manic",
      "/Users/anish/git/manic/examples/three-d-v2.manic",
      "/Users/anish/git/manic/examples/story-time-varying-field3.manic",
      "/Users/anish/git/manic/examples/frame3-grid-policies.manic",
      "/Users/anish/git/manic/examples/dimensions-unfold.manic",
      "/Users/anish/git/manic/examples/fourier-series-live-wave.manic",
      "/Users/anish/git/manic/examples/story-dependent-chain-history.manic",
    ]) {
      const scene = readSceneSource(readFileSync(path, "utf8"));
      expect(scene.skipped.filter((statement) => batch.test(statement)), path).toEqual([]);
    }
  });

  it.runIf(existsSync(MANIC))("passes the native Manic checker", () => {
    const file = resolve(tmpdir(), `manic-workbench-three-motion-camera-${process.pid}.manic`);
    writeFileSync(file, SOURCE);
    expect(execFileSync(MANIC, ["check", file], { encoding: "utf8" })).toContain("parses + validates");
  });
});
