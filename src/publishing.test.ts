import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyVocabularyFeature, cloneDoc, createEntity, creatorEndcardBox, entityBounds,
  patchSceneSource, readSceneSource, referenceIds, replaceEntityReference,
  serializeSceneFile, vocabularyAvailability, vocabularyEntry,
} from "./index.js";
import type { CreatorEntity, FigureEntity, SafezoneEntity } from "./types.js";

const MANIC = "/Users/anish/git/manic/target/debug/manic";
const SOURCE = `canvas(720, 1280);
template("black");

creator(me, "@anish name=Manic_Lab tagline=Ideas_in_motion yt=channel x=@anish web=manic.dev accent=cyan secondary=gold footer=signature cta=Try_it safe=reels");
socials(me);
endcard(me, "title=Build_Visually cta=manic.dev safe=clean");
sticky(me.footer);
sticky(me.endcard);
safezone(safe, reels);
circle(hero, (360, 480), 70);
tag(hero, artwork);
figure(artwork, (360, 500), (520, 300));

step("Publish") {
  seq {
    fade(me.footer, 0.3);
    show(me.endcard, 0.6);
  }
}
`;

describe("creator publishing vocabulary", () => {
  it("projects profiles, generated families, safe areas, figures, and child beats", () => {
    const scene = readSceneSource(SOURCE);
    expect(scene.skipped).toEqual([]);
    expect(scene.doc.entities.map((entity) => entity.kind)).toEqual(["creator", "safezone", "circle", "figure"]);
    const creator = scene.doc.entities[0] as CreatorEntity;
    expect(creator).toMatchObject({ handle: "@anish", displayName: "Manic Lab", tagline: "Ideas in motion", website: "manic.dev", footer: "signature", safe: "reels", socials: true, stickyFooter: true, stickyEndcard: true });
    expect(creator.platforms).toBe("yt=channel x=@anish");
    expect(creator.endcard).toEqual({ title: "Build Visually", cta: "manic.dev", safe: "clean" });
    expect((scene.doc.entities[1] as SafezoneEntity).mode).toBe("reels");
    expect(scene.doc.entities[3]).toMatchObject({ kind: "figure", id: "artwork.figure", target: "artwork", x: 360, y: 500, width: 520, height: 300 });
    expect(scene.doc.steps[0].actions.map((action) => action.target)).toEqual(["me.footer", "me.endcard"]);
  });

  it("identity-patches and surgically regenerates the complete profile family", () => {
    const scene = readSceneSource(SOURCE);
    expect(patchSceneSource(SOURCE, scene, cloneDoc(scene.doc))).toBe(SOURCE);
    const next = cloneDoc(scene.doc), creator = next.entities[0] as CreatorEntity;
    creator.displayName = "Manic Studio";
    creator.socialsAt = { x: 360, y: 1170 };
    creator.endcard = { title: "Keep Building", cta: "try.manic.dev", safe: "shorts" };
    (next.entities[1] as SafezoneEntity).mode = "tiktok";
    (next.entities[3] as FigureEntity).width = 560;
    const updated = patchSceneSource(SOURCE, scene, next);
    expect(updated).toContain("name=Manic_Studio");
    expect(updated).toContain("socials(me, (360, 1170));");
    expect(updated).toContain('endcard(me, "title=Keep_Building cta=try.manic.dev safe=shorts");');
    expect(updated).toContain("safezone(safe, tiktok);");
    expect(updated).toContain("figure(artwork, (360, 500), (560, 300));");
    expect(readSceneSource(updated).skipped).toEqual([]);
  });

  it("creates valid defaults and exposes socials/endcard as contextual features", () => {
    const doc = readSceneSource("circle(hero, (300, 300), 60);\n").doc;
    const creator = createEntity("creator", "brand", 0, 0, doc) as CreatorEntity;
    doc.entities.push(creator);
    for (const name of ["socials", "endcard"] as const) {
      const entry = vocabularyEntry(name)!;
      expect(vocabularyAvailability(entry, doc, creator.id).enabled).toBe(true);
      expect(applyVocabularyFeature(creator, name, doc)).toBe(true);
    }
    const safe = createEntity("safezone", "safe", 0, 0, doc);
    const figure = createEntity("figure", "ignored", 0, 0, doc, "hero");
    doc.entities.push(safe, figure);
    expect(readSceneSource(serializeSceneFile(doc)).skipped).toEqual([]);
  });

  it("matches native footer suppression and case-insensitive end-card keys", () => {
    const source = `canvas(1080, 1920);\ncreator(me, "@a footer=none");\nsocials(me);\nendcard(me, "TITLE=Keep_Going CTA=manic.dev SAFE=reels");\n`;
    const scene = readSceneSource(source);
    expect(scene.skipped).toEqual([]);
    const creator = scene.doc.entities[0] as CreatorEntity;
    expect(creator.endcard).toEqual({ title: "Keep Going", cta: "manic.dev", safe: "reels" });
    expect(referenceIds(creator)).toEqual(["me.endcard"]);
    const bounds = entityBounds(creator, scene.doc), endcard = creatorEndcardBox(creator, scene.doc);
    expect(bounds.x).toBeCloseTo(endcard.x);
    expect(bounds.y).toBeCloseTo(endcard.y);
    expect(bounds.width).toBeCloseTo(endcard.width);
    expect(bounds.height).toBeCloseTo(endcard.height);
    creator.stickyFooter = true;
    expect(serializeSceneFile(scene.doc)).not.toContain("sticky(me.footer)");
  });

  it("renames figure relationships and their derived logical id", () => {
    const scene = readSceneSource(SOURCE), figure = scene.doc.entities[3] as FigureEntity;
    replaceEntityReference(figure, "artwork", "diagram");
    expect(figure).toMatchObject({ target: "diagram", id: "diagram.figure" });
  });

  it("passes native validation", () => {
    if (!existsSync(MANIC)) return;
    const path = resolve(tmpdir(), "manic-publishing-batch.manic");
    writeFileSync(path, SOURCE);
    expect(() => execFileSync(MANIC, ["check", path], { stdio: "pipe" })).not.toThrow();
  });
});

const EXAMPLES = ["creator-v2.manic", "motion-graphics-v2-story.manic", "parameter-journeys.manic", "creator-lattice-paths.manic"]
  .map((name) => resolve(import.meta.dirname, "../../manic-workbench/examples", name));

describe.skipIf(EXAMPLES.some((file) => !existsSync(file)))("publishing corpus acceptance", () => {
  it("understands the batch without disturbing representative creator files", () => {
    const names = ["creator", "socials", "endcard", "safezone", "figure"];
    for (const file of EXAMPLES) {
      const source = readFileSync(file, "utf8"), scene = readSceneSource(source);
      for (const name of names) expect(scene.skipped.some((note) => note.includes(`\`${name}\` isn't canvas vocabulary yet`)), `${file}: ${name}`).toBe(false);
      expect(patchSceneSource(source, scene, cloneDoc(scene.doc)), file).toBe(source);
    }
  });
});
