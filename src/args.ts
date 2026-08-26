// Statement-argument helpers and Manic literal formatting, shared by every
// registry definition's parse/serialize.

import type { Arg } from "./script.js";
import { EASINGS, type EaseName } from "./types.js";

export function argNumber(args: Arg[], index: number): number | null {
  const arg = args[index];
  return arg && arg.type === "number" ? arg.value : null;
}

export function argString(args: Arg[], index: number): string | null {
  const arg = args[index];
  return arg && arg.type === "string" ? arg.value : null;
}

export function argName(args: Arg[], index: number): string | null {
  const arg = args[index];
  return arg && arg.type === "name" ? arg.value : null;
}

export function argPoint(args: Arg[], index: number): { x: number; y: number } | null {
  const arg = args[index];
  return arg && arg.type === "point" ? { x: arg.x, y: arg.y } : null;
}

export function argPoint3(args: Arg[], index: number): { x: number; y: number; z: number } | null {
  const arg = args[index];
  return arg && arg.type === "point3" ? { x: arg.x, y: arg.y, z: arg.z } : null;
}

const EASE_ALIASES: Record<string, EaseName> = { inout: "smooth", back: "overshoot", spring: "elastic" };

/** Canonical easing for an engine easing name, or null if it isn't one. */
export function easeFrom(name: string | null): EaseName | null {
  if (!name) return null;
  if ((EASINGS as readonly string[]).includes(name)) return name as EaseName;
  return EASE_ALIASES[name] ?? null;
}

export function num(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export function pt(x: number, y: number): string {
  return `(${num(x)}, ${num(y)})`;
}

export function pt3(x: number, y: number, z: number): string {
  return `(${num(x)}, ${num(y)}, ${num(z)})`;
}

/** LaTeX belongs in backticks (raw — every backslash survives); fall back to a
 * quoted string only if the text itself contains a backtick. */
export function latexLiteral(value: string): string {
  if (!value.includes("`")) return `\`${value}\``;
  return `"${escapeString(value)}"`;
}

export function escapeString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n");
}
