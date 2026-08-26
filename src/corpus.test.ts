// Corpus invariants over the real example library (hundreds of hand-written
// .manic files). The projection/patching contract must hold for every one:
//   1. readSceneSource never throws.
//   2. Identity: patching an unchanged doc returns the byte-identical file.
//   3. A real edit survives: mutate → patch → re-read matches, skipped
//      statements are untouched, and the patched file identity-patches too.
//
// Skips cleanly when the examples corpus isn't checked out next door.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { patchSceneSource, readSceneSource } from "./codec.js";
import { cloneDoc, entityAnchor, translateEntity } from "./model.js";

const CORPUS_DIR = process.env.MANIC_EXAMPLES
  ?? resolve(import.meta.dirname, "../../manic-workbench/examples");

const available = existsSync(CORPUS_DIR);
const files = available
  ? readdirSync(CORPUS_DIR).filter((file) => file.endsWith(".manic")).sort()
  : [];

describe.skipIf(!available)(`example corpus (${files.length} files)`, () => {
  it("projects every file and identity-patches byte-identically", () => {
    const failures: string[] = [];
    for (const file of files) {
      const source = readFileSync(resolve(CORPUS_DIR, file), "utf8");
      try {
        const scene = readSceneSource(source);
        if (patchSceneSource(source, scene, cloneDoc(scene.doc)) !== source) failures.push(`${file}: identity patch differs`);
      } catch (error) {
        failures.push(`${file}: threw ${(error as Error).message}`);
      }
    }
    expect(failures, failures.slice(0, 10).join("\n")).toEqual([]);
  }, 15_000);

  it("survives a real edit on every editable file", () => {
    const failures: string[] = [];
    for (const file of files) {
      const source = readFileSync(resolve(CORPUS_DIR, file), "utf8");
      const scene = readSceneSource(source);
      // Only literal (origin-less) entities are editable; computed/generated
      // ones are locked by design.
      const editableIndex = scene.doc.entities.findIndex((entity) => !entity.origin);
      if (editableIndex === -1) continue;
      try {
        const next = cloneDoc(scene.doc);
        translateEntity(next.entities[editableIndex], 7, 11);
        const updated = patchSceneSource(source, scene, next);
        const again = readSceneSource(updated);
        const moved = again.doc.entities.find((entity) => entity.id === next.entities[editableIndex].id);
        const want = entityAnchor(next.entities[editableIndex]);
        const got = moved ? entityAnchor(moved) : { x: NaN, y: NaN };
        if (Math.abs(got.x - want.x) > 0.01 || Math.abs(got.y - want.y) > 0.01) {
          failures.push(`${file}: anchor ${got.x},${got.y} != ${want.x},${want.y}`);
          continue;
        }
        if (again.skipped.length !== scene.skipped.length) {
          failures.push(`${file}: skipped ${scene.skipped.length} -> ${again.skipped.length}`);
          continue;
        }
        // The patched file must itself be a stable projection.
        if (patchSceneSource(updated, again, cloneDoc(again.doc)) !== updated) {
          failures.push(`${file}: post-edit identity patch differs`);
        }
      } catch (error) {
        failures.push(`${file}: threw ${(error as Error).message}`);
      }
    }
    expect(failures, failures.slice(0, 10).join("\n")).toEqual([]);
  }, 15_000);
});
