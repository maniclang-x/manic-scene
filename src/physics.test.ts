import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PHYSICS_KINDS, allEntityDefs, allVerbDefs, allVocabularyEntries, beatAvailability, canvasAnnotations,
  cloneDoc, patchSceneSource, physicsGeometry, readSceneSource, referenceIds, serializeSceneFile, type PhysicsEntity,
} from "./index.js";

const ids=new Map(PHYSICS_KINDS.map((kind,index)=>[kind,`sim${index}`]));
const declarations=PHYSICS_KINDS.map(kind=>kind==="freekick"?`freekick(${ids.get(kind)}, (320, 240), 28, 22, 8);`:kind==="dominopath"?`dominopath(${ids.get(kind)}, (640, 360), 220, 150, "cos(t)", "sin(t)");`:`${kind}(${ids.get(kind)});`).join("\n");
const source=`title("Physics kit");\ncanvas("16:9");\n${declarations}
species(${ids.get("gas")}, A, 0.6, cyan);
species(${ids.get("gas")}, B, magenta);
rule(${ids.get("gas")}, "A + B -> C + C when energy > 3");
speeds(${ids.get("gas")}, (920, 220), 420, 220, 12, 9, 4.5);
phase(${ids.get("pendulum")}, (920, 500), 260);
well(${ids.get("pendulum")}, (920, 780), 260);
timegraph(${ids.get("pendulum")}, (920, 1060), 260);
energygraph(${ids.get("pendulum")}, (920, 1340), 260);
run(${ids.get("spring")}, 5);
swing(${ids.get("pendulum")}, 6);
forces(${ids.get("ramp")}, 0.8);
hidden(${ids.get("dominopath")}.dominos);
untraced(${ids.get("dominopath")}.path);
`;

describe("Physics kit onboarding",()=>{
  it("registers all 38 simulation constructors, seven dependent features, and three verbs",()=>{
    const defs=allEntityDefs().filter(def=>def.group==="Physics");expect(defs).toHaveLength(38);expect(new Set(defs.map(def=>def.ctor))).toEqual(new Set(PHYSICS_KINDS));
    const vocabulary=allVocabularyEntries().filter(entry=>entry.kit==="physics");expect(vocabulary).toHaveLength(48);expect(vocabulary.every(entry=>entry.fidelity==="semantic")).toBe(true);
    const verbs=new Set(allVerbDefs().map(def=>def.name));for(const name of ["run","swing","forces"])expect(verbs.has(name),name).toBe(true);
  });

  it("parses every simulation and dependent form without duplicate Canvas entities",()=>{
    const scene=readSceneSource(source);expect(scene.skipped).toEqual([]);expect(scene.doc.entities).toHaveLength(38);
    const gas=scene.doc.entities.find((entity):entity is PhysicsEntity=>entity.kind==="gas")!,pendulum=scene.doc.entities.find((entity):entity is PhysicsEntity=>entity.kind==="pendulum")!;
    expect(gas.species).toEqual([{name:"A",weight:.6,color:"cyan"},{name:"B",weight:null,color:"magenta"}]);expect(gas.rules).toEqual(["A + B -> C + C when energy > 3"]);expect(gas.speeds).toMatchObject({x:920,y:220,p1:420,p2:220,p3:12,p4:9,size:4.5});
    expect(pendulum.phase).toMatchObject({x:920,y:500,size:260});expect(pendulum.energygraph).toMatchObject({x:920,y:1340,size:260});
    expect(scene.doc.steps.flatMap(step=>step.actions).map(action=>action.verb)).toEqual(expect.arrayContaining(["run","swing","forces"]));
  });

  it("serializes features, required signatures, and generated child styling",()=>{
    const text=serializeSceneFile(readSceneSource(source).doc);expect(text).toContain(`freekick(${ids.get("freekick")}, (320, 240), 28, 22, 8);`);expect(text).toContain(`dominopath(${ids.get("dominopath")}, (640, 360), 220, 150, "cos(t)", "sin(t)");`);expect(text).toContain(`species(${ids.get("gas")}, B, magenta);`);expect(text).toContain(`energygraph(${ids.get("pendulum")}, (920, 1340), 260);`);expect(text).toContain(`hidden(${ids.get("dominopath")}.dominos);`);
  });

  it("provides bounded semantic state, stable families, and correct Beat restrictions",()=>{
    const scene=readSceneSource(source),pendulum=scene.doc.entities.find((entity):entity is PhysicsEntity=>entity.kind==="pendulum")!,gas=scene.doc.entities.find((entity):entity is PhysicsEntity=>entity.kind==="gas")!,ramp=scene.doc.entities.find((entity)=>entity.kind==="ramp")!;
    expect(physicsGeometry(gas).primitives.filter(primitive=>primitive.id.startsWith(`${gas.id}.p`)).length).toBeLessThanOrEqual(80);expect(referenceIds(gas)).toEqual(expect.arrayContaining([`${gas.id}.particles`,`${gas.id}.p0`,`${gas.id}.speeds.axis`,`${gas.id}.speeds.b0`]));expect(referenceIds(pendulum)).toEqual(expect.arrayContaining([`${pendulum.id}.pivot`,`${pendulum.id}.bob`,`${pendulum.id}.phase`]));
    expect(beatAvailability(scene.doc,"run",gas.id).enabled).toBe(true);expect(beatAvailability(scene.doc,"swing",pendulum.id).enabled).toBe(true);expect(beatAvailability(scene.doc,"forces",ramp.id).enabled).toBe(true);expect(beatAvailability(scene.doc,"forces",pendulum.id).enabled).toBe(false);
    expect(canvasAnnotations(gas,scene.doc).find(note=>note.id==="physics-contract")).toMatchObject({representation:"semantic",tone:"info",detail:expect.stringContaining("does not advance")});
  });
});

const EXAMPLES=resolve(import.meta.dirname,"../../../manic/examples");
const physicsNames=new RegExp(`\\b(${[...PHYSICS_KINDS,"species","rule","speeds","phase","well","timegraph","energygraph"].join("|")})\\s*\\(`,"u");
describe.skipIf(!existsSync(EXAMPLES))("native Physics examples",()=>{
  const files=(readdirSync(EXAMPLES,{recursive:true}) as string[]).filter(file=>file.endsWith(".manic")&&physicsNames.test(readFileSync(resolve(EXAMPLES,file),"utf8")));
  for(const file of files)it(`${file} projects Physics vocabulary and remains byte-identical`,()=>{const original=readFileSync(resolve(EXAMPLES,file),"utf8"),scene=readSceneSource(original);expect(scene.skipped.filter(note=>new RegExp(`\\b(${[...PHYSICS_KINDS,"species","rule","speeds","swing","forces","phase","well","timegraph","energygraph"].join("|")})\\b.*isn't canvas vocabulary yet`,"u").test(note))).toEqual([]);expect(patchSceneSource(original,scene,cloneDoc(scene.doc))).toBe(original);});
});
