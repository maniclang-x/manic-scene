import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  STATS_CANVAS_POINT_CAP, STATS_CANVAS_TRIAL_CAP, allEntityDefs, canvasAnnotations, cloneDoc,
  patchSceneSource, readSceneSource, referenceIds, serializeSceneFile, statsGeometry, type StatsEntity,
} from "./index.js";

const source = `title("Stats kit");
canvas("16:9");
histogram(hist, (300, 220), "1 2 2 3 4 5 5 5 8", 7, 420, 210, rainbow);
covariance(cov, (840, 220), 42, "1 1 2 2 3 2 4 5 5 4", gold);
bayes(b, (320, 470), 8, 4, 500, 210);
hypothesis(hyp, (850, 470), 2.1, 0.05, 65);
bellcurve(n, (640, 300), 100, 15, 72, cyan);
gaussian(ng, (640, 300), 0, 1);
summary(sum, (640, 350), "2 3 3 4 5 5 5 6 8", 600, lime);
correlation(cor, (640, 340), 38, "1 1 2 2 3 2 4 5 5 4", cyan);
skew(sk, (320, 250), "1 2 2 3 3 3 4 7 10", 6, 440, 220, rainbow);
boxplot(box, (640, 360), "1 2 3 4 5 6 7 12", 580, cyan);
distribution(dist, (640, 340), "binomial", 10, 0.4, rainbow);
confidence(ci, (640, 360), 50, 10, 100, 95, 520);
montecarlo(mc, (640, 340), 4000, 7, 220);
randomwalk(rw, (640, 360), 3000, 9, 12);
lln(law, (640, 350), 5000, 11, 620, 260);
clt(limit, (640, 350), 12, 5000, 13, 540, 240, rainbow);
hidden(hist.bar0);
color(sum.meanmark, magenta);
`;

