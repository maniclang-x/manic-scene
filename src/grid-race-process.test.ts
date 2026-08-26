import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allVocabularyEntries, beatAvailability, canvasAnnotations, cloneDoc, gridDesignCells,
  patchSceneSource, raceRows, readSceneSource, referenceIds, serializeSceneFile,
  type GridEntity, type LiveHistogramEntity, type RaceChartEntity,
} from "./index.js";

const names = [
  "neighbors", "setcell", "walls", "evolve", "collapse", "gridbfs", "gridastar",
  "racechart", "racedata", "raceseries", "raceline", "racepanel", "race",
  "livehistogram", "stream", "emit", "advect", "branch", "collect", "observe",
] as const;

const source = `title("Grid, race, and process");
canvas("16:9");
grid(board, "@...;....;...*;....", (300, 300), 4, 4, 32);
neighbors(board, "8");
setcell(board, 1, 1, wall);
walls(board, "1,2 2,2");
evolve(board, "life");
collapse(board, "maze", 7);
racechart(chart, "bar", "2020 2021 2022", "Growth");
racedata(chart, "Alpha,10,14,20;Beta,8,16,22");
raceseries(chart, "Gamma", "g", "6 12 24");
raceline(chart, "Total", "24 42 66");
racepanel(chart);
circle(source, (120, 620), 24);
line(route, (150, 620), (760, 620));
particles(dust, source, 24, 4, 17);
vectorfield(field, (640, 360), 400, 220, "-y", "x", 11);
livehistogram(hist, (1000, 620), 0, 2, 8, 360, 180, cyan);
step("compute") {
  par {
    gridbfs(board, (0, 0), (3, 2));
    gridastar(board, (0, 0), (3, 2), diagonal);
    race(chart, 6, smooth);
    stream(dust, route, 4, 20, smooth);
    emit(dust, route, maxwell, 4, 24, smooth);
    advect(dust, field, 4, 0.5);
    branch(dust, routes, 4, smooth);
    collect(hist, dust, speed, 0.4, smooth);
    observe(hist, dust, speed);
  }
}
`;

