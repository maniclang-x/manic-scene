// Pure camera-authoring math. These helpers describe source intent for Canvas
// gizmos; they never attempt to render or play the native camera animation.

import { docSize, stepActions } from "./model.js";
import type { Camera3Entity, CanvasSize, Point3, SceneAction, SceneDoc } from "./types.js";

export interface ActionSelection { step: number; index: number; }
export interface Camera2State { center: { x: number; y: number }; zoom: number; }
export interface Camera3State { azimuth: number; elevation: number; radius: number; roll: number; }
export interface CameraViewport { x: number; y: number; width: number; height: number; }

export function camera2Initial(size: CanvasSize): Camera2State {
  return { center: { x: size.width / 2, y: size.height / 2 }, zoom: 1 };
}

export function applyCamera2Action(state: Camera2State, action: SceneAction): Camera2State {
  if (action.verb === "cam" && action.point) return { ...state, center: { ...action.point } };
  if (action.verb === "zoom") return { ...state, zoom: Math.max(.01, action.amount ?? 1) };
  return state;
}

/** Camera state immediately before an action in authored source order. */
export function camera2Before(doc: SceneDoc, selected: ActionSelection): Camera2State {
  let state = camera2Initial(docSize(doc));
  for (let step = 0; step < doc.steps.length; step += 1) {
    const actions = stepActions(doc.steps[step]);
    for (let index = 0; index < actions.length; index += 1) {
      if (step === selected.step && index === selected.index) return state;
      state = applyCamera2Action(state, actions[index]);
    }
  }
  return state;
}

export function cameraViewport(state: Camera2State, size: CanvasSize): CameraViewport {
  const zoom = Math.max(.01, state.zoom);
  const width = size.width / zoom, height = size.height / zoom;
  return { x: state.center.x - width / 2, y: state.center.y - height / 2, width, height };
}

export function orbitFromPoints(eye: Point3, target: Point3): Camera3State {
  const dx = eye.x - target.x, dy = eye.y - target.y, dz = eye.z - target.z;
  const flat = Math.hypot(dx, dy);
  const radius = Math.max(.01, Math.hypot(flat, dz));
  const azimuth = flat <= 1e-8 ? (dz >= 0 ? -90 : 90) : Math.atan2(dy, dx) * 180 / Math.PI;
  return { azimuth, elevation: Math.atan2(dz, flat) * 180 / Math.PI, radius, roll: 0 };
}

export function eyeFromOrbit(target: Point3, state: Pick<Camera3State, "azimuth" | "elevation" | "radius">): Point3 {
  const azimuth = state.azimuth * Math.PI / 180, elevation = state.elevation * Math.PI / 180;
  const radius = Math.max(.01, state.radius), flat = radius * Math.cos(elevation);
  return {
    x: target.x + flat * Math.cos(azimuth),
    y: target.y + flat * Math.sin(azimuth),
    z: target.z + radius * Math.sin(elevation),
  };
}

export function camera3Before(doc: SceneDoc, selected: ActionSelection): Camera3State | null {
  const camera = doc.entities.find((entity): entity is Camera3Entity => entity.kind === "camera3");
  if (!camera) return null;
  let state = orbitFromPoints(camera.eye, camera.target);
  for (let step = 0; step < doc.steps.length; step += 1) {
    const actions = stepActions(doc.steps[step]);
    for (let index = 0; index < actions.length; index += 1) {
      if (step === selected.step && index === selected.index) return state;
      const action = actions[index];
      if (action.verb === "orbit3") state = {
        ...state,
        azimuth: action.amount ?? state.azimuth,
        elevation: action.values?.[0] ?? state.elevation,
        radius: Math.max(.01, action.values?.[1] ?? state.radius),
      };
      if (action.verb === "roll3") state = { ...state, roll: action.amount ?? state.roll };
    }
  }
  return state;
}

/** Non-linear plan-view scale: useful from close-up to wide camera radii. */
export function radiusToGuidePixels(radius: number): number {
  return Math.min(118, Math.max(18, 18 + 18 * Math.log2(1 + Math.max(0, radius))));
}

export function guidePixelsToRadius(pixels: number): number {
  return Math.max(.01, 2 ** ((Math.max(18, Math.min(118, pixels)) - 18) / 18) - 1);
}
