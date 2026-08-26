import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  beatAvailability, beatTargetOptions, canvasAnnotations, cloneDoc, createEntity,
  domainColorSamples, leastSquaresGeometry, patchSceneSource, readSceneSource,
  referenceIds, serializeSceneFile, tableGrid, tableLayout, vectorFieldShape,
  verbPropertyOptions, vocabularyAvailability, vocabularyEntry, warpLines,
} from "./index.js";
import type { DomainColorEntity, LeastSquaresEntity, PieEntity, TableEntity, VectorFieldEntity, WarpEntity } from "./types.js";

const SOURCE=`canvas("16:9");
template("black");
field(potential, "sin(x) * exp(-0.2*(x*x+y*y))");
arrowfield(named, (220, 230), 160, 100, swirl, 9);
vectorfield(formula, (560, 230), 160, 100, "-y", "x", 9);
colorwheel(wheel, (850, 190), 70);
domaincolor(domain, (1080, 200), 260, 180, "z*z+1", 4);
warp(warped, (300, 530), 45, "z*z", 2.5, 20);
table(data, "1 2; 3 4", (620, 500), 90, 54, "A B", "X Y");
mathtable(mathdata, "x y; z w", (850, 470));
integertable(intdata, "1 2; 3 4", (1030, 470));
decimaltable(decdata, "1.2 2.4; 3.6 4.8", (1180, 470));
pie(parts, (770, 650), 70, 4);
leastsquares(fit, (1030, 650), 28, "1 2 2 3 3 5 4 4", cyan);
untraced(data.lines);
hidden(data.labels);
untraced(parts0);
hidden(fit.points);
untraced(fit.line);
step("Animate") { to(warped, morph, 1, 1.4); draw(parts0, 0.3); show(data.labels, 0.3); }
`;

