import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allEntityDefs, allVerbDefs, allVocabularyEntries, beatAvailability, canvasAnnotations, cloneDoc,
  patchSceneSource, readSceneSource, referenceIds, serializeSceneFile, systemConnectionGeometry,
  systemDiagramFor, systemItemBox, type SystemConnectionEntity, type SystemMessageEntity,
} from "./index.js";

const source=`title("Systems kit");
canvas("16:9");
architecture(platform, (640, 380), 1120, 470);
node(user, platform, "client", "User");
cluster(services, platform, "SERVICES");
node(api, services, "service", "API");
node(db, platform, "database", "Database");
connect(toApi, user, api, 65);
connect(toDb, api, db, orthogonal, right, left);
annotate(toDb, "Writes [SQL]");
message(job, user, "BUY");
request(call, user, "GET");
flowchart(flow, TD, 8);
node(start, flow, "terminator", "Start");
node(decide, flow, "decision", "Valid?");
connect(next, start, decide);
request(cursor, start, "1");
c4(components, component);
node(controller, components, "component", "Controller", "Handles requests", "Spring MVC");
node(store, components, "external", "Store", "Persists data");
connect(uses, controller, store);
annotate(uses, "Uses [JDBC]");
route(job, toApi, 0.7, linear);
route(job, toDb, 0.8);
hotpath(call, 4, 9);
`;

describe("Systems and architecture kit onboarding",()=>{
  it("registers all eight visual entities, one dependent annotation, and two runtime verbs",()=>{
    const defs=allEntityDefs().filter(def=>def.group==="Systems");expect(defs).toHaveLength(8);
    expect(new Set(defs.map(def=>def.ctor))).toEqual(new Set(["architecture","flowchart","c4","node","cluster","connect","message","request"]));
    const vocabulary=allVocabularyEntries().filter(entry=>entry.kit==="systems");expect(vocabulary).toHaveLength(11);expect(vocabulary.every(entry=>entry.fidelity==="semantic")).toBe(true);
    const verbs=new Set(allVerbDefs().map(def=>def.name));for(const name of ["route","hotpath"])expect(verbs.has(name),name).toBe(true);
  });

  it("folds annotations into their connection and keeps messages as one persistent entity",()=>{
    const scene=readSceneSource(source);expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.filter(entity=>entity.kind==="connect")).toHaveLength(4);
    expect(scene.doc.entities.some(entity=>entity.id==="toDb.text")).toBe(false);
    expect(scene.doc.entities.find(entity=>entity.id==="toDb")).toMatchObject({kind:"connect",routing:"orthogonal",fromPort:"right",toPort:"left",annotation:"Writes [SQL]"});
    expect(scene.doc.entities.find(entity=>entity.id==="controller")).toMatchObject({kind:"node",parent:"components",nodeKind:"component",description:"Handles requests",technology:"Spring MVC"});
    expect(scene.doc.steps.flatMap(step=>step.actions).filter(action=>["route","hotpath"].includes(action.verb))).toHaveLength(3);
  });

  it("serializes native contracts, generated children, and Story controls",()=>{
    const scene=readSceneSource(source),text=serializeSceneFile(scene.doc),edge=scene.doc.entities.find((entity):entity is SystemConnectionEntity=>entity.id==="toDb")!,message=scene.doc.entities.find((entity):entity is SystemMessageEntity=>entity.id==="job")!;
    expect(text).toContain("architecture(platform, (640, 380), 1120, 470);");expect(text).toContain("connect(toDb, api, db, orthogonal, right, left);");expect(text).toContain('annotate(toDb, "Writes [SQL]");');expect(text).toContain("route(job, toApi, 0.7, linear);");expect(text).toContain("hotpath(call, 4, 9);");
    expect(referenceIds(edge)).toEqual(expect.arrayContaining(["toDb.path","toDb.hot","toDb.body","toDb.arrow","toDb.text"]));expect(referenceIds(message)).toEqual(expect.arrayContaining(["job.token","job.label","job.parts"]));
  });

  it("derives bounded nested layout and honest connection/message semantics",()=>{
    const scene=readSceneSource(source),api=systemItemBox("api",scene.doc)!,services=systemItemBox("services",scene.doc)!,edge=scene.doc.entities.find((entity):entity is SystemConnectionEntity=>entity.id==="toDb")!,job=scene.doc.entities.find(entity=>entity.id==="job")!;
    expect(api.x).toBeGreaterThanOrEqual(services.x);expect(api.y).toBeGreaterThanOrEqual(services.y);expect(api.x+api.width).toBeLessThanOrEqual(services.x+services.width);expect(api.y+api.height).toBeLessThanOrEqual(services.y+services.height);
    expect(systemConnectionGeometry(edge,scene.doc).points).toHaveLength(4);expect(systemDiagramFor("api",scene.doc)?.id).toBe("platform");
    expect(beatAvailability(scene.doc,"route",job.id).enabled).toBe(true);expect(beatAvailability(scene.doc,"hotpath",job.id).enabled).toBe(true);expect(beatAvailability(scene.doc,"route","api").enabled).toBe(false);
    expect(canvasAnnotations(job,scene.doc).find(note=>note.id==="systems-message")).toMatchObject({representation:"semantic",detail:expect.stringContaining("persistent identity")});
  });
});

const EXAMPLES=resolve(import.meta.dirname,"../../../manic/examples"),names=["architecture","flowchart","c4","node","cluster","connect","annotate","message","request","route","hotpath"],systemsPattern=new RegExp(`^\\s*(?:${names.join("|")})\\s*\\(`,"mu");
describe.skipIf(!existsSync(EXAMPLES))("native Systems examples",()=>{
  const files=(readdirSync(EXAMPLES,{recursive:true}) as string[]).filter(file=>file.endsWith(".manic")&&systemsPattern.test(readFileSync(resolve(EXAMPLES,file),"utf8")));
  for(const file of files)it(`${file} projects Systems vocabulary and remains byte-identical`,()=>{const original=readFileSync(resolve(EXAMPLES,file),"utf8"),scene=readSceneSource(original);expect(scene.skipped.filter(note=>new RegExp(`\\b(?:${names.join("|")})\\b.*isn't canvas vocabulary yet`,"u").test(note))).toEqual([]);expect(patchSceneSource(original,scene,cloneDoc(scene.doc))).toBe(original);});
});
