// A normalized, framework-agnostic read model over Manic's engine catalog and
// the visual editor registries. UI surfaces search/filter this index; behavior
// remains owned by EntityDef, VerbDef, the codec, and the engine.

import { CATALOG, type CatalogEntry } from "./catalog.js";
import { beatAvailability, canNativeCopy, canNativeState, entityReferences } from "./model.js";
import { threePointReferences } from "./entities/three.js";
import { allEntityDefs, allVerbDefs, defFor, entityDefByCtor, isAuthorOnly, type EntityDef } from "./registry.js";
import type { SceneDoc, SceneEntity } from "./types.js";

export const VOCABULARY_CATEGORIES = [
  "Text & captions",
  "Math & equations",
  "Shapes & drawing",
  "Plots & data",
  "Annotation & explanation",
  "Media",
  "3D",
  "Camera & scene",
  "Effects & styling",
  "Layout & relationships",
  "Timing & animation",
  "Computation & source",
] as const;

export type VocabularyCategory = (typeof VOCABULARY_CATEGORIES)[number];
export type VocabularyKind = "entity" | "verb" | "modifier" | "scene" | "helper";
export type VocabularySurface = "add" | "animate" | "feature" | "inspector" | "scene" | "language" | "source";
export type VocabularyFidelity = "exact" | "semantic" | "source-only";
export type VocabularyOperation = "create" | "animate" | "style" | "arrange" | "relate" | "reveal" | "camera" | "compute";

export interface VocabularyEntry {
  /** Stable native Manic spelling. */
  name: string;
  label: string;
  summary: string;
  kind: VocabularyKind;
  kit: string;
  category: VocabularyCategory;
  operations: readonly VocabularyOperation[];
  keywords: readonly string[];
  surfaces: readonly VocabularySurface[];
  fidelity: VocabularyFidelity;
  order: number;
  icon?: string;
  signature: string;
  /** Adapter identity; runtime behavior stays in the existing registries. */
  registryRef?: string;
  /** Inspector anchor for optional features. */
  controlId?: string;
}

export interface VocabularyAvailability {
  enabled: boolean;
  reason: string;
  recovery?: { label: string; action: "select" | "add-camera" | "add-entity" | "source" };
}

export type FeatureName = "gradient" | "plate" | "cursor" | "clip" | "mask" | "glow" | "sticky" | "dashed" | "savestate" | "morph" | "pin3" | "thick" | "finish3" | "morph3" | "follow3" | "socials" | "endcard";

interface FeatureMetadata {
  name: FeatureName;
  label: string;
  summary: string;
  category: VocabularyCategory;
  fidelity: Exclude<VocabularyFidelity, "source-only">;
  keywords: readonly string[];
  controlId: string;
  order: number;
}

