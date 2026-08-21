// The projection contract: the canvas shows exactly what's in the file, and
// writing back patches only the statements that changed — comments, blank
// lines, loops, and unsupported vocabulary stay byte-for-byte intact.

import { describe, expect, it } from "vitest";
import { patchSceneSource, readSceneSource } from "./codec.js";
import { cloneDoc } from "./model.js";
import type { TextEntity } from "./types.js";

const FILE = `// How text works — a guide you can watch
title("how text works");
canvas("16:9");
template("black");

// ── 1 · the default ──
text(hello, (640, 300), "one line");
size(hello, 30);
color(hello, fg);
hidden(hello);

dot(anchor1, (640, 300), 4);
color(anchor1, coral);

// a build-time loop the canvas cannot model
for i in 0..6 { hue(spectrum.w{i}, i*54); }

// the run
wait(0.6);
par { show(hello, 0.5); pulse(anchor1, 0.8); }
show(hello, 0.4);
`;

describe("whole-file projection + surgical patching", () => {
  it("projects every supported statement, expanding the loop", () => {
    const scene = readSceneSource(FILE);
    expect(scene.doc.entities.map((entity) => entity.id)).toEqual(["hello", "anchor1"]);
    expect(scene.doc.steps).toHaveLength(3);
    // The for-loop is evaluated now; its hue targets are unknown ids, which
    // warn quietly — nothing is reported as unsupported.
    expect(scene.skipped).toHaveLength(0);
  });

  it("moving an entity rewrites only its statements", () => {
    const scene = readSceneSource(FILE);
    const next = cloneDoc(scene.doc);
    (next.entities[0] as TextEntity).x = 400;
    const updated = patchSceneSource(FILE, scene, next);
    expect(updated).toContain('text(hello, (400, 300), "one line");');
    // Everything else is untouched.
    expect(updated).toContain("// How text works — a guide you can watch");
    expect(updated).toContain('title("how text works");');
    expect(updated).toContain("for i in 0..6 { hue(spectrum.w{i}, i*54); }");
    expect(updated).toContain("// ── 1 · the default ──");
    expect(updated).toContain("par { show(hello, 0.5); pulse(anchor1, 0.8); }");
    expect(updated).toContain("dot(anchor1, (640, 300), 4);");
    // And the projection round-trips.
    const again = readSceneSource(updated);
    expect((again.doc.entities[0] as TextEntity).x).toBe(400);
  });

  it("editing one beat rewrites only that statement, keeping bare form", () => {
    const scene = readSceneSource(FILE);
    const next = cloneDoc(scene.doc);
    next.steps[2].actions[0].dur = 0.9; // the bare `show(hello, 0.4);`
    const updated = patchSceneSource(FILE, scene, next);
    expect(updated).toContain("show(hello, 0.9);");
    expect(updated).not.toContain("show(hello, 0.4);");
    expect(updated.match(/step\(/gu)).toBeNull(); // bare stays bare, no step() introduced
  });

  it("editing an action inside a hand-written par keeps it anonymous", () => {
    const scene = readSceneSource(FILE);
    const next = cloneDoc(scene.doc);
    next.steps[1].actions[0].dur = 0.7;
    const updated = patchSceneSource(FILE, scene, next);
    expect(updated).toContain("par {");
    expect(updated).toContain("show(hello, 0.7);");
    expect(updated).not.toContain("step(");
    expect(updated).toContain("pulse(anchor1, 0.8);");
  });

  it("deleting an entity removes its statements and its beats, nothing else", () => {
    const scene = readSceneSource(FILE);
    const next = cloneDoc(scene.doc);
    next.entities = next.entities.filter((entity) => entity.id !== "anchor1");
    for (const step of next.steps) step.actions = step.actions.filter((action) => action.target !== "anchor1");
    const updated = patchSceneSource(FILE, scene, next);
    expect(updated).not.toContain("anchor1");
    expect(updated).toContain('text(hello, (640, 300), "one line");');
    expect(updated).toContain("for i in 0..6");
    expect(readSceneSource(updated).doc.entities).toHaveLength(1);
  });

  it("adding an entity and a step appends plain manic at the end", () => {
    const scene = readSceneSource(FILE);
    const next = cloneDoc(scene.doc);
    next.entities.push({
      kind: "circle", id: "focus", x: 900, y: 300, r: 80, paint: "default", strokeWidth: null, outlineColor: null,
      color: "cyan", opacity: 1, rotation: 0, reveal: "grow", untraced: false, hue: null,
    });
    next.steps.push({
      name: "Focus", mode: "together", gap: 0.15,
      actions: [{ verb: "show", target: "focus", prop: null, point: null, amount: null, color: null, text: null, dur: 0.5, ease: "overshoot" }],
    });
    const updated = patchSceneSource(FILE, scene, next);
    expect(updated).toContain("circle(focus, (900, 300), 80);");
    expect(updated).toContain("hidden(focus, center);");
    expect(updated).toContain('step("Focus") {');
    const again = readSceneSource(updated);
    expect(again.doc.entities).toHaveLength(3);
    expect(again.doc.steps).toHaveLength(4);
  });

  it("renaming an entity patches its statements and its beats in place", () => {
    const scene = readSceneSource(FILE);
    const next = cloneDoc(scene.doc);
    (next.entities[0] as TextEntity).id = "greeting";
    for (const step of next.steps) for (const action of step.actions) if (action.target === "hello") action.target = "greeting";
    const updated = patchSceneSource(FILE, scene, next);
    expect(updated).toContain('text(greeting, (640, 300), "one line");');
    expect(updated).toContain("show(greeting, 0.4);");
    expect(updated).not.toMatch(/\bhello\b/u);
    expect(updated).toContain("for i in 0..6");
  });

  it("changing the template patches the existing statement", () => {
    const scene = readSceneSource(FILE);
    const next = cloneDoc(scene.doc);
    next.template = "paper";
    const updated = patchSceneSource(FILE, scene, next);
    expect(updated).toContain('template("paper");');
    expect(updated).not.toContain('template("black");');
    expect(updated.match(/template\(/gu)).toHaveLength(1);
  });

  it("no change produces the identical file", () => {
    const scene = readSceneSource(FILE);
    expect(patchSceneSource(FILE, scene, cloneDoc(scene.doc))).toBe(FILE);
  });
});

describe("expression-preserving edits (computed entities)", () => {
  const VARS = `let gx = cx - 340;
canvas(1000, 1000);

equation(eqR, (cx, 190), \`S_8\`, 40);
color(eqR, fg);
circle(conf, (gx + 100, cy), 60);
color(conf, cyan);
show(eqR, 0.5);
`;

  it("drags write deltas onto the original expressions", () => {
    const scene = readSceneSource(VARS);
    const eq = scene.doc.entities[0];
    expect(eq).toMatchObject({ origin: "computed", x: 500, y: 190 });
    const next = cloneDoc(scene.doc);
    const moved = next.entities[0] as { x: number; y: number };
    moved.x = 360; // drag left by 140
    moved.y = 210; // and down by 20
    const updated = patchSceneSource(VARS, scene, next);
    expect(updated).toContain("equation(eqR, (cx - 140, 210), `S_8`, 40);");
    expect(updated).toContain("let gx = cx - 340;");
    expect(updated).toContain("circle(conf, (gx + 100, cy), 60);");
    const again = readSceneSource(updated);
    expect(again.doc.entities[0]).toMatchObject({ x: 360, y: 210, origin: "computed" });
  });

  it("keeps composite expressions and appends only the delta", () => {
    const scene = readSceneSource(VARS);
    const next = cloneDoc(scene.doc);
    const conf = next.entities[1] as { x: number; y: number; r: number };
    conf.x += 25;
    conf.r = 80; // non-position field bakes to a literal — that's the edit
    const updated = patchSceneSource(VARS, scene, next);
    expect(updated).toContain("circle(conf, (gx + 100 + 25, cy), 80);");
    const again = readSceneSource(updated);
    expect(again.doc.entities[1]).toMatchObject({ x: 285, r: 80 }); // gx + 100 + 25 = (500-340) + 125
  });

  it("unchanged computed entities stay byte-identical", () => {
    const scene = readSceneSource(VARS);
    expect(patchSceneSource(VARS, scene, cloneDoc(scene.doc))).toBe(VARS);
  });
});