describe("Stats kit onboarding", () => {
  it("registers every native constructor spelling in the Stats group", () => {
    const defs = allEntityDefs().filter((def) => def.group === "Stats");
    expect(defs).toHaveLength(15);
    expect(new Set(defs.flatMap((def) => [def.ctor, ...(def.aliases ?? [])]))).toEqual(new Set([
      "histogram", "covariance", "bayes", "hypothesis", "bellcurve", "gaussian", "summary", "correlation",
      "skew", "boxplot", "distribution", "confidence", "montecarlo", "randomwalk", "lln", "clt",
    ]));
  });

  it("parses every spelling without skipped source and preserves constructor arguments", () => {
    const parsed = readSceneSource(source);
    expect(parsed.skipped).toEqual([]);
    expect(parsed.doc.entities).toHaveLength(16);
    expect(parsed.doc.entities.every((entity) => allEntityDefs().some((def) => def.kind === entity.kind))).toBe(true);
    const gaussian = parsed.doc.entities.find((entity): entity is StatsEntity => entity.id === "ng")!;
    expect(gaussian).toMatchObject({ kind: "bellcurve", spelling: "gaussian", p1: 0, p2: 1 });
    const text = serializeSceneFile(parsed.doc);
    expect(text).toContain("gaussian(ng, (640, 300), 0, 1);");
    expect(text).toContain('distribution(dist, (640, 340), "binomial", 10, 0.4, rainbow);');
    expect(text).toContain("clt(limit, (640, 350), 12, 5000, 13, 540, 240, rainbow);");
    expect(text).toContain("hidden(hist.bar0);");
    expect(text).toContain("color(sum.meanmark, magenta);");
  });

  it("computes stable statistical children and values", () => {
    const entities = readSceneSource(source).doc.entities as StatsEntity[];
    const histogram = entities.find((entity) => entity.kind === "histogram")!;
    expect(referenceIds(histogram)).toEqual(expect.arrayContaining(["hist.bars", "hist.bar0", "hist.bar6", "hist.meanline", "hist.mean"]));
    const summary = statsGeometry(entities.find((entity) => entity.kind === "summary")!);
    expect(summary.primitives.find((primitive) => primitive.id === "sum.readout")).toMatchObject({ kind: "text", text: expect.stringContaining("variance") });
    const correlation = statsGeometry(entities.find((entity) => entity.kind === "correlation")!);
    expect(correlation.primitives.find((primitive) => primitive.id === "cor.r")).toMatchObject({ kind: "text", text: expect.stringContaining("positive") });
    const confidence = statsGeometry(entities.find((entity) => entity.kind === "confidence")!);
    expect(confidence.primitives.find((primitive) => primitive.id === "ci.ci")).toMatchObject({ kind: "text", text: expect.stringContaining("95% CI") });
  });

  it("bounds high-count simulations while preserving their authored totals", () => {
    const entities = readSceneSource(source).doc.entities as StatsEntity[];
    const monte = statsGeometry(entities.find((entity) => entity.kind === "montecarlo")!);
    expect(monte.semantic).toBe(true);
    expect(monte.primitives.filter((primitive) => primitive.id.startsWith("mc.pt"))).toHaveLength(STATS_CANVAS_POINT_CAP);
    expect(monte.note).toContain("4000");
    const walk = statsGeometry(entities.find((entity) => entity.kind === "randomwalk")!);
    const walkPath = walk.primitives.find((primitive) => primitive.id === "rw.path");
    expect(walkPath).toMatchObject({ kind: "polyline", points: expect.any(Array) });
    if (walkPath?.kind !== "polyline") throw new Error("missing walk path");
    expect(walkPath.points).toHaveLength(STATS_CANVAS_TRIAL_CAP + 1);
    expect(statsGeometry(entities.find((entity) => entity.kind === "lln")!).note).toContain("5000");
    expect(statsGeometry(entities.find((entity) => entity.kind === "clt")!).note).toContain("5000");
  });

  it("surfaces exact, semantic, and invalid-input annotations honestly", () => {
    const parsed = readSceneSource(source), entities = parsed.doc.entities as StatsEntity[];
    expect(canvasAnnotations(entities.find((entity) => entity.kind === "histogram")!, parsed.doc).find((note) => note.id === "stats-composition")).toMatchObject({ representation: "exact", tone: "info" });
    expect(canvasAnnotations(entities.find((entity) => entity.kind === "montecarlo")!, parsed.doc).find((note) => note.id === "stats-composition")).toMatchObject({ representation: "semantic", tone: "info" });
    const invalid = { ...entities.find((entity) => entity.kind === "histogram")!, data: "1" };
    expect(canvasAnnotations(invalid, parsed.doc).find((note) => note.id === "stats-composition")).toMatchObject({ tone: "warning", label: "Statistical inputs need attention" });
  });
});

const EXAMPLES = resolve(import.meta.dirname, "../../../manic/examples");
describe.skipIf(!existsSync(EXAMPLES))("native Stats examples", () => {
  for (const [file, names] of [
    ["histogram.manic", ["histogram"]], ["summary.manic", ["summary"]], ["boxplot.manic", ["boxplot"]],
    ["skew.manic", ["skew"]], ["correlation.manic", ["correlation"]], ["covariance.manic", ["covariance"]],
    ["bayes.manic", ["bayes"]], ["hypothesis.manic", ["hypothesis"]], ["bellcurve.manic", ["bellcurve"]],
    ["lln.manic", ["lln"]], ["clt.manic", ["clt"]],
    ["probability.manic", ["distribution", "confidence", "montecarlo", "randomwalk"]],
  ] as const) it(`${file} projects its Stats vocabulary and remains byte-identical`, () => {
    const source = readFileSync(resolve(EXAMPLES, file), "utf8"), scene = readSceneSource(source);
    for (const name of names) expect(scene.skipped.some((note) => note.includes(`\`${name}\` isn't canvas vocabulary yet`)), name).toBe(false);
    expect(patchSceneSource(source, scene, cloneDoc(scene.doc))).toBe(source);
  });
});
