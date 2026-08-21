// Verb definitions. Each is self-contained: UI hints, parse, serialize,
// beat length, and its timeline behavior. Onboarding a new verb = one entry.

import { argName, argNumber, argPoint, argString, easeFrom, latexLiteral, num, pt } from "./args.js";
import { registerVerb, wordCount, type VerbApplyCtx, type VerbDef } from "./registry.js";
import type { CallStatement } from "./script.js";
import type { SceneAction, SceneEntity } from "./types.js";

const any = () => true;
const strokes = (kind: string) => ["circle", "rect", "line", "arrow"].includes(kind);

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
    Partial<Pick<VerbDef, "onAdd">>,
): VerbDef {
  return {
    ...cfg,
    ui: { durLabel: "Seconds" },
    create: (target) => baseAction(cfg.name, target, cfg.defaultDur),
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
  name: "show", label: "Show", order: 10, defaultDur: 0.5, hasEase: true,
  hint: "Reveal — fade in, or grow in when hidden from center",
  appliesTo: any,
  onAdd(entity) { if (entity.reveal === "none") entity.reveal = "fade"; },
  apply(ctx, action, start, end) {
    ctx.tween("opacity", start, end, ctx.entity.opacity, action.ease);
    if (ctx.entity.reveal === "grow") ctx.tween("scale", start, end, 1, action.ease);
  },
}));

registerVerb(simpleVerb({
  name: "draw", label: "Draw", order: 11, defaultDur: 1.2, hasEase: false,
  hint: "Trace the stroke on (arms untraced)",
  appliesTo: strokes,
  onAdd(entity) { entity.untraced = true; },
  apply(ctx, action, start, end) { ctx.tween("draw", start, end, 1, "smooth"); },
}));

registerVerb(simpleVerb({
  name: "type", label: "Type", order: 12, defaultDur: 1.2, hasEase: false,
  hint: "Typewriter-reveal the words",
  appliesTo: (kind) => kind === "text",
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

function pointVerb(name: string, label: string, hint: string, order: number, mode: "absolute" | "delta", defaultDur: number): VerbDef {
  return {
    name, label, hint, order, defaultDur, hasEase: true,
    ui: { durLabel: "Seconds", point: mode },
    appliesTo: any,
    create: (target) => ({ ...baseAction(name, target, defaultDur), point: mode === "delta" ? { x: 80, y: 0 } : { x: 0, y: 0 } }),
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

registerVerb(pointVerb("move", "Move", "Glide to a point", 20, "absolute", 0.8));
registerVerb(pointVerb("shift", "Shift", "Move by a delta", 21, "delta", 0.6));

function amountVerb(name: string, label: string, hint: string, order: number, amount: { label: string; step: number; initial: number }, defaultDur: number, apply: VerbDef["apply"]): VerbDef {
  return {
    name, label, hint, order, defaultDur, hasEase: true,
    ui: { durLabel: "Seconds", amount: { label: amount.label, step: amount.step } },
    appliesTo: any,
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
  (ctx, action, start, end) => ctx.tween("rotation", start, end, ctx.valueAt("rotation", start) + (action.amount ?? 0), action.ease)));

// to(id, prop, value, [dur], [ease]) — animate one property to a value.
const TO_PROPS = ["x", "y", "opacity", "scale", "angle", "hue", "value"] as const;
registerVerb({
  name: "to", label: "To (property)", order: 24, defaultDur: 1, hasEase: true,
  hint: "Animate one property (x/y/opacity/scale/angle/hue) to a value",
  ui: { durLabel: "Seconds", amount: { label: "Value", step: 1 }, propOptions: TO_PROPS },
  appliesTo: any,
  create: (target) => ({ ...baseAction("to", target, 1), prop: "hue", amount: 320 }),
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

// flash(id, [color], [dur]) — flash to a color and restore.
registerVerb({
  name: "flash", label: "Flash", order: 31, defaultDur: 0.8, hasEase: false,
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
    const dur = argNumber(stmt.args, rest);
    if (dur !== null) { action.dur = dur; rest += 1; }
    return rest === stmt.args.length ? action : null;
  },
  serialize: (action) => `flash(${action.target}, ${action.color ?? "magenta"}, ${num(action.dur)});`,
  beatDur: (action) => action.dur,
  apply(ctx, action, start, end) { ctx.flash(start, end, action.color ?? "magenta"); },
});

registerVerb(simpleVerb({
  name: "fade", label: "Fade", order: 40, defaultDur: 0.5, hasEase: false,
  hint: "Fade the entity out",
  appliesTo: any,
  apply(ctx, action, start, end) { ctx.tween("opacity", start, end, 0, "smooth"); },
}));

// wait(secs) — targetless reading room.
registerVerb({
  name: "wait", label: "Wait", order: 50, defaultDur: 1, hasEase: false, targetless: true,
  hint: "Reading room — a deliberate pause",
  ui: { durLabel: "Seconds" },
  appliesTo: any,
  create: () => baseAction("wait", "", 1),
  parse(stmt) {
    const secs = argNumber(stmt.args, 0);
    if (secs === null || stmt.args.length !== 1) return null;
    return baseAction("wait", "", secs);
  },
  serialize: (action) => `wait(${num(action.dur)});`,
  beatDur: (action) => action.dur,
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
  create: (target) => ({ ...baseAction("recolor", target, 0.5), color: "gold" }),
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
  name: "section", label: "Section", order: 51, defaultDur: 1, hasEase: false, targetless: true,
  hint: "A section banner + jump marker",
  ui: { durLabel: "Seconds", wordsArg: { label: "Title" } },
  appliesTo: any,
  create: () => ({ ...baseAction("section", "", 1), text: "Next chapter" }),
  parse(stmt) {
    const title = argString(stmt.args, 0);
    if (title === null || stmt.args.length !== 1) return null;
    return { ...baseAction("section", "", 1), text: title };
  },
  serialize: (action) => `section("${escapeWords(action.text ?? "")}");`,
  beatDur: () => 1,
  apply() {},
});

// cue(tick|pop|whoosh|chime) — a short procedural sound at this beat.
registerVerb({
  name: "cue", label: "Cue", order: 52, defaultDur: 0.1, hasEase: false, targetless: true,
  hint: "A short procedural sound (tick / pop / whoosh / chime)",
  ui: { durLabel: "Seconds", propOptions: ["tick", "pop", "whoosh", "chime"] },
  appliesTo: any,
  create: () => ({ ...baseAction("cue", "", 0.1), prop: "tick" }),
  parse(stmt) {
    const sound = argName(stmt.args, 0);
    if (!sound || stmt.args.length !== 1) return null;
    return { ...baseAction("cue", "", 0.1), prop: sound };
  },
  serialize: (action) => `cue(${action.prop ?? "tick"});`,
  beatDur: () => 0.1,
  apply() {},
});

function escapeWords(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n");
}