const FEATURES: readonly FeatureMetadata[] = [
  { name: "gradient", label: "Gradient", summary: "Use a multi-stop fill or stroke gradient", category: "Effects & styling", fidelity: "semantic", keywords: ["paint", "colors", "palette", "speed", "curvature"], controlId: "mse-gradient-controls", order: 10 },
  { name: "plate", label: "Readable text plate", summary: "Put a theme-aware background behind text", category: "Effects & styling", fidelity: "exact", keywords: ["readable", "background", "contrast", "text"], controlId: "mse-text-composition-controls", order: 20 },
  { name: "cursor", label: "Typewriter cursor", summary: "Show a typing cursor on text", category: "Effects & styling", fidelity: "semantic", keywords: ["type", "caret", "text"], controlId: "mse-text-composition-controls", order: 21 },
  { name: "clip", label: "Rectangular clip", summary: "Crop this entity to another entity's bounds", category: "Layout & relationships", fidelity: "exact", keywords: ["crop", "window", "region"], controlId: "mse-crop-controls", order: 30 },
  { name: "mask", label: "Shape mask", summary: "Use another entity's silhouette as a visibility mask", category: "Layout & relationships", fidelity: "semantic", keywords: ["crop", "silhouette", "spotlight", "region"], controlId: "mse-crop-controls", order: 31 },
  { name: "glow", label: "Glow", summary: "Add a neon halo around this entity", category: "Effects & styling", fidelity: "semantic", keywords: ["neon", "halo", "light"], controlId: "mse-shared-feature-controls", order: 40 },
  { name: "sticky", label: "Screen pinned", summary: "Keep this entity fixed while the camera moves", category: "Camera & scene", fidelity: "semantic", keywords: ["hud", "overlay", "fixed", "camera"], controlId: "mse-shared-feature-controls", order: 41 },
  { name: "dashed", label: "Dashed stroke", summary: "Use a repeating dash and gap on a path", category: "Effects & styling", fidelity: "exact", keywords: ["stroke", "line", "pattern"], controlId: "mse-shared-feature-controls", order: 42 },
  { name: "savestate", label: "Saved state", summary: "Snapshot this entity for a later Restore beat", category: "Timing & animation", fidelity: "semantic", keywords: ["restore", "snapshot", "return", "state"], controlId: "mse-state-controls", order: 43 },
  { name: "morph", label: "Shape morph", summary: "Prepare this entity to morph into another 2D entity", category: "Layout & relationships", fidelity: "semantic", keywords: ["transform", "blueprint", "shape", "spin"], controlId: "mse-morph2-controls", order: 44 },
  { name: "pin3", label: "Follow a 3D point", summary: "Pin a 2D label to a projected world-space point", category: "3D", fidelity: "semantic", keywords: ["attach", "world", "label", "camera"], controlId: "mse-spatial3-controls", order: 50 },
  { name: "thick", label: "3D thickness", summary: "Render a 3D path with a world-space tube radius", category: "3D", fidelity: "semantic", keywords: ["tube", "stroke", "radius"], controlId: "mse-spatial3-controls", order: 51 },
  { name: "finish3", label: "3D material finish", summary: "Configure shading, material, texture, wireframe, depth, and shadow", category: "3D", fidelity: "semantic", keywords: ["material", "metal", "glass", "wireframe", "texture", "shading"], controlId: "mse-spatial3-controls", order: 51.5 },
  { name: "morph3", label: "3D morph", summary: "Morph a sampled 3D curve into another curve", category: "3D", fidelity: "semantic", keywords: ["transform", "curve", "shape", "spin"], controlId: "mse-spatial3-controls", order: 52 },
  { name: "follow3", label: "3D follow relationship", summary: "Keep one concrete 3D entity at another entity's world position plus an offset", category: "3D", fidelity: "semantic", keywords: ["attach", "parent", "relationship", "offset", "world"], controlId: "mse-spatial3-controls", order: 53 },
  { name: "socials", label: "Social footer", summary: "Draw this creator profile's responsive social footer", category: "Layout & relationships", fidelity: "semantic", keywords: ["creator", "footer", "handle", "platforms", "brand"], controlId: "mse-publishing-controls", order: 60 },
  { name: "endcard", label: "Creator end card", summary: "Build a responsive hidden call-to-action card", category: "Layout & relationships", fidelity: "semantic", keywords: ["creator", "cta", "outro", "brand"], controlId: "mse-publishing-controls", order: 61 },
];

const FEATURE_BY_NAME = new Map(FEATURES.map((feature) => [feature.name, feature]));
const CATALOG_BY_NAME = new Map(CATALOG.builtins.map((entry) => [entry.name, entry]));
const COMPUTATION_NAMES = ["let", "for", "if", "def", "sum", "prod", "min", "max"] as const;
const TIMING_CONTROL = [
  { name: "timed", label: "Timed phase composition", summary: "schedule one Story composition against a generic timing controller's exact named-phase offsets", signature: "timed(clock) { during(…) { … } }" },
  { name: "during", label: "During named phase", summary: "place sequential, parallel, or staggered Story beats inside one declared timing phase", signature: "during(phase) { … }" },
] as const;
const SCENE_NAMES = ["canvas", "template"] as const;
const SHARED_READY = ["color", "opacity", "rot", "hidden", "untraced", "hue", "tag", "z", "label3"] as const;

const GROUP_CATEGORY: Record<string, VocabularyCategory> = {
  Text: "Text & captions",
  Math: "Math & equations",
  Shapes: "Shapes & drawing",
  Annotations: "Annotation & explanation",
  Geometry: "Plots & data",
  Data: "Plots & data",
  Charts: "Plots & data",
  Process: "Plots & data",
  Chemistry: "Math & equations",
  Publishing: "Layout & relationships",
  Systems: "Layout & relationships",
  "3D": "3D",
};

