import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allEntityDefs, beatAvailability, canvasAnnotations, cloneDoc, opticsGeometry,
  patchSceneSource, readSceneSource, referenceIds, serializeSceneFile, type OpticsEntity,
} from "./index.js";

const source = `title("Optics kit");
canvas("16:9");
refract(ref, (420, 300), 1.52, 1.0, 52);
lens(thin, (920, 300), 240, 130);
prism(spec, (420, 720), "sf11");
achromat(pair, (920, 720), 120);
lenssystem(sys, (420, 1120), "doublet", 900);
rayfan(fan, (920, 1120), "aspheric");
spotdiagram(spot, (420, 1500), "singlet");
fieldspot(field, (920, 1500), "doublet", 8);
color(spec.out0, red);
hidden(sys.rays);
run(ref, 5);
run(thin, 5);
run(spec, 5);
run(pair, 5);
run(sys, 5);
`;

describe("Optics kit onboarding", () => {
  it("registers all eight native Optics constructors", () => {
    const defs=allEntityDefs().filter(def=>def.group==="Optics");
    expect(defs).toHaveLength(8);
    expect(new Set(defs.map(def=>def.ctor))).toEqual(new Set(["refract","lens","prism","achromat","lenssystem","rayfan","spotdiagram","fieldspot"]));
    expect(defs.every(def=>def.fidelity==="semantic")).toBe(true);
  });

  it("parses and serializes every constructor and optical sweep without skips", () => {
    const scene=readSceneSource(source);expect(scene.skipped).toEqual([]);expect(scene.doc.entities).toHaveLength(8);expect(scene.doc.steps.flatMap(step=>step.actions).filter(action=>action.verb==="run")).toHaveLength(5);
    const text=serializeSceneFile(scene.doc);
    expect(text).toContain("refract(ref, (420, 300), 1.52, 1, 52);");
    expect(text).toContain('lenssystem(sys, (420, 1120), "doublet", 900);');
    expect(text).toContain("color(spec.out0, red);");
    expect(text).toContain("hidden(sys.rays);");
  });

  it("keeps stable native part names and useful bounded optical geometry", () => {
    const entities=readSceneSource(source).doc.entities as OpticsEntity[];
    const ref=entities.find(entity=>entity.kind==="refract")!, lens=entities.find(entity=>entity.kind==="lens")!, prism=entities.find(entity=>entity.kind==="prism")!, sys=entities.find(entity=>entity.kind==="lenssystem")!;
    expect(referenceIds(ref)).toEqual(expect.arrayContaining(["ref.interface","ref.normal","ref.incident","ref.refracted","ref.reflected","ref.thetai","ref.thetat","ref.tir"]));
    expect(referenceIds(lens)).toEqual(expect.arrayContaining(["thin.lens","thin.focus","thin.in0","thin.out6"]));
    expect(referenceIds(prism)).toEqual(expect.arrayContaining(["spec.prism","spec.beam","spec.in8","spec.out8"]));
    expect(referenceIds(sys)).toEqual(expect.arrayContaining(["sys.elem0","sys.elem1","sys.rays","sys.ray10","sys.sensor","sys.bestfocus"]));
    expect(opticsGeometry(sys).note).toContain("2 optical elements");
  });

  it("shows sweep semantics only on native simulation targets", () => {
    const scene=readSceneSource(source), byKind=(kind:string)=>scene.doc.entities.find(entity=>entity.kind===kind)!;
    for(const kind of ["refract","lens","prism","achromat","lenssystem"]) expect(beatAvailability(scene.doc,"run",byKind(kind).id).enabled,kind).toBe(true);
    for(const kind of ["rayfan","spotdiagram","fieldspot"]) expect(beatAvailability(scene.doc,"run",byKind(kind).id).enabled,kind).toBe(false);
    expect(canvasAnnotations(byKind("refract"),scene.doc).find(note=>note.id==="optics-contract")).toMatchObject({representation:"semantic",tone:"info",label:expect.stringContaining("sweep")});
    expect(canvasAnnotations(byKind("fieldspot"),scene.doc).find(note=>note.id==="optics-contract")?.detail).toContain("physical trace");
  });

  it("preserves omitted sweep controls and custom prescriptions", () => {
    const scene=readSceneSource('refract(r); lens(l); lenssystem(custom, (640, 380), "160 26 bk7 | -140 8 f2 | -420 0 air");');
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities[0]).toMatchObject({kind:"refract",x:640,y:360,p1:null,p2:null,p3:null});
    expect(scene.doc.entities[1]).toMatchObject({kind:"lens",x:640,y:360,p1:null,p2:null});
    expect(opticsGeometry(scene.doc.entities[2] as OpticsEntity).note).toContain("2 optical elements");
  });
});

const EXAMPLES=resolve(import.meta.dirname,"../../../manic/examples");
describe.skipIf(!existsSync(EXAMPLES))("native Optics examples",()=>{
  for(const file of [
    "refraction.manic","refraction-paper.manic","lens.manic","lens-paper.manic","prism.manic","prism-cinematic.manic",
    "achromat.manic","achromat-cinematic.manic","lens-system.manic","lens-prescription.manic","aspheric-lens.manic",
    "ray-fan.manic","spot-diagram.manic","off-axis.manic","creator-v2.manic","3b1b-eval/light-and-brachistochrone.manic",
  ]) it(`${file} projects Optics vocabulary and remains byte-identical`,()=>{
    const original=readFileSync(resolve(EXAMPLES,file),"utf8"),scene=readSceneSource(original);
    expect(scene.skipped.filter(note=>/`(refract|lens|prism|achromat|lenssystem|rayfan|spotdiagram|fieldspot)` isn't canvas vocabulary yet/u.test(note))).toEqual([]);
    expect(patchSceneSource(original,scene,cloneDoc(scene.doc))).toBe(original);
  });
});
