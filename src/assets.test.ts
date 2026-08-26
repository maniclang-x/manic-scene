import { describe, expect, it } from "vitest";
import {
  cloneDoc, createEntity, imageSize, patchSceneSource, readSceneSource, serializeSceneFile,
  svgSize, vocabularyEntry,
} from "./index.js";
import type { ImageEntity, SvgEntity } from "./types.js";

const SOURCE = `canvas(1920, 1080);
template("black");

image(photo, (420, 360), "asset:artwork/photo.png");
image(banner, (960, 780), "asset:project/hero/banner.jpg", 640);
svg(icon, (1440, 360), "asset:svg/lucide/star.svg", 180);
`;

describe("image and svg asset entities", () => {
  it("reads optional native dimensions and preserves untouched source exactly", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map((entity) => entity.kind)).toEqual(["image", "image", "svg"]);
    const [photo, banner, icon] = scene.doc.entities as [ImageEntity, ImageEntity, SvgEntity];
    expect(photo).toMatchObject({ path: "asset:artwork/photo.png", width: null, height: null });
    expect(imageSize(photo)).toEqual({ width: 300, height: 300 });
    expect(banner).toMatchObject({ width: 640, height: null });
    expect(imageSize(banner)).toEqual({ width: 640, height: 640 });
    expect(svgSize(icon)).toBe(180);
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
  });

  it("patches only portable URI and authored dimensions", () => {
    const scene = readSceneSource(SOURCE), next = cloneDoc(scene.doc);
    const photo = next.entities[0] as ImageEntity, icon = next.entities[2] as SvgEntity;
    photo.path = "asset:project/abc/new-photo.png";
    photo.width = 500;
    photo.height = 280;
    icon.size = 220;
    const patched = patchSceneSource(SOURCE, scene, next);
    expect(patched).toContain('image(photo, (420, 360), "asset:project/abc/new-photo.png", 500, 280);');
    expect(patched).toContain('svg(icon, (1440, 360), "asset:svg/lucide/star.svg", 220);');
    expect(readSceneSource(patched).skipped).toEqual([]);
  });

  it("serializes native-valid entities and declares honest fidelity", () => {
    const scene = readSceneSource("canvas(1280, 720);\n");
    scene.doc.entities.push({
      id: "photo", kind: "image", layer: "fg", hidden: false, x: 300, y: 300,
      path: "asset:manic-logo.png", width: null, height: null,
    });
    scene.doc.entities.push({
      id: "mark", kind: "svg", layer: "fg", hidden: false, x: 800, y: 300,
      path: "asset:svg/lucide/check.svg", size: null,
    });
    const source = serializeSceneFile(scene.doc);
    expect(source).toContain('image(photo, (300, 300), "asset:manic-logo.png");');
    expect(source).toContain('svg(mark, (800, 300), "asset:svg/lucide/check.svg");');
    expect(vocabularyEntry("image")?.fidelity).toBe("exact");
    expect(vocabularyEntry("svg")?.fidelity).toBe("semantic");
  });

  it("does not add a destructive default color override to newly chosen artwork", () => {
    const scene = readSceneSource("canvas(1280, 720);\n");
    scene.doc.entities.push(createEntity("svg", "art", 640, 360, scene.doc));
    const source = serializeSceneFile(scene.doc);
    expect(source).not.toContain("color(art,");
    expect(source).toContain('svg(art, (640, 360), "asset:svg/lucide/star.svg", 240);');
  });
});