describe("remaining Math fields and data vocabulary",()=>{
  it("projects all twelve catalog names, preserves aliases, and round-trips",()=>{
    const scene=readSceneSource(SOURCE);expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map(entity=>entity.kind)).toEqual(["scalarfield","vectorfield","vectorfield","colorwheel","domaincolor","warp","table","table","table","table","pie","leastsquares"]);
    expect((scene.doc.entities[1] as VectorFieldEntity).spelling).toBe("arrowfield");
    expect(scene.doc.entities.slice(6,10).map(entity=>(entity as TableEntity).spelling)).toEqual(["table","mathtable","integertable","decimaltable"]);
    expect(patchSceneSource(SOURCE,scene,cloneDoc(scene.doc))).toBe(SOURCE);
    const generated=serializeSceneFile(scene.doc),reparsed=readSceneSource(generated);expect(reparsed.skipped).toEqual([]);expect(reparsed.doc).toEqual(scene.doc);
  });

  it("computes bounded vector, complex, table, pie, and regression geometry",()=>{
    const scene=readSceneSource(SOURCE),named=vectorFieldShape(scene.doc.entities[1] as VectorFieldEntity),formula=vectorFieldShape(scene.doc.entities[2] as VectorFieldEntity);
    expect(named.issue).toBeNull();expect(named.arrows).toHaveLength(named.rows*named.columns);expect(formula.arrows).toHaveLength(formula.rows*formula.columns);
    expect(domainColorSamples(scene.doc.entities[4] as DomainColorEntity)).toHaveLength(28*Math.round(28*180/260));
    const warped=warpLines(scene.doc.entities[5] as WarpEntity);expect(warped.issue).toBeNull();expect(warped.lines).toHaveLength(10);
    const grid=tableGrid(scene.doc.entities[6] as TableEntity),layout=tableLayout(scene.doc.entities[6] as TableEntity);expect(grid.issue).toBeNull();expect(layout).toMatchObject({gridRows:3,gridColumns:3,width:270,height:162});
    const regression=leastSquaresGeometry(scene.doc.entities[11] as LeastSquaresEntity);expect(regression.issue).toBeNull();expect(regression.geometry?.points).toHaveLength(4);expect(regression.geometry?.slope).toBeCloseTo(.8);
  });

  it("treats field declarations honestly and exposes native morph/child targets",()=>{
    const scene=readSceneSource(SOURCE),field=scene.doc.entities[0],warp=scene.doc.entities[5];
    expect(beatAvailability(scene.doc,"show",field.id).enabled).toBe(false);
    expect(vocabularyAvailability(vocabularyEntry("glow")!,scene.doc,field.id).enabled).toBe(false);
    expect(canvasAnnotations(field,scene.doc)[0]).toMatchObject({id:"scalar-field-declaration",representation:"semantic"});
    expect(canvasAnnotations(warp,scene.doc)[0]).toMatchObject({id:"warp-morph",representation:"semantic"});
    expect(verbPropertyOptions("to",warp)).toContain("morph");
    const targets=beatTargetOptions(scene.doc,"show").map(option=>option.id);
    expect(targets).toEqual(expect.arrayContaining(["data.labels","data.r1c1","parts0","fit.points","fit.eq"]));
  });

  it("retains generated-child modifiers and indexes native identities",()=>{
    const scene=readSceneSource(SOURCE),table=scene.doc.entities[6] as TableEntity,pie=scene.doc.entities[10] as PieEntity,fit=scene.doc.entities[11] as LeastSquaresEntity;
    expect(table.childStyles).toMatchObject({"data.lines":{untraced:true},"data.labels":{reveal:"fade"}});
    expect(pie.childStyles).toMatchObject({parts0:{untraced:true}});
    expect(fit.childStyles).toMatchObject({"fit.points":{reveal:"fade"},"fit.line":{untraced:true}});
    expect(referenceIds(table)).toEqual(expect.arrayContaining(["data.entries","data.labels","data.row1","data.col1","data.r1c1","data.h3","data.v3"]));
    expect(referenceIds(pie)).toEqual(["parts0","parts1","parts2","parts3"]);
    expect(referenceIds(fit)).toEqual(expect.arrayContaining(["fit.line","fit.points","fit.residuals","fit.eq","fit.p3","fit.r3"]));
  });

  it("serializes Canvas-created defaults and surgically edits every family",()=>{
    const empty=readSceneSource('canvas("16:9");\ntemplate("black");\n').doc;
    for(const kind of ["scalarfield","vectorfield","colorwheel","domaincolor","warp","table","pie","leastsquares"] as const)empty.entities.push(createEntity(kind,kind,640,360,empty));
    const generated=serializeSceneFile(empty),reparsed=readSceneSource(generated);expect(reparsed.skipped).toEqual([]);expect(reparsed.doc).toEqual(empty);
    const scene=readSceneSource(SOURCE),next=cloneDoc(scene.doc);(next.entities[0] as never as {formula:string}).formula="x*x+y*y";(next.entities[1] as VectorFieldEntity).namedField="radial";(next.entities[4] as DomainColorEntity).formula="1/z";(next.entities[5] as WarpEntity).formula="(1+i)*z";(next.entities[6] as TableEntity).source="5 6; 7 8";(next.entities[10] as PieEntity).slices=6;(next.entities[11] as LeastSquaresEntity).source="0 1 1 3 2 5";
    const patched=patchSceneSource(SOURCE,scene,next);for(const snippet of ['field(potential, "x*x+y*y")','arrowfield(named, (220, 230), 160, 100, radial','domaincolor(domain, (1080, 200), 260, 180, "1/z"','warp(warped, (300, 530), 45, "(1+i)*z"','table(data, "5 6; 7 8"','pie(parts, (770, 650), 70, 6)','leastsquares(fit, (1030, 650), 28, "0 1 1 3 2 5"'])expect(patched).toContain(snippet);
    expect(patched).toContain("untraced(data.lines);");expect(patched).toContain("hidden(fit.points);");expect(readSceneSource(patched).skipped).toEqual([]);
  });

  for(const name of ["arrowfield","vectorfield","field","colorwheel","domaincolor","warp","table","mathtable","integertable","decimaltable","pie","leastsquares"])it(`${name} is no longer Source-only`,()=>expect(vocabularyEntry(name)).toEqual(expect.objectContaining({fidelity:expect.not.stringMatching("source-only")})));
});

const EXAMPLES=resolve(import.meta.dirname,"../../../manic/examples");
describe.skipIf(!existsSync(EXAMPLES))("remaining Math representative acceptance",()=>{
  for(const [file,names] of [["vector_field.manic",["arrowfield"]],["3b1b-eval/warp-grid.manic",["warp"]],["3b1b-eval/zeta.manic",["domaincolor","colorwheel"]],["field-many-views.manic",["field"]],["table.manic",["table"]],["pie.manic",["pie"]],["projection.manic",["leastsquares"]]] as const)it(`${file} identity-patches with its Math vocabulary onboarded`,()=>{const source=readFileSync(resolve(EXAMPLES,file),"utf8"),scene=readSceneSource(source);for(const name of names)expect(scene.skipped.some(note=>note.includes(`\`${name}\` isn't canvas vocabulary yet`)),name).toBe(false);expect(patchSceneSource(source,scene,cloneDoc(scene.doc))).toBe(source);});
});
