// A reader for the manic statement grammar, including the build-time
// computation layer: `name(args);` calls (args may be full expressions),
// `let name = expr;`, `for v in a..b { }`, `if cond { } else { }`,
// `def name(params) { }`, and id interpolation `name{expr}`.
// Statements the canvas cannot model are preserved verbatim (raw + span) so
// hand-written vocabulary is never destroyed — the canvas simply skips them.

import { parseExpr, parseTuple, type ExprNode } from "./expr.js";

export type Arg =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "name"; value: string }
  | { type: "point"; x: number; y: number }
  | { type: "expr"; node: ExprNode; src: string };

interface StatementBase {
  raw: string;
  /** Source span of the whole statement, for surgical patching. */
  start: number;
  end: number;
}

export interface CallStatement extends StatementBase {
  kind: "call";
  name: string;
  args: Arg[];
  block: Statement[] | null;
}

export interface LetStatement extends StatementBase {
  kind: "let";
  name: string;
  expr: ExprNode;
}

export interface ForStatement extends StatementBase {
  kind: "for";
  variable: string;
  from: ExprNode;
  to: ExprNode;
  body: Statement[];
}

export interface IfStatement extends StatementBase {
  kind: "if";
  branches: { cond: ExprNode; body: Statement[] }[];
  elseBody: Statement[] | null;
}

export interface DefStatement extends StatementBase {
  kind: "def";
  name: string;
  params: string[];
  body: Statement[];
}

export type Statement = CallStatement | LetStatement | ForStatement | IfStatement | DefStatement;

export interface ScriptParse {
  statements: Statement[];
  unsupported: string[];
}

export interface Token {
  kind: "name" | "number" | "string" | "punct" | "op" | "other";
  text: string;
  value?: number;
  start: number;
  end: number;
}

export function parseScript(source: string): ScriptParse {
  const tokens = tokenize(source);
  const reader: Reader = { tokens, index: 0, source };
  const unsupported: string[] = [];
  const statements = readStatements(reader, unsupported, false);
  return { statements, unsupported };
}

interface Reader { tokens: Token[]; index: number; source: string; }

function readStatements(reader: Reader, unsupported: string[], insideBlock: boolean): Statement[] {
  const statements: Statement[] = [];
  while (reader.index < reader.tokens.length) {
    const token = reader.tokens[reader.index];
    if (insideBlock && token.kind === "punct" && token.text === "}") break;
    const statement = readStatement(reader, unsupported);
    if (statement) statements.push(statement);
  }
  return statements;
}

function readStatement(reader: Reader, unsupported: string[]): Statement | null {
  const start = reader.tokens[reader.index];
  if (start.kind !== "name") {
    skipStatement(reader, start.start, unsupported);
    return null;
  }
  try {
    if (start.text === "let") return readLet(reader);
    if (start.text === "for") return readFor(reader, unsupported);
    if (start.text === "if") return readIf(reader, unsupported);
    if (start.text === "def") return readDef(reader, unsupported);
    return readCall(reader, unsupported);
  } catch {
    skipStatement(reader, start.start, unsupported);
    return null;
  }
}

class ParseFail extends Error {}
const fail = (): never => { throw new ParseFail(); };

function readLet(reader: Reader): LetStatement {
  const start = reader.tokens[reader.index];
  reader.index += 1;
  const name = reader.tokens[reader.index];
  if (!name || name.kind !== "name") fail();
  reader.index += 1;
  const eq = reader.tokens[reader.index];
  if (!eq || eq.kind !== "op" || eq.text !== "=") fail();
  reader.index += 1;
  const exprTokens = takeUntil(reader, (token) => token.kind === "punct" && token.text === ";");
  const semi = reader.tokens[reader.index];
  if (!semi) fail();
  reader.index += 1;
  return { kind: "let", name: name.text, expr: parseExpr(exprTokens), raw: slice(reader, start.start, semi.end), start: start.start, end: semi.end };
}

