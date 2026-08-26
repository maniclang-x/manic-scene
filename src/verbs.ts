// Verb definitions. Each is self-contained: UI hints, parse, serialize,
// beat length, and its timeline behavior. Onboarding a new verb = one entry.

import { argName, argNumber, argPoint, argPoint3, argString, easeFrom, escapeString, latexLiteral, num, pt, pt3 } from "./args.js";
import { entityDef, registerVerb, wordCount, type VerbApplyCtx, type VerbDef } from "./registry.js";
import { graphAlgorithmPlan, graphStartVertices, hashmapLookupPlan } from "./entities/algo.js";
import { circuitParts } from "./entities/circuit.js";
import { mlOutputShape } from "./entities/ml.js";
import { PHYSICS_KINDS } from "./entities/physics.js";
import type { CallStatement } from "./script.js";
import type { SceneAction, SceneDoc, SceneEntity } from "./types.js";

const any = (kind: string) => kind !== "loupe" && entityDef(kind)?.authorOnly !== true;
const is3D = (kind: string) => ["camera3", "grid3", "line3", "arrow3", "curve3", "point3", "cloud3", "axes3", "frame3", "cube3", "sphere3", "prism3", "pyramid3", "midpoint3", "cross3", "link3", "model3", "assembly3", "extrude3", "revolve3", "tube3", "project3", "projectpath3", "surface3", "domainsurface", "param3", "implicit3", "heightmap3", "contour3", "slice3", "tangentplane3", "gradient3", "vectorfield3", "volume3", "trajectory3", "descend3", "linmap3", "eigen3", "collection3", "collection3data", "child3", "links3", "links3data", "pieces3", "ring3", "trail3", "historyplot3", "randomwalk3", "lsystem3", "tree3", "hilbert3", "molecule3"].includes(kind);
const attachable3 = (kind: string) => is3D(kind) && !["camera3", "axes3", "frame3", "cross3", "assembly3", "volume3", "eigen3", "pieces3", "tree3"].includes(kind);
const transformTarget3 = (kind: string) => kind === "camera3" || attachable3(kind);
const drawable3 = (kind: string) => is3D(kind) && kind !== "camera3";
const collectionTarget3 = (kind: string) => kind === "collection3" || kind === "collection3data";
const pathTarget3 = (kind: string) => ["line3", "arrow3", "curve3", "projectpath3", "trajectory3", "descend3", "ring3", "trail3", "randomwalk3", "lsystem3", "hilbert3"].includes(kind);
const motion2D = (kind: string) => !is3D(kind) && kind !== "loupe" && entityDef(kind)?.authorOnly !== true;
const direct2D = (kind: string) => motion2D(kind) && !["caption", "mathparts", "particles", "extrema", "inflections", "limit"].includes(kind);
const strokes = (kind: string) => ["circle", "rect", "boolean", "line", "arrow", "link", "brace", "bracelabel", "bracetext", "support", "axes", "coords", "segment", "vector", "ellipse", "circle2", "circumcircle", "incircle", "fullline", "parabola", "hyperbola", "commontangent", "anglemark", "rightangle", "plot", "deriv", "accum", "tangent", "invertpath", "reflectpath", "line3", "arrow3", "curve3", "axes3", "frame3", "cross3", "link3", "tube3", "projectpath3", "revolve3", "extrude3", "model3", "surface3", "domainsurface", "param3", "implicit3", "heightmap3", "contour3", "slice3", "tangentplane3", "gradient3", "vectorfield3", "trajectory3", "descend3", "linmap3"].includes(kind);
// `flow` follows a path; unlike draw/erase it cannot use an arbitrary closed
// shape such as rect/circle as its target in the native engine.
const flowPaths = (kind: string) => ["line", "arrow", "link", "brace", "bracelabel", "bracetext", "axes", "coords", "segment", "vector", "ellipse", "circle2", "fullline", "parabola", "hyperbola", "commontangent", "anglemark", "rightangle", "plot", "deriv", "accum", "tangent", "invertpath", "reflectpath"].includes(kind);
const cycleTarget = direct2D;
const concrete2D = (kind: string) => [
  "text", "equation", "circle", "rect", "dot", "line", "arrow", "polygon", "counter", "label", "link", "framebox",
  "brace", "bracelabel", "bracetext", "point", "segment", "vector", "ellipse", "circle2", "midpoint", "anglemark",
  "rightangle", "centroid", "circumcenter", "incenter", "orthocenter", "foot", "meet", "reflect", "bisector", "rotpoint", "between", "anglepoint", "circumcircle", "incircle", "fullline", "parabola", "commontangent", "cloud", "shader", "trail", "lsystem", "plot", "deriv", "accum", "tangent", "slope", "area",
  "integral", "watermark", "safezone", "invertpath", "reflectpath", "boolean",
].includes(kind);

function baseAction(verb: string, target: string, dur: number): SceneAction {
  return { verb, target, prop: null, point: null, amount: null, color: null, text: null, dur, ease: "smooth" };
}

/** Parse the common tail `…, [dur], [ease])` starting at `index`; null = trailing junk. */
function parseTail(action: SceneAction, stmt: CallStatement, index: number, hasEase: boolean): SceneAction | null {
  let rest = index;
  const dur = argNumber(stmt.args, rest);
  if (dur !== null) { action.dur = dur; rest += 1; }
  const easeName = argName(stmt.args, rest);
  if (easeName !== null) {
    const ease = easeFrom(easeName);
    if (!ease || !hasEase) return null;
    action.ease = ease;
    rest += 1;
  }
  return rest === stmt.args.length ? action : null;
}

function easeSuffix(action: SceneAction, hasEase: boolean): string {
  return hasEase && action.ease !== "smooth" ? `, ${action.ease}` : "";
}

/** The `verb(target, [dur], [ease])` family. */
function simpleVerb(
  cfg: Pick<VerbDef, "name" | "label" | "hint" | "order" | "defaultDur" | "hasEase" | "appliesTo" | "apply"> &
    Partial<Pick<VerbDef, "onAdd" | "canAdd" | "addBlockedReason" | "createDur">> & { durMin?: number },
): VerbDef {
  return {
    ...cfg,
    ui: { durLabel: "Seconds", ...(cfg.durMin === undefined ? {} : { durMin: cfg.durMin }) },
    create: (target) => baseAction(cfg.name, target, cfg.createDur ?? cfg.defaultDur),
    parse(stmt) {
      const target = argName(stmt.args, 0);
      if (!target) return null;
      return parseTail(baseAction(cfg.name, target, cfg.defaultDur), stmt, 1, cfg.hasEase);
    },
    serialize: (action) => `${cfg.name}(${action.target}, ${num(action.dur)}${easeSuffix(action, cfg.hasEase)});`,
    beatDur: (action) => action.dur,
  };
}

registerVerb(simpleVerb({
  name: "show", label: "Show", order: 10, defaultDur: 0.5, createDur: 0.4, hasEase: true,
  hint: "Reveal — fade in, or grow in when hidden from center",
  appliesTo: any,
  onAdd(entity) { if (entity.reveal === "none") entity.reveal = "fade"; },
  apply(ctx, action, start, end) {
    ctx.tween("opacity", start, end, ctx.entity.opacity, action.ease);
    if (ctx.entity.reveal === "grow") ctx.tween("scale", start, end, 1, action.ease);
  },
}));

registerVerb(simpleVerb({
  name: "draw", label: "Draw", order: 11, defaultDur: 1.2, createDur: 0.7, hasEase: true,
  hint: "Trace the stroke on (arms untraced)",
  appliesTo: strokes,
  onAdd(entity) { entity.untraced = true; },
  apply(ctx, action, start, end) { ctx.tween("draw", start, end, 1, action.ease); },
}));

registerVerb(simpleVerb({
  name: "erase", label: "Erase stroke", order: 11.5, defaultDur: .7, hasEase: true,
  hint: "Trace a stroke back out",
  appliesTo: strokes,
  apply(ctx, action, start, end) { ctx.tween("draw", start, end, 0, action.ease); },
}));

registerVerb(simpleVerb({
  name: "type", label: "Type", order: 12, defaultDur: 1.2, hasEase: false,
  hint: "Typewriter-reveal the words",
  appliesTo: (kind) => kind === "text",
  onAdd(entity) { entity.untraced = true; },
  apply(ctx, action, start, end) { ctx.tween("type", start, end, 1, "linear"); },
}));

// karaoke(id, [delay], [color]) — word k recolors at k·delay; beat = (n-1)·delay + 0.25.
registerVerb({
  name: "karaoke", label: "Karaoke", order: 13, defaultDur: 0.25, hasEase: false,
  hint: "Highlight a caption's words in sequence (lyrics-style)",
  ui: { durLabel: "Delay / word", colorArg: true },
  appliesTo: (kind) => kind === "caption",
  create: (target) => ({ ...baseAction("karaoke", target, 0.25), color: null }),
  parse(stmt) {
    const target = argName(stmt.args, 0);
    if (!target) return null;
    const action = baseAction("karaoke", target, 0.25);
    let rest = 1;
    const delay = argNumber(stmt.args, rest);
    if (delay !== null) { action.dur = delay; rest += 1; }
    const color = argName(stmt.args, rest);
    if (color !== null) { action.color = color; rest += 1; }
    return rest === stmt.args.length ? action : null;
  },
  serialize: (action) => `karaoke(${action.target}, ${num(action.dur)}${action.color ? `, ${action.color}` : ""});`,
  beatDur: (action, entity) => beatOverWords(action, entity, 0.25),
  apply(ctx, action, start) {
    ctx.wordFx({ kind: "karaoke", start, delay: action.dur, color: action.color });
  },
});

// wordpop(id, [delay]) — word k pops in at k·delay over 0.16s.
registerVerb({
  name: "wordpop", label: "Word pop", order: 14, defaultDur: 0.12, hasEase: false,
  hint: "Pop a caption's words in one at a time",
  ui: { durLabel: "Delay / word" },
  appliesTo: (kind) => kind === "caption",
  create: (target) => baseAction("wordpop", target, 0.12),
  onAdd(entity) { if (entity.reveal === "none") entity.reveal = "fade"; },
  parse(stmt) {
    const target = argName(stmt.args, 0);
    if (!target) return null;
    const action = baseAction("wordpop", target, 0.12);
    return parseTail(action, stmt, 1, false);
  },
  serialize: (action) => `wordpop(${action.target}, ${num(action.dur)});`,
  beatDur: (action, entity) => beatOverWords(action, entity, 0.16),
  apply(ctx, action, start) {
    ctx.wordFx({ kind: "wordpop", start, delay: action.dur, color: null });
  },
});

function beatOverWords(action: SceneAction, entity: SceneEntity | null, tail: number): number {
  const words = entity && entity.kind === "caption" ? wordCount(entity.text) : 1;
  return Math.max(0, words - 1) * action.dur + tail;
}

function pointVerb(name: string, label: string, hint: string, order: number, mode: "absolute" | "delta", defaultDur: number, appliesTo: VerbDef["appliesTo"], createDur?: number): VerbDef {
  return {
    name, label, hint, order, defaultDur, hasEase: true,
    ui: { durLabel: "Seconds", point: mode },
    appliesTo,
    create: (target) => ({ ...baseAction(name, target, createDur ?? defaultDur), point: mode === "delta" ? { x: 80, y: 0 } : { x: 0, y: 0 } }),
    parse(stmt) {
      const target = argName(stmt.args, 0);
      const point = argPoint(stmt.args, 1);
      if (!target || !point) return null;
      return parseTail({ ...baseAction(name, target, defaultDur), point }, stmt, 2, true);
    },
    serialize: (action) => `${name}(${action.target}, ${pt(action.point?.x ?? 0, action.point?.y ?? 0)}, ${num(action.dur)}${easeSuffix(action, true)});`,
    beatDur: (action) => action.dur,
    apply(ctx, action, start, end) {
      if (!action.point) return;
      if (mode === "absolute") {
        ctx.tween("x", start, end, action.point.x, action.ease);
        ctx.tween("y", start, end, action.point.y, action.ease);
      } else {
        ctx.tween("x", start, end, ctx.valueAt("x", start) + action.point.x, action.ease);
        ctx.tween("y", start, end, ctx.valueAt("y", start) + action.point.y, action.ease);
      }
    },
  };
}

registerVerb(pointVerb("move", "Move", "Glide to a point", 20, "absolute", 0.8, direct2D, 0.6));
registerVerb(pointVerb("shift", "Shift", "Move by a delta", 21, "delta", 0.6, motion2D));

registerVerb(amountVerb("slidex", "Slide X", "Slide to an absolute x while keeping the current y", 21.1, { label: "Destination x", step: 1, initial: 640 }, 0.6,
  (ctx, action, start, end) => ctx.tween("x", start, end, action.amount ?? ctx.valueAt("x", start), action.ease), direct2D));

registerVerb(amountVerb("slidey", "Slide Y", "Slide to an absolute y while keeping the current x", 21.2, { label: "Destination y", step: 1, initial: 360 }, 0.6,
  (ctx, action, start, end) => ctx.tween("y", start, end, action.amount ?? ctx.valueAt("y", start), action.ease), direct2D));

function amountVerb(name: string, label: string, hint: string, order: number, amount: { label: string; step: number; initial: number }, defaultDur: number, apply: VerbDef["apply"], appliesTo: VerbDef["appliesTo"] = any): VerbDef {
  return {
    name, label, hint, order, defaultDur, hasEase: true,
    ui: { durLabel: "Seconds", amount: { label: amount.label, step: amount.step } },
    appliesTo,
    create: (target) => ({ ...baseAction(name, target, defaultDur), amount: amount.initial }),
    parse(stmt) {
      const target = argName(stmt.args, 0);
      const value = argNumber(stmt.args, 1);
      if (!target || value === null) return null;
      return parseTail({ ...baseAction(name, target, defaultDur), amount: value }, stmt, 2, true);
    },
    serialize: (action) => `${name}(${action.target}, ${num(action.amount ?? 0)}, ${num(action.dur)}${easeSuffix(action, true)});`,
    beatDur: (action) => action.dur,
    apply,
  };
}

registerVerb(amountVerb("scale", "Scale", "Animate uniform scale to a factor", 22, { label: "Factor", step: 0.1, initial: 1.5 }, 0.6,
  (ctx, action, start, end) => ctx.tween("scale", start, end, action.amount ?? 1, action.ease)));

registerVerb(amountVerb("spin", "Spin", "Rotate by relative degrees", 23, { label: "Degrees", step: 15, initial: 360 }, 0.8,
  (ctx, action, start, end) => ctx.tween("rotation", start, end, ctx.valueAt("rotation", start) + (action.amount ?? 0), action.ease), motion2D));

const rotateVerb = amountVerb("rotate", "Rotate to angle", "Animate to an absolute 2D angle", 23.05, { label: "Degrees", step: 5, initial: 90 }, 0.5,
  (ctx, action, start, end) => ctx.tween("rotation", start, end, action.amount ?? 0, action.ease), motion2D);
rotateVerb.ui = { ...rotateVerb.ui, targetTags: true };
registerVerb(rotateVerb);

