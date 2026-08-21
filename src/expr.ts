// The manic expression engine — a faithful port of the build-time evaluator in
// manic-lang/src/expand.rs so the canvas resolves the SAME numbers the engine
// does: operators (+ - * / ^ right-assoc, comparisons, && ||), implicit
// multiplication after a number or `)`, the function table, callable
// min/max(a,b), sum/prod/min/max reductions, and bit-exact `random`/`noise`
// (splitmix64 finalizer over f32 bit patterns, seed 0).

import type { Token } from "./script.js";

export type ExprNode =
  | { kind: "num"; value: number }
  | { kind: "var"; name: string }
  | { kind: "unary"; op: "-" | "!"; operand: ExprNode }
  | { kind: "bin"; op: string; left: ExprNode; right: ExprNode }
  | { kind: "call"; name: string; args: ExprNode[] }
  | { kind: "reduce"; op: "sum" | "prod" | "min" | "max"; variable: string; from: ExprNode; to: ExprNode; body: ExprNode }
  | { kind: "tuple"; items: ExprNode[] };

export class ExprError extends Error {}

export type Env = Map<string, number>;

export const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

// --- Parser (Pratt over script tokens) ----------------------------------------

const BINARY_POWER: Record<string, [number, number]> = {
  "||": [1, 2],
  "&&": [3, 4],
  "==": [5, 6], "!=": [5, 6], "<": [5, 6], "<=": [5, 6], ">": [5, 6], ">=": [5, 6],
  "+": [7, 8], "-": [7, 8],
  "*": [9, 10], "/": [9, 10],
  "^": [14, 13], // right-associative
};
const IMPLICIT_MUL: [number, number] = [9, 10];
const REDUCERS = new Set(["sum", "prod", "min", "max"]);

interface Cursor { tokens: Token[]; index: number; }

/** Parse a full expression from a token slice; throws ExprError on leftovers. */
export function parseExpr(tokens: Token[]): ExprNode {
  const cursor: Cursor = { tokens, index: 0 };
  const node = parseBinding(cursor, 0);
  if (cursor.index !== tokens.length) throw new ExprError(`unexpected \`${tokens[cursor.index]?.text}\``);
  return node;
}

/** Parse a parenthesis-free tuple: `e1, e2[, e3]` (a point argument). */
export function parseTuple(tokens: Token[]): ExprNode {
  const items: ExprNode[] = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index <= tokens.length; index += 1) {
    const token = tokens[index];
    if (token && token.kind === "punct" && (token.text === "(")) depth += 1;
    if (token && token.kind === "punct" && (token.text === ")")) depth -= 1;
    if (index === tokens.length || (depth === 0 && token.kind === "punct" && token.text === ",")) {
      items.push(parseExpr(tokens.slice(start, index)));
      start = index + 1;
    }
  }
  if (items.length === 1) return items[0];
  return { kind: "tuple", items };
}

function parseBinding(cursor: Cursor, minPower: number): ExprNode {
  let left = parsePrimary(cursor);
  for (;;) {
    const token = cursor.tokens[cursor.index];
    if (!token) break;
    let op: string | null = null;
    let implicit = false;
    if (token.kind === "op" && BINARY_POWER[token.text]) {
      op = token.text;
    } else if (token.kind === "name" || (token.kind === "punct" && token.text === "(") || token.kind === "number") {
      // Implicit multiplication: allowed only after a number or `)` — the
      // engine reads `2sx`, `3(x+1)`, `(a+b)c`; name·name must be explicit.
      op = "*";
      implicit = true;
    } else {
      break;
    }
    const [leftPower, rightPower] = implicit ? IMPLICIT_MUL : BINARY_POWER[op];
    if (leftPower < minPower) break;
    if (!implicit) cursor.index += 1;
    const right = parseBinding(cursor, rightPower);
    left = { kind: "bin", op, left, right };
  }
  return left;
}