function readFor(reader: Reader, unsupported: string[]): ForStatement {
  const start = reader.tokens[reader.index];
  reader.index += 1;
  const variable = reader.tokens[reader.index];
  if (!variable || variable.kind !== "name") fail();
  reader.index += 1;
  const inWord = reader.tokens[reader.index];
  if (!inWord || inWord.text !== "in") fail();
  reader.index += 1;
  const fromTokens = takeUntil(reader, (token) => token.kind === "op" && token.text === "..");
  if (!reader.tokens[reader.index]) fail();
  reader.index += 1;
  const toTokens = takeUntil(reader, (token) => token.kind === "punct" && token.text === "{");
  const body = readBlock(reader, unsupported);
  const close = reader.tokens[reader.index - 1];
  return {
    kind: "for", variable: variable.text,
    from: parseExpr(fromTokens), to: parseExpr(toTokens), body,
    raw: slice(reader, start.start, close.end), start: start.start, end: close.end,
  };
}

function readIf(reader: Reader, unsupported: string[]): IfStatement {
  const start = reader.tokens[reader.index];
  const branches: { cond: ExprNode; body: Statement[] }[] = [];
  let elseBody: Statement[] | null = null;
  let end = start.end;
  reader.index += 1; // `if`
  for (;;) {
    const condTokens = takeUntil(reader, (token) => token.kind === "punct" && token.text === "{");
    const body = readBlock(reader, unsupported);
    end = reader.tokens[reader.index - 1].end;
    branches.push({ cond: parseExpr(condTokens), body });
    const next = reader.tokens[reader.index];
    if (!next || next.kind !== "name" || next.text !== "else") break;
    reader.index += 1; // `else`
    const after = reader.tokens[reader.index];
    if (after && after.kind === "name" && after.text === "if") {
      reader.index += 1;
      continue;
    }
    elseBody = readBlock(reader, unsupported);
    end = reader.tokens[reader.index - 1].end;
    break;
  }
  return { kind: "if", branches, elseBody, raw: slice(reader, start.start, end), start: start.start, end };
}

function readDef(reader: Reader, unsupported: string[]): DefStatement {
  const start = reader.tokens[reader.index];
  reader.index += 1;
  const name = reader.tokens[reader.index];
  if (!name || name.kind !== "name") fail();
  reader.index += 1;
  expect(reader, "punct", "(");
  const params: string[] = [];
  for (;;) {
    const token = reader.tokens[reader.index];
    if (!token) fail();
    if (token.kind === "punct" && token.text === ")") { reader.index += 1; break; }
    if (token.kind === "punct" && token.text === ",") { reader.index += 1; continue; }
    if (token.kind !== "name") fail();
    params.push(token.text);
    reader.index += 1;
  }
  const body = readBlock(reader, unsupported);
  const close = reader.tokens[reader.index - 1];
  return { kind: "def", name: name.text, params, body, raw: slice(reader, start.start, close.end), start: start.start, end: close.end };
}

function readBlock(reader: Reader, unsupported: string[]): Statement[] {
  expect(reader, "punct", "{");
  const body = readStatements(reader, unsupported, true);
  expect(reader, "punct", "}");
  return body;
}

function readCall(reader: Reader, unsupported: string[]): CallStatement {
  const start = reader.tokens[reader.index];
  reader.index += 1;
  const args: Arg[] = [];
  let next = reader.tokens[reader.index];
  if (next && next.kind === "punct" && next.text === "(") {
    reader.index += 1;
    readCallArgs(reader, args);
    next = reader.tokens[reader.index];
  }
  if (next && next.kind === "punct" && next.text === "{") {
    const block = readStatements((reader.index += 1, reader), unsupported, true);
    const close = reader.tokens[reader.index];
    if (!close || close.text !== "}") fail();
    reader.index += 1;
    return { kind: "call", name: start.text, args, block, raw: slice(reader, start.start, close.end), start: start.start, end: close.end };
  }
  if (next && next.kind === "punct" && next.text === ";") {
    reader.index += 1;
    return { kind: "call", name: start.text, args, block: null, raw: slice(reader, start.start, next.end), start: start.start, end: next.end };
  }
  return fail();
}

