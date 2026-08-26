import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canvasAnnotations, createBeatAction, readSceneSource, serializeSceneFile, vocabularyEntry,
} from "./index.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";

const SOURCE = `canvas(1280, 720);
template("black");

circle(source, (260, 300), 70);
tag(source, cluster);
rect(panel, (850, 360), 360, 220);
tag(panel, cluster);
particles(dots, source, 12, 5, 7, "ring");
copy(source_copy, source);

step("Core layout") {
  seq {
    slidex(source_copy, 560, 0.5, linear);
    slidey(source_copy, 470, 0.4, out);
    groupscale(cluster, 1.25, 0.7, inout);
    dock(cluster, source, panel, 0.6, smooth);
    arrange(dots, panel, "grid", 1.2, smooth);
  }
}
`;

describe("Core layout and transform batch", () => {
  it("projects native copy and every layout verb without Source-only gaps", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    const copied = scene.doc.entities.find((entity) => entity.id === "source_copy")!;
    expect(copied).toMatchObject({ kind: "circle", copyOf: "source" });
    expect(copied.tags).toBeUndefined();
    expect(scene.doc.steps[0].actions).toMatchObject([
      { verb: "slidex", target: "source_copy", amount: 560, dur: .5 },
      { verb: "slidey", target: "source_copy", amount: 470, dur: .4 },
      { verb: "groupscale", target: "cluster", amount: 1.25, dur: .7 },
      { verb: "dock", target: "cluster", ref: "source", refs: ["panel"], dur: .6 },
      { verb: "arrange", target: "dots", ref: "panel", text: "grid", dur: 1.2 },
    ]);
    const regenerated = serializeSceneFile(scene.doc);
    expect(regenerated).toContain("copy(source_copy, source);");
    const roundTrip = readSceneSource(regenerated);
    expect(roundTrip.skipped).toEqual([]);
    expect(roundTrip.doc).toEqual(scene.doc);
    if (existsSync(MANIC)) {
      const path = join(tmpdir(), "manic-core-layout.manic");
      writeFileSync(path, regenerated);
      expect(() => execFileSync(MANIC, ["check", path], { stdio: "pipe" })).not.toThrow();
    }
  });

  it("exposes the batch as semantic Canvas vocabulary with editable defaults", () => {
    const doc = readSceneSource(SOURCE).doc;
    for (const name of ["copy", "slidex", "slidey", "groupscale", "dock", "arrange"]) {
      expect(vocabularyEntry(name), name).toMatchObject({ fidelity: "semantic" });
    }
    expect(createBeatAction(doc, "slidex", "source_copy").action).toMatchObject({ verb: "slidex", target: "source_copy" });
    expect(createBeatAction(doc, "groupscale", "source").action).toMatchObject({ verb: "groupscale", target: "source" });
    expect(createBeatAction(doc, "arrange", "dots").action).toMatchObject({ verb: "arrange", target: "dots", ref: "source" });
  });

  it("makes copy, group, docking, axis, and arrangement meaning visible", () => {
    const doc = readSceneSource(SOURCE).doc;
    const copied = doc.entities.find((entity) => entity.id === "source_copy")!;
    const source = doc.entities.find((entity) => entity.id === "source")!;
    const dots = doc.entities.find((entity) => entity.id === "dots")!;
    expect(canvasAnnotations(copied, doc)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "copy", representation: "semantic", refs: ["source"] }),
      expect.objectContaining({ label: "slidex to 560" }),
      expect.objectContaining({ label: "slidey to 470" }),
    ]));
    expect(canvasAnnotations(source, doc)).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Collective scale 1.25×" }),
      expect.objectContaining({ label: "Dock source" }),
    ]));
    expect(canvasAnnotations(dots, doc)).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "grid particle arrangement", refs: ["panel"] }),
    ]));
  });
});