function parsePrimary(cursor: Cursor): ExprNode {
  const token = cursor.tokens[cursor.index];
  if (!token) throw new ExprError("expression ended early");
  if (token.kind === "op" && token.text === "-") {
    cursor.index += 1;
    return { kind: "unary", op: "-", operand: parseBinding(cursor, 11) };
  }
  if (token.kind === "number") {
    cursor.index += 1;
    return { kind: "num", value: token.value ?? 0 };
  }
  if (token.kind === "punct" && token.text === "(") {
    cursor.index += 1;
    const inner = parseBinding(cursor, 0);
    expectPunct(cursor, ")");
    return inner;
  }
  if (token.kind === "name") {
    if (token.text.includes("{")) throw new ExprError(`\`${token.text}\` — id interpolation is not a number`);
    cursor.index += 1;
    const next = cursor.tokens[cursor.index];
    if (next && next.kind === "punct" && next.text === "(") {
      if (REDUCERS.has(token.text) && isReduction(cursor)) return parseReduction(cursor, token.text as "sum");
      cursor.index += 1;
      const args: ExprNode[] = [];
      if (!consumePunct(cursor, ")")) {
        for (;;) {
          args.push(parseBinding(cursor, 0));
          if (consumePunct(cursor, ")")) break;
          expectPunct(cursor, ",");
        }
      }
      return { kind: "call", name: token.text, args };
    }
    return { kind: "var", name: token.text };
  }
  throw new ExprError(`unexpected \`${token.text}\``);
}

function isReduction(cursor: Cursor): boolean {
  // at `(`: reduction looks like `( name in … )`
  const name = cursor.tokens[cursor.index + 1];
  const inWord = cursor.tokens[cursor.index + 2];
  return !!name && name.kind === "name" && !!inWord && inWord.kind === "name" && inWord.text === "in";
}

function parseReduction(cursor: Cursor, op: "sum" | "prod" | "min" | "max"): ExprNode {
  expectPunct(cursor, "(");
  const variable = cursor.tokens[cursor.index];
  if (!variable || variable.kind !== "name") throw new ExprError(`${op}: expected a loop variable`);
  cursor.index += 1;
  const inWord = cursor.tokens[cursor.index];
  if (!inWord || inWord.text !== "in") throw new ExprError(`${op}: expected \`in\``);
  cursor.index += 1;
  const from = parseBinding(cursor, 0);
  expectOp(cursor, "..");
  const to = parseBinding(cursor, 0);
  expectOp(cursor, ":");
  const body = parseBinding(cursor, 0);
  expectPunct(cursor, ")");
  return { kind: "reduce", op, variable: variable.text, from, to, body };
}

function consumePunct(cursor: Cursor, text: string): boolean {
  const token = cursor.tokens[cursor.index];
  if (token && token.kind === "punct" && token.text === text) {
    cursor.index += 1;
    return true;
  }
  return false;
}

function expectPunct(cursor: Cursor, text: string): void {
  if (!consumePunct(cursor, text)) throw new ExprError(`expected \`${text}\``);
}

function expectOp(cursor: Cursor, text: string): void {
  const token = cursor.tokens[cursor.index];
  if (!token || token.kind !== "op" || token.text !== text) throw new ExprError(`expected \`${text}\``);
  cursor.index += 1;
}

// --- Evaluator -----------------------------------------------------------------

const MAX_REDUCE = 100_000;

export function evalExpr(node: ExprNode, env: Env): number {
  switch (node.kind) {
    case "num": return node.value;
    case "var": {
      const bound = env.get(node.name);
      if (bound !== undefined) return bound;
      if (node.name in CONSTANTS) return CONSTANTS[node.name];
      throw new ExprError(`unknown name \`${node.name}\``);
    }
    case "unary": return -evalExpr(node.operand, env);
    case "bin": {
      const a = evalExpr(node.left, env);
      const b = evalExpr(node.right, env);
      switch (node.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return a / b;
        case "^": return a ** b;
        case "<": return a < b ? 1 : 0;
        case "<=": return a <= b ? 1 : 0;
        case ">": return a > b ? 1 : 0;
        case ">=": return a >= b ? 1 : 0;
        case "==": return a === b ? 1 : 0;
        case "!=": return a !== b ? 1 : 0;
        case "&&": return a !== 0 && b !== 0 ? 1 : 0;
        case "||": return a !== 0 || b !== 0 ? 1 : 0;
        default: throw new ExprError(`unknown operator \`${node.op}\``);
      }
    }
    case "call": {
      const args = node.args.map((arg) => evalExpr(arg, env));
      return callFn(node.name, args);
    }
    case "reduce": {
      const from = Math.trunc(evalExpr(node.from, env));
      const to = Math.trunc(evalExpr(node.to, env));
      if (to - from > MAX_REDUCE) throw new ExprError(`${node.op}: range too large`);
      const child = new Map(env);
      let acc = node.op === "prod" ? 1 : node.op === "sum" ? 0 : node.op === "min" ? Infinity : -Infinity;
      for (let index = from; index < to; index += 1) {
        child.set(node.variable, index);
        const value = evalExpr(node.body, child);
        if (node.op === "sum") acc += value;
        else if (node.op === "prod") acc *= value;
        else if (node.op === "min") acc = Math.min(acc, value);
        else acc = Math.max(acc, value);
      }
      return acc;
    }
    case "tuple":
      throw new ExprError("a point is not a number here");
  }
}

