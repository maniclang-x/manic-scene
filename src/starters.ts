// Shared starting-point scenes. Both Workbench and Web offer the same
// starters, so a scene begun in one place looks identical in the other.
// Built with the registry's own defaults so they always round-trip exactly.

import { createAction, createEntity } from "./model.js";
import type { EntityKind, SceneAction, SceneDoc, SceneEntity } from "./types.js";

export interface SceneStarter {
  id: string;
  name: string;
  description: string;
  doc: SceneDoc;
}

function make<K extends EntityKind>(
  kind: K,
  id: string,
  x: number,
  y: number,
  over: Partial<Extract<SceneEntity, { kind: K }>> = {},
): SceneEntity {
  return Object.assign(createEntity(kind, id, x, y), over);
}

function act(verb: string, target: string, over: Partial<SceneAction> = {}): SceneAction {
  return { ...createAction(verb, target), ...over };
}

const QUADRATIC_STATES = [
  String.raw`x^2+\frac{\textcolor{cyan}{b}}{\textcolor{orange}{a}}x+\frac{\textcolor{lime}{c}}{\textcolor{orange}{a}}=0`,
  String.raw`x^2+\frac{\textcolor{cyan}{b}}{\textcolor{orange}{a}}x=-\frac{\textcolor{lime}{c}}{\textcolor{orange}{a}}`,
  String.raw`x^2+\frac{\textcolor{cyan}{b}}{2\textcolor{orange}{a}}x+\frac{\textcolor{cyan}{b}}{2\textcolor{orange}{a}}x=-\frac{\textcolor{lime}{c}}{\textcolor{orange}{a}}`,
  String.raw`x^2+\frac{\textcolor{cyan}{b}}{2\textcolor{orange}{a}}x+\frac{\textcolor{cyan}{b}}{2\textcolor{orange}{a}}x+\left(\frac{\textcolor{cyan}{b}}{2\textcolor{orange}{a}}\right)^2=\left(\frac{\textcolor{cyan}{b}}{2\textcolor{orange}{a}}\right)^2-\frac{\textcolor{lime}{c}}{\textcolor{orange}{a}}`,
  String.raw`x^2+\frac{\textcolor{cyan}{b}}{2\textcolor{orange}{a}}x+\frac{\textcolor{cyan}{b}}{2\textcolor{orange}{a}}x+\left(\frac{\textcolor{cyan}{b}}{2\textcolor{orange}{a}}\right)^2=\frac{\textcolor{cyan}{b}^2-4\textcolor{orange}{a}\textcolor{lime}{c}}{4\textcolor{orange}{a}^2}`,
  String.raw`x\left(x+\frac{\textcolor{cyan}{b}}{2\textcolor{orange}{a}}\right)+\frac{\textcolor{cyan}{b}}{2\textcolor{orange}{a}}\left(x+\frac{\textcolor{cyan}{b}}{2\textcolor{orange}{a}}\right)=\frac{\textcolor{cyan}{b}^2-4\textcolor{orange}{a}\textcolor{lime}{c}}{4\textcolor{orange}{a}^2}`,
  String.raw`\left(x+\frac{\textcolor{cyan}{b}}{2\textcolor{orange}{a}}\right)^2=\frac{\textcolor{cyan}{b}^2-4\textcolor{orange}{a}\textcolor{lime}{c}}{4\textcolor{orange}{a}^2}`,
  String.raw`x+\frac{\textcolor{cyan}{b}}{2\textcolor{orange}{a}}=\pm\frac{\sqrt{\textcolor{cyan}{b}^2-4\textcolor{orange}{a}\textcolor{lime}{c}}}{2\textcolor{orange}{a}}`,
  String.raw`x=\frac{-\textcolor{cyan}{b}\pm\sqrt{\textcolor{cyan}{b}^2-4\textcolor{orange}{a}\textcolor{lime}{c}}}{2\textcolor{orange}{a}}`,
] as const;