const PATH_KINDS = new Set(["line", "arrow", "link", "framebox", "brace", "bracelabel", "bracetext", "support", "axes", "coords", "segment", "vector", "ellipse", "circle2", "anglemark", "rightangle", "plot", "deriv", "accum", "tangent", "lsystem", "polarpath", "hull2", "invertpath", "reflectpath", "boolean", "arc"]);
const FILL_KINDS = new Set(["circle", "rect", "dot", "polygon", "particles", "circle2", "repeat", "hull2", "boolean", "band", "sector", "annulus"]);
const ENTITY3_KINDS = new Set(["camera3", "grid3", "line3", "arrow3", "curve3", "point3", "cloud3", "axes3", "frame3", "cube3", "sphere3", "prism3", "pyramid3", "midpoint3", "cross3", "link3", "model3", "assembly3", "extrude3", "revolve3", "tube3", "project3", "projectpath3", "surface3", "domainsurface", "param3", "implicit3", "heightmap3", "contour3", "slice3", "tangentplane3", "gradient3", "vectorfield3", "volume3", "trajectory3", "descend3", "linmap3", "eigen3", "collection3", "collection3data", "child3", "links3", "links3data", "pieces3", "ring3", "trail3", "historyplot3", "randomwalk3", "lsystem3", "tree3", "hilbert3", "molecule3"]);
const CROP_EXCLUDED = new Set(["caption", "mathparts", "particles", ...ENTITY3_KINDS]);
const FOLLOW3_EXCLUDED = new Set(["camera3", "axes3", "frame3", "cross3", "assembly3", "volume3", "eigen3", "pieces3", "tree3"]);
const COMMON_ENTITY_ORDER = new Map(["text", "equation", "rect", "circle", "arrow", "line", "caption", "plot", "point", "segment", "axes", "coords", "vector", "ellipse", "circle2", "midpoint", "anglemark", "rightangle", "label", "framebox", "brace", "mathparts"].map((name, index) => [name, index + 1]));

let cachedEntries: readonly VocabularyEntry[] | null = null;