/** Evaluate a tuple node into components (a point/point3 argument). */
export function evalTuple(node: ExprNode, env: Env): number[] {
  if (node.kind === "tuple") return node.items.map((item) => evalExpr(item, env));
  return [evalExpr(node, env)];
}

function callFn(name: string, args: number[]): number {
  if (name === "random" || name === "rand") return randArgs(args, 0n);
  if (name === "noise") {
    if (args.length === 1) return noise1(args[0], 0n);
    if (args.length === 2) return noise2(args[0], args[1], 0n);
    throw new ExprError("`noise` takes 1 or 2 arguments");
  }
  if ((name === "min" || name === "max") && args.length === 2) {
    return name === "min" ? Math.min(args[0], args[1]) : Math.max(args[0], args[1]);
  }
  if (args.length !== 1) throw new ExprError(`\`${name}\` takes 1 argument`);
  const x = args[0];
  switch (name) {
    case "sin": return Math.sin(x);
    case "cos": return Math.cos(x);
    case "tan": return Math.tan(x);
    case "asin": return Math.asin(x);
    case "acos": return Math.acos(x);
    case "atan": return Math.atan(x);
    case "sinh": return Math.sinh(x);
    case "cosh": return Math.cosh(x);
    case "tanh": return Math.tanh(x);
    case "exp": return Math.exp(x);
    case "sqrt": return Math.sqrt(x);
    case "abs": return Math.abs(x);
    case "ln": case "log": return Math.log(x);
    case "log10": return Math.log10(x);
    case "log2": return Math.log2(x);
    case "floor": return Math.floor(x);
    case "ceil": return Math.ceil(x);
    case "round": return Math.round(x);
    case "sign": return Math.sign(x) || (Object.is(x, -0) || x === 0 ? (Object.is(x, -0) ? -0 : 0) : x);
    case "sinc": return x === 0 ? 1 : Math.sin(x) / x;
    default: throw new ExprError(`unknown function \`${name}\``);
  }
}

// --- random/noise: bit-exact port of expand.rs -------------------------------

const MASK64 = (1n << 64n) - 1n;
const f32view = new DataView(new ArrayBuffer(4));

function f32bits(x: number): bigint {
  f32view.setFloat32(0, Math.fround(x));
  return BigInt(f32view.getUint32(0));
}

function finalize01(h: bigint): number {
  h ^= h >> 30n;
  h = (h * 0xbf58476d1ce4e5b9n) & MASK64;
  h ^= h >> 27n;
  h = (h * 0x94d049bb133111ebn) & MASK64;
  h ^= h >> 31n;
  return Number(h >> 40n) / 16777216;
}

export function randArgs(args: number[], seed: bigint): number {
  let h = (seed * 0x9e3779b97f4a7c15n + 0x2545f491n) & MASK64;
  for (const a of args) {
    const mix = (f32bits(a) + 0x9e3779b97f4a7c15n + ((h << 6n) & MASK64) + (h >> 2n)) & MASK64;
    h = (h ^ mix) & MASK64;
    h = (h * 0x100000001b3n) & MASK64;
  }
  return finalize01(h);
}

function smoothstepF(f: number): number {
  return f * f * (3 - 2 * f);
}

function noise1(x: number, seed: bigint): number {
  const xi = Math.floor(x);
  const a = randArgs([xi], seed);
  const b = randArgs([xi + 1], seed);
  return a + (b - a) * smoothstepF(x - xi);
}

function noise2(x: number, y: number, seed: bigint): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = smoothstepF(x - xi);
  const fy = smoothstepF(y - yi);
  const c00 = randArgs([xi, yi], seed);
  const c10 = randArgs([xi + 1, yi], seed);
  const c01 = randArgs([xi, yi + 1], seed);
  const c11 = randArgs([xi + 1, yi + 1], seed);
  const a = c00 + (c10 - c00) * fx;
  const b = c01 + (c11 - c01) * fx;
  return a + (b - a) * fy;
}

/** Engine's id-interpolation number formatting: near-integers print as integers. */
export function formatInterp(value: number): string {
  if (Math.abs(value - Math.round(value)) < 1e-6) return String(Math.round(value));
  return String(value);
}
