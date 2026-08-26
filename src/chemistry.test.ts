import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allVocabularyEntries, balanceSides, beatAvailability, canvasAnnotations, chemReferences, formulaAtoms,
  cloneDoc, entityReferences, patchSceneSource, readSceneSource, serializeSceneFile,
  type BalanceChemEntity, type IRSpectrumChemEntity, type ProfileChemEntity,
} from "./index.js";

const names = [
  "balance", "supply", "limiting", "solve", "react", "lewis", "octet", "resonate",
  "levels", "emission", "drop", "cell", "discharge", "lattice", "dissolve",
  "newman", "profile", "vibration", "irspectrum", "molecule3",
] as const;

const source = `title("Chemistry authoring");
canvas("16:9");
balance(rx, (640, 150), "Fe + O2 -> Fe2O3", 44);
supply(rx, "Fe=10g O2=5g");
limiting(rx, (640, 340), 620, 48, 20);
lewis(lw, "NO3-", (250, 590), 110, 28);
levels(lv, (560, 590), 260, 260, 6, 1);
emission(sp, lv, (980, 560), 420, 80, 380);
cell(galv, "Zn|Cu", (320, 900), 520, 240, "resistance=10 carriers=8");
lattice(salt, "NaCl", (760, 900), 5, 4, 44);
newman(nm, "asset:molecules/butane.sdf", (260, 1240), 120, 18);
profile(pf, nm, (650, 1240), 420, 170);
vibration(vib, "asset:molecules/water.sdf", (970, 1240), 120, 20);
irspectrum(ir, vib, (970, 1500), 460, 150, 15);
molecule3(water, "asset:molecules/water.sdf", (0, 0, 0), 1.5, "style=ball spin=12");
step("chemistry") {
  par {
    solve(rx, 2.4);
    react(rx, 2.6);
    octet(lw, 6);
    resonate(lw, 4, 2);
    drop(lv, 3, 2, 1.6);
    discharge(galv, 4, 30);
    dissolve(salt, 5, 6);
  }
}
`;

describe("Chemistry onboarding", () => {
  it("onboards the exact 20-builtin batch as semantic Canvas vocabulary", () => {
    const vocabulary = allVocabularyEntries(true);
    for (const name of names) expect(vocabulary.find((entry) => entry.name === name), name).toMatchObject({ kit: "chem", fidelity: "semantic" });
    for (const name of ["structure", "tally", "twist", "vibrate"]) expect(vocabulary.find((entry) => entry.name === name), name).toMatchObject({ kit: "chem", fidelity: "source-only" });
  });

  it("folds modifiers and dependent figures into stable visual owners", () => {
    const scene = readSceneSource(source);
    expect(scene.skipped).toEqual([]);
    const balance = scene.doc.entities.find((entity): entity is BalanceChemEntity => entity.kind === "balance")!;
    const profile = scene.doc.entities.find((entity): entity is ProfileChemEntity => entity.kind === "profile")!;
    const spectrum = scene.doc.entities.find((entity): entity is IRSpectrumChemEntity => entity.kind === "irspectrum")!;
    expect(balance).toMatchObject({ equation: "Fe + O2 -> Fe2O3", supplied: "Fe=10g O2=5g", limiting: true, limitWidth: 620 });
    expect(balanceSides(balance.equation)).toEqual({ left: ["Fe", "O2"], right: ["Fe2O3"] });
    expect(profile.torsion).toBe("nm");
    expect(spectrum.molecule).toBe("vib");
    expect(entityReferences(profile)).toEqual(["nm"]);
    expect(entityReferences(spectrum)).toEqual(["vib"]);
    expect(chemReferences(balance)).toEqual(expect.arrayContaining(["rx.parts", "rx.limit", "rx.limit.mark"]));
  });

  it("keeps molecular subscripts when parsing a bare ionic charge", () => {
    expect(formulaAtoms("NH4+")).toEqual(["N", "H", "H", "H", "H"]);
    expect(formulaAtoms("NO3-")).toEqual(["N", "O", "O", "O"]);
    expect(formulaAtoms("SO4^2-")).toEqual(["S", "O", "O", "O", "O"]);
  });

  it("round-trips Story controls and exposes honest Preview boundaries", () => {
    const scene = readSceneSource(source), text = serializeSceneFile(scene.doc);
    for (const name of ["solve", "react", "octet", "resonate", "drop", "discharge", "dissolve"]) expect(text).toContain(`${name}(`);
    for (const [verb, target] of [["solve", "rx"], ["react", "rx"], ["octet", "lw"], ["drop", "lv"], ["discharge", "galv"], ["dissolve", "salt"]] as const) expect(beatAvailability(scene.doc, verb, target).enabled, verb).toBe(true);
    const balance = scene.doc.entities.find((entity) => entity.id === "rx")!;
    const levels = scene.doc.entities.find((entity) => entity.id === "lv")!;
    const vibration = scene.doc.entities.find((entity) => entity.id === "vib")!;
    const molecule = scene.doc.entities.find((entity) => entity.id === "water")!;
    expect(canvasAnnotations(balance, scene.doc).find((note) => note.id === "chemical-balance")).toMatchObject({ representation: "semantic", detail: expect.stringContaining("Preview owns") });
    expect(canvasAnnotations(levels, scene.doc).find((note) => note.id === "energy-levels")).toMatchObject({ label: expect.stringContaining("1 drop") });
    expect(canvasAnnotations(vibration, scene.doc).find((note) => note.id === "molecular-vibration")).toMatchObject({ refs: expect.arrayContaining(["ir"]) });
    expect(canvasAnnotations(molecule, scene.doc).find((note) => note.id === "molecule3-asset")).toMatchObject({ refs: expect.arrayContaining(["__camera3"]) });
  });
});

const examples = resolve(import.meta.dirname, "../../../manic/examples");
const pattern = new RegExp(`^\\s*(?:${names.join("|")})\\s*\\(`, "mu");
describe.skipIf(!existsSync(examples))("native Chemistry examples", () => {
  const files = (readdirSync(examples, { recursive: true }) as string[]).filter((file) => file.endsWith(".manic") && pattern.test(readFileSync(resolve(examples, file), "utf8")));
  it("discovers examples across the full batch", () => {
    const corpus = files.map((file) => readFileSync(resolve(examples, file), "utf8")).join("\n");
    for (const name of ["balance", "react", "lewis", "resonate", "levels", "emission", "cell", "lattice", "newman", "profile", "vibration", "irspectrum", "molecule3"]) expect(new RegExp(`^\\s*${name}\\s*\\(`, "mu").test(corpus), name).toBe(true);
  });
  for (const file of files) it(`${file} projects this batch and remains byte-identical`, () => {
    const original = readFileSync(resolve(examples, file), "utf8"), scene = readSceneSource(original);
    const skipped = scene.skipped.filter((note) => new RegExp(`\\b(?:${names.join("|")})\\b.*isn't canvas vocabulary yet`, "u").test(note));
    expect(skipped).toEqual([]);
    expect(patchSceneSource(original, scene, cloneDoc(scene.doc))).toBe(original);
  });
});
