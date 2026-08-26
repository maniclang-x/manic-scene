import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canvasAnnotations, cloneDoc, cloud3Samples, cloudSamples, defFor, entityReferences, glslUniforms, patchSceneSource, readSceneSource, replaceEntityReference, shaderSamples, vocabularyEntry } from "./index.js";
import type { Cloud3Entity, CloudEntity, GlslEntity, ShaderEntity } from "./types.js";

const SOURCE = `canvas(1280, 720);
template("black");
let ox = 400;
parameter(p, (100, 680), 0.5, 0, 1, "spread", 2);
cloud(field, 12000, cyan, 0.7) {
  let a = i/12000*tau;
  let x = ox + 200*p*cos(a+t);
  let y = cy + 160*p*sin(a+t);
  let r = 2;
  let hue = mod(i*0.1, 360);
}
camera3((0,0,10),(0,0,0),8,orthographic);
cloud3(orb, 2000, #ffffff, 0.9) {
  let a = i/2000*tau;
  let x = 3*cos(a+t);
  let y = 3*sin(a+t);
  let z = sin(a*3);
  let r = 0.05;
}
shader(panel, (960, 180), 500, 260) {
  let r = u;
  let g = v;
  let b = 0.5 + 0.5*sin(t);
}
`;

describe("generative field authoring", () => {
  it("projects block constructors and produces bounded deterministic design samples", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map((entity) => entity.kind)).toEqual(["parameter", "cloud", "camera3", "cloud3", "shader"]);
    const cloud = scene.doc.entities[1] as CloudEntity;
    const cloud3 = scene.doc.entities[3] as Cloud3Entity;
    const shader = scene.doc.entities[4] as ShaderEntity;
    expect(cloud).toMatchObject({ count: 12000, pointOpacity: .7, source: null });
    expect(cloud.variables.ox).toBe(400);
    expect(cloudSamples(cloud, scene.doc)).toHaveLength(600);
    expect(cloudSamples(cloud, scene.doc)[0]).toMatchObject({ x: 500, y: 360, radius: 2 });
    expect(cloud3Samples(cloud3, scene.doc)).toHaveLength(600);
    expect(shaderSamples(shader, scene.doc).length).toBeGreaterThan(200);
    expect(canvasAnnotations(cloud, scene.doc)[0]).toMatchObject({ id: "cloud-sample", representation: "semantic" });
    expect(canvasAnnotations(shader, scene.doc)[0]).toMatchObject({ id: "shader-sample" });
    expect(vocabularyEntry("cloud")).toMatchObject({ kind: "entity", fidelity: "semantic" });
    expect(vocabularyEntry("cloud3")).toMatchObject({ kind: "entity", fidelity: "semantic" });
    expect(vocabularyEntry("shader")).toMatchObject({ kind: "entity", fidelity: "semantic" });
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
  });

  it("patches formula, count, opacity, and shader region as ordinary Manic", () => {
    const scene = readSceneSource(SOURCE);
    const next = cloneDoc(scene.doc);
    const cloud = next.entities[1] as CloudEntity;
    cloud.count = 900;
    cloud.pointOpacity = .45;
    cloud.program = "let x = cx + i/10;\nlet y = cy;\nlet r = 3;";
    const shader = next.entities[4] as ShaderEntity;
    shader.fullCanvas = true;
    const updated = patchSceneSource(SOURCE, scene, next);
    expect(updated).toContain("cloud(field, 900, cyan, 0.45) {");
    expect(updated).toContain("  let x = cx + i/10;");
    expect(updated).toContain("shader(panel) {");
    const again = readSceneSource(updated);
    expect(again.skipped).toEqual([]);
    expect((again.doc.entities[1] as CloudEntity).program).toContain("let r = 3;");
    expect(patchSceneSource(updated, again, cloneDoc(again.doc))).toBe(updated);
  });

  it("keeps native cloud home providers honest and source-safe", () => {
    const source = `canvas(1080,1080); cloud(word,1800,#fff,0.95) from text("MANIC") { let x=hx; let y=hy; }`;
    const scene = readSceneSource(source);
    expect(scene.skipped).toEqual([]);
    const cloud = scene.doc.entities[0] as CloudEntity;
    expect(cloud.source).toBe('text("MANIC")');
    expect(cloudSamples(cloud, scene.doc)).toEqual([]);
    expect(canvasAnnotations(cloud, scene.doc)[0].detail).toContain("home-point relationship");
    expect(patchSceneSource(source, scene, cloneDoc(scene.doc))).toBe(source);
  });

  it("onboards raw GLSL as source-backed GPU semantics with live uniform relationships", () => {
    const source = `canvas("16:9");
parameter(freq, (640, 680), 3, 1, 16, "freq", 0);
glsl(scene, \`
uniform float u_freq;
uniform vec3 iCamEye;
uniform float u_missing;
void mainImage(out vec4 o, in vec2 fc) {
  float u_frequency = 2.0;
  o = vec4(vec3(sin(fc.x*u_freq + iTime)), 1.0);
}
\`);
show(scene, 0.4);
`;
    const scene = readSceneSource(source);
    expect(scene.skipped).toEqual([]);
    const glsl = scene.doc.entities[1] as GlslEntity;
    expect(glsl.kind).toBe("glsl");
    expect(glsl.source).toContain("void mainImage");
    expect(glslUniforms(glsl, scene.doc)).toEqual([
      { name: "u_freq", binding: "parameter", target: "freq" },
      { name: "iCamEye", binding: "camera", target: "__camera3" },
      { name: "u_missing", binding: "unbound", target: null },
    ]);
    expect(entityReferences(glsl)).toEqual([]);
    expect(canvasAnnotations(glsl, scene.doc)[0]).toMatchObject({ id: "glsl-preview", representation: "semantic", tone: "warning", refs: ["freq", "missing", "__camera3"] });
    expect(defFor(glsl).fields.map((field) => field.key)).toEqual(["source"]);
    expect(vocabularyEntry("glsl")).toMatchObject({ kind: "entity", fidelity: "semantic" });
    expect(vocabularyEntry("shaders")).toBeUndefined();
    expect(patchSceneSource(source, scene, cloneDoc(scene.doc))).toBe(source);

    const next = cloneDoc(scene.doc);
    next.entities[0].id = "speed";
    const edited = next.entities[1] as GlslEntity;
    replaceEntityReference(edited, "freq", "speed", "parameter");
    expect(edited.source).toContain("fc.x*u_speed");
    expect(edited.source).toContain("u_frequency = 2.0");
    replaceEntityReference(edited, "speed", "wrong", "circle");
    expect(edited.source).toContain("fc.x*u_speed");
    const updated = patchSceneSource(source, scene, next);
    expect(updated).toContain("uniform float u_speed;");
    expect(readSceneSource(updated).skipped).toEqual([]);
  });
});