/** Full language index. Rebuilt only when explicitly requested by tests/tooling. */
export function allVocabularyEntries(refresh = false): readonly VocabularyEntry[] {
  if (cachedEntries && !refresh) return cachedEntries;
  const entries = new Map<string, VocabularyEntry>();

  for (const catalog of CATALOG.builtins) entries.set(catalog.name, catalogEntry(catalog));

  for (const def of allEntityDefs()) {
    const catalog = CATALOG_BY_NAME.get(def.ctor);
    entries.set(def.ctor, {
      ...baseEntry(def.ctor, catalog),
      label: def.label,
      summary: catalog?.summary || def.hint,
      kind: "entity",
      category: GROUP_CATEGORY[def.group] ?? "Shapes & drawing",
      operations: def.references ? ["create", "relate"] : ["create"],
      keywords: uniqueWords([def.group, def.kind, def.hint, ...(def.kind === "link" ? ["connect two things edge relationship"] : def.references ? ["attach", "relationship"] : [])]),
      surfaces: ["add", "language"],
      fidelity: entityFidelity(def),
      order: COMMON_ENTITY_ORDER.get(def.ctor) ?? 500 + def.order,
      icon: def.icon,
      registryRef: `entity:${def.kind}`,
    });
    for (const alias of def.aliases ?? []) {
      const aliasCatalog = CATALOG_BY_NAME.get(alias);
      entries.set(alias, {
        ...baseEntry(alias, aliasCatalog),
        label: `${def.label} · ${alias}`,
        summary: aliasCatalog?.summary || `${alias} is a native spelling handled by ${def.label}.`,
        kind: "entity", category: GROUP_CATEGORY[def.group] ?? "Shapes & drawing",
        operations: def.references ? ["create", "relate"] : ["create"],
        keywords: uniqueWords([def.group, def.kind, def.hint, "alias"]),
        surfaces: ["language"], fidelity: entityFidelity(def),
        order: 500 + def.order, icon: def.icon, registryRef: `entity:${def.kind}`,
      });
    }
  }

  const copyCatalog = CATALOG_BY_NAME.get("copy");
  entries.set("copy", {
    ...baseEntry("copy", copyCatalog), label: "Copy entity",
    summary: copyCatalog?.summary || "Duplicate the selected entity as a native snapshot",
    kind: "entity", category: "Layout & relationships", operations: ["create", "relate"],
    keywords: ["duplicate", "clone", "snapshot", "transform from copy"], surfaces: ["language"],
    fidelity: "semantic", order: 590, icon: "⧉", registryRef: "editor:copy",
  });

  const modifierGroups = new Map<string, Set<string>>();
  for (const def of allEntityDefs()) {
    for (const name of Object.keys(def.modifiers)) {
      const groups = modifierGroups.get(name) ?? new Set<string>();
      groups.add(def.group);
      modifierGroups.set(name, groups);
    }
  }
  for (const [name, groups] of modifierGroups) {
    const existing = entries.get(name);
    if (existing && existing.fidelity !== "source-only") continue;
    const catalog = CATALOG_BY_NAME.get(name);
    const onlyGroup = groups.size === 1 ? [...groups][0] : "";
    entries.set(name, {
      ...baseEntry(name, catalog),
      kind: "modifier",
      category: GROUP_CATEGORY[onlyGroup] ?? "Effects & styling",
      operations: ["style"],
      keywords: uniqueWords([...groups, "property inspector"]),
      surfaces: ["inspector", "language"],
      fidelity: onlyGroup === "Physics" || onlyGroup === "Systems" || onlyGroup === "Circuit" || onlyGroup === "Charts" || onlyGroup === "Chemistry" || ["neighbors", "setcell", "walls", "evolve", "collapse", "option", "timing", "timerstyle", "explain"].includes(name) ? "semantic" : "exact",
      order: 2_000,
      registryRef: `modifier:${name}`,
    });
  }

  for (const verb of allVerbDefs()) {
    const catalog = CATALOG_BY_NAME.get(verb.name);
    entries.set(verb.name, {
      ...baseEntry(verb.name, catalog),
      label: verb.label,
      summary: catalog?.summary || verb.hint,
      kind: "verb",
      category: verbCategory(verb.name),
      operations: verbOperations(verb.name),
      keywords: uniqueWords([verb.hint, verb.targetless ? "scene" : "entity", verb.placement === "timeline" ? "timeline" : "beat"]),
      surfaces: verb.placement === "timeline" ? ["animate", "language"] : ["animate", "language"],
      fidelity: "semantic",
      order: verb.order,
      registryRef: `verb:${verb.name}`,
    });
  }

  for (const feature of FEATURES) {
    const catalog = CATALOG_BY_NAME.get(feature.name);
    entries.set(feature.name, {
      ...baseEntry(feature.name, catalog),
      label: feature.label,
      summary: catalog?.summary || feature.summary,
      kind: "modifier",
      category: feature.category,
      operations: feature.category === "Layout & relationships" ? ["relate", "style"] : feature.category === "Camera & scene" ? ["camera", "style"] : ["style"],
      keywords: feature.keywords,
      surfaces: ["feature", "language"],
      fidelity: feature.fidelity,
      order: 1_000 + feature.order,
      registryRef: `feature:${feature.name}`,
      controlId: feature.controlId,
    });
  }

  for (const name of SHARED_READY) {
    if (entries.get(name)?.fidelity !== "source-only") continue;
    const catalog = CATALOG_BY_NAME.get(name);
    entries.set(name, {
      ...baseEntry(name, catalog), kind: "modifier", category: name === "label3" ? "3D" : "Effects & styling",
      operations: [name === "label3" ? "relate" : "style"], keywords: [], surfaces: ["inspector", "language"], fidelity: name === "label3" ? "semantic" : "exact", order: 2_100,
      registryRef: `modifier:${name}`,
    });
  }

  for (const name of SCENE_NAMES) {
    const catalog = CATALOG_BY_NAME.get(name);
    entries.set(name, {
      ...baseEntry(name, catalog), kind: "scene", category: "Camera & scene",
      operations: ["create"], keywords: ["document", "format", "style"], surfaces: ["scene", "language"], fidelity: name === "canvas" ? "exact" : "semantic", order: 5_000,
    });
  }

  for (const name of COMPUTATION_NAMES) {
    const catalog = CATALOG_BY_NAME.get(name);
    entries.set(name, {
      ...baseEntry(name, catalog), kind: "helper", category: "Computation & source",
      operations: ["compute"], keywords: ["variables", "expressions", "generated"], surfaces: ["language", "source"], fidelity: "semantic", order: 5_100,
      summary: catalog?.summary || `${name} computation supported by the Canvas projection while Source remains authoritative`,
    });
  }

  for (const control of TIMING_CONTROL) {
    entries.set(control.name, {
      name: control.name, label: control.label, summary: control.summary, signature: control.signature,
      kind: "helper", kit: "editor", category: "Timing & animation", operations: ["animate", "arrange"],
      keywords: ["phase", "clock", "schedule", "nested", "parallel", "sequence", "stagger"],
      surfaces: ["language"], fidelity: "semantic", order: 5_050,
    });
  }

  cachedEntries = [...entries.values()].sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order || a.name.localeCompare(b.name));
  return cachedEntries;
}

