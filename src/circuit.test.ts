import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { allEntityDefs, allVerbDefs, allVocabularyEntries, beatAvailability, canvasAnnotations, circuitGeometry, circuitPartAnchor, cloneDoc, patchSceneSource, readSceneSource, referenceIds, serializeSceneFile, type CircuitEntity } from "./index.js";

const source=`title("Circuit kit");
canvas("16:9");
circuit(fig, (560, 330), \`
  dc-voltage 0 4 0 0 v=9 name=V1
  resistor   0 0 4 0 r=1k name=R1
  wire       4 0 4 4 name=RET
  wire       4 4 0 4
\`, 52, 1, 0.25);
current(fig, 1.6, diamond, crimson, 4);
probe(fig, R1, (30, -20));
probe(fig, (0, 0));
scope(fig, R1, (980, 300), 320, 150);
cut(fig, R1, 0.8);
run(fig, 4);
reconnect(fig, R1, 0.8);
color(fig.R1, magenta);
`;

describe("Circuit kit onboarding",()=>{
  it("registers the complete six-builtin kit",()=>{
    expect(allEntityDefs().filter(def=>def.group==="Circuit").map(def=>def.ctor)).toEqual(["circuit"]);
    const vocabulary=allVocabularyEntries().filter(entry=>entry.kit==="circuit");expect(vocabulary).toHaveLength(6);expect(vocabulary.every(entry=>entry.fidelity==="semantic")).toBe(true);
    const verbs=new Set(allVerbDefs().map(def=>def.name));for(const name of ["run","cut","reconnect"])expect(verbs.has(name),name).toBe(true);
  });

  it("folds current, probes, and scopes into one circuit owner",()=>{
    const scene=readSceneSource(source);expect(scene.skipped).toEqual([]);expect(scene.doc.entities).toHaveLength(1);
    const circuit=scene.doc.entities[0] as CircuitEntity;expect(circuit).toMatchObject({kind:"circuit",unit:52,labels:true,build:.25,currentStyle:{speed:1.6,shape:"diamond",color:"crimson",size:4}});expect(circuit.probes).toHaveLength(2);expect(circuit.scopes).toHaveLength(1);
    expect(scene.doc.steps.flatMap(step=>step.actions).map(action=>action.verb)).toEqual(["cut","run","reconnect"]);
  });

  it("serializes all native declarations and stable generated references",()=>{
    const scene=readSceneSource(source),circuit=scene.doc.entities[0] as CircuitEntity,text=serializeSceneFile(scene.doc);expect(text).toContain("current(fig, 1.6, diamond, crimson, 4);");expect(text).toContain("probe(fig, R1, (30, -20));");expect(text).toContain("scope(fig, R1, (980, 300), 320, 150);");expect(text).toContain("cut(fig, R1, 0.8);");expect(referenceIds(circuit)).toEqual(expect.arrayContaining(["fig.parts","fig.nodes","fig.labels","fig.charge","fig.glow","fig.R1","fig.c1","fig.c1.value"]));
  });

  it("derives bounded topology and exposes only honest simulation controls",()=>{
    const scene=readSceneSource(source),circuit=scene.doc.entities[0] as CircuitEntity,geometry=circuitGeometry(circuit);expect(geometry.parts).toHaveLength(4);expect(geometry.bounds.width).toBeGreaterThan(100);expect(circuitPartAnchor(circuit,"R1")).not.toBeNull();
    expect(beatAvailability(scene.doc,"run","fig").enabled).toBe(true);expect(beatAvailability(scene.doc,"cut","fig").enabled).toBe(true);expect(beatAvailability(scene.doc,"cut","missing").enabled).toBe(false);
    expect(canvasAnnotations(circuit,scene.doc).find(note=>note.id==="circuit-contract")).toMatchObject({representation:"semantic",tone:"info",detail:expect.stringContaining("MNA")});
  });
});

const EXAMPLES=resolve(import.meta.dirname,"../../../manic/examples"),pattern=/^\s*(?:circuit|probe|current|cut|reconnect|scope)\s*\(/mu;
describe.skipIf(!existsSync(EXAMPLES))("native Circuit examples",()=>{
  const files=(readdirSync(EXAMPLES,{recursive:true}) as string[]).filter(file=>file.endsWith(".manic")&&pattern.test(readFileSync(resolve(EXAMPLES,file),"utf8")));
  it("finds the four native Circuit examples",()=>expect(files).toHaveLength(4));
  for(const file of files)it(`${file} projects Circuit vocabulary and remains byte-identical`,()=>{const original=readFileSync(resolve(EXAMPLES,file),"utf8"),scene=readSceneSource(original);expect(scene.skipped.filter(note=>/\b(?:circuit|probe|current|cut|reconnect|scope)\b.*isn't canvas vocabulary yet/u.test(note))).toEqual([]);expect(patchSceneSource(original,scene,cloneDoc(scene.doc))).toBe(original);});
});