export const STARTERS: SceneStarter[] = [
  {
    id: "concept",
    name: "Concept",
    description: "A calm first explanation with a focal shape.",
    doc: {
      format: "16:9",
      template: "black",
      entities: [
        make("text", "idea", 640, 126, { text: "Start with an idea", size: 52, reveal: "fade" }),
        make("circle", "focus", 640, 380, { r: 118, reveal: "grow" }),
        make("text", "note", 640, 600, { text: "Add, arrange, then animate.", size: 26, color: "dim", reveal: "fade" }),
      ],
      steps: [
        {
          name: "Reveal", mode: "stagger", gap: 0.2, actions: [
            act("show", "idea", { dur: 0.6 }),
            act("show", "focus", { dur: 0.7, ease: "overshoot" }),
            act("show", "note", { dur: 0.5 }),
          ],
        },
        {
          name: "Focus", mode: "together", gap: 0.15, actions: [
            act("pulse", "focus", { dur: 0.9 }),
            act("flash", "idea", { color: "gold", dur: 0.9 }),
          ],
        },
      ],
    },
  },
  {
    id: "geometry",
    name: "Geometry",
    description: "A construction that draws itself on.",
    doc: {
      format: "16:9",
      template: "black",
      entities: [
        make("text", "title", 640, 96, { text: "A circle tells a story", size: 44, reveal: "fade" }),
        make("circle", "ring", 520, 400, { r: 150, paint: "outlined", strokeWidth: 3, untraced: true }),
        make("line", "chord", 0, 0, { x1: 415, y1: 505, x2: 625, y2: 295, strokeWidth: 3, color: "magenta", untraced: true }),
        make("dot", "pa", 415, 505, { r: 7, color: "gold", reveal: "fade" }),
        make("dot", "pb", 625, 295, { r: 7, color: "gold", reveal: "fade" }),
        make("text", "insight", 950, 400, { text: "Find the relationship", size: 30, color: "dim", reveal: "fade" }),
      ],
      steps: [
        {
          name: "Construct", mode: "sequence", gap: 0.15, actions: [
            act("show", "title", { dur: 0.5 }),
            act("draw", "ring", { dur: 1.4 }),
            act("draw", "chord", { dur: 0.8 }),
          ],
        },
        {
          name: "Mark the points", mode: "stagger", gap: 0.25, actions: [
            act("show", "pa", { dur: 0.4 }),
            act("show", "pb", { dur: 0.4 }),
            act("show", "insight", { dur: 0.6 }),
          ],
        },
      ],
    },
  },
  {
    id: "system",
    name: "System flow",
    description: "Three connected stages, drawn in order.",
    doc: {
      format: "16:9",
      template: "black",
      entities: [
        make("text", "title", 640, 105, { text: "How a request becomes a result", size: 40, reveal: "fade" }),
        make("rect", "input", 265, 380, { width: 220, height: 130, color: "cyan", reveal: "grow" }),
        make("rect", "process", 640, 380, { width: 220, height: 130, color: "magenta", reveal: "grow" }),
        make("rect", "result", 1015, 380, { width: 220, height: 130, color: "lime", reveal: "grow" }),
        make("text", "inputLabel", 265, 380, { text: "Input", size: 26, reveal: "fade" }),
        make("text", "processLabel", 640, 380, { text: "Process", size: 26, reveal: "fade" }),
        make("text", "resultLabel", 1015, 380, { text: "Result", size: 26, reveal: "fade" }),
        make("arrow", "hop1", 0, 0, { x1: 390, y1: 380, x2: 515, y2: 380, strokeWidth: 4, untraced: true }),
        make("arrow", "hop2", 0, 0, { x1: 765, y1: 380, x2: 890, y2: 380, strokeWidth: 4, untraced: true }),
      ],
      steps: [
        {
          name: "Stations", mode: "stagger", gap: 0.18, actions: [
            act("show", "title", { dur: 0.5 }),
            act("show", "input", { dur: 0.5, ease: "overshoot" }),
            act("show", "inputLabel", { dur: 0.4 }),
            act("show", "process", { dur: 0.5, ease: "overshoot" }),
            act("show", "processLabel", { dur: 0.4 }),
            act("show", "result", { dur: 0.5, ease: "overshoot" }),
            act("show", "resultLabel", { dur: 0.4 }),
          ],
        },
        {
          name: "Connect", mode: "sequence", gap: 0.15, actions: [
            act("draw", "hop1", { dur: 0.7 }),
            act("draw", "hop2", { dur: 0.7 }),
            act("pulse", "result", { dur: 0.8 }),
          ],
        },
      ],
    },
  },
  {
    id: "textguide",
    name: "Text story",
    description: "The text vocabulary: type, caption, karaoke, hue.",
    doc: {
      format: "16:9",
      template: "black",
      entities: [
        make("text", "head", 640, 90, { text: "How text works", size: 40, bold: true }),
        make("text", "kicker", 640, 150, { text: "one primitive, a lot of behaviour", size: 18, color: "dim", reveal: "fade" }),
        make("text", "column", 250, 380, {
          text: "A column you chose yourself, three hundred pixels wide.",
          size: 20, color: "magenta", wrap: 300, reveal: "fade",
        }),
        make("text", "poem", 640, 380, {
          text: "leading\ncontrols the\nroom between lines", size: 20, leading: 2, reveal: "fade",
        }),
        make("text", "spine", 1030, 380, { text: "UPRIGHT", size: 30, color: "teal", vertical: true, reveal: "fade" }),
        make("caption", "lyrics", 640, 600, { text: "one entity per word so each can be timed", size: 22 }),
        make("text", "hued", 640, 660, { text: "hue colours text by angle", size: 18, hue: { deg: 200, s: 0.95, l: 0.62 }, reveal: "fade" }),
      ],
      steps: [
        {
          name: "Setting", mode: "sequence", gap: 0.15, actions: [
            act("type", "head", { dur: 1 }),
            act("show", "kicker", { dur: 0.5 }),
          ],
        },
        {
          name: "Three columns", mode: "stagger", gap: 0.25, actions: [
            act("show", "column", { dur: 0.6 }),
            act("show", "poem", { dur: 0.6 }),
            act("show", "spine", { dur: 0.6 }),
          ],
        },
        {
          name: "Word by word", mode: "sequence", gap: 0.15, actions: [
            act("wordpop", "lyrics", { dur: 0.14 }),
            act("karaoke", "lyrics", { dur: 0.3, color: "gold" }),
            act("show", "hued", { dur: 0.5 }),
            act("to", "hued", { prop: "hue", amount: 320, dur: 2 }),
          ],
        },
      ],
    },
  },
  {
    id: "short",
    name: "Creator short",
    description: "A vertical hook, hero visual, and takeaway.",
    doc: {
      format: "portrait",
      template: "shorts",
      entities: [
        make("text", "hook", 360, 200, { text: "Why does this work?", size: 44 }),
        make("circle", "hero", 360, 620, { r: 150, color: "magenta", reveal: "grow" }),
        make("arrow", "callout", 0, 0, { x1: 360, y1: 880, x2: 360, y2: 800, strokeWidth: 4, untraced: true }),
        make("text", "answer", 360, 1000, { text: "One visual idea at a time.", size: 30, color: "cyan", reveal: "fade" }),
      ],
      steps: [
        {
          name: "Hook", mode: "sequence", gap: 0.15, actions: [
            act("type", "hook", { dur: 1.1 }),
            act("show", "hero", { dur: 0.7, ease: "overshoot" }),
          ],
        },
        {
          name: "Takeaway", mode: "sequence", gap: 0.15, actions: [
            act("draw", "callout", { dur: 0.5 }),
            act("show", "answer", { dur: 0.6 }),
            act("pulse", "hero", { dur: 0.9 }),
          ],
        },
      ],
    },
  },
  {
    id: "quadratic",
    name: "Quadratic derivation",
    description: "A continuous nine-state equation rewrite with reading beats.",
    doc: {
      title: "The Quadratic Formula by Completing the Square",
      format: "16:9",
      template: "plain",
      entities: [
        make("watermark", "manicMark", 1135, 30, { text: "Made With Manic", size: 20, responsive: false }),
        make("text", "kicker", 640, 72, { text: "COMPLETING THE SQUARE · ONE CONTINUOUS EQUATION", size: 18, color: "dim", bold: true, reveal: "fade" }),
        make("text", "guide", 640, 620, { text: "Stable symbols stay. Only the mathematical change moves.", size: 19, color: "dim", reveal: "fade" }),
        make("equation", "work", 640, 330, { latex: String.raw`\textcolor{orange}{a}x^2+\textcolor{cyan}{b}x+\textcolor{lime}{c}=0`, size: 48, reveal: "fade" }),
      ],
      steps: [
        { name: "Reveal heading", mode: "together", gap: .15, actions: [act("show", "kicker", { dur: .45 })] },
        { name: "Reveal guide", mode: "together", gap: .15, actions: [act("show", "guide", { dur: .45 })] },
        { name: "Reveal equation", mode: "together", gap: .15, actions: [act("show", "work", { dur: .65 })] },
        { name: "Read setup", mode: "together", gap: .15, actions: [act("wait", "", { dur: 1.2 })] },
        ...QUADRATIC_STATES.flatMap((latex, index) => [
          { name: `Rewrite ${index + 1}`, mode: "together" as const, gap: .15, actions: [act("rewrite", "work", { text: latex, dur: [1, .95, 1.05, 1.1, 1, 1.05, .95, 1.05, 1.1][index] })] },
          ...(index < QUADRATIC_STATES.length - 1 ? [{ name: `Read state ${index + 1}`, mode: "together" as const, gap: .15, actions: [act("wait", "", { dur: [1, .95, .95, 1.05, 1, .9, 1, 1.1][index] })] }] : []),
        ]),
        { name: "Emphasize result", mode: "together", gap: .15, actions: [act("pulse", "work", { dur: .65 })] },
        { name: "Hold result", mode: "together", gap: .15, actions: [act("wait", "", { dur: 2.5 })] },
      ],
    },
  },
  {
    id: "blank",
    name: "Blank",
    description: "Start with a completely empty canvas.",
    doc: { format: "16:9", template: "black", entities: [], steps: [] },
  },
];