describe("Grid, Race charts, and Process onboarding", () => {
  it("onboards the exact 20-builtin batch as semantic Canvas vocabulary", () => {
    const vocabulary = allVocabularyEntries(true);
    for (const name of names) expect(vocabulary.find((entry) => entry.name === name), name).toMatchObject({ fidelity: "semantic" });
    expect(vocabulary.filter((entry) => entry.kit === "grid").every((entry) => entry.fidelity !== "source-only")).toBe(true);
    expect(vocabulary.filter((entry) => entry.kit === "charts").every((entry) => entry.fidelity !== "source-only")).toBe(true);
    expect(vocabulary.filter((entry) => entry.kit === "process").every((entry) => entry.fidelity !== "source-only")).toBe(true);
  });

  it("folds dependent declarations into stable visual owners", () => {
    const scene = readSceneSource(source);
    expect(scene.skipped).toEqual([]);
    const grid = scene.doc.entities.find((entity): entity is GridEntity => entity.kind === "grid")!;
    const race = scene.doc.entities.find((entity): entity is RaceChartEntity => entity.kind === "racechart")!;
    const histogram = scene.doc.entities.find((entity): entity is LiveHistogramEntity => entity.kind === "livehistogram")!;
    expect(grid).toMatchObject({ neighbors: "8", operations: [{ kind: "setcell" }, { kind: "walls" }, { kind: "evolve" }, { kind: "collapse", tileset: "maze", seed: 7 }] });
    expect(gridDesignCells(grid)).toHaveLength(16);
    expect(raceRows(race)).toHaveLength(3);
    expect(race).toMatchObject({ panel: true, companion: { label: "Total", values: "24 42 66" } });
    expect(referenceIds(grid)).toEqual(expect.arrayContaining(["board.cells", "board.frontier", "board.visited", "board.path", "board.r1c1"]));
    expect(referenceIds(race)).toEqual(expect.arrayContaining(["chart.period", "chart.bars", "chart.lines", "chart.panel", "chart.bar0"]));
    expect(referenceIds(histogram)).toEqual(expect.arrayContaining(["hist.axis", "hist.bars", "hist.count", "hist.bar0"]));
  });

  it("round-trips all Story relationships and exposes honest Canvas annotations", () => {
    const scene = readSceneSource(source), text = serializeSceneFile(scene.doc);
    for (const name of ["gridbfs", "gridastar", "race", "stream", "emit", "advect", "branch", "collect", "observe"]) expect(text).toContain(`${name}(`);
    for (const [verb, target] of [["gridbfs", "board"], ["gridastar", "board"], ["race", "chart"], ["stream", "dust"], ["collect", "hist"], ["observe", "hist"]] as const) expect(beatAvailability(scene.doc, verb, target).enabled, verb).toBe(true);
    const grid = scene.doc.entities.find((entity) => entity.id === "board")!, race = scene.doc.entities.find((entity) => entity.id === "chart")!, histogram = scene.doc.entities.find((entity) => entity.id === "hist")!, particles = scene.doc.entities.find((entity) => entity.id === "dust")!;
    expect(canvasAnnotations(grid, scene.doc).find((note) => note.id === "grid-computation")).toMatchObject({ representation: "semantic", detail: expect.stringContaining("Preview owns") });
    expect(canvasAnnotations(race, scene.doc).find((note) => note.id === "race-playback")).toMatchObject({ label: expect.stringContaining("3 series") });
    expect(canvasAnnotations(histogram, scene.doc).find((note) => note.id === "live-histogram")).toMatchObject({ tone: "info" });
    expect(canvasAnnotations(particles, scene.doc).find((note) => note.id === "process-motion")).toMatchObject({ refs: expect.arrayContaining(["route", "field"]) });
  });

  it("preserves Grid Run's optional generations and duration overload", () => {
    const short = readSceneSource('grid(g, (300, 300), 4, 4); collapse(g, "maze", 7); run(g, 6);');
    expect(short.skipped).toEqual([]);
    expect(short.doc.steps[0].actions[0]).toMatchObject({ verb: "run", target: "g", values: [6], dur: 4, durationExplicit: false });
    expect(serializeSceneFile(short.doc)).toContain("run(g, 6);");
    const explicit = readSceneSource('grid(g, (300, 300), 4, 4); collapse(g, "maze", 7); run(g, 6, 2.5);');
    expect(explicit.skipped).toEqual([]);
    expect(explicit.doc.steps[0].actions[0]).toMatchObject({ values: [6], dur: 2.5, durationExplicit: true });
    expect(serializeSceneFile(explicit.doc)).toContain("run(g, 6, 2.5);");
  });
});

const examples = resolve(import.meta.dirname, "../../../manic/examples");
const pattern = new RegExp(`^\\s*(?:${names.join("|")})\\s*\\(`, "mu");
describe.skipIf(!existsSync(examples))("native Grid, Race, and Process examples", () => {
  const files = (readdirSync(examples, { recursive: true }) as string[]).filter((file) => file.endsWith(".manic") && pattern.test(readFileSync(resolve(examples, file), "utf8")));
  it("discovers native examples for all three kits", () => {
    const source = files.map((file) => readFileSync(resolve(examples, file), "utf8")).join("\n");
    for (const name of ["grid", "gridastar", "racechart", "race", "livehistogram", "stream", "observe"]) expect(patternFor(name).test(source), name).toBe(true);
  });
  for (const file of files) it(`${file} projects this batch and remains byte-identical`, () => {
    const original = readFileSync(resolve(examples, file), "utf8"), scene = readSceneSource(original);
    const skipped = scene.skipped.filter((note) => new RegExp(`\\b(?:${names.join("|")})\\b.*isn't canvas vocabulary yet`, "u").test(note));
    expect(skipped).toEqual([]);
    expect(patchSceneSource(original, scene, cloneDoc(scene.doc))).toBe(original);
  });
});

function patternFor(name: string): RegExp {
  return new RegExp(`^\\s*${name}\\s*\\(`, "mu");
}