/** Collect each argument's token slice (split at top-level commas), classify. */
function readCallArgs(reader: Reader, args: Arg[]): void {
  let depth = 0;
  let current: Token[] = [];
  for (;;) {
    const token = reader.tokens[reader.index];
    if (!token) fail();
    if (token.kind === "punct" && token.text === "(") depth += 1;
    if (token.kind === "punct" && token.text === ")") {
      if (depth === 0) {
        reader.index += 1;
        if (current.length > 0) args.push(classifyArg(current, reader.source));
        else if (args.length > 0) fail();
        return;
      }
      depth -= 1;
    }
    if (depth === 0 && token.kind === "punct" && token.text === ",") {
      if (current.length === 0) fail();
      args.push(classifyArg(current, reader.source));
      current = [];
      reader.index += 1;
      continue;
    }
    current.push(token);
    reader.index += 1;
  }
}

function classifyArg(tokens: Token[], source: string): Arg {
  const src = source.slice(tokens[0].start, tokens[tokens.length - 1].end);
  if (tokens.length === 1) {
    const only = tokens[0];
    if (only.kind === "string") return { type: "string", value: only.text };
    if (only.kind === "number") return { type: "number", value: only.value ?? 0 };
    if (only.kind === "name") return { type: "name", value: only.text };
  }
  if (tokens.length === 2 && tokens[0].kind === "op" && tokens[0].text === "-" && tokens[1].kind === "number") {
    return { type: "number", value: -(tokens[1].value ?? 0) };
  }
  // Literal point fast-path: ( ±num , ±num )
  const point = literalPoint(tokens);
  if (point) return point;
  // Full expression (possibly a tuple when wrapped in parens with top commas).
  if (tokens[0].kind === "punct" && tokens[0].text === "(" && tokens[tokens.length - 1].kind === "punct" && tokens[tokens.length - 1].text === ")") {
    return { type: "expr", node: parseTuple(tokens.slice(1, -1)), src };
  }
  return { type: "expr", node: parseExpr(tokens), src };
}

function literalPoint(tokens: Token[]): Arg | null {
  const inner = tokens[0]?.kind === "punct" && tokens[0].text === "(" ? tokens.slice(1, -1) : null;
  if (!inner || tokens[tokens.length - 1].text !== ")") return null;
  const parts: number[] = [];
  let index = 0;
  while (index < inner.length) {
    let sign = 1;
    if (inner[index]?.kind === "op" && inner[index].text === "-") { sign = -1; index += 1; }
    const num = inner[index];
    if (!num || num.kind !== "number") return null;
    parts.push(sign * (num.value ?? 0));
    index += 1;
    if (index === inner.length) break;
    if (inner[index].kind !== "punct" || inner[index].text !== ",") return null;
    index += 1;
  }
  if (parts.length === 2) return { type: "point", x: parts[0], y: parts[1] };
  return null;
}

function takeUntil(reader: Reader, stop: (token: Token) => boolean): Token[] {
  const out: Token[] = [];
  for (;;) {
    const token = reader.tokens[reader.index];
    if (!token) fail();
    if (stop(token)) return out;
    out.push(token);
    reader.index += 1;
  }
}

function expect(reader: Reader, kind: Token["kind"], text: string): void {
  const token = reader.tokens[reader.index];
  if (!token || token.kind !== kind || token.text !== text) fail();
  reader.index += 1;
}

function slice(reader: Reader, start: number, end: number): string {
  return reader.source.slice(start, end);
}

// Skip to the end of the malformed/unsupported statement (`;` or balanced `}`)
// and preserve its exact source text.
function skipStatement(reader: Reader, from: number, unsupported: string[]): void {
  let depth = 0;
  let end = reader.source.length;
  while (reader.index < reader.tokens.length) {
    const token = reader.tokens[reader.index];
    reader.index += 1;
    if (token.kind === "punct" && (token.text === "{" || token.text === "(")) depth += 1;
    if (token.kind === "punct" && token.text === ")") depth -= 1;
    if (token.kind === "punct" && token.text === "}") {
      depth -= 1;
      if (depth <= 0) { end = token.end; break; }
    }
    if (token.kind === "punct" && token.text === ";" && depth <= 0) { end = token.end; break; }
  }
  unsupported.push(reader.source.slice(from, end).trim());
}

