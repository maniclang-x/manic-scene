import { describe, expect, it } from "vitest";
import {
  camera2Before, camera3Before, cameraViewport, cloneDoc, eyeFromOrbit, guidePixelsToRadius,
  orbitFromPoints, patchSceneSource, radiusToGuidePixels, readSceneSource,
} from "./index.js";

const SOURCE = `canvas(1280,720);
camera3((7,-7,6),(0,0,0),45,perspective);
step("pan") { cam((320,240), 1, smooth); }
step("lens") { zoom(2, 0.8, out); }
step("orbit") { orbit3(60,25,10,1.2,linear); }
step("roll") { roll3(-45,1,smooth); }
`;

describe("camera authoring guides", () => {
  it("derives source-ordered 2D camera keyframes without moving the authoring canvas", () => {
    const doc = readSceneSource(SOURCE).doc;
    expect(camera2Before(doc, { step: 0, index: 0 })).toEqual({ center: { x: 640, y: 360 }, zoom: 1 });
    expect(camera2Before(doc, { step: 1, index: 0 })).toEqual({ center: { x: 320, y: 240 }, zoom: 1 });
    expect(cameraViewport({ center: { x: 320, y: 240 }, zoom: 2 }, { width: 1280, height: 720 })).toEqual({ x: 0, y: 60, width: 640, height: 360 });
  });

  it("uses the same absolute spherical convention as native camera3/orbit3", () => {
    const doc = readSceneSource(SOURCE).doc;
    const initial = camera3Before(doc, { step: 2, index: 0 })!;
    expect(initial.azimuth).toBeCloseTo(-45);
    expect(initial.elevation).toBeCloseTo(31.22, 1);
    expect(initial.radius).toBeCloseTo(Math.sqrt(134));
    expect(camera3Before(doc, { step: 3, index: 0 })).toMatchObject({ azimuth: 60, elevation: 25, radius: 10, roll: 0 });

    const target = { x: 2, y: -1, z: 3 };
    const orbit = { azimuth: 130, elevation: -22, radius: 14, roll: 0 };
    expect(orbitFromPoints(eyeFromOrbit(target, orbit), target)).toMatchObject({
      azimuth: expect.closeTo(130, 8), elevation: expect.closeTo(-22, 8), radius: expect.closeTo(14, 8),
    });
    expect(guidePixelsToRadius(radiusToGuidePixels(10))).toBeCloseTo(10);
  });

  it("writes camera handle changes back as ordinary native Manic source", () => {
    const scene = readSceneSource(SOURCE);
    const next = cloneDoc(scene.doc);
    next.steps[0].actions[0].point = { x: 410, y: 275 };
    next.steps[1].actions[0].amount = 2.4;
    next.steps[2].actions[0].amount = 75;
    next.steps[2].actions[0].values = [35, 12.5];
    next.steps[3].actions[0].amount = 30;
    const patched = patchSceneSource(SOURCE, scene, next);
    expect(patched).toContain("cam((410, 275), 1)");
    expect(patched).toContain("zoom(2.4, 0.8, out)");
    expect(patched).toContain("orbit3(75, 35, 12.5, 1.2, linear)");
    expect(patched).toContain("roll3(30, 1)");
    expect(readSceneSource(patched).skipped).toEqual([]);
  });
});