export function vocabularyEntry(name: string): VocabularyEntry | undefined {
  return allVocabularyEntries().find((entry) => entry.name === name);
}

export function entriesForSurface(surface: VocabularySurface): VocabularyEntry[] {
  return allVocabularyEntries().filter((entry) => entry.surfaces.includes(surface));
}

/** Search is deterministic and deliberately small: exact/prefix name and label
 * beat task-language keywords, which beat summary-only matches. */
export function searchVocabulary(entries: readonly VocabularyEntry[], query: string): VocabularyEntry[] {
  const tokens = normalize(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return [...entries].sort(defaultEntryOrder);
  return entries
    .map((entry) => ({ entry, score: searchScore(entry, tokens) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || defaultEntryOrder(a.entry, b.entry))
    .map((candidate) => candidate.entry);
}

export function vocabularyAvailability(entry: VocabularyEntry, doc: SceneDoc, selectedId = ""): VocabularyAvailability {
  if (entry.fidelity === "source-only") return { enabled: false, reason: "Source only — open this builtin in Language or Source.", recovery: { label: "Open Source", action: "source" } };
  if (entry.name === "copy") {
    const selected = doc.entities.find((entity) => entity.id === selectedId);
    if (!selected) return { enabled: false, reason: "Select an entity to copy.", recovery: { label: "Select an entity", action: "select" } };
    if (!canNativeCopy(selected)) return { enabled: false, reason: "This Canvas item is a logical group or generated controller, not one concrete native entity. Duplicate its source structure instead." };
    return { enabled: true, reason: "" };
  }
  if (entry.kind === "entity") {
    const def = entityDefByCtor(entry.name);
    if (!def) return { enabled: false, reason: "This constructor is not registered for Canvas creation." };
    if (def.canCreate && !def.canCreate(doc)) return { enabled: false, reason: def.createBlockedReason ?? `${def.hint} — add its required target first.`, recovery: { label: "Add prerequisite", action: "add-entity" } };
    return { enabled: true, reason: "" };
  }
  if (entry.kind === "verb") return beatAvailability(doc, entry.name, selectedId);
  if (entry.kind === "modifier" && FEATURE_BY_NAME.has(entry.name as FeatureName)) {
    const entity = doc.entities.find((candidate) => candidate.id === selectedId) ?? null;
    return featureAvailability(entry.name as FeatureName, doc, entity);
  }
  return { enabled: true, reason: "" };
}

export function isFeatureName(name: string): name is FeatureName {
  return FEATURE_BY_NAME.has(name as FeatureName);
}

export function featureControlId(name: FeatureName): string {
  return FEATURE_BY_NAME.get(name)?.controlId ?? "";
}

export function featureIsApplied(entity: SceneEntity, name: FeatureName): boolean {
  if (name === "thick") return (entity.thickness3 ?? 0) !== 0;
  if (name === "finish3") return entity.finish3 !== undefined;
  if (name === "follow3") return entity.follow3 !== undefined;
  return name === "gradient" ? entity.gradient !== undefined
    : name === "plate" ? entity.plate !== undefined
      : name === "cursor" ? entity.cursor === true
        : name === "clip" ? entity.clip !== undefined
          : name === "mask" ? entity.mask !== undefined
            : name === "glow" ? entity.glow !== undefined
              : name === "sticky" ? entity.sticky === true
              : name === "dashed" ? entity.dashed !== undefined
                : name === "savestate" ? entity.savedState === true
                  : name === "morph" ? entity.morph2 !== undefined
                    : name === "pin3" ? entity.pin3 !== undefined
                    : name === "morph3" ? entity.morph3 !== undefined
                      : name === "socials" ? entity.kind === "creator" && entity.socials
                        : name === "endcard" ? entity.kind === "creator" && entity.endcard !== null
                      : false;
}

export function featureAvailability(name: FeatureName, doc: SceneDoc, entity: SceneEntity | null): VocabularyAvailability {
  if (!entity) return { enabled: false, reason: `Select a compatible entity to apply ${FEATURE_BY_NAME.get(name)?.label ?? name}.`, recovery: { label: "Select an entity", action: "select" } };
  if (entity.origin === "generated") return { enabled: false, reason: "Generated instances are edited through their loop or macro in Source.", recovery: { label: "Open Source", action: "source" } };
  if (isAuthorOnly(entity)) return { enabled: false, reason: "This is a source declaration, not a drawable native entity." };
  if (entity.kind === "loupe") return { enabled: false, reason: "Loupe styling belongs to its constructor fields; animate its frame or panel children from Story." };
  if (featureIsApplied(entity, name)) return { enabled: false, reason: "Already applied — edit it in the Applied section." };
  if (name === "gradient" && !FILL_KINDS.has(entity.kind) && !PATH_KINDS.has(entity.kind)) return { enabled: false, reason: "Gradient needs a filled shape or path-like entity." };
  if ((name === "plate" || name === "cursor") && entity.kind !== "text" && entity.kind !== "label") return { enabled: false, reason: `${FEATURE_BY_NAME.get(name)?.label} applies to text or attached labels.` };
  if ((name === "clip" || name === "mask")) {
    if (CROP_EXCLUDED.has(entity.kind)) return { enabled: false, reason: `${FEATURE_BY_NAME.get(name)?.label} is not supported for this entity kind.` };
    if (cropRegions(doc, entity).length === 0) return { enabled: false, reason: `${FEATURE_BY_NAME.get(name)?.label} needs another entity to use as its region.`, recovery: { label: "Add a region", action: "add-entity" } };
  }
  if (name === "sticky" && ENTITY3_KINDS.has(entity.kind)) return { enabled: false, reason: "3D entities live in world space and cannot be screen pinned." };
  if (name === "dashed" && !PATH_KINDS.has(entity.kind) && !["circle", "rect", "polygon", "sector", "annulus"].includes(entity.kind)) return { enabled: false, reason: "Dashed stroke needs a path or outlined shape." };
  if (name === "savestate" && !canNativeState(entity)) return { enabled: false, reason: "Saved state needs one concrete 2D entity; generated groups and controllers have no single native state to snapshot." };
  if (name === "morph" && (ENTITY3_KINDS.has(entity.kind) || ["caption", "mathparts", "particles", "parameter"].includes(entity.kind))) return { enabled: false, reason: "Shape morph needs a concrete 2D outline." };
  if (name === "morph" && !doc.entities.some((candidate) => candidate.id !== entity.id && !ENTITY3_KINDS.has(candidate.kind) && !["caption", "mathparts", "particles", "parameter"].includes(candidate.kind))) return { enabled: false, reason: "Shape morph needs another 2D entity as its target.", recovery: { label: "Add target shape", action: "add-entity" } };
  if (name === "pin3" && !["text", "equation", "label"].includes(entity.kind)) return { enabled: false, reason: "3D pin applies to text, equations, and attached labels." };
  if (name === "pin3" && !doc.entities.some((candidate) => candidate.kind === "camera3")) return { enabled: false, reason: "Follow a 3D point needs a 3D Camera first.", recovery: { label: "Add 3D Camera", action: "add-camera" } };
  if (name === "follow3" && (!ENTITY3_KINDS.has(entity.kind) || FOLLOW3_EXCLUDED.has(entity.kind))) return { enabled: false, reason: "3D follow needs one concrete native 3D entity; generated families are addressed through their children." };
  if (name === "follow3" && !threePointReferences(doc).some((target) => target !== entity.id)) return { enabled: false, reason: "3D follow needs another concrete 3D entity or addressable 3D child as its target.", recovery: { label: "Add 3D entity", action: "add-entity" } };
  if (name === "thick" && !["line3", "arrow3", "curve3", "link3", "cube3", "sphere3", "prism3", "pyramid3", "midpoint3", "point3", "model3", "extrude3", "revolve3", "tube3", "project3", "projectpath3", "surface3", "domainsurface", "param3", "implicit3", "heightmap3", "contour3", "slice3", "tangentplane3", "gradient3", "vectorfield3", "trajectory3", "descend3", "linmap3", "collection3", "collection3data", "child3", "links3", "links3data", "ring3", "trail3", "historyplot3", "randomwalk3", "lsystem3", "hilbert3"].includes(entity.kind)) return { enabled: false, reason: "3D thickness applies to concrete 3D paths and solids." };
  if (name === "finish3" && (!ENTITY3_KINDS.has(entity.kind) || ["camera3", "axes3", "frame3", "cross3", "assembly3", "volume3", "eigen3", "pieces3", "tree3"].includes(entity.kind))) return { enabled: false, reason: "3D finish needs one concrete native 3D entity; generated groups are styled through their addressable children." };
  if (name === "morph3" && entity.kind !== "curve3") return { enabled: false, reason: "3D morph applies to a sampled 3D curve." };
  if (name === "morph3" && !doc.entities.some((candidate) => candidate.id !== entity.id && candidate.kind === "curve3")) return { enabled: false, reason: "3D morph needs another 3D curve as its target.", recovery: { label: "Add 3D Curve", action: "add-entity" } };
  if ((name === "socials" || name === "endcard") && entity.kind !== "creator") return { enabled: false, reason: `${FEATURE_BY_NAME.get(name)?.label} needs a Creator profile.`, recovery: { label: "Add creator profile", action: "add-entity" } };
  return { enabled: true, reason: "" };
}

/** Apply the native-valid default for an optional Inspector feature. */
export function applyVocabularyFeature(entity: SceneEntity, name: FeatureName, doc: SceneDoc): boolean {
  if (!featureAvailability(name, doc, entity).enabled) return false;
  if (name === "gradient") entity.gradient = { stops: ["cyan", "magenta"], mode: FILL_KINDS.has(entity.kind) ? "linear" : "along", angle: 90 };
  else if (name === "plate") entity.plate = 0.55;
  else if (name === "cursor") entity.cursor = true;
  else if (name === "clip" || name === "mask") {
    const region = cropRegions(doc, entity)[0]?.id;
    if (!region) return false;
    if (name === "clip") entity.clip = region;
    else entity.mask = region;
  } else if (name === "glow") entity.glow = 12;
  else if (name === "sticky") entity.sticky = true;
  else if (name === "dashed") entity.dashed = { dash: null, gap: null };
  else if (name === "savestate") entity.savedState = true;
  else if (name === "morph") {
    const target = doc.entities.find((candidate) => candidate.id !== entity.id && !ENTITY3_KINDS.has(candidate.kind) && !["caption", "mathparts", "particles", "parameter"].includes(candidate.kind));
    if (!target) return false;
    entity.morph2 = { target: target.id, spin: null };
  }
  else if (name === "pin3") entity.pin3 = { at: { x: 0, y: 0, z: 0 }, target: null, offset: { x: 0, y: -24 }, worldHeight: null, form: "pin3" };
  else if (name === "thick") entity.thickness3 = 0.02;
  else if (name === "finish3") entity.finish3 = { shading: "smooth", material: "matte", texture: "solid", textureScale: 4, mesh: 0, wire: 0, depth: .2, shadow: .15, keys: ["shading", "material", "depth", "shadow"] };
  else if (name === "morph3") {
    const target = doc.entities.find((candidate) => candidate.id !== entity.id && candidate.kind === "curve3");
    if (!target) return false;
    entity.morph3 = { target: target.id, spin: null };
  }
  else if (name === "follow3") {
    const target = threePointReferences(doc).find((candidate) => candidate !== entity.id);
    if (!target) return false;
    entity.follow3 = { target, offset: { x: 0, y: 0, z: 0 } };
  }
  else if (name === "socials" && entity.kind === "creator") entity.socials = true;
  else if (name === "endcard" && entity.kind === "creator") entity.endcard = { title: null, cta: null, safe: null };
  return true;
}

export function validateVocabulary(entries: readonly VocabularyEntry[] = allVocabularyEntries()): string[] {
  const errors: string[] = [];
  const names = new Set<string>();
  for (const entry of entries) {
    if (names.has(entry.name)) errors.push(`Duplicate vocabulary name: ${entry.name}`);
    names.add(entry.name);
    if (!entry.label.trim()) errors.push(`${entry.name}: missing label`);
    if (!entry.summary.trim()) errors.push(`${entry.name}: missing summary`);
    if (entry.surfaces.length === 0) errors.push(`${entry.name}: missing surface`);
    if (entry.fidelity !== "source-only" && !entry.registryRef && entry.kind !== "scene" && entry.kind !== "helper") errors.push(`${entry.name}: authorable support has no adapter`);
  }
  return errors;
}

function cropRegions(doc: SceneDoc, entity: SceneEntity): SceneEntity[] {
  return doc.entities.filter((candidate) => candidate.id !== entity.id && !entityReferences(candidate).includes(entity.id));
}

function catalogEntry(entry: CatalogEntry): VocabularyEntry {
  return {
    name: entry.name,
    label: humanize(entry.name),
    summary: entry.summary,
    kind: entry.kind === "ctor" ? "entity" : "verb",
    kit: entry.kit,
    category: kitCategory(entry.kit),
    operations: entry.kind === "ctor" ? ["create"] : ["animate"],
    keywords: [],
    surfaces: ["language", "source"],
    fidelity: "source-only",
    order: 10_000,
    signature: signature(entry),
  };
}

function baseEntry(name: string, catalog?: CatalogEntry): Pick<VocabularyEntry, "name" | "label" | "summary" | "kit" | "signature"> {
  return {
    name,
    label: humanize(name),
    summary: catalog?.summary ?? name,
    kit: catalog?.kit ?? "editor",
    signature: catalog ? signature(catalog) : `${name}(…)`,
  };
}

function entityFidelity(def: EntityDef): Exclude<VocabularyFidelity, "source-only"> {
  if (def.fidelity) return def.fidelity;
  if (def.group === "3D" || def.kind === "watermark" || ["creator", "figure", "quiz", "timing", "countdown"].includes(def.kind)) return "semantic";
  return "exact";
}

function verbCategory(name: string): VocabularyCategory {
  if (["cam", "zoom", "followshot", "orbit3", "roll3", "look3", "view3", "present3", "followshot3"].includes(name)) return "Camera & scene";
  if (["karaoke", "wordpop", "type", "say", "rewrite"].includes(name)) return "Text & captions";
  if (["gridbfs", "gridastar", "race", "stream", "emit", "advect", "branch", "collect", "observe"].includes(name)) return "Plots & data";
  if (["solve", "react", "octet", "resonate", "drop", "discharge", "dissolve"].includes(name)) return "Math & equations";
  return "Timing & animation";
}

function verbOperations(name: string): VocabularyOperation[] {
  if (["cam", "zoom", "followshot", "orbit3", "roll3", "look3", "view3", "present3", "followshot3"].includes(name)) return ["animate", "camera"];
  if (["show", "draw", "type", "karaoke", "wordpop"].includes(name)) return ["animate", "reveal"];
  return ["animate"];
}

function kitCategory(kit: string): VocabularyCategory {
  if (kit === "three") return "3D";
  if (["math", "stats", "physics", "chem"].includes(kit)) return "Math & equations";
  if (["charts", "geo", "grid"].includes(kit)) return "Plots & data";
  if (["brand", "creator"].includes(kit)) return "Text & captions";
  if (["generative", "algo", "systems", "process", "circuit", "rubik", "ml", "optics"].includes(kit)) return "Shapes & drawing";
  return "Computation & source";
}

function signature(entry: CatalogEntry): string {
  if (entry.params.length === 0) return `${entry.name}(…)`;
  const params = entry.params.map((param) => param.optional ? `[${param.name}]` : param.name).join(", ");
  return `${entry.name}(${params})`;
}

function humanize(name: string): string {
  return name.replaceAll(/[_-]+/gu, " ").replace(/^./u, (letter) => letter.toUpperCase());
}

function uniqueWords(values: readonly string[]): string[] {
  return [...new Set(values.flatMap((value) => normalize(value).split(" ")).filter((word) => word.length > 1))];
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replaceAll(/[^a-z0-9]+/gu, " ").trim();
}

function searchScore(entry: VocabularyEntry, tokens: readonly string[]): number {
  const name = normalize(entry.name);
  const label = normalize(entry.label);
  const category = normalize(entry.category);
  const keywords = normalize(entry.keywords.join(" "));
  const summary = normalize(entry.summary);
  let total = 0;
  for (const token of tokens) {
    if (name === token) total += 120;
    else if (name.startsWith(token)) total += 80;
    else if (name.includes(token)) total += 50;
    else if (label.startsWith(token)) total += 65;
    else if (label.includes(token)) total += 42;
    else if (keywords.includes(token)) total += 30;
    else if (category.includes(token)) total += 18;
    else if (summary.includes(token)) total += 8;
    else return 0;
  }
  return total;
}

function defaultEntryOrder(a: VocabularyEntry, b: VocabularyEntry): number {
  return a.order - b.order || a.label.localeCompare(b.label);
}
