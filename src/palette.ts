// Preview approximations of manic's template-aware semantic palette, so a
// visual editor can render an honest look for every template without the
// engine. Named colors round-trip as names; the engine remains the color
// authority at render time.

import type { HueSpec, ManicTemplate } from "./types.js";

export interface TemplateTheme {
  /** Canvas ground. */
  background: string;
  /** Faint layout grid line color. */
  grid: string;
  /** Whether the ground is light (affects editor chrome contrast). */
  light: boolean;
  colors: Record<string, string>;
}

const NEON: Record<string, string> = {
  fg: "#EFF5FF", dim: "#96A1B3", panel: "#1A2233",
  cyan: "#5DE7FF", magenta: "#FF5CCF", gold: "#FFD166", lime: "#69E6A6",
  violet: "#A995FF", blue: "#5B8CFF", teal: "#3BD8C8", orange: "#FFA14A",
  red: "#FF5D6C", coral: "#FF8A7A", mint: "#8AF5CE", indigo: "#8B7BFF",
};

export const THEMES: Record<ManicTemplate, TemplateTheme> = {
  black: { background: "#050608", grid: "#6B789018", light: false, colors: NEON },
  plain: { background: "#0B1022", grid: "#6B789018", light: false, colors: NEON },
  terminal: { background: "#0B161B", grid: "#3B738722", light: false, colors: NEON },
  shorts: {
    background: "#191021", grid: "#8A6B9022", light: false,
    colors: { ...NEON, fg: "#FFF7FC", dim: "#D5B8C5", cyan: "#9CEEFF", magenta: "#FF8CBB", gold: "#FFE1A3", lime: "#A3EFBF", violet: "#BDAAFF" },
  },
  mono: {
    background: "#050506", grid: "#5A5A5E22", light: false,
    colors: { fg: "#FFFFFF", dim: "#B8BCC3", panel: "#1C1C1F", cyan: "#F4F5F6", magenta: "#F4F5F6", gold: "#E6E7E9", lime: "#F4F5F6", violet: "#DBDCDF", blue: "#E6E7E9", teal: "#F4F5F6", orange: "#E6E7E9", red: "#F4F5F6", coral: "#E6E7E9", mint: "#F4F5F6", indigo: "#DBDCDF" },
  },
  paper: {
    background: "#F7F0DD", grid: "#A99D7A33", light: true,
    colors: { fg: "#292820", dim: "#706C5E", panel: "#EFE6CC", cyan: "#176B7A", magenta: "#A43C60", gold: "#9A6714", lime: "#467042", violet: "#66519A", blue: "#2D4E9E", teal: "#1E6E62", orange: "#A85A18", red: "#A62F3C", coral: "#A8503F", mint: "#3A7A5E", indigo: "#4A3F8F" },
  },
  blueprint: {
    background: "#0A2A50", grid: "#9CDEF635", light: false,
    colors: { fg: "#FFFFFF", dim: "#A7CADB", panel: "#123A66", cyan: "#86EEFF", magenta: "#C6E8FF", gold: "#FFE9B0", lime: "#B8F4D2", violet: "#D6CBFF", blue: "#A9CCFF", teal: "#9BEFE3", orange: "#FFCFA0", red: "#FFB3BC", coral: "#FFC4B8", mint: "#C0F7E2", indigo: "#C3B9FF" },
  },
};

const COLOR_ALIASES: Record<string, string> = {
  white: "fg", green: "lime", yellow: "gold", amber: "gold", pink: "magenta",
  accent: "magenta", purple: "violet", azure: "blue", turquoise: "teal",
  salmon: "coral", seafoam: "mint", gray: "dim", grey: "dim", crimson: "red",
};

/** Palette names offered by editor pickers (parse accepts the full alias set + hex). */
export const COLOR_OPTIONS = ["cyan", "magenta", "gold", "lime", "violet", "blue", "teal", "orange", "red", "fg", "dim"] as const;

export function resolveColor(template: ManicTemplate, name: string): string {
  if (name.startsWith("#")) return name;
  const theme = THEMES[template];
  const canonical = COLOR_ALIASES[name] ?? name;
  return theme.colors[canonical] ?? theme.colors.fg;
}

/** CSS color for `hue(id, deg, [sat], [light])` — engine defaults sat 1.0, light 0.6. */
export function hueToCss(hue: HueSpec, degOverride?: number): string {
  const s = Math.round((hue.s ?? 1) * 100);
  const l = Math.round((hue.l ?? 0.6) * 100);
  return `hsl(${Math.round(degOverride ?? hue.deg)} ${s}% ${l}%)`;
}