const EXAMPLES = resolve(import.meta.dirname, "../../../manic/examples");
const ACCEPTANCE = ["cloud-wave-lattice.manic", "cloud3-ripple.manic", "shader-patterns.manic", "art-rakkan-v2.manic", "exponential-shells.manic"];

describe.skipIf(!existsSync(EXAMPLES))("generative corpus acceptance", () => {
  it("onboards representative and stress scenes without constructor skips", () => {
    for (const file of ACCEPTANCE) {
      const source = readFileSync(resolve(EXAMPLES, file), "utf8");
      const scene = readSceneSource(source);
      expect(scene.skipped.filter((note) => /`(?:cloud|cloud3|shader)`/u.test(note)), file).toEqual([]);
      expect(scene.doc.entities.some((entity) => ["cloud", "cloud3", "shader"].includes(entity.kind)), file).toBe(true);
      const sampled = scene.doc.entities.filter((entity) => ["cloud", "cloud3", "shader"].includes(entity.kind)).some((entity) => {
        if (entity.kind === "cloud") return entity.source !== null || cloudSamples(entity, scene.doc, 0, 32).length > 0;
        if (entity.kind === "cloud3") return cloud3Samples(entity, scene.doc, 0, 32).length > 0;
        return entity.kind === "shader" && shaderSamples(entity, scene.doc).length > 0;
      });
      expect(sampled, `${file}: no bounded Canvas sample could be evaluated`).toBe(true);
      expect(patchSceneSource(source, scene, cloneDoc(scene.doc)), file).toBe(source);
    }
  });

  it("preserves representative raw GLSL scenes without constructor skips", () => {
    for (const file of ["glsl-parameter.manic", "glsl-crt-patterns.manic", "glsl-seascape.manic"]) {
      const source = readFileSync(resolve(EXAMPLES, file), "utf8");
      const scene = readSceneSource(source);
      expect(scene.skipped.filter((note) => /`glsl`/u.test(note)), file).toEqual([]);
      expect(scene.doc.entities.some((entity) => entity.kind === "glsl"), file).toBe(true);
      expect(patchSceneSource(source, scene, cloneDoc(scene.doc)), file).toBe(source);
    }
  });
});