registerVerb({
  name: "groupscale", label: "Scale group", order: 23.1, defaultDur: .7, hasEase: true,
  hint: "Scale an entity or tagged group around its collective centre",
  ui: { durLabel: "Seconds", amount: { label: "Scale factor", step: .1, min: .01 }, targetLabel: "Group", targetTags: true },
  appliesTo: direct2D,
  create: (target) => ({ ...baseAction("groupscale", target, .7), amount: 1.5 }),
  parse(stmt) {
    const group = argName(stmt.args, 0), factor = argNumber(stmt.args, 1);
    if (!group || factor === null || factor <= 0) return null;
    return parseTail({ ...baseAction("groupscale", group, .7), amount: factor }, stmt, 2, true);
  },
  serialize: (action) => `groupscale(${action.target}, ${num(Math.max(.01, action.amount ?? 1))}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur,
  apply() {},
});

registerVerb({
  name: "dock", label: "Dock group", order: 23.2, defaultDur: .6, hasEase: true,
  hint: "Shift an entity or tagged group rigidly until one member reaches a point or entity",
  ui: {
    durLabel: "Seconds", targetLabel: "Group", targetTags: true,
    entityArg: { label: "Member", accept: direct2D },
    pointOrEntity: { label: "Dock destination" }, pointOrEntityRef: "refs0",
  },
  appliesTo: direct2D,
  canAdd: (doc) => doc.entities.filter((entity) => direct2D(entity.kind)).length >= 2,
  addBlockedReason: "Dock needs a group member and another entity or point to dock to.",
  create: (target) => ({ ...baseAction("dock", target, .6), ref: "", point: { x: 640, y: 360 }, refs: [] }),
  parse(stmt) {
    const group = argName(stmt.args, 0), member = argName(stmt.args, 1);
    const point = argPoint(stmt.args, 2), destination = argName(stmt.args, 2);
    if (!group || !member || (!point && !destination)) return null;
    return parseTail({ ...baseAction("dock", group, .6), ref: member, point, refs: destination ? [destination] : [] }, stmt, 3, true);
  },
  serialize: (action) => `dock(${action.target}, ${action.ref ?? action.target}, ${action.refs?.[0] ?? pt(action.point?.x ?? 640, action.point?.y ?? 360)}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur,
  apply() {},
});

registerVerb({
  name: "arrange", label: "Arrange particles", order: 23.3, defaultDur: 1.2, hasEase: true,
  hint: "Move persistent particles into a deterministic random, grid, or ring layout",
  ui: {
    durLabel: "Seconds",
    entityArg: { label: "Container", kinds: ["circle", "rect"] },
    choices: [{ label: "Layout", field: "text", options: ["random", "grid", "ring"] }],
  },
  appliesTo: (kind) => kind === "particles",
  canAdd: (doc) => doc.entities.some((entity) => entity.kind === "circle" || entity.kind === "rect"),
  addBlockedReason: "Arrange needs persistent particles and a circle or rectangle container.",
  create: (target) => ({ ...baseAction("arrange", target, 1.2), ref: "", text: "random" }),
  parse(stmt) {
    const particles = argName(stmt.args, 0), container = argName(stmt.args, 1);
    const layout = argString(stmt.args, 2) ?? "random";
    if (!particles || !container || !["random", "grid", "ring"].includes(layout)) return null;
    const action = { ...baseAction("arrange", particles, 1.2), ref: container, text: layout };
    return parseTail(action, stmt, 3, true);
  },
  serialize: (action) => `arrange(${action.target}, ${action.ref ?? "container"}, "${action.text ?? "random"}", ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur,
  apply() {},
});

registerVerb({
  name: "setsliders", label: "Set coordinate sliders", order: 23.35, defaultDur: 1, hasEase: true,
  hint: "Animate every dial and update the native sum-of-squares readout",
  ui: { durLabel: "Seconds", numberList: { label: "Coordinates", step: .01, min: -1, max: 1, countFromTarget: "count" } },
  appliesTo: (kind) => kind === "sliders",
  create: (target) => ({ ...baseAction("setsliders", target, 1), values: [0, 0, 0, 0] }),
  parse(stmt) {
    const target = argName(stmt.args, 0), source = argString(stmt.args, 1);
    if (!target || source === null) return null;
    const values = source.trim().split(/\s+/u).filter(Boolean).map(Number);
    if (values.length === 0 || values.some((value) => !Number.isFinite(value))) return null;
    const action = parseTail({ ...baseAction("setsliders", target, 1), values }, stmt, 2, true);
    return action && action.dur > 0 ? action : null;
  },
  serialize: (action) => `setsliders(${action.target}, "${(action.values ?? [0]).map(num).join(" ")}", ${num(Math.max(.01, action.dur))}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur,
  apply(ctx, action, start, end) {
    if (ctx.entity.kind !== "sliders") return;
    const count = Math.max(1, Math.round(ctx.entity.count));
    for (let index = 0; index < count; index += 1) ctx.auxTween(`slider-${index}`, start, end, Math.max(-1, Math.min(1, action.values?.[index] ?? 0)), action.ease, 0);
  },
});

registerVerb({
  name: "wander", label: "Wander particles", hint: "Deterministic ambient motion contained by the particle source region",
  order: 23.36, defaultDur: 4, hasEase: false,
  ui: { durLabel: "Seconds", durMin: .01 }, appliesTo: (kind) => kind === "particles",
  create: (target) => baseAction("wander", target, 4),
  parse(stmt) {
    const target = argName(stmt.args, 0), duration = argNumber(stmt.args, 1) ?? 4;
    return target && duration > 0 && stmt.args.length <= 2 ? baseAction("wander", target, duration) : null;
  },
  serialize: (action) => `wander(${action.target}, ${num(Math.max(.01, action.dur))});`,
  beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "surround", label: "Surround target", order: 23.4, defaultDur: .8, hasEase: true,
  hint: "Move and resize a highlight rectangle around another entity or tagged group",
  ui: { durLabel: "Seconds", entityArg: { label: "Surround", allowTags: true } },
  appliesTo: (kind) => kind === "framebox" || kind === "rect",
  create: (target) => ({ ...baseAction("surround", target, .8), ref: "" }),
  parse(stmt) {
    const box = argName(stmt.args, 0), target = argName(stmt.args, 1);
    return box && target ? parseTail({ ...baseAction("surround", box, .8), ref: target }, stmt, 2, true) : null;
  },
  serialize: (action) => `surround(${action.target}, ${action.ref ?? "target"}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur,
  apply() {},
});

const growTargets = (kind: string) => ["line", "arrow", "link", "segment", "vector", "tangent"].includes(kind);
registerVerb({
  name: "grow", label: "Grow endpoint", order: 23.5, defaultDur: .5, hasEase: true,
  hint: "Animate a line-like endpoint to a point or another entity",
  ui: { durLabel: "Seconds", pointOrEntity: { label: "New endpoint" }, pointOrEntityRef: "ref" },
  appliesTo: growTargets,
  create: (target) => ({ ...baseAction("grow", target, .5), point: { x: 640, y: 360 }, ref: null }),
  parse(stmt) {
    const target = argName(stmt.args, 0), point = argPoint(stmt.args, 1), ref = argName(stmt.args, 1);
    if (!target || (!point && !ref)) return null;
    return parseTail({ ...baseAction("grow", target, .5), point, ref }, stmt, 2, true);
  },
  serialize: (action) => `grow(${action.target}, ${action.ref ?? pt(action.point?.x ?? 640, action.point?.y ?? 360)}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur,
  apply() {},
});

// to(id, prop, value, [dur], [ease]) — animate one property to a value.
const toProperties = (entity: SceneEntity): readonly string[] => is3D(entity.kind)
  ? ["opacity", "scale", "trace", ...(entity.morph3 ? ["morph"] : [])]
  : !direct2D(entity.kind)
    ? ["opacity", "scale", "angle", "hue"]
  : ["x", "y", ...((entity.kind === "rect") ? ["width", "height"] : []), "opacity", "scale", "angle", "hue", ...(["counter", "parameter"].includes(entity.kind) ? ["value"] : []), ...(entity.morph2 || ["gridmap", "squish", "warp"].includes(entity.kind) ? ["morph"] : [])];
registerVerb({
  name: "to", label: "To (property)", order: 24, defaultDur: 1, hasEase: true,
  hint: "Animate one property (including a registered 3D morph) to a value",
  ui: { durLabel: "Seconds", amount: { label: "Value", step: 1 }, propOptions: toProperties },
  appliesTo: any,
  create: (target) => ({ ...baseAction("to", target, 1.5), prop: "scale", amount: 1.5 }),
  parse(stmt) {
    const target = argName(stmt.args, 0);
    const prop = argName(stmt.args, 1);
    const value = argNumber(stmt.args, 2);
    if (!target || !prop || value === null) return null;
    return parseTail({ ...baseAction("to", target, 1), prop, amount: value }, stmt, 3, true);
  },
  serialize: (action) => `to(${action.target}, ${action.prop ?? "value"}, ${num(action.amount ?? 0)}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur,
  apply(ctx, action, start, end) {
    const value = action.amount ?? 0;
    switch (action.prop) {
      case "x": ctx.tween("x", start, end, value, action.ease); break;
      case "y": ctx.tween("y", start, end, value, action.ease); break;
      case "opacity": ctx.tween("opacity", start, end, value, action.ease); break;
      case "scale": ctx.tween("scale", start, end, value, action.ease); break;
      case "angle": ctx.tween("rotation", start, end, value, action.ease); break;
      case "hue": ctx.auxTween("hue", start, end, value, action.ease, ctx.entity.hue?.deg ?? 0); break;
      default: ctx.auxTween(action.prop ?? "value", start, end, value, action.ease, 0); break;
    }
  },
});

registerVerb({
  name: "set", label: "Set property", order: 24.1, defaultDur: .5, hasEase: true,
  hint: "Native alias of To — animate one numeric property to a value",
  ui: { durLabel: "Seconds", amount: { label: "Value", step: 1 }, propOptions: toProperties },
  appliesTo: any,
  create: (target) => ({ ...baseAction("set", target, .5), prop: "scale", amount: 1.5 }),
  parse(stmt) {
    const target = argName(stmt.args, 0), prop = argName(stmt.args, 1), value = argNumber(stmt.args, 2);
    if (!target || !prop || value === null) return null;
    return parseTail({ ...baseAction("set", target, .5), prop, amount: value }, stmt, 3, true);
  },
  serialize: (action) => `set(${action.target}, ${action.prop ?? "value"}, ${num(action.amount ?? 0)}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur,
  apply(ctx, action, start, end) {
    const value = action.amount ?? 0;
    switch (action.prop) {
      case "x": ctx.tween("x", start, end, value, action.ease); break;
      case "y": ctx.tween("y", start, end, value, action.ease); break;
      case "opacity": ctx.tween("opacity", start, end, value, action.ease); break;
      case "scale": ctx.tween("scale", start, end, value, action.ease); break;
      case "angle": ctx.tween("rotation", start, end, value, action.ease); break;
      case "hue": ctx.auxTween("hue", start, end, value, action.ease, ctx.entity.hue?.deg ?? 0); break;
      default: ctx.auxTween(action.prop ?? "value", start, end, value, action.ease, 0); break;
    }
  },
});

registerVerb({
  name: "transform", label: "Apply 2×2 matrix", order: 24.2, defaultDur: .9, hasEase: true,
  hint: "Apply an affine 2×2 matrix about an editable origin",
  ui: { durLabel: "Seconds", point: "absolute", pointLabel: "Origin", numbers: [{ label: "a · xx", step: .05 }, { label: "b · xy", step: .05 }, { label: "c · yx", step: .05 }, { label: "d · yy", step: .05 }] },
  appliesTo: concrete2D,
  create: (target) => ({ ...baseAction("transform", target, .9), point: { x: 640, y: 360 }, values: [0, -1, 1, 0] }),
  parse(stmt) {
    const target = argName(stmt.args, 0), origin = argPoint(stmt.args, 1);
    const values = [2, 3, 4, 5].map((index) => argNumber(stmt.args, index));
    if (!target || !origin || values.some((value) => value === null)) return null;
    return parseTail({ ...baseAction("transform", target, .9), point: origin, values: values as number[] }, stmt, 6, true);
  },
  serialize: (action) => `transform(${action.target}, ${pt(action.point?.x ?? 640, action.point?.y ?? 360)}, ${(action.values ?? [1, 0, 0, 1]).slice(0, 4).map(num).join(", ")}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur,
  apply(ctx, action, start, end) {
    const origin = action.point ?? { x: 0, y: 0 }, [a, b, c, d] = action.values ?? [1, 0, 0, 1];
    const x = ctx.valueAt("x", start) - origin.x, y = ctx.valueAt("y", start) - origin.y;
    ctx.tween("x", start, end, origin.x + a * x + b * y, action.ease);
    ctx.tween("y", start, end, origin.y + c * x + d * y, action.ease);
  },
});

registerVerb({
  name: "swap", label: "Swap positions", order: 24.3, defaultDur: .6, hasEase: true,
  hint: "Exchange the authored positions of two concrete entities",
  ui: { durLabel: "Seconds", entityArg: { label: "Swap with", accept: concrete2D } },
  appliesTo: concrete2D,
  canAdd: (doc) => doc.entities.filter((entity) => concrete2D(entity.kind)).length >= 2,
  addBlockedReason: "Swap needs two concrete 2D entities.",
  create: (target) => ({ ...baseAction("swap", target, .6), ref: "" }),
  parse(stmt) {
    const a = argName(stmt.args, 0), b = argName(stmt.args, 1);
    return a && b ? parseTail({ ...baseAction("swap", a, .6), ref: b }, stmt, 2, true) : null;
  },
  serialize: (action) => `swap(${action.target}, ${action.ref ?? "target"}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur,
  apply() {},
});

registerVerb({
  name: "restore", label: "Restore saved state", order: 24.4, defaultDur: .7, hasEase: true,
  hint: "Return an entity to its saved state, or roll an ML network back to a named checkpoint",
  ui: { durLabel: "Seconds", wordsArg: { label: "ML checkpoint (network only)" } }, appliesTo: (kind) => concrete2D(kind) || kind === "network",
  canAdd: (_doc, selected) => selected?.savedState === true || selected?.kind === "network",
  addBlockedReason: "Apply Saved state first, or select an ML network with a checkpoint.",
  create: (target) => baseAction("restore", target, .7),
  parse(stmt) {
    const target = argName(stmt.args, 0);
    if (!target) return null;
    const checkpoint = argName(stmt.args, 1);
    return checkpoint ? parseTail({ ...baseAction("restore", target, 2.3), text: checkpoint }, stmt, 2, true) : parseTail(baseAction("restore", target, .7), stmt, 1, true);
  },
  serialize: (action) => `restore(${action.target}${action.text ? `, ${action.text}` : ""}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur,
  apply(ctx, action, start, end) {
    if (action.text) return;
    for (const prop of ["x", "y", "opacity", "scale", "rotation"] as const) ctx.tween(prop, start, end, ctx.valueAt(prop, 0), action.ease);
  },
});

// rewrite(id, `latex`, [dur], [ease]) — transform an equation to new LaTeX.
registerVerb({
  name: "rewrite", label: "Rewrite", order: 25, defaultDur: 0.9, hasEase: true,
  hint: "Smoothly transform an equation into new LaTeX",
  ui: { durLabel: "Seconds", latexArg: { label: "New LaTeX" } },
  appliesTo: (kind) => kind === "equation",
  create: (target) => ({ ...baseAction("rewrite", target, 0.9), text: "x^{2}" }),
  parse(stmt) {
    const target = argName(stmt.args, 0);
    const latex = argString(stmt.args, 1);
    if (!target || latex === null) return null;
    return parseTail({ ...baseAction("rewrite", target, 0.9), text: latex }, stmt, 2, true);
  },
  serialize: (action) => `rewrite(${action.target}, ${latexLiteral(action.text ?? "")}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur,
  apply() {},
});

registerVerb(simpleVerb({
  name: "pulse", label: "Pulse", order: 30, defaultDur: 0.8, hasEase: false,
  hint: "Quick grow-and-settle attention pulse",
  appliesTo: any,
  apply(ctx, action, start, end) {
    const mid = (start + end) / 2;
    const base = ctx.valueAt("scale", start);
    ctx.tween("scale", start, mid, base * 1.16, "out");
    ctx.tween("scale", mid, end, base, "in");
  },
}));

// flash(id, [color], [dur], [ease]) — flash to a color and restore.
registerVerb({
  name: "flash", label: "Flash", order: 31, defaultDur: 0.8, hasEase: true,
  hint: "Flash to a color and restore",
  ui: { durLabel: "Seconds", colorArg: true },
  appliesTo: any,
  create: (target) => ({ ...baseAction("flash", target, 0.8), color: "gold" }),
  parse(stmt) {
    const target = argName(stmt.args, 0);
    if (!target) return null;
    const action = { ...baseAction("flash", target, 0.8), color: "magenta" };
    let rest = 1;
    const color = argName(stmt.args, rest);
    if (color !== null) { action.color = color; rest += 1; }
    return parseTail(action, stmt, rest, true);
  },
  serialize: (action) => `flash(${action.target}, ${action.color ?? "magenta"}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur,
  apply(ctx, action, start, end) { ctx.flash(start, end, action.color ?? "magenta", action.ease); },
});

registerVerb(simpleVerb({
  name: "blink", label: "Blink", order: 31.1, defaultDur: .6, hasEase: false,
  hint: "Blink out and back twice, ending visible",
  appliesTo: any,
  apply(ctx, _action, start, end) {
    const d = (end - start) / 4;
    ctx.tween("opacity", start, start + d, 0, "smooth");
    ctx.tween("opacity", start + d, start + 2 * d, 1, "smooth");
    ctx.tween("opacity", start + 2 * d, start + 3 * d, 0, "smooth");
    ctx.tween("opacity", start + 3 * d, end, 1, "smooth");
  },
}));

registerVerb(simpleVerb({
  name: "wiggle", label: "Wiggle", order: 31.2, defaultDur: .7, hasEase: false,
  hint: "Quick scale pop with a six-part rotational wiggle",
  appliesTo: motion2D,
  apply(ctx, _action, start, end) {
    const baseScale = ctx.valueAt("scale", start), baseRotation = ctx.valueAt("rotation", start), half = (start + end) / 2;
    ctx.tween("scale", start, half, baseScale + .12, "smooth");
    ctx.tween("scale", half, end, baseScale, "smooth");
    const offsets = [6, -6, 6, -6, 6, 0];
    offsets.forEach((offset, index) => ctx.tween("rotation", start + index * (end - start) / 6, start + (index + 1) * (end - start) / 6, baseRotation + offset, "smooth"));
  },
}));

function outlineEffectTarget(kind: string): boolean {
  return [
    "text", "equation", "circle", "rect", "dot", "polygon", "line", "arrow", "link", "framebox",
    "brace", "bracelabel", "bracetext", "segment", "vector", "ellipse", "circle2",
    "anglemark", "rightangle", "plot", "deriv", "accum", "tangent", "area", "invertpath", "reflectpath", "boolean",
  ].includes(kind);
}

function coloredEffect(name: string, label: string, hint: string, order: number, defaultDur: number, appliesTo: VerbDef["appliesTo"], targetTags = false): VerbDef {
  return {
    name, label, hint, order, defaultDur, hasEase: false,
    ui: { durLabel: "Seconds", colorArg: true, ...(targetTags ? { targetTags: true } : {}) },
    appliesTo,
    create: (target) => ({ ...baseAction(name, target, defaultDur), color: "gold" }),
    parse(stmt) {
      const target = argName(stmt.args, 0), color = argName(stmt.args, 1) ?? "gold", dur = argNumber(stmt.args, 2) ?? defaultDur;
      if (!target || stmt.args.length > 3 || (stmt.args.length > 1 && argName(stmt.args, 1) === null) || (stmt.args.length > 2 && argNumber(stmt.args, 2) === null)) return null;
      return { ...baseAction(name, target, dur), color };
    },
    serialize: (action) => `${name}(${action.target}, ${action.color ?? "gold"}, ${num(action.dur)});`,
    beatDur: (action) => action.dur,
    apply() {},
  };
}

registerVerb(coloredEffect("circumscribe", "Circumscribe", "Trace and fade a temporary highlight box around an entity or group", 31.3, 1, any, true));
registerVerb(coloredEffect("passflash", "Passing flash", "Send a glowing stroke around the target outline", 31.4, 1, outlineEffectTarget));

registerVerb({
  ...simpleVerb({ name: "spotlight", label: "Spotlight", hint: "Expand a dim circular focus wash over an entity or group", order: 31.5, defaultDur: 1.4, hasEase: false, appliesTo: any, apply() {} }),
  ui: { durLabel: "Seconds", targetTags: true },
});

registerVerb({
  ...simpleVerb({ name: "spiralin", label: "Spiral in", hint: "Spiral every member of an entity or tagged group into place", order: 31.6, defaultDur: 1.4, hasEase: false, appliesTo: direct2D, apply() {} }),
  ui: { durLabel: "Seconds", targetLabel: "Group", targetTags: true },
});

registerVerb({
  name: "deform", label: "Deform outline", order: 31.7, defaultDur: 2, hasEase: true,
  hint: "Continuously remap an outline with u(x,y,t) and v(x,y,t)",
  ui: {
    durLabel: "Seconds", durMin: .05,
    formulaArgs: [
      { label: "u(x, y, t) · output x", hint: "Use u=x at t=0 for a clean start." },
      { label: "v(x, y, t) · output y", hint: "Use v=y at t=0 for a clean start." },
    ],
  },
  appliesTo: outlineEffectTarget,
  create: (target) => ({ ...baseAction("deform", target, 2), texts: ["x", "y + 30*sin(x*0.04 + t*tau)*sin(pi*t)"] }),
  parse(stmt) {
    const target = argName(stmt.args, 0), u = argString(stmt.args, 1), v = argString(stmt.args, 2);
    if (!target || u === null || v === null) return null;
    return parseTail({ ...baseAction("deform", target, 2), texts: [u, v] }, stmt, 3, true);
  },
  serialize: (action) => `deform(${action.target}, "${escapeString(action.texts?.[0] ?? "x")}", "${escapeString(action.texts?.[1] ?? "y")}", ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur,
  apply() {},
});

registerVerb(simpleVerb({
  name: "fade", label: "Fade", order: 40, defaultDur: 0.5, createDur: 0.4, hasEase: true,
  hint: "Fade the entity out",
  appliesTo: any,
  apply(ctx, action, start, end) { ctx.tween("opacity", start, end, 0, action.ease); },
}));

function nativeRunDuration(entity: SceneEntity | null, fallback: number): number {
  if (entity?.kind === "grid") return 4;
  if (entity?.kind === "countdown") return entity.seconds;
  if (entity?.kind === "timing") return entity.phases.reduce((sum, phase) => sum + phase.duration, 0);
  if (entity?.kind === "quiz") {
    if (entity.timing) return entity.timing.ask + entity.timing.options + entity.timing.think + entity.timing.reveal + entity.timing.hold;
    const presets = { quick: [.7, .7, 3, .5, 2.1], balanced: [1.4, 1.2, 5, .8, 3.6], calm: [1.8, 1.6, 7, 1, 3.6], dramatic: [1.1, 1.4, 5, .9, 3.6] } as const;
    const values: number[] = [...presets[entity.pace]];
    if (entity.seconds !== null) values[2] = entity.seconds;
    return values.reduce((sum, value) => sum + value, 0);
  }
  return fallback;
}

// run(target, [secs]) — native playback for workflows and deterministic optics
// parameter sweeps whose owning constructors are Canvas-known.
registerVerb({
  name: "run", label: "Run", order: 41, defaultDur: 6, hasEase: false,
  hint: "Play the target's native deterministic workflow",
  ui: { durLabel: "Seconds", durMin: .1, numbers:[{label:"Generations / settle rows",step:1,min:1,initial:1,visibleWhenKinds:["grid"]}] },
  appliesTo: (kind) => ["quiz", "timing", "countdown", "refract", "lens", "prism", "achromat", "lenssystem", "circuit", "grid", ...PHYSICS_KINDS].includes(kind as never),
  create: (target) => ({ ...baseAction("run", target, 6), durationExplicit: false }),
  parse(stmt) {
    const target = argName(stmt.args, 0), first = argNumber(stmt.args, 1), second=argNumber(stmt.args,2);
    if (!target || stmt.args.length > 3 || (stmt.args.length > 1 && first === null)||(stmt.args.length===3&&second===null)) return null;
    if (stmt.args.length === 3) return {...baseAction("run",target,second!),values:[first!],durationExplicit:true};
    if (stmt.args.length === 2) return {...baseAction("run",target,4),values:[first!],durationExplicit:false};
    return {...baseAction("run",target,6),durationExplicit:false};
  },
  serialize: (action) => action.values?.length?`run(${action.target}, ${num(action.values[0])}${action.durationExplicit === false ? "" : `, ${num(action.dur)}`});`:`run(${action.target}${action.durationExplicit === false ? "" : `, ${num(action.dur)}`});`,
  beatDur: (action, entity) => action.durationExplicit === false ? nativeRunDuration(entity, action.dur) : action.dur,
  apply() {},
});

registerVerb({
  name: "swing", label: "Swing simulation", order: 41.1, defaultDur: 6, hasEase: false,
  hint: "Replay a native pre-simulated Physics motion; pendulum-friendly alias of Run",
  ui: { durLabel: "Seconds", durMin: .1 }, appliesTo: (kind) => PHYSICS_KINDS.includes(kind as never),
  create: (target) => ({ ...baseAction("swing", target, 6), durationExplicit: false }),
  parse(stmt) { const target=argName(stmt.args,0),duration=argNumber(stmt.args,1);if(!target||stmt.args.length>2||(stmt.args.length===2&&duration===null))return null;return{...baseAction("swing",target,duration??6),durationExplicit:duration!==null}; },
  serialize: action=>`swing(${action.target}${action.durationExplicit===false?"":`, ${num(action.dur)}`});`,beatDur:action=>action.dur,apply(){},
});

registerVerb({
  name: "forces", label: "Reveal force diagram", order: 41.2, defaultDur: .6, hasEase: false,
  hint: "Reveal the ramp simulation's native gravity, normal, friction, and acceleration arrows",
  ui: { durLabel: "Seconds", durMin: .05 }, appliesTo: kind=>kind==="ramp",
  create: target=>baseAction("forces",target,.6),
  parse(stmt){const target=argName(stmt.args,0),duration=argNumber(stmt.args,1);if(!target||stmt.args.length>2||(stmt.args.length===2&&duration===null))return null;return baseAction("forces",target,duration??.6);},
  serialize: action=>`forces(${action.target}, ${num(action.dur)});`,beatDur:action=>action.dur,apply(){},
});

registerVerb({
  name:"route",label:"Route message",order:42,defaultDur:1,hasEase:true,
  hint:"Move one persistent Systems message through a selected named connection",
  ui:{durLabel:"Seconds",durMin:.01,entityArg:{label:"Connection",kinds:["connect"]}},appliesTo:kind=>kind==="message"||kind==="request",
  canAdd:doc=>doc.entities.some(entity=>entity.kind==="connect"),addBlockedReason:"Route needs at least one named system connection.",
  create:target=>({...baseAction("route",target,1),ref:""}),
  parse(stmt){const target=argName(stmt.args,0),connection=argName(stmt.args,1);return target&&connection?parseTail({...baseAction("route",target,1),ref:connection},stmt,2,true):null;},
  serialize:action=>`route(${action.target}, ${action.ref??"connection"}, ${num(action.dur)}${easeSuffix(action,true)});`,beatDur:action=>action.dur,apply(){},
});

registerVerb({
  name:"hotpath",label:"Seeded hot path",order:42.1,defaultDur:5,hasEase:false,
  hint:"Choose and illuminate one deterministic valid route from the message to a reachable sink",
  ui:{durLabel:"Seconds",durMin:.01,amount:{label:"Seed",step:1,min:0}},appliesTo:kind=>kind==="message"||kind==="request",
  canAdd:doc=>doc.entities.some(entity=>entity.kind==="connect"),addBlockedReason:"Hot path needs a reachable system connection graph.",
  create:target=>({...baseAction("hotpath",target,5),amount:1,durationExplicit:true}),
  parse(stmt){const target=argName(stmt.args,0),duration=argNumber(stmt.args,1),seed=argNumber(stmt.args,2);if(!target||stmt.args.length>3||(stmt.args.length>1&&duration===null)||(stmt.args.length>2&&seed===null))return null;return{...baseAction("hotpath",target,duration??5),amount:seed,durationExplicit:duration!==null};},
  serialize:action=>`hotpath(${action.target}${action.durationExplicit===false?"":`, ${num(action.dur)}${action.amount===null?"":`, ${num(Math.max(0,action.amount))}`}`});`,beatDur:action=>action.dur,apply(){},
});

for(const [name,label,order] of [["cut","Cut component",42.2],["reconnect","Reconnect component",42.3]] as const)registerVerb({
  name,label,order,defaultDur:.5,hasEase:false,
  hint:name==="cut"?"Remove a named component and let Preview re-solve the live circuit":"Restore a named component and let Preview re-solve the live circuit",
  ui:{durLabel:"Seconds",durMin:0,choices:[{label:"Part name or cN",field:"text",options:entity=>entity?.kind==="circuit"?circuitParts(entity).map(part=>part.name??`c${part.index}`):["c0"]}]},appliesTo:kind=>kind==="circuit",
  create:target=>({...baseAction(name,target,.5),text:"c0"}),
  parse(stmt){const target=argName(stmt.args,0),part=argName(stmt.args,1),duration=argNumber(stmt.args,2);if(!target||!part||stmt.args.length>3||(stmt.args.length>2&&duration===null))return null;return{...baseAction(name,target,duration??.5),text:part,durationExplicit:duration!==null};},
  serialize:action=>`${name}(${action.target}, ${action.text?.trim()||"c0"}${action.durationExplicit===false?"":`, ${num(action.dur)}`});`,beatDur:action=>action.dur,apply(){},
});

for(const [name,label,order] of [["gridbfs","Grid BFS",43],["gridastar","Grid A*",43.1]] as const)registerVerb({
  name,label,order,defaultDur:0,hasEase:false,hint:name==="gridastar"?"Explore grid cells with A* and reveal the computed shortest path":"Explore grid cells with breadth-first search and reveal the computed shortest path",
  ui:{durLabel:"Computed",hideDur:true,numbers:[{label:"Start column",step:1,min:0,initial:0},{label:"Start row",step:1,min:0,initial:0},{label:"Goal column",step:1,min:0,initial:1},{label:"Goal row",step:1,min:0,initial:1}],...(name==="gridastar"?{choices:[{label:"Heuristic",field:"prop" as const,options:["manhattan","euclidean","diagonal"]}]}:{})},appliesTo:kind=>kind==="grid",
  create:target=>({...baseAction(name,target,0),values:[0,0,1,1],prop:name==="gridastar"?"manhattan":null}),
  parse(stmt){const target=argName(stmt.args,0),start=argPoint(stmt.args,1),goal=argPoint(stmt.args,2),heuristic=argName(stmt.args,3);if(!target||!start||!goal||stmt.args.length>(name==="gridastar"?4:3)||(name==="gridbfs"&&stmt.args.length!==3))return null;return{...baseAction(name,target,0),values:[start.x,start.y,goal.x,goal.y],prop:name==="gridastar"?(heuristic??"manhattan"):null};},
  serialize:action=>`${name}(${action.target}, (${num(action.values?.[0]??0)}, ${num(action.values?.[1]??0)}), (${num(action.values?.[2]??1)}, ${num(action.values?.[3]??1)})${name==="gridastar"&&action.prop!=="manhattan"?`, ${action.prop}`:""});`,beatDur:(_action,entity)=>entity?.kind==="grid"?Math.max(.8,entity.rows*entity.cols*.18):1,apply(){},
});

registerVerb({
  name:"race",label:"Play race chart",order:43.2,defaultDur:10,hasEase:true,hint:"Interpolate periods, values, ranks, bars/lines, and companion panels in native Preview",
  ui:{durLabel:"Seconds",durMin:.5},appliesTo:kind=>kind==="racechart",create:target=>baseAction("race",target,10),
  parse(stmt){const target=argName(stmt.args,0);return target?parseTail(baseAction("race",target,10),stmt,1,true):null;},serialize:action=>`race(${action.target}, ${num(action.dur)}${easeSuffix(action,true)});`,beatDur:action=>action.dur,apply(){},
});

const processPathKinds=new Set(["line","arrow","link","brace","bracelabel","bracetext","axes","coords","segment","vector","ellipse","circle2","fullline","parabola","hyperbola","commontangent","plot","spline","arc"]);
registerVerb({name:"stream",label:"Stream particles",order:43.3,defaultDur:4,hasEase:true,hint:"Send persistent particle children progressively along one path and retain measurements",ui:{durLabel:"Seconds",durMin:.21,amount:{label:"Endpoint spread",step:1,min:0,max:500},entityArg:{label:"Path",accept:kind=>processPathKinds.has(kind)}},appliesTo:kind=>kind==="particles",create:target=>({...baseAction("stream",target,4),ref:"",amount:24}),parse(stmt){const target=argName(stmt.args,0),ref=argName(stmt.args,1),dur=argNumber(stmt.args,2),spread=argNumber(stmt.args,3),ease=argName(stmt.args,4);if(!target||!ref||dur===null||stmt.args.length>5||(stmt.args.length>3&&spread===null))return null;const action={...baseAction("stream",target,dur),ref,amount:spread??24};if(ease){const value=easeFrom(ease);if(!value)return null;action.ease=value;}return action;},serialize:action=>`stream(${action.target}, ${action.ref??"path"}, ${num(action.dur)}, ${num(action.amount??24)}${easeSuffix(action,true)});`,beatDur:action=>action.dur,apply(){}});
registerVerb({name:"emit",label:"Emit particles",order:43.4,defaultDur:5,hasEase:true,hint:"Release particles with deterministic speeds sampled from a named profile",ui:{durLabel:"Seconds",durMin:.51,amount:{label:"Endpoint spread",step:1,min:0,max:500},entityArg:{label:"Path",accept:kind=>processPathKinds.has(kind)},choices:[{label:"Speed profile",field:"prop",options:["uniform","maxwell"]}]},appliesTo:kind=>kind==="particles",create:target=>({...baseAction("emit",target,5),ref:"",prop:"uniform",amount:34}),parse(stmt){const target=argName(stmt.args,0),ref=argName(stmt.args,1),profile=argName(stmt.args,2),dur=argNumber(stmt.args,3),spread=argNumber(stmt.args,4),ease=argName(stmt.args,5);if(!target||!ref||!profile||dur===null||stmt.args.length>6||(stmt.args.length>4&&spread===null))return null;const action={...baseAction("emit",target,dur),ref,prop:profile,amount:spread??34};if(ease){const value=easeFrom(ease);if(!value)return null;action.ease=value;}return action;},serialize:action=>`emit(${action.target}, ${action.ref??"path"}, ${action.prop??"uniform"}, ${num(action.dur)}, ${num(action.amount??34)}${easeSuffix(action,true)});`,beatDur:action=>action.dur,apply(){}});
registerVerb({name:"advect",label:"Advect collection",order:43.5,defaultDur:4,hasEase:false,hint:"Carry particles or a cloud through an earlier bounded vector field",ui:{durLabel:"Seconds",durMin:.21,amount:{label:"Field rate",step:.05,min:.01,max:10},entityArg:{label:"Vector field",kinds:["vectorfield"]}},appliesTo:kind=>kind==="particles"||kind==="cloud",create:target=>({...baseAction("advect",target,4),ref:"",amount:.65}),parse(stmt){const target=argName(stmt.args,0),ref=argName(stmt.args,1),dur=argNumber(stmt.args,2),rate=argNumber(stmt.args,3);return target&&ref&&dur!==null&&stmt.args.length<=4&&(stmt.args.length<4||rate!==null)?{...baseAction("advect",target,dur),ref,amount:rate??.65}:null;},serialize:action=>`advect(${action.target}, ${action.ref??"field"}, ${num(action.dur)}, ${num(action.amount??.65)});`,beatDur:action=>action.dur,apply(){}});
registerVerb({name:"branch",label:"Branch collection",order:43.6,defaultDur:5,hasEase:true,hint:"Send each particle through one seeded route in a tagged directed acyclic path network",ui:{durLabel:"Seconds",durMin:.51,wordsArg:{label:"Tagged path network"}},appliesTo:kind=>kind==="particles",create:target=>({...baseAction("branch",target,5),text:"routes"}),parse(stmt){const target=argName(stmt.args,0),network=argName(stmt.args,1),dur=argNumber(stmt.args,2),ease=argName(stmt.args,3);if(!target||!network||dur===null||stmt.args.length>4)return null;const action={...baseAction("branch",target,dur),text:network};if(ease){const value=easeFrom(ease);if(!value)return null;action.ease=value;}return action;},serialize:action=>`branch(${action.target}, ${action.text?.trim()||"routes"}, ${num(action.dur)}${easeSuffix(action,true)});`,beatDur:action=>action.dur,apply(){}});
registerVerb({name:"collect",label:"Collect into histogram",order:43.7,defaultDur:.4,hasEase:true,hint:"Catch processed particles in bins selected by their actual process measurement",ui:{durLabel:"Seconds",durMin:.06,entityArg:{label:"Particle collection",kinds:["particles"]},choices:[{label:"Measurement",field:"prop",options:["speed","arrival","outcome","steps"]}]},appliesTo:kind=>kind==="livehistogram",create:target=>({...baseAction("collect",target,.4),ref:"",prop:"speed",durationExplicit:true}),parse(stmt){const target=argName(stmt.args,0),group=argName(stmt.args,1),metric=argName(stmt.args,2),dur=argNumber(stmt.args,3);if(!target||!group||!metric||stmt.args.length>5||(stmt.args.length>3&&dur===null))return null;const action={...baseAction("collect",target,dur??.4),ref:group,prop:metric,durationExplicit:dur!==null},ease=argName(stmt.args,4);if(ease){const value=easeFrom(ease);if(!value)return null;action.ease=value;}return action;},serialize:action=>`collect(${action.target}, ${action.ref??"particles"}, ${action.prop??"speed"}, ${num(action.dur)}${easeSuffix(action,true)});`,beatDur:action=>action.dur,apply(){}});
registerVerb({name:"observe",label:"Observe process",order:43.8,defaultDur:0,hasEase:false,hint:"Drive a counter or live histogram from measurements produced by the latest process",ui:{durLabel:"Process duration",hideDur:true,entityArg:{label:"Particle collection",kinds:["particles"]},choices:[{label:"Measurement",field:"prop",options:entity=>entity?.kind==="counter"?["arrived"]:["speed","arrival","outcome","steps"]}]},appliesTo:kind=>kind==="livehistogram"||kind==="counter",create:target=>({...baseAction("observe",target,0),ref:"",prop:"speed"}),parse(stmt){const target=argName(stmt.args,0),group=argName(stmt.args,1),metric=argName(stmt.args,2);return target&&group&&metric&&stmt.args.length===3?{...baseAction("observe",target,0),ref:group,prop:metric}:null;},serialize:action=>`observe(${action.target}, ${action.ref??"particles"}, ${action.prop??"speed"});`,beatDur:()=>0,apply(){}});

// --- Chemistry -------------------------------------------------------------

for(const [name,label,order,duration,kind] of [
  ["solve","Solve coefficients",44,2.4,"balance"],
  ["react","Run limiting reaction",44.1,2.6,"balance"],
  ["octet","Build Lewis octet",44.2,6,"lewis"],
] as const)registerVerb({
  name,label,order,defaultDur:duration,hasEase:false,
  hint:name==="solve"?"Write the exact balanced coefficients while conservation updates":name==="react"?"Animate limiting-reagent bars, yields, leftovers, and mass conservation":"Reveal electron count, bonds, lone pairs, promoted pairs, and formal charges",
  ui:{durLabel:"Seconds",durMin:name==="octet"?1:.2},appliesTo:entityKind=>entityKind===kind,
  canAdd:name==="react"?(_doc,selected)=>selected?.kind==="balance"&&selected.supplied!==null&&selected.limiting:undefined,
  addBlockedReason:name==="react"?"React needs both supplied amounts and the limiting-reagent view enabled in the Balance Inspector.":undefined,
  create:target=>baseAction(name,target,duration),
  parse(stmt){const target=argName(stmt.args,0),dur=argNumber(stmt.args,1);return target&&stmt.args.length<=2&&(stmt.args.length<2||dur!==null)?baseAction(name,target,dur??duration):null;},
  serialize:action=>`${name}(${action.target}, ${num(action.dur)});`,beatDur:action=>action.dur,apply(){},
});

registerVerb({
  name:"resonate",label:"Move resonance form",order:44.3,defaultDur:4,hasEase:false,hint:"Cycle equivalent Lewis bond, lone-pair, and formal-charge arrangements",
  ui:{durLabel:"Seconds",durMin:.6,amount:{label:"Cycles",step:1,min:1,max:8}},appliesTo:kind=>kind==="lewis",
  create:target=>({...baseAction("resonate",target,4),amount:2}),
  parse(stmt){const target=argName(stmt.args,0),dur=argNumber(stmt.args,1),cycles=argNumber(stmt.args,2);return target&&stmt.args.length<=3&&(stmt.args.length<2||dur!==null)&&(stmt.args.length<3||cycles!==null)?{...baseAction("resonate",target,dur??4),amount:cycles??2}:null;},
  serialize:action=>`resonate(${action.target}, ${num(action.dur)}, ${num(action.amount??2)});`,beatDur:action=>action.dur,apply(){},
});

registerVerb({
  name:"drop",label:"Emit level transition",order:44.4,defaultDur:1.6,hasEase:false,hint:"Drop one electron to a lower level and emit its computed photon and spectrum line",
  ui:{durLabel:"Seconds",durMin:.3,numbers:[
    {label:"From level",step:1,min:2,max:entity=>entity?.kind==="levels"?entity.nmax:12,initial:2},
    {label:"To level",step:1,min:1,max:entity=>entity?.kind==="levels"?Math.max(1,entity.nmax-1):11,initial:1},
  ]},appliesTo:kind=>kind==="levels",
  create:target=>({...baseAction("drop",target,1.6),values:[2,1]}),
  parse(stmt){const target=argName(stmt.args,0),from=argNumber(stmt.args,1),to=argNumber(stmt.args,2),dur=argNumber(stmt.args,3);return target&&from!==null&&to!==null&&stmt.args.length<=4&&(stmt.args.length<4||dur!==null)?{...baseAction("drop",target,dur??1.6),values:[from,to]}:null;},
  serialize:action=>`drop(${action.target}, ${num(action.values?.[0]??2)}, ${num(action.values?.[1]??1)}, ${num(action.dur)});`,beatDur:action=>action.dur,apply(){},
});

registerVerb({
  name:"discharge",label:"Discharge galvanic cell",order:44.5,defaultDur:4,hasEase:false,hint:"Move charge carriers and count charge and Faraday mass loss",
  ui:{durLabel:"Shot seconds",durMin:.4,amount:{label:"Experimental minutes",step:1,min:.01}},appliesTo:kind=>kind==="cell",
  create:target=>({...baseAction("discharge",target,4),amount:30}),
  parse(stmt){const target=argName(stmt.args,0),dur=argNumber(stmt.args,1),minutes=argNumber(stmt.args,2);return target&&stmt.args.length<=3&&(stmt.args.length<2||dur!==null)&&(stmt.args.length<3||minutes!==null)?{...baseAction("discharge",target,dur??4),amount:minutes??30}:null;},
  serialize:action=>`discharge(${action.target}, ${num(action.dur)}, ${num(action.amount??30)});`,beatDur:action=>action.dur,apply(){},
});

registerVerb({
  name:"dissolve",label:"Dissolve lattice",order:44.6,defaultDur:5,hasEase:false,hint:"Remove the least-coordinated ions first and form oriented hydration shells",
  ui:{durLabel:"Seconds",durMin:.5,amount:{label:"Ions leaving",step:1,min:1,max:entity=>entity?.kind==="lattice"?entity.cols*entity.rows:196}},appliesTo:kind=>kind==="lattice",
  create:target=>({...baseAction("dissolve",target,5),amount:6}),
  parse(stmt){const target=argName(stmt.args,0),dur=argNumber(stmt.args,1),count=argNumber(stmt.args,2);return target&&stmt.args.length<=3&&(stmt.args.length<2||dur!==null)&&(stmt.args.length<3||count!==null)?{...baseAction("dissolve",target,dur??5),amount:count??6}:null;},
  serialize:action=>`dissolve(${action.target}, ${num(action.dur)}, ${num(action.amount??6)});`,beatDur:action=>action.dur,apply(){},
});

// wait(secs) — targetless reading room.
registerVerb({
  name: "wait", label: "Wait", order: 50, defaultDur: 1, hasEase: false, targetless: true,
  hint: "Reading room — a deliberate pause",
  ui: { durLabel: "Seconds" },
  appliesTo: any,
  create: () => baseAction("wait", "", 0.8),
  parse(stmt) {
    const secs = argNumber(stmt.args, 0);
    if (secs === null || stmt.args.length !== 1) return null;
    return baseAction("wait", "", secs);
  },
  serialize: (action) => `wait(${num(action.dur)});`,
  beatDur: (action) => action.dur,
  apply() {},
});

/** Native fallback timing used when TTS is unavailable (roughly 150 wpm). */
export function estimateSpeakDuration(words: string): number {
  return Math.min(30, Math.max(.8, wordCount(words) / 2.5));
}

// speak("narration") / speak(caption, "narration") — voice is configured once
// at document level and edited beside the beat in Story.
registerVerb({
  name: "speak", label: "Speak", order: 49, defaultDur: .8, hasEase: false, targetless: true,
  hint: "Narrate this beat, optionally updating a caption at the same time",
  ui: {
    durLabel: "", hideDur: true,
    wordsArg: { label: "Narration" },
    optionalTarget: { label: "On-screen caption", noneLabel: "Voice only", kinds: ["caption"] },
    autoDurationFromWords: true,
    voiceConfig: true,
  },
  appliesTo: (kind) => kind === "caption",
  create: () => {
    const text = "Write narration here";
    return { ...baseAction("speak", "", estimateSpeakDuration(text)), text, durationExplicit: false };
  },
  parse(stmt) {
    const onlyWords = argString(stmt.args, 0);
    if (onlyWords !== null && stmt.args.length === 1) {
      return { ...baseAction("speak", "", estimateSpeakDuration(onlyWords)), text: onlyWords, durationExplicit: false };
    }
    const caption = argName(stmt.args, 0), words = argString(stmt.args, 1);
    if (!caption || words === null || stmt.args.length !== 2) return null;
    return { ...baseAction("speak", caption, estimateSpeakDuration(words)), text: words, durationExplicit: false };
  },
  serialize: (action) => action.target
    ? `speak(${action.target}, "${escapeWords(action.text ?? "")}");`
    : `speak("${escapeWords(action.text ?? "")}");`,
  beatDur: (action) => estimateSpeakDuration(action.text ?? ""),
  apply() {},
});

export { type VerbApplyCtx };

// say(id, "words", [dur], [ease]) — crossfade a text/caption/counter to new words.
registerVerb({
  name: "say", label: "Say", order: 16, defaultDur: 0.4, hasEase: true,
  hint: "Crossfade the words to new content (on-screen caption)",
  ui: { durLabel: "Seconds", wordsArg: { label: "New words" } },
  appliesTo: (kind) => kind === "text" || kind === "caption" || kind === "counter",
  create: (target) => ({ ...baseAction("say", target, 0.4), text: "new words" }),
  parse(stmt) {
    const target = argName(stmt.args, 0);
    const words = argString(stmt.args, 1);
    if (!target || words === null) return null;
    return parseTail({ ...baseAction("say", target, 0.4), text: words }, stmt, 2, true);
  },
  serialize: (action) => `say(${action.target}, "${escapeWords(action.text ?? "")}", ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur,
  apply() {},
});

// recolor(id, color, [dur]) — permanently animate the fill color.
registerVerb({
  name: "recolor", label: "Recolor", order: 32, defaultDur: 0.5, hasEase: false,
  hint: "Animate the fill color permanently",
  ui: { durLabel: "Seconds", colorArg: true },
  appliesTo: any,
  create: (target) => ({ ...baseAction("recolor", target, 0.3), color: "gold" }),
  parse(stmt) {
    const target = argName(stmt.args, 0);
    const color = argName(stmt.args, 1);
    if (!target || !color) return null;
    return parseTail({ ...baseAction("recolor", target, 0.5), color }, stmt, 2, false);
  },
  serialize: (action) => `recolor(${action.target}, ${action.color ?? "gold"}, ${num(action.dur)});`,
  beatDur: (action) => action.dur,
  apply() {},
});

// section("Title") — a banner card + jump marker on the timeline.
registerVerb({
  name: "section", label: "Section", order: 51, defaultDur: 2.2, hasEase: false, targetless: true, placement: "timeline",
  hint: "A section banner + jump marker",
  ui: { durLabel: "", hideDur: true, wordsArg: { label: "Title" } },
  appliesTo: any,
  create: () => ({ ...baseAction("section", "", 2.2), text: "Next chapter" }),
  parse(stmt) {
    const title = argString(stmt.args, 0);
    if (title === null || stmt.args.length !== 1) return null;
    return { ...baseAction("section", "", 2.2), text: title };
  },
  serialize: (action) => `section("${escapeWords(action.text ?? "")}");`,
  beatDur: () => 2.2,
  apply() {},
});

// cue(tick|pop|whoosh|chime) — a short procedural sound at this beat.
registerVerb({
  name: "cue", label: "Cue", order: 52, defaultDur: 0, hasEase: false, targetless: true,
  hint: "A short procedural sound (tick / pop / whoosh / chime)",
  ui: { durLabel: "", hideDur: true, propOptions: ["tick", "pop", "whoosh", "chime"] },
  appliesTo: any,
  create: () => ({ ...baseAction("cue", "", 0), prop: "tick" }),
  parse(stmt) {
    const sound = argName(stmt.args, 0);
    if (!sound || stmt.args.length !== 1) return null;
    return { ...baseAction("cue", "", 0), prop: sound };
  },
  serialize: (action) => `cue(${action.prop ?? "tick"});`,
  beatDur: () => 0.1,
  apply() {},
});

function escapeWords(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n");
}

// --- semantic runtime/camera verbs -----------------------------------------
// The Story exposes and round-trips these precisely. Their native pixels and
// time sampling intentionally remain the responsibility of Manic Preview.

registerVerb({
  name: "mark", label: "Timeline mark", order: 53, defaultDur: 0, hasEase: false, targetless: true, placement: "timeline",
  hint: "A named jump marker in the animation timeline",
  ui: { durLabel: "", hideDur: true, wordsArg: { label: "Marker name" } }, appliesTo: any,
  create: () => ({ ...baseAction("mark", "", 0), text: "chapter" }),
  parse(stmt) { const name = argString(stmt.args, 0); return name !== null && stmt.args.length === 1 ? { ...baseAction("mark", "", 0), text: name } : null; },
  serialize: (action) => `mark("${escapeWords(action.text ?? "chapter")}");`, beatDur: () => 0, apply() {},
});

registerVerb({
  name: "cam", label: "Camera pan", order: 54, defaultDur: 1, hasEase: true, targetless: true,
  hint: "Pan the native camera; the Canvas marks intent without changing its authoring view",
  ui: { durLabel: "Seconds", point: "absolute" }, appliesTo: any,
  create: () => ({ ...baseAction("cam", "", 1), point: { x: 640, y: 360 } }),
  parse(stmt) { const point = argPoint(stmt.args, 0); return point ? parseTail({ ...baseAction("cam", "", 1), point }, stmt, 1, true) : null; },
  serialize: (action) => `cam(${pt(action.point?.x ?? 640, action.point?.y ?? 360)}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "zoom", label: "Camera zoom", order: 55, defaultDur: 1, hasEase: true, targetless: true,
  hint: "Zoom the native camera; the Canvas keeps a stable design view",
  ui: { durLabel: "Seconds", amount: { label: "Zoom factor", step: .1 } }, appliesTo: any,
  create: () => ({ ...baseAction("zoom", "", 1), amount: 1.5 }),
  parse(stmt) { const amount = argNumber(stmt.args, 0); return amount !== null ? parseTail({ ...baseAction("zoom", "", 1), amount }, stmt, 1, true) : null; },
  serialize: (action) => `zoom(${num(action.amount ?? 1)}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur, apply() {},
});

// Motion relationships are represented honestly on Canvas (targets, pivots,
// paths and camera intent); native Preview remains responsible for sampling.
registerVerb({
  name: "turn", label: "Turn around pivot", order: 23.5, defaultDur: .7, hasEase: true,
  hint: "Rotate an entity or tag rigidly around a point or another entity",
  ui: { durLabel: "Seconds", amount: { label: "Degrees", step: 15 }, pointOrEntity: { label: "Pivot" } }, appliesTo: direct2D,
  create(target) { return { ...baseAction("turn", target, .7), point: { x: 0, y: 0 }, amount: 90 }; },
  parse(stmt) {
    const target = argName(stmt.args, 0), point = argPoint(stmt.args, 1), ref = argName(stmt.args, 1), degrees = argNumber(stmt.args, 2);
    if (!target || (!point && !ref) || degrees === null) return null;
    return parseTail({ ...baseAction("turn", target, .7), point, ref, amount: degrees }, stmt, 3, true);
  },
  serialize: (action) => `turn(${action.target}, ${action.ref ?? pt(action.point?.x ?? 0, action.point?.y ?? 0)}, ${num(action.amount ?? 90)}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur, apply() {},
});

function rollDefaultAmount(action: SceneAction, doc?: SceneDoc): number {
  const track = doc?.entities.find((entity) => entity.id === action.ref);
  return track?.kind === "line" ? Math.hypot(track.x2 - track.x1, track.y2 - track.y1) : 1;
}

registerVerb({
  name: "roll", label: "Roll without slipping", order: 23.6, defaultDur: 2, hasEase: true,
  hint: "Roll a circle or tagged rig along a line or circular track without slipping",
  ui: {
    targetLabel: "Rolling body or rig",
    targetTags: true,
    durLabel: "Seconds",
    durMin: .01,
    amount: { label: "Distance (line) / laps (circle)", step: .1 },
    entityArg: { label: "Track", kinds: ["line", "circle"] },
  },
  appliesTo: (kind) => kind === "circle",
  canAdd: (doc, selected) => selected?.kind === "circle" && doc.entities.some((entity) => entity.id !== selected.id && (entity.kind === "line" || entity.kind === "circle")),
  addBlockedReason: "Roll needs a circle body and a separate line or circle track.",
  create: (target) => ({ ...baseAction("roll", target, 2), ref: "track", ease: "linear", amountExplicit: false, durationExplicit: false }),
  completeAction(action, doc) { if (action.amountExplicit !== true) action.amount = rollDefaultAmount(action, doc); },
  parse(stmt, doc) {
    const target = argName(stmt.args, 0), track = argName(stmt.args, 1), amount = argNumber(stmt.args, 2), dur = argNumber(stmt.args, 3), easeName = argName(stmt.args, 4);
    if (!target || !track || stmt.args.length < 2 || stmt.args.length > 5 || (stmt.args.length > 2 && amount === null) || (stmt.args.length > 3 && dur === null)) return null;
    const ease = easeName === null ? "linear" : easeFrom(easeName);
    if (!ease) return null;
    return { ...baseAction("roll", target, dur ?? 2), ref: track, amount: amount ?? rollDefaultAmount({ ...baseAction("roll", target, 2), ref: track }, doc), ease, amountExplicit: amount !== null, durationExplicit: dur !== null };
  },
  serialize(action) {
    const amount = action.amountExplicit === false && action.durationExplicit !== true && action.ease === "linear" ? "" : `, ${num(action.amount ?? 1)}`;
    const duration = action.durationExplicit === true || action.ease !== "linear" ? `, ${num(action.dur)}` : "";
    const ease = action.ease !== "linear" ? `, ${action.ease}` : "";
    return `roll(${action.target}, ${action.ref ?? "track"}${amount}${duration}${ease});`;
  },
  beatDur: (action) => action.dur,
  apply() {},
});

registerVerb({
  name: "flow", label: "Flow along path", order: 28, defaultDur: 1, hasEase: false,
  hint: "Send a luminous pulse or finite stream over a path",
  ui: {
    durLabel: "Seconds",
    choices: [
      { label: "Direction", field: "prop", options: ["forward", "reverse", "both"] },
      { label: "Mode", field: "text", options: ["once", "continuous"] },
    ],
  },
  appliesTo: flowPaths,
  create(target) { return { ...baseAction("flow", target, 1), prop: "forward", text: "once" }; },
  parse(stmt) {
    const target = argName(stmt.args, 0);
    if (!target) return null;
    const dur = argNumber(stmt.args, 1) ?? 1;
    const direction = argName(stmt.args, 2) ?? "forward", mode = argName(stmt.args, 3) ?? "once";
    if (!["forward", "reverse", "both"].includes(direction) || !["once", "continuous"].includes(mode) || stmt.args.length > 4) return null;
    return { ...baseAction("flow", target, dur), prop: direction, text: mode };
  },
  serialize: (action) => `flow(${action.target}, ${num(action.dur)}, ${action.prop ?? "forward"}, ${action.text ?? "once"});`,
  beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "become", label: "Become blueprint", order: 29, defaultDur: .8, hasEase: true,
  hint: "Keep the source id while adopting another entity's visual blueprint",
  ui: { durLabel: "Seconds", entityArg: { label: "Blueprint", accept: direct2D } }, appliesTo: direct2D,
  create(target) { return { ...baseAction("become", target, .8), ref: "" }; },
  parse(stmt) {
    const target = argName(stmt.args, 0), ref = argName(stmt.args, 1);
    return target && ref && target !== ref ? parseTail({ ...baseAction("become", target, .8), ref }, stmt, 2, true) : null;
  },
  serialize: (action) => `become(${action.target}, ${action.ref ?? "blueprint"}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "attach", label: "Attach", order: 29.2, defaultDur: 0, hasEase: false,
  hint: "Keep an entity pinned to another entity, or release it with none",
  ui: { durLabel: "", hideDur: true, point: "delta", entityArg: { label: "Attach to", accept: direct2D, allowNone: true } }, appliesTo: direct2D,
  create(target) { return { ...baseAction("attach", target, 0), ref: "none", point: { x: 0, y: 0 } }; },
  parse(stmt) {
    const target = argName(stmt.args, 0), ref = argName(stmt.args, 1), offset = argPoint(stmt.args, 2) ?? { x: 0, y: 0 };
    if (!target || !ref || stmt.args.length > 3 || (stmt.args.length > 2 && !argPoint(stmt.args, 2))) return null;
    return { ...baseAction("attach", target, 0), ref, point: offset };
  },
  serialize: (action) => `attach(${action.target}, ${action.ref ?? "none"}${action.ref !== "none" && (action.point?.x || action.point?.y) ? `, ${pt(action.point?.x ?? 0, action.point?.y ?? 0)}` : ""});`,
  beatDur: () => 0, apply() {},
});

registerVerb({
  name: "attach3", label: "Attach in 3D", order: 29.3, defaultDur: 0, hasEase: false, concreteStoryTargetsOnly: true,
  hint: "Attach a concrete 3D entity to another world-space entity, rigidly or by position, or release it with none",
  ui: { durLabel: "", hideDur: true, entityArg: { label: "Attach to", accept: attachable3, allowNone: true, includeChildren: true, concreteChildrenOnly: true }, choices: [{ label: "Attachment mode", field: "prop", options: ["position", "rigid"] }], numbers: [{ label: "Offset X", step: .1 }, { label: "Offset Y", step: .1 }, { label: "Offset Z", step: .1 }] }, appliesTo: attachable3,
  create(target) { return { ...baseAction("attach3", target, 0), ref: "none", prop: "position", values: [0, 0, 0] }; },
  parse(stmt) {
    const target = argName(stmt.args, 0), ref = argName(stmt.args, 1), offset = argPoint3(stmt.args, 2), mode = argName(stmt.args, 3);
    if (!target || !ref || stmt.args.length > 4 || (stmt.args.length > 2 && !offset) || (stmt.args.length > 3 && mode !== "position" && mode !== "rigid")) return null;
    return { ...baseAction("attach3", target, 0), ref, prop: mode ?? "position", values: [offset?.x ?? 0, offset?.y ?? 0, offset?.z ?? 0] };
  },
  serialize(action) {
    const ref = action.ref ?? "none", values = action.values ?? [0, 0, 0], mode = action.prop === "rigid" ? "rigid" : "position";
    if (ref === "none") return `attach3(${action.target}, none);`;
    const hasOffset = values.some((value) => value !== 0);
    return `attach3(${action.target}, ${ref}${hasOffset || mode === "rigid" ? `, ${pt3(values[0] ?? 0, values[1] ?? 0, values[2] ?? 0)}` : ""}${mode === "rigid" ? ", rigid" : ""});`;
  },
  beatDur: () => 0, apply() {},
});

function vector3Verb(config: {
  name: "move3" | "shift3" | "rotate3" | "grow3";
  label: string; hint: string; order: number; defaultDur: number;
  vectorLabel: string; initial: [number, number, number]; appliesTo: VerbDef["appliesTo"];
}): VerbDef {
  return {
    ...config, hasEase: true, concreteStoryTargetsOnly: true,
    ui: { durLabel: "Seconds", point3: { label: config.vectorLabel } },
    create: (target) => ({ ...baseAction(config.name, target, config.defaultDur), values: [...config.initial] }),
    parse(stmt) {
      const target = argName(stmt.args, 0), point = argPoint3(stmt.args, 1);
      return target && point ? parseTail({ ...baseAction(config.name, target, config.defaultDur), values: [point.x, point.y, point.z] }, stmt, 2, true) : null;
    },
    serialize: (action) => `${config.name}(${action.target}, ${pt3(action.values?.[0] ?? 0, action.values?.[1] ?? 0, action.values?.[2] ?? 0)}, ${num(action.dur)}${easeSuffix(action, true)});`,
    beatDur: (action) => action.dur,
    apply() {},
  };
}

registerVerb(vector3Verb({ name: "move3", label: "Move in 3D", hint: "Move one native 3D entity to an absolute world position", order: 29.31, defaultDur: .7, vectorLabel: "World destination", initial: [0, 0, 0], appliesTo: transformTarget3 }));
registerVerb(vector3Verb({ name: "shift3", label: "Shift in 3D", hint: "Move one native 3D entity by a world-space delta", order: 29.32, defaultDur: .7, vectorLabel: "World delta", initial: [1, 0, 0], appliesTo: transformTarget3 }));
registerVerb(vector3Verb({ name: "rotate3", label: "Rotate in 3D", hint: "Animate one native 3D entity to absolute XYZ Euler angles", order: 29.33, defaultDur: .8, vectorLabel: "XYZ degrees", initial: [0, 0, 90], appliesTo: transformTarget3 }));
registerVerb(vector3Verb({ name: "grow3", label: "Grow 3D endpoint", hint: "Animate a line3 or arrow3 endpoint to an absolute world point", order: 29.34, defaultDur: .7, vectorLabel: "World endpoint", initial: [1, 0, 0], appliesTo: (kind) => kind === "line3" || kind === "arrow3" }));

registerVerb({
  name: "turn3", label: "Turn 3D arrangement", order: 29.35, defaultDur: .9, hasEase: true, allowAuthorOnlyTargets: true,
  hint: "Rigidly rotate an entity or generated 3D family around a world-space pivot and axis",
  ui: {
    durLabel: "Seconds", targetLabel: "Entity or family", targetTags: true,
    point3OrEntity: { label: "World pivot", accept: attachable3, includeChildren: true },
    amount: { label: "Degrees", step: 5 },
    choices: [{ label: "Axis", field: "prop", options: ["x", "y", "z", "custom"] }],
    point3: { label: "Custom axis vector", offset: 3, visibleWhen: { field: "prop", equals: "custom" } },
  },
  appliesTo: drawable3,
  create(target) { return { ...baseAction("turn3", target, .9), ref: null, prop: "z", amount: 90, values: [0, 0, 0, 0, 0, 1] }; },
  parse(stmt) {
    const target = argName(stmt.args, 0), pivot = argPoint3(stmt.args, 1), pivotRef = argName(stmt.args, 1);
    const axis = argPoint3(stmt.args, 2), axisName = argName(stmt.args, 2), degrees = argNumber(stmt.args, 3);
    if (!target || (!pivot && !pivotRef) || (!axis && !["x", "y", "z"].includes(axisName ?? "")) || degrees === null) return null;
    const values = [pivot?.x ?? 0, pivot?.y ?? 0, pivot?.z ?? 0, axis?.x ?? 0, axis?.y ?? 0, axis?.z ?? 1];
    return parseTail({ ...baseAction("turn3", target, .9), ref: pivotRef, prop: axis ? "custom" : axisName, amount: degrees, values }, stmt, 4, true);
  },
  serialize(action) {
    const values = action.values ?? [0, 0, 0, 0, 0, 1];
    const pivot = action.ref ?? pt3(values[0] ?? 0, values[1] ?? 0, values[2] ?? 0);
    const axis = ["x", "y", "z"].includes(action.prop ?? "") ? action.prop! : pt3(values[3] ?? 0, values[4] ?? 0, values[5] ?? 1);
    return `turn3(${action.target}, ${pivot}, ${axis}, ${num(action.amount ?? 90)}, ${num(action.dur)}${easeSuffix(action, true)});`;
  },
  beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "become3", label: "Become 3D blueprint", order: 29.36, defaultDur: 1, hasEase: true, concreteStoryTargetsOnly: true,
  hint: "Keep a drawable 3D source id while adopting another entity's geometry, transform and style",
  ui: { durLabel: "Seconds", entityArg: { label: "3D blueprint", accept: attachable3, includeChildren: true, concreteChildrenOnly: true } },
  appliesTo: attachable3,
  canAdd: (doc) => doc.entities.filter((entity) => attachable3(entity.kind)).length >= 2,
  addBlockedReason: "Become 3D needs two drawable 3D entities.",
  create(target) { return { ...baseAction("become3", target, 1), ref: "" }; },
  parse(stmt) {
    const target = argName(stmt.args, 0), blueprint = argName(stmt.args, 1);
    return target && blueprint && target !== blueprint ? parseTail({ ...baseAction("become3", target, 1), ref: blueprint }, stmt, 2, true) : null;
  },
  serialize: (action) => `become3(${action.target}, ${action.ref ?? "blueprint"}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "travel3", label: "Travel along 3D path", order: 29.37, defaultDur: 1, hasEase: true, concreteStoryTargetsOnly: true,
  hint: "Move one persistent 3D entity along a line, arrow or sampled 3D path",
  ui: { durLabel: "Seconds", entityArg: { label: "3D path", accept: pathTarget3, includeChildren: true, concreteChildrenOnly: true } },
  appliesTo: attachable3,
  canAdd: (doc) => doc.entities.some((entity) => pathTarget3(entity.kind)),
  addBlockedReason: "Travel 3D needs a line3, arrow3, curve3, or sampled 3D path.",
  create(target) { return { ...baseAction("travel3", target, 1), ref: "" }; },
  parse(stmt) {
    const target = argName(stmt.args, 0), path = argName(stmt.args, 1);
    return target && path && target !== path ? parseTail({ ...baseAction("travel3", target, 1), ref: path }, stmt, 2, true) : null;
  },
  serialize: (action) => `travel3(${action.target}, ${action.ref ?? "path"}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "drift3", label: "Drift 3D collection", order: 29.38, defaultDur: 4, hasEase: false,
  hint: "Compile deterministic bounded ambient motion for every stable collection child",
  ui: { durLabel: "Seconds", durMin: .21, amount: { label: "Drift amount", step: .05, min: 0, max: 10 } }, appliesTo: collectionTarget3,
  create(target) { return { ...baseAction("drift3", target, 4), amount: .35 }; },
  parse(stmt) {
    const target = argName(stmt.args, 0), duration = argNumber(stmt.args, 1), amount = argNumber(stmt.args, 2) ?? .35;
    return target && duration !== null && duration > .2 && amount >= 0 && amount <= 10 && stmt.args.length <= 3 ? { ...baseAction("drift3", target, duration), amount } : null;
  },
  serialize: (action) => `drift3(${action.target}, ${num(Math.max(.21, action.dur))}, ${num(Math.max(0, Math.min(10, action.amount ?? .35)))});`,
  beatDur: (action) => action.dur, apply() {},
});

function numericWords(source: string): number[] | null {
  const values = source.split(/[\s,]+/u).filter(Boolean).map(Number);
  return values.length > 0 && values.every(Number.isFinite) ? values : null;
}

registerVerb({
  name: "chain3", label: "Chain 3D children", order: 29.39, defaultDur: 6, hasEase: false,
  hint: "Turn stable collection children into a deterministic rotating dependency chain",
  ui: {
    durLabel: "Seconds", durMin: .21,
    numberLists: [
      { label: "Segment lengths", step: .1, initial: 1, countFromTarget: "count" },
      { label: "Rotation rates", step: .1, initial: 1, countFromTarget: "count" },
    ],
  },
  appliesTo: collectionTarget3,
  create(target) { return { ...baseAction("chain3", target, 6), valueLists: [[1], [1]] }; },
  parse(stmt) {
    const target = argName(stmt.args, 0), lengthsText = argString(stmt.args, 1), ratesText = argString(stmt.args, 2), duration = argNumber(stmt.args, 3);
    const lengths = lengthsText === null ? null : numericWords(lengthsText), rates = ratesText === null ? null : numericWords(ratesText);
    return target && lengths && rates && duration !== null && duration > .2 && stmt.args.length === 4 ? { ...baseAction("chain3", target, duration), valueLists: [lengths, rates] } : null;
  },
  serialize(action) {
    const [lengths = [1], rates = [1]] = action.valueLists ?? [];
    return `chain3(${action.target}, "${lengths.map(num).join(" ")}", "${rates.map(num).join(" ")}", ${num(Math.max(.21, action.dur))});`;
  },
  beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "advect3", label: "Advect 3D collection", order: 29.4, defaultDur: 4, hasEase: false,
  hint: "Integrate every stable collection child through a vectorfield3 with deterministic RK4 motion",
  ui: { durLabel: "Seconds", durMin: .21, amount: { label: "Advection rate", step: .05, min: .01, max: 8 }, entityArg: { label: "Vector field", kinds: ["vectorfield3"] } },
  appliesTo: collectionTarget3,
  canAdd: (doc) => doc.entities.some((entity) => entity.kind === "vectorfield3"),
  addBlockedReason: "Advect 3D needs a vectorfield3 in the scene.",
  create(target) { return { ...baseAction("advect3", target, 4), ref: "", amount: .7 }; },
  parse(stmt) {
    const target = argName(stmt.args, 0), field = argName(stmt.args, 1), duration = argNumber(stmt.args, 2), rate = argNumber(stmt.args, 3) ?? .7;
    return target && field && duration !== null && duration > .2 && rate >= .01 && rate <= 8 && stmt.args.length <= 4 ? { ...baseAction("advect3", target, duration), ref: field, amount: rate } : null;
  },
  serialize: (action) => `advect3(${action.target}, ${action.ref ?? "field"}, ${num(Math.max(.21, action.dur))}, ${num(Math.max(.01, Math.min(8, action.amount ?? .7)))});`,
  beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "oscillate", label: "Oscillate", order: 30.2, defaultDur: 6, hasEase: false,
  hint: "Continuously oscillate size, opacity, position or hue",
  ui: {
    durLabel: "Total seconds", propOptions: ["size", "opacity", "x", "y", "hue"],
    numbers: [{ label: "Period", step: .1 }, { label: "Amplitude", step: .1 }, { label: "Phase", step: .05 }],
  }, appliesTo: direct2D,
  create(target) { return { ...baseAction("oscillate", target, 6), prop: "size", values: [2, .08, 0] }; },
  parse(stmt) {
    const target = argName(stmt.args, 0), prop = argName(stmt.args, 1), period = argNumber(stmt.args, 2), amp = argNumber(stmt.args, 3);
    if (!target || !prop || !["size", "scale", "opacity", "fade", "x", "y", "hue"].includes(prop) || period === null || amp === null) return null;
    const phase = argNumber(stmt.args, 4) ?? 0, dur = argNumber(stmt.args, 5) ?? 6;
    if (stmt.args.length > 6) return null;
    return { ...baseAction("oscillate", target, dur), prop, values: [period, amp, phase] };
  },
  serialize: (action) => `oscillate(${action.target}, ${action.prop ?? "size"}, ${num(action.values?.[0] ?? 2)}, ${num(action.values?.[1] ?? .08)}, ${num(action.values?.[2] ?? 0)}, ${num(action.dur)});`,
  beatDur: (action) => action.dur, apply() {},
});

registerVerb(simpleVerb({
  name: "shake", label: "Shake", order: 30.3, defaultDur: .55, hasEase: false,
  hint: "Horizontal error or impact gesture", appliesTo: direct2D, apply() {},
}));

registerVerb({
  name: "followshot", label: "Follow shot", order: 55.05, defaultDur: 0, hasEase: false,
  hint: "Attach the native 2D camera to an entity, or release it with none",
  ui: { durLabel: "", hideDur: true, point: "delta", targetNone: true }, appliesTo: direct2D,
  create(target) { return { ...baseAction("followshot", target, 0), point: { x: 0, y: 0 } }; },
  parse(stmt) {
    const target = argName(stmt.args, 0), offset = argPoint(stmt.args, 1) ?? { x: 0, y: 0 };
    if (!target || stmt.args.length > 2 || (stmt.args.length > 1 && !argPoint(stmt.args, 1))) return null;
    return { ...baseAction("followshot", target, 0), point: offset };
  },
  serialize: (action) => `followshot(${action.target}${action.target !== "none" && (action.point?.x || action.point?.y) ? `, ${pt(action.point?.x ?? 0, action.point?.y ?? 0)}` : ""});`,
  beatDur: () => 0, apply() {},
});

registerVerb({
  name: "orbit3", label: "Orbit 3D camera", order: 55.1, defaultDur: 1.2, hasEase: true, targetless: true,
  hint: "Set 3D camera azimuth, elevation and radius in native Preview",
  ui: { durLabel: "Seconds", amount: { label: "Azimuth °", step: 5 }, numbers: [{ label: "Elevation °", step: 5 }, { label: "Radius", step: .1 }] }, appliesTo: any,
  canAdd: (doc) => doc.entities.some((entity) => entity.kind === "camera3"),
  create: () => ({ ...baseAction("orbit3", "__camera3", 1.2), amount: 45, values: [30, 10] }),
  parse(stmt) {
    const azimuth = argNumber(stmt.args, 0), elevation = argNumber(stmt.args, 1), radius = argNumber(stmt.args, 2);
    return azimuth !== null && elevation !== null && radius !== null
      ? parseTail({ ...baseAction("orbit3", "__camera3", 1.2), amount: azimuth, values: [elevation, radius] }, stmt, 3, true) : null;
  },
  serialize: (action) => `orbit3(${num(action.amount ?? 45)}, ${num(action.values?.[0] ?? 30)}, ${num(action.values?.[1] ?? 10)}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "roll3", label: "Roll 3D camera", order: 55.2, defaultDur: 1.2, hasEase: true, targetless: true,
  hint: "Roll the native 3D camera around its viewing axis",
  ui: { durLabel: "Seconds", amount: { label: "Degrees", step: 5 } }, appliesTo: any,
  canAdd: (doc) => doc.entities.some((entity) => entity.kind === "camera3"),
  create: () => ({ ...baseAction("roll3", "__camera3", 1.2), amount: 90 }),
  parse(stmt) { const degrees = argNumber(stmt.args, 0); return degrees !== null ? parseTail({ ...baseAction("roll3", "__camera3", 1.2), amount: degrees }, stmt, 1, true) : null; },
  serialize: (action) => `roll3(${num(action.amount ?? 0)}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "look3", label: "Look at 3D point", order: 55.21, defaultDur: .8, hasEase: true, targetless: true,
  hint: "Move the native 3D camera target to an absolute world-space point",
  ui: { durLabel: "Seconds", point3: { label: "World look target" } }, appliesTo: any,
  canAdd: (doc) => doc.entities.some((entity) => entity.kind === "camera3"),
  addBlockedReason: "Look 3D needs camera3 in the scene.",
  create: () => ({ ...baseAction("look3", "__camera3", .8), values: [0, 0, 0] }),
  parse(stmt) {
    const point = argPoint3(stmt.args, 0);
    return point ? parseTail({ ...baseAction("look3", "__camera3", .8), values: [point.x, point.y, point.z] }, stmt, 1, true) : null;
  },
  serialize: (action) => `look3(${pt3(action.values?.[0] ?? 0, action.values?.[1] ?? 0, action.values?.[2] ?? 0)}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "view3", label: "Frame a 3D view", order: 55.22, defaultDur: 1, hasEase: true, allowAuthorOnlyTargets: true,
  hint: "Aim and fit the native 3D camera to an entity, generated family, or tagged group",
  ui: {
    durLabel: "Seconds", targetLabel: "3D subject", targetTags: true,
    amount: { label: "Fit margin", step: .05, min: 1 },
    choices: [{ label: "Shot", field: "prop", options: ["front", "side", "right", "left", "top", "isometric", "iso", "fit"] }],
  },
  appliesTo: drawable3,
  canAdd: (doc) => doc.entities.some((entity) => entity.kind === "camera3"),
  addBlockedReason: "View 3D needs camera3 in the scene.",
  create: (target) => ({ ...baseAction("view3", target, 1), prop: "isometric", amount: 1.18 }),
  parse(stmt) {
    const target = argName(stmt.args, 0), shot = argString(stmt.args, 1) ?? argName(stmt.args, 1);
    if (!target || !shot || !["front", "side", "right", "left", "top", "isometric", "iso", "fit"].includes(shot)) return null;
    const action = parseTail({ ...baseAction("view3", target, 1), prop: shot, amount: 1.18 }, { ...stmt, args: stmt.args.slice(0, Math.min(stmt.args.length, 4)) }, 2, true);
    if (!action) return null;
    const margin = argNumber(stmt.args, 4) ?? 1.18;
    if (stmt.args.length > 5 || margin < 1) return null;
    action.amount = margin;
    return action;
  },
  serialize: (action) => `view3(${action.target}, "${action.prop ?? "isometric"}", ${num(action.dur)}, ${action.ease}, ${num(Math.max(1, action.amount ?? 1.18))});`,
  beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "present3", label: "Present scientific frame", order: 55.23, defaultDur: .65, hasEase: true, allowAuthorOnlyTargets: true,
  hint: "Change a frame3 family between textbook and spatial visual treatment without moving geometry",
  ui: { durLabel: "Seconds", choices: [{ label: "Presentation", field: "prop", options: ["textbook", "spatial"] }] },
  appliesTo: (kind) => kind === "frame3",
  create: (target) => ({ ...baseAction("present3", target, .65), prop: "spatial" }),
  parse(stmt) {
    const target = argName(stmt.args, 0), mode = argName(stmt.args, 1);
    return target && (mode === "textbook" || mode === "spatial") ? parseTail({ ...baseAction("present3", target, .65), prop: mode }, stmt, 2, true) : null;
  },
  serialize: (action) => `present3(${action.target}, ${action.prop ?? "spatial"}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "followshot3", label: "Follow 3D subject", order: 55.24, defaultDur: 0, hasEase: false, concreteStoryTargetsOnly: true,
  hint: "Attach the native 3D camera target to one concrete entity, or release it with none",
  ui: { durLabel: "", hideDur: true, targetNone: true, point3: { label: "World follow offset" } },
  appliesTo: attachable3,
  canAdd: (doc) => doc.entities.some((entity) => entity.kind === "camera3"),
  addBlockedReason: "Follow 3D subject needs camera3 in the scene.",
  create: (target) => ({ ...baseAction("followshot3", target, 0), values: [0, 0, 0] }),
  parse(stmt) {
    const target = argName(stmt.args, 0), offset = argPoint3(stmt.args, 1);
    if (!target || stmt.args.length > 2 || (stmt.args.length === 2 && !offset)) return null;
    return { ...baseAction("followshot3", target, 0), values: [offset?.x ?? 0, offset?.y ?? 0, offset?.z ?? 0] };
  },
  serialize(action) {
    const values = action.values ?? [0, 0, 0], hasOffset = values.some((value) => value !== 0);
    return `followshot3(${action.target}${action.target !== "none" && hasOffset ? `, ${pt3(values[0] ?? 0, values[1] ?? 0, values[2] ?? 0)}` : ""});`;
  },
  beatDur: () => 0, apply() {},
});

registerVerb({
  name: "cycle", label: "Cycle positions", order: 55.3, defaultDur: .8, hasEase: true,
  hint: "Move two or more entities into each other's positions along native arcs",
  ui: { durLabel: "Seconds", amount: { label: "Arc °", step: 5 }, entityList: { label: "Cycle members", min: 2 } }, appliesTo: cycleTarget,
  create: (target) => ({ ...baseAction("cycle", target, .8), amount: 90, refs: [] }),
  parse(stmt) {
    const firstNumber = stmt.args.findIndex((arg) => arg.type === "number");
    const split = firstNumber === -1 ? stmt.args.length : firstNumber;
    const ids = stmt.args.slice(0, split).map((_arg, index) => argName(stmt.args, index));
    if (ids.length < 2 || ids.some((id) => !id)) return null;
    const tail = stmt.args.slice(split);
    if (tail.length > 3) return null;
    const dur = tail.length > 0 ? argNumber(tail, 0) : .8;
    const arc = tail.length > 1 ? argNumber(tail, 1) : 90;
    const ease = tail.length > 2 ? easeFrom(argName(tail, 2)) : "smooth";
    if (dur === null || arc === null || !ease) return null;
    return { ...baseAction("cycle", ids[0]!, dur), amount: arc, refs: ids.slice(1) as string[], ease };
  },
  serialize: (action) => `cycle(${[action.target, ...(action.refs ?? [])].join(", ")}, ${num(action.dur)}, ${num(action.amount ?? 90)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur, apply() {},
});

registerVerb(simpleVerb({
  name: "disintegrate", label: "Disintegrate", order: 56, defaultDur: 1.2, hasEase: false,
  hint: "Dissolve the native silhouette into deterministic particles",
  appliesTo: direct2D, durMin: .15, apply() {},
  // The engine mints {target}.dust* ids — a second disintegrate on the same
  // target collides with them.
  canAdd: (doc, selected) => !!selected && !doc.steps.some((step) =>
    [...step.actions, ...(step.timed?.phases.flatMap((phase) => phase.segments.flatMap((segment) => segment.items.flatMap((item) => item.kind === "action" ? [item.action] : []))) ?? [])]
      .some((action) => action.verb === "disintegrate" && action.target === selected.id)),
  addBlockedReason: "This entity already disintegrates — the engine allows one per entity.",
}));

registerVerb(simpleVerb({
  name: "burst", label: "Particle burst", order: 57, defaultDur: .7, hasEase: false,
  hint: "Explode a particle group outward and fade it",
  appliesTo: (kind) => kind === "particles", apply() {},
}));

const TRAVEL_PATH_KINDS = ["plot", "deriv", "accum", "line", "arrow", "link", "tangent", "brace", "bracelabel", "bracetext", "segment", "vector", "ellipse", "circle2", "anglemark", "rightangle", "invertpath", "reflectpath"] as const;
registerVerb({
  name: "travel", label: "Travel path", order: 58, defaultDur: 1, hasEase: true,
  hint: "Move an entity along another entity's path in native Preview",
  ui: { durLabel: "Seconds", entityArg: { label: "Path", kinds: TRAVEL_PATH_KINDS } }, appliesTo: direct2D,
  create(target) { return { ...baseAction("travel", target, 1), ref: "" }; },
  parse(stmt) {
    const target = argName(stmt.args, 0), ref = argName(stmt.args, 1);
    return target && ref ? parseTail({ ...baseAction("travel", target, 1), ref }, stmt, 2, true) : null;
  },
  serialize: (action) => `travel(${action.target}, ${action.ref ?? "path"}, ${num(action.dur)}${easeSuffix(action, true)});`,
  beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "breathe", label: "Breathe", order: 59, defaultDur: 3, hasEase: false,
  hint: "Oscillate size with a period, amplitude and optional phase",
  ui: { durLabel: "Total seconds", amount: { label: "Period", step: .1 }, numbers: [{ label: "Amplitude", step: .01 }, { label: "Phase", step: .1 }] },
  appliesTo: any,
  create(target) { return { ...baseAction("breathe", target, 3), amount: 3, values: [.05, 0] }; },
  parse(stmt) {
    const target = argName(stmt.args, 0), period = argNumber(stmt.args, 1), amplitude = argNumber(stmt.args, 2);
    if (!target || period === null || amplitude === null) return null;
    const phase = argNumber(stmt.args, 3) ?? 0, dur = argNumber(stmt.args, 4) ?? period;
    if (stmt.args.length < 3 || stmt.args.length > 5) return null;
    return { ...baseAction("breathe", target, dur), amount: period, values: [amplitude, phase] };
  },
  serialize: (action) => `breathe(${action.target}, ${num(action.amount ?? 3)}, ${num(action.values?.[0] ?? .05)}, ${num(action.values?.[1] ?? 0)}, ${num(action.dur)});`,
  beatDur: (action) => action.dur, apply() {},
});

// --- Algo structures -------------------------------------------------------

const tokenCount = (entity: SceneEntity | null): number | undefined => entity && (entity.kind === "array" || entity.kind === "list") ? entity.source.trim().split(/\s+/u).filter(Boolean).length : undefined;
const lastIndex = (entity: SceneEntity | null): number | undefined => { const count = tokenCount(entity); return count === undefined ? undefined : Math.max(0, count - 1); };
const structureActions = (doc: Parameters<NonNullable<VerbDef["canAdd"]>>[0]): SceneAction[] => doc.steps.flatMap((step) => step.timed
  ? step.timed.phases.flatMap((phase) => phase.segments.flatMap((segment) => segment.items.flatMap((item) => item.kind === "action" ? [item.action] : [])))
  : step.actions);

registerVerb({
  name: "compare", label: "Compare array slots", order: 60, defaultDur: 1, hasEase: false, allowAuthorOnlyTargets: true,
  hint: "Flash the values currently occupying two fixed array slots",
  ui: { durLabel: "Native 1.0s flash", hideDur: true, colorArg: true, numbers: [
    { label: "First slot", step: 1, min: 0, max: lastIndex },
    { label: "Second slot", step: 1, min: 0, max: lastIndex },
  ] },
  appliesTo: (kind) => kind === "array",
  create: (target) => ({ ...baseAction("compare", target, 1), values: [0, 1], color: null }),
  parse(stmt) {
    const target = argName(stmt.args, 0), first = argNumber(stmt.args, 1), second = argNumber(stmt.args, 2), color = argName(stmt.args, 3);
    if (!target || first === null || second === null || stmt.args.length < 3 || stmt.args.length > 4 || (stmt.args.length === 4 && !color)) return null;
    return { ...baseAction("compare", target, 1), values: [Math.trunc(first), Math.trunc(second)], color };
  },
  serialize: (action) => `compare(${action.target}, ${num(Math.max(0, Math.trunc(action.values?.[0] ?? 0)))}, ${num(Math.max(0, Math.trunc(action.values?.[1] ?? 1)))}${action.color ? `, ${action.color}` : ""});`,
  beatDur: () => 1, apply() {},
});

registerVerb({
  name: "pointat", label: "Point at array slot", order: 60.1, defaultDur: .5, hasEase: false,
  hint: "Slide an array pointer horizontally to another fixed slot",
  ui: {
    durLabel: "Seconds", durMin: .01, targetLabel: "Pointer",
    entityArg: { label: "Array", kinds: ["array"] },
    amount: { label: "Destination slot", step: 1, min: 0, max: (_target, doc, action) => lastIndex(doc.entities.find((entity) => entity.id === action.ref) ?? null) },
  },
  appliesTo: (kind) => kind === "pointer",
  canAdd: (doc) => doc.entities.some((entity) => entity.kind === "array"), addBlockedReason: "Point at needs an array.",
  create(target) { return { ...baseAction("pointat", target, .5), ref: "", amount: 0 }; },
  parse(stmt) { const target = argName(stmt.args, 0), ref = argName(stmt.args, 1), slot = argNumber(stmt.args, 2), dur = argNumber(stmt.args, 3); if (!target || !ref || slot === null || stmt.args.length < 3 || stmt.args.length > 4 || (stmt.args.length === 4 && dur === null)) return null; return { ...baseAction("pointat", target, dur ?? .5), ref, amount: Math.trunc(slot) }; },
  serialize: (action) => `pointat(${action.target}, ${action.ref || "array"}, ${num(Math.max(0, Math.trunc(action.amount ?? 0)))}, ${num(Math.max(.01, action.dur))});`,
  beatDur: (action) => action.dur, apply() {},
});

function valueOperation(config: { name: "push" | "enqueue"; label: string; hint: string; kind: "stack" | "queue"; order: number }): VerbDef {
  return {
    name: config.name, label: config.label, hint: config.hint, order: config.order, defaultDur: .5, hasEase: false, allowAuthorOnlyTargets: true,
    ui: { durLabel: "Seconds", durMin: .01, wordsArg: { label: "Cell value" } }, appliesTo: (kind) => kind === config.kind,
    create: (target) => ({ ...baseAction(config.name, target, .5), text: config.kind === "stack" ? "5" : "A" }),
    parse(stmt) { const target = argName(stmt.args, 0), value = argString(stmt.args, 1), dur = argNumber(stmt.args, 2); if (!target || value === null || stmt.args.length < 2 || stmt.args.length > 3 || (stmt.args.length === 3 && dur === null)) return null; return { ...baseAction(config.name, target, dur ?? .5), text: value }; },
    serialize: (action) => `${config.name}(${action.target}, "${escapeString(action.text ?? "")}", ${num(Math.max(.01, action.dur))});`, beatDur: (action) => action.dur, apply() {},
  };
}

function removalOperation(config: { name: "pop" | "dequeue"; label: string; hint: string; kind: "stack" | "queue"; order: number; defaultDur: number; addVerb: "push" | "enqueue" }): VerbDef {
  return {
    name: config.name, label: config.label, hint: config.hint, order: config.order, defaultDur: config.defaultDur, hasEase: false, allowAuthorOnlyTargets: true,
    ui: { durLabel: "Seconds", durMin: .01 }, appliesTo: (kind) => kind === config.kind,
    canAdd(doc, selected) { if (!selected) return false; const actions = structureActions(doc).filter((action) => action.target === selected.id); return actions.filter((action) => action.verb === config.addVerb).length > actions.filter((action) => action.verb === config.name).length; },
    addBlockedReason: config.kind === "stack" ? "Add a Push beat before Pop so the native stack is not empty." : "Add an Enqueue beat before Dequeue so the native queue is not empty.",
    create: (target) => baseAction(config.name, target, config.defaultDur),
    parse(stmt) { const target = argName(stmt.args, 0), dur = argNumber(stmt.args, 1); if (!target || stmt.args.length > 2 || (stmt.args.length === 2 && dur === null)) return null; return baseAction(config.name, target, dur ?? config.defaultDur); },
    serialize: (action) => `${config.name}(${action.target}, ${num(Math.max(.01, action.dur))});`, beatDur: (action) => action.dur, apply() {},
  };
}

registerVerb(valueOperation({ name: "push", label: "Push onto stack", hint: "Drop a new value cell onto the LIFO top", kind: "stack", order: 61 }));
registerVerb(removalOperation({ name: "pop", label: "Pop stack", hint: "Lift and fade the current LIFO top cell", kind: "stack", order: 61.1, defaultDur: .45, addVerb: "push" }));
registerVerb(valueOperation({ name: "enqueue", label: "Enqueue", hint: "Slide a new value cell onto the FIFO back", kind: "queue", order: 61.2 }));
registerVerb(removalOperation({ name: "dequeue", label: "Dequeue", hint: "Remove the FIFO front and advance every remaining cell", kind: "queue", order: 61.3, defaultDur: .5, addVerb: "enqueue" }));

registerVerb({
  name: "insert", label: "Insert list node", order: 62, defaultDur: .6, hasEase: false, allowAuthorOnlyTargets: true,
  hint: "Splice a new node after a live list index and re-thread its pointers",
  ui: { durLabel: "Seconds", durMin: .01, amount: { label: "After index", step: 1, min: 0 }, wordsArg: { label: "Node value" } }, appliesTo: (kind) => kind === "list",
  create: (target) => ({ ...baseAction("insert", target, .6), amount: 0, text: "7" }),
  parse(stmt) { const target = argName(stmt.args, 0), after = argNumber(stmt.args, 1), value = argString(stmt.args, 2), dur = argNumber(stmt.args, 3); if (!target || after === null || value === null || stmt.args.length < 3 || stmt.args.length > 4 || (stmt.args.length === 4 && dur === null)) return null; return { ...baseAction("insert", target, dur ?? .6), amount: Math.trunc(after), text: value }; },
  serialize: (action) => `insert(${action.target}, ${num(Math.max(0, Math.trunc(action.amount ?? 0)))}, "${escapeString(action.text ?? "")}", ${num(Math.max(.01, action.dur))});`, beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "remove", label: "Remove list node", order: 62.1, defaultDur: .55, hasEase: false, allowAuthorOnlyTargets: true,
  hint: "Unlink one live list index and re-thread the remaining pointers",
  ui: { durLabel: "Seconds", durMin: .01, amount: { label: "Node index", step: 1, min: 0 } }, appliesTo: (kind) => kind === "list",
  create: (target) => ({ ...baseAction("remove", target, .55), amount: 0 }),
  parse(stmt) { const target = argName(stmt.args, 0), index = argNumber(stmt.args, 1), dur = argNumber(stmt.args, 2); if (!target || index === null || stmt.args.length < 2 || stmt.args.length > 3 || (stmt.args.length === 3 && dur === null)) return null; return { ...baseAction("remove", target, dur ?? .55), amount: Math.trunc(index) }; },
  serialize: (action) => `remove(${action.target}, ${num(Math.max(0, Math.trunc(action.amount ?? 0)))}, ${num(Math.max(.01, action.dur))});`, beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "put", label: "Put hash entry", order: 63, defaultDur: .5, hasEase: false, allowAuthorOnlyTargets: true,
  hint: "Hash a key and append its key:value entry to the matching bucket chain",
  ui: { durLabel: "Seconds", durMin: .01, wordsArgs: [{ label: "Key" }, { label: "Value" }] }, appliesTo: (kind) => kind === "hashmap",
  create: (target) => ({ ...baseAction("put", target, .5), texts: ["cat", "7"] }),
  parse(stmt) { const target = argName(stmt.args, 0), key = argString(stmt.args, 1), value = argString(stmt.args, 2), dur = argNumber(stmt.args, 3); if (!target || key === null || value === null || stmt.args.length < 3 || stmt.args.length > 4 || (stmt.args.length === 4 && dur === null)) return null; return { ...baseAction("put", target, dur ?? .5), texts: [key, value] }; },
  serialize: (action) => `put(${action.target}, "${escapeString(action.texts?.[0] ?? "")}", "${escapeString(action.texts?.[1] ?? "")}", ${num(Math.max(.01, action.dur))});`, beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "get", label: "Get hash key", order: 63.1, defaultDur: .45, hasEase: false, allowAuthorOnlyTargets: true,
  hint: "Hash a key, scan its live chain in order, then show a hit or miss",
  ui: { durLabel: "Seconds per scan", durMin: .01, wordsArg: { label: "Lookup key" } }, appliesTo: (kind) => kind === "hashmap",
  create: (target) => ({ ...baseAction("get", target, .45), text: "cat" }),
  parse(stmt) { const target = argName(stmt.args, 0), key = argString(stmt.args, 1), step = argNumber(stmt.args, 2); if (!target || key === null || stmt.args.length < 2 || stmt.args.length > 3 || (stmt.args.length === 3 && step === null)) return null; return { ...baseAction("get", target, step ?? .45), text: key }; },
  serialize: (action) => `get(${action.target}, "${escapeString(action.text ?? "")}", ${num(Math.max(.01, action.dur))});`,
  beatDur(action, entity, doc) { return entity?.kind === "hashmap" ? hashmapLookupPlan(entity, action, doc).duration : action.dur * 2 + .2; }, apply() {},
});

function graphAlgorithmVerb(name: "bfs" | "dfs" | "dijkstra", label: string, hint: string, order: number): VerbDef {
  return {
    name, label, hint, order, defaultDur: .3, hasEase: false, allowAuthorOnlyTargets: true,
    ui: { durLabel: "Derived native runtime", hideDur: true, choices: [{ label: "Start vertex", field: "text", options: (entity) => entity?.kind === "graph" ? graphStartVertices(entity) : [] }] }, appliesTo: (kind) => kind === "graph",
    canAdd: (_doc, selected) => selected?.kind === "graph" && graphStartVertices(selected).length > 0,
    addBlockedReason: "Graph algorithms need at least one vertex that is a bare Manic identifier.",
    create: (target) => ({ ...baseAction(name, target, .3), text: null, durationExplicit: false }),
    parse(stmt) { const target = argName(stmt.args, 0), start = argName(stmt.args, 1); return target && start && stmt.args.length === 2 ? { ...baseAction(name, target, .3), text: start, durationExplicit: false } : null; },
    serialize: (action) => `${name}(${action.target}, ${action.text || "start"});`,
    beatDur(action, entity) { return entity?.kind === "graph" ? graphAlgorithmPlan(entity, action.text ?? "", name).duration : .3; }, apply() {},
  };
}
registerVerb(graphAlgorithmVerb("bfs", "Breadth-first search", "Traverse level by level with a native queue/frontier readout", 64));
registerVerb(graphAlgorithmVerb("dfs", "Depth-first search", "Traverse deeply with a native stack/frontier readout", 64.1));
registerVerb(graphAlgorithmVerb("dijkstra", "Dijkstra shortest paths", "Settle weighted shortest distances and preserve the final parent tree", 64.2));

// --- ML kit ---------------------------------------------------------------

const mlNetwork = (kind: string) => kind === "network";
const mlTensor = (kind: string) => ["tensor", "digit", "convolve", "pool"].includes(kind);

registerVerb({
  name: "forward", label: "Forward pass", order: 80, defaultDur: 3.2, hasEase: true,
  hint: "Evaluate a numeric input through every native network layer",
  ui: { durLabel: "Seconds", wordsArg: { label: "Input vector" } }, appliesTo: mlNetwork,
  create: (target) => ({ ...baseAction("forward", target, 3.2), text: "0.15 0.92 0.38" }),
  parse(stmt) { const target = argName(stmt.args, 0), input = argString(stmt.args, 1); return target && input !== null ? parseTail({ ...baseAction("forward", target, 3.2), text: input }, stmt, 2, true) : null; },
  serialize: (action) => `forward(${action.target}, "${escapeString(action.text ?? "")}", ${num(action.dur)}${easeSuffix(action, true)});`, beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "feed", label: "Feed tensor", order: 80.1, defaultDur: 3.2, hasEase: true,
  hint: "Flatten a tensor into the network input and run a forward pass",
  ui: { durLabel: "Seconds", entityArg: { label: "Input tensor", accept: mlTensor } }, appliesTo: mlNetwork,
  canAdd: (doc) => doc.entities.some((entity) => mlNetwork(entity.kind)) && doc.entities.some((entity) => mlTensor(entity.kind)), addBlockedReason: "Feed needs a network and a tensor/digit result.",
  create: (target) => ({ ...baseAction("feed", target, 3.2), ref: "" }),
  parse(stmt) { const target = argName(stmt.args, 0), input = argName(stmt.args, 1); return target && input ? parseTail({ ...baseAction("feed", target, 3.2), ref: input }, stmt, 2, true) : null; },
  serialize: (action) => `feed(${action.target}, ${action.ref ?? "input"}, ${num(action.dur)}${easeSuffix(action, true)});`, beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "loss", label: "Measure loss", order: 80.2, defaultDur: 1.6, hasEase: true,
  hint: "Compare the latest prediction with a target vector",
  ui: { durLabel: "Seconds", wordsArg: { label: "Target vector" }, choices: [{ label: "Loss", field: "prop", options: ["crossentropy", "mse"] }] }, appliesTo: mlNetwork,
  create: (target) => ({ ...baseAction("loss", target, 1.6), text: "1 0 0", prop: "crossentropy" }),
  parse(stmt) { const target = argName(stmt.args, 0), values = argString(stmt.args, 1); if (!target || values === null) return null; const kind = argName(stmt.args, 2); return parseTail({ ...baseAction("loss", target, 1.6), text: values, prop: kind }, stmt, kind ? 3 : 2, true); },
  serialize: (action) => `loss(${action.target}, "${escapeString(action.text ?? "")}"${action.prop ? `, ${action.prop}` : ""}, ${num(action.dur)}${easeSuffix(action, true)});`, beatDur: (action) => action.dur, apply() {},
});

for (const [name, label, duration, order] of [["backward", "Backpropagate", 3.2, 80.3], ["encode", "Encode transformer", 5.4, 82.2]] as const) {
  registerVerb({ name, label, order, defaultDur: duration, hasEase: true, hint: name === "encode" ? "Reveal attention, residual, normalization, and MLP stages" : "Propagate loss gradients through the network", ui: { durLabel: "Seconds" }, appliesTo: name === "encode" ? (kind) => kind === "transformer" : mlNetwork, create: (target) => baseAction(name, target, duration), parse(stmt) { const target = argName(stmt.args, 0); return target ? parseTail(baseAction(name, target, duration), stmt, 1, true) : null; }, serialize: (action) => `${name}(${action.target}, ${num(action.dur)}${easeSuffix(action, true)});`, beatDur: (action) => action.dur, apply() {} });
}

registerVerb({
  name: "checkpoint", label: "Checkpoint network", order: 80.4, defaultDur: 0, hasEase: false,
  hint: "Capture network parameters, prediction, target, and loss under a reusable name",
  ui: { durLabel: "Instant", hideDur: true, wordsArg: { label: "Checkpoint name" } }, appliesTo: mlNetwork,
  create: (target) => ({ ...baseAction("checkpoint", target, 0), text: "beforeUpdate", durationExplicit: false }),
  parse(stmt) { const checkpoint = argName(stmt.args, 0), target = argName(stmt.args, 1); return checkpoint && target && stmt.args.length === 2 ? { ...baseAction("checkpoint", target, 0), text: checkpoint, durationExplicit: false } : null; },
  serialize: (action) => `checkpoint(${action.text || "checkpoint"}, ${action.target});`, beatDur: () => 0, apply() {},
});

registerVerb({
  name: "update", label: "Update parameters", order: 80.5, defaultDur: 2.4, hasEase: true,
  hint: "Apply the latest gradients with a chosen learning rate",
  ui: { durLabel: "Seconds", amount: { label: "Learning rate", step: .01, min: .000001 } }, appliesTo: mlNetwork,
  create: (target) => ({ ...baseAction("update", target, 2.4), amount: .15 }),
  parse(stmt) { const target = argName(stmt.args, 0); if (!target) return null; const rate = argNumber(stmt.args, 1); return parseTail({ ...baseAction("update", target, 2.4), amount: rate ?? .15 }, stmt, rate === null ? 1 : 2, true); },
  serialize: (action) => `update(${action.target}, ${num(action.amount ?? .15)}, ${num(action.dur)}${easeSuffix(action, true)});`, beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "scan", label: "Scan tensor operation", order: 81, defaultDur: 2.4, hasEase: true,
  hint: "Animate every convolution or pooling window and arithmetic result",
  ui: { durLabel: "Seconds" }, appliesTo: (kind) => kind === "convolve" || kind === "pool",
  create: (target) => ({ ...baseAction("scan", target, 2.4), durationExplicit: false }),
  parse(stmt) { const target = argName(stmt.args, 0); if (!target) return null; const explicit = argNumber(stmt.args, 1) !== null, parsed = parseTail({ ...baseAction("scan", target, 2.4), durationExplicit: explicit }, stmt, 1, true); return parsed; },
  serialize: (action) => `scan(${action.target}${action.durationExplicit === false ? "" : `, ${num(action.dur)}${easeSuffix(action, true)}`});`,
  beatDur(action, entity, doc) { if (action.durationExplicit !== false || !entity || !doc || (entity.kind !== "convolve" && entity.kind !== "pool")) return action.dur; return Math.max(2.4, Math.min(9, mlOutputShape(entity, doc).steps * .42)); }, apply() {},
});

registerVerb({
  name: "sample", label: "Sample token", order: 82.3, defaultDur: 3.6, hasEase: true,
  hint: "Filter, renormalize, and select from a logits distribution",
  ui: { durLabel: "Seconds", wordsArg: { label: "Strategy" } }, appliesTo: (kind) => kind === "logits",
  create: (target) => ({ ...baseAction("sample", target, 3.6), text: "top-p 0.90 seed=17" }),
  parse(stmt) { const target = argName(stmt.args, 0), strategy = argString(stmt.args, 1); return target && strategy !== null ? parseTail({ ...baseAction("sample", target, 3.6), text: strategy }, stmt, 2, true) : null; },
  serialize: (action) => `sample(${action.target}, "${escapeString(action.text ?? "greedy")}", ${num(action.dur)}${easeSuffix(action, true)});`, beatDur: (action) => action.dur, apply() {},
});

registerVerb({
  name: "attend", label: "Focus attention", order: 82.4, defaultDur: 4.2, hasEase: true,
  hint: "Focus one 1-based query token and reveal its Q/K/V contribution",
  ui: { durLabel: "Seconds", amount: { label: "Token (1-based)", step: 1, min: 1 } }, appliesTo: (kind) => kind === "attention",
  create: (target) => ({ ...baseAction("attend", target, 4.2), amount: 1 }),
  parse(stmt) { const target = argName(stmt.args, 0), token = argNumber(stmt.args, 1); return target && token !== null ? parseTail({ ...baseAction("attend", target, 4.2), amount: token }, stmt, 2, true) : null; },
  serialize: (action) => `attend(${action.target}, ${num(action.amount ?? 1)}, ${num(action.dur)}${easeSuffix(action, true)});`, beatDur: (action) => action.dur, apply() {},
});
