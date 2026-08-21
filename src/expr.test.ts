// The expression engine must match the engine's expand pass semantics.

import { describe, expect, it } from "vitest";
import { evalExpr, parseExpr, randArgs, formatInterp, type Env } from "./expr.js";
import { lexTokens } from "./script.js";

function run(src: string, vars: Record<string, number> = {}): number {
  return evalExpr(parseExpr(lexTokens(src)), new Map(Object.entries(vars)) as Env);
}

describe("expression engine", () => {
  it("handles precedence and right-associative ^", () => {
    expect(run("2 + 3 * 4")).toBe(14);
    expect(run("2 ^ 3 ^ 2")).toBe(512); // right-assoc: 2^(3^2)
    expect(run("-2 ^ 2")).toBe(-4);     // unary binds looser than ^
    expect(run("(2 + 3) * 4")).toBe(20);
  });

  it("implicit multiplication after a number or `)`", () => {
    expect(run("2sx", { sx: 170 })).toBe(340);
    expect(run("3(1 + 1)")).toBe(6);
    expect(run("(1 + 2)c", { c: 10 })).toBe(30);
    expect(run("2pi")).toBeCloseTo(Math.PI * 2, 10);
    expect(run("110cos(0)")).toBe(110);
  });

  it("comparisons and logic yield 1/0", () => {
    expect(run("3 > 2 && 1 <= 1")).toBe(1);
    expect(run("3 == 2 || 0")).toBe(0);
    expect(run("h > w", { h: 1280, w: 720 })).toBe(1);
  });

  it("evaluates reductions", () => {
    expect(run("sum(i in 0..5 : i)")).toBe(10);
    expect(run("prod(i in 1..5 : i)")).toBe(24);
    expect(run("min(i in 0..4 : 10 - i)")).toBe(7);
    expect(run("max(i in 0..4 : i * i)")).toBe(9);
  });

  it("callable 2-arg min/max and the function table", () => {
    expect(run("min(3, 7)")).toBe(3);
    expect(run("max(3, 7)")).toBe(7);
    expect(run("sqrt(9) + abs(-2) + floor(1.9)")).toBe(6);
    expect(run("sinc(0)")).toBe(1);
    expect(run("sign(-3)")).toBe(-1);
  });

  it("random is deterministic, bounded, and varied", () => {
    const seen = new Set<number>();
    for (let index = 0; index < 200; index += 1) {
      const value = randArgs([index], 0n);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      seen.add(value);
    }
    expect(seen.size).toBeGreaterThan(190);
    expect(randArgs([42], 0n)).toBe(randArgs([42], 0n));
    expect(run("random(7)")).toBe(run("random(7)"));
    expect(run("noise(1.5)")).toBeGreaterThanOrEqual(0);
  });

  it("throws on unknown names and glued name-name products", () => {
    expect(() => run("nope + 1")).toThrow();
    expect(() => run("dxsx", { dx: 2, sx: 3 })).toThrow(); // one identifier, per the language
  });

  it("formats interpolated ids like the engine", () => {
    expect(formatInterp(3)).toBe("3");
    expect(formatInterp(2.9999999)).toBe("3");
    expect(formatInterp(3.5)).toBe("3.5");
  });
});