/** Tokenize an expression fragment (used for id-interpolation contents). */
export function lexTokens(source: string): Token[] {
  return tokenize(source);
}

// --- Tokenizer -----------------------------------------------------------------

const TWO_CHAR_OPS = ["<=", ">=", "==", "!=", "&&", "||", ".."];
const ONE_CHAR_OPS = new Set(["+", "-", "*", "/", "^", "<", ">", "=", "!", ":", "."]);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === " " || char === "\t" || char === "\n" || char === "\r") { index += 1; continue; }
    if (char === "/" && source[index + 1] === "/") {
      const newline = source.indexOf("\n", index);
      index = newline === -1 ? source.length : newline + 1;
      continue;
    }
    const start = index;
    if (char === '"') {
      let text = "";
      index += 1;
      while (index < source.length && source[index] !== '"') {
        if (source[index] === "\\" && index + 1 < source.length) {
          const escaped = source[index + 1];
          text += escaped === "n" ? "\n" : escaped;
          index += 2;
        } else {
          text += source[index];
          index += 1;
        }
      }
      index += 1;
      tokens.push({ kind: "string", text, start, end: index });
      continue;
    }
    if (char === "`") {
      const close = source.indexOf("`", index + 1);
      index = close === -1 ? source.length : close + 1;
      tokens.push({ kind: "string", text: source.slice(start + 1, Math.max(start + 1, index - 1)), start, end: index });
      continue;
    }
    if (/[0-9]/u.test(char) || (char === "." && /[0-9]/u.test(source[index + 1] ?? "") && source[index + 1] !== ".")) {
      let end = index;
      let dotted = false;
      while (end < source.length) {
        const c = source[end];
        if (/[0-9]/u.test(c)) { end += 1; continue; }
        // A single decimal dot — but never the start of a `..` range.
        if (c === "." && !dotted && source[end + 1] !== "." && /[0-9]/u.test(source[end + 1] ?? "")) {
          dotted = true;
          end += 1;
          continue;
        }
        break;
      }
      const text = source.slice(index, end);
      tokens.push({ kind: "number", text, value: Number(text), start, end });
      index = end;
      continue;
    }
    if (/[A-Za-z_#]/u.test(char)) {
      let end = index + 1;
      for (;;) {
        const c = source[end];
        if (c !== undefined && /[A-Za-z0-9_]/u.test(c)) { end += 1; continue; }
        // Single dots join child ids (`cap.w0`) — but never a `..` range.
        if (c === "." && source[end + 1] !== "." && /[A-Za-z0-9_]/u.test(source[end + 1] ?? "")) { end += 1; continue; }
        // Adjacent `{expr}` = id interpolation, glued (a spaced `{` is a block).
        if (c === "{") {
          let depth = 0;
          let scan = end;
          while (scan < source.length) {
            if (source[scan] === "{") depth += 1;
            if (source[scan] === "}") { depth -= 1; if (depth === 0) { scan += 1; break; } }
            scan += 1;
          }
          if (depth !== 0) break;
          end = scan;
          continue;
        }
        break;
      }
      tokens.push({ kind: "name", text: source.slice(index, end), start, end });
      index = end;
      continue;
    }
    if ("(){};,".includes(char)) {
      tokens.push({ kind: "punct", text: char, start, end: index + 1 });
      index += 1;
      continue;
    }
    const two = source.slice(index, index + 2);
    if (TWO_CHAR_OPS.includes(two)) {
      tokens.push({ kind: "op", text: two, start, end: index + 2 });
      index += 2;
      continue;
    }
    if (ONE_CHAR_OPS.has(char)) {
      tokens.push({ kind: "op", text: char, start, end: index + 1 });
      index += 1;
      continue;
    }
    tokens.push({ kind: "other", text: char, start, end: index + 1 });
    index += 1;
  }
  return tokens;
}
