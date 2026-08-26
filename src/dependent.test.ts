import { describe, expect, it } from "vitest";
import {
  cloneDoc, entityBounds, entityReferences, patchSceneSource, readSceneSource, referenceIds, replaceEntityReference,
} from "./index.js";
import type {
  BraceEntity, BraceLabelEntity, FrameboxEntity, LabelEntity, LinkEntity, MathPartsEntity, ParticlesEntity, RectEntity,
} from "./types.js";

const SOURCE = `// dependency vocabulary must remain ordinary Manic
canvas(1280, 720);
template("black");

circle(node, (260, 280), 70);
rect(panel, (760, 280), 260, 160);
label(node, "source", (0, -105));
link(edge, node, panel, 30);
framebox(focus, node, 12, gold);
brace(span, (180, 500), (420, 500), 28, down);
bracelabel(measure, (500, 500), (760, 500), "width", 24);
bracetext(note, (800, 500), (1080, 500), "explanation", -26);
mathparts(eq, (640, 110), \`a^2\`, \`+\`, \`b^2\`, 42);
color(eq.1, red);
hidden(eq.2);
particles(dots, panel, 8, 5, 17, "grid");
color(dots, cyan);

show(eq.0, 0.4);
`;

describe("dependency-aware core entities", () => {
  it("projects all eight logical entities and their virtual children", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map((entity) => entity.kind)).toEqual([
      "circle", "rect", "label", "link", "framebox", "brace", "bracelabel", "bracetext", "mathparts", "particles",
    ]);
    const label = scene.doc.entities[2] as LabelEntity;
    expect(label).toMatchObject({ id: "node.label", target: "node", text: "source", dx: 0, dy: -105 });
    expect(entityReferences(label)).toEqual(["node"]);
    const math = scene.doc.entities[8] as MathPartsEntity;
    expect(referenceIds(math)).toEqual(["eq.0", "eq.1", "eq.2"]);
    expect(math.parts[1]).toMatchObject({ latex: "+", color: "red" });
    expect(math.parts[2].reveal).toBe("fade");
    expect(referenceIds(scene.doc.entities[9])).toHaveLength(8);
  });

  it("is byte-identical when the projected document is unchanged", () => {
    const scene = readSceneSource(SOURCE);
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
  });

  it("patches edits to every new entity while preserving unrelated source", () => {
    const scene = readSceneSource(SOURCE);
    const next = cloneDoc(scene.doc);
    (next.entities[2] as LabelEntity).text = "origin";
    (next.entities[3] as LinkEntity).bend = -45;
    (next.entities[4] as FrameboxEntity).buff = 20;
    (next.entities[5] as BraceEntity).depth = 36;
    (next.entities[6] as BraceLabelEntity).text = "distance";
    (next.entities[7] as BraceLabelEntity).text = "long explanation";
    (next.entities[8] as MathPartsEntity).parts[0].latex = "x^2";
    (next.entities[9] as ParticlesEntity).count = 12;
    const updated = patchSceneSource(SOURCE, scene, next);
    expect(updated).toContain("// dependency vocabulary must remain ordinary Manic");
    expect(updated).toContain('label(node, "origin", (0, -105));');
    expect(updated).toContain("link(edge, node, panel, -45);");
    expect(updated).toContain("framebox(focus, node, 20, gold);");
    expect(updated).toContain("brace(span, (180, 500), (420, 500), 36, down);");
    expect(updated).toContain('bracelabel(measure, (500, 500), (760, 500), "distance", 24);');
    expect(updated).toContain('bracetext(note, (800, 500), (1080, 500), "long explanation", -26);');
    expect(updated).toContain("mathparts(eq, (640, 110), `x^2`, `+`, `b^2`, 42);");
    expect(updated).toContain('particles(dots, panel, 12, 5, 17, "grid");');
    const again = readSceneSource(updated);
    expect(again.skipped).toEqual([]);
  });

  it("recomputes dependent geometry when its target moves", () => {
    const scene = readSceneSource(SOURCE);
    const labelBefore = entityBounds(scene.doc.entities[2], scene.doc);
    const frameBefore = entityBounds(scene.doc.entities[4], scene.doc);
    const particlesBefore = entityBounds(scene.doc.entities[9], scene.doc);
    const next = cloneDoc(scene.doc);
    const node = next.entities[0] as { x: number; y: number };
    node.x += 100;
    node.y += 40;
    const panel = next.entities[1] as RectEntity;
    panel.x -= 50;
    expect(entityBounds(next.entities[2], next).x - labelBefore.x).toBe(100);
    expect(entityBounds(next.entities[2], next).y - labelBefore.y).toBe(40);
    expect(entityBounds(next.entities[4], next).x - frameBefore.x).toBe(100);
    expect(entityBounds(next.entities[9], next).x - particlesBefore.x).toBe(-50);
  });

  it("rewrites dependency references and derived label identity on rename", () => {
    const scene = readSceneSource(SOURCE);
    const draft = cloneDoc(scene.doc);
    for (const entity of draft.entities) replaceEntityReference(entity, "node", "sourceNode");
    expect((draft.entities[2] as LabelEntity)).toMatchObject({ id: "sourceNode.label", target: "sourceNode" });
    expect((draft.entities[3] as LinkEntity).from).toBe("sourceNode");
    expect((draft.entities[4] as FrameboxEntity).target).toBe("sourceNode");
  });

  it("reports a missing dependency without dropping the entity", () => {
    const scene = readSceneSource("link(edge, absentA, absentB);\n");
    expect(scene.doc.entities).toHaveLength(1);
    expect(scene.skipped.join(" ")).toContain("depends on missing entity or group");
  });
});
