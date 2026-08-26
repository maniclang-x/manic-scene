import { argName, argNumber, argPoint, argPoint3, argString, escapeString, num, pt, pt3 } from "../args.js";
import { preferReference, registerEntity, type Box, type FieldSpec, type StoryTargetSpec } from "../registry.js";
import type { CallStatement } from "../script.js";
import type {
  BalanceChemEntity, CellChemEntity, ChemEntity, EmissionChemEntity, IRSpectrumChemEntity,
  LatticeChemEntity, LevelsChemEntity, LewisChemEntity, Molecule3ChemEntity, NewmanChemEntity,
  ProfileChemEntity, SceneDoc, VibrationChemEntity, VirtualChildStyle,
} from "../types.js";
import { baseEntity } from "./base.js";
import { projectPoint3 } from "./three.js";

const childStyles = () => ({} as Record<string, VirtualChildStyle>);
const base = <K extends ChemEntity["kind"]>(id: string, kind: K) => ({ ...baseEntity(id, "cyan"), nativePaint: true, kind, childStyles: childStyles() });
const pointFields: FieldSpec[] = [{ key: "x", label: "Center X", input: "number" }, { key: "y", label: "Center Y", input: "number" }];
const numberField = (key: string, label: string, min?: number, step = 1): FieldSpec => ({ key, label, input: "number", min, step });
const sourceField = (key: string, label: string, hint: string, nullable = false): FieldSpec => ({ key, label, input: "text", hint, nullable });
const refField = (key: string, label: string, kinds: ChemEntity["kind"][]): FieldSpec => ({ key, label, input: "entity", entityKinds: kinds, referencesEarlierOnly: true });

function styleFor(entity: ChemEntity, ref: string): VirtualChildStyle {
  return entity.childStyles[ref] ?? (entity.childStyles[ref] = {});
}
function applyChild(entity: ChemEntity, ref: string, stmt: CallStatement): boolean {
  const style = styleFor(entity, ref);
  if (stmt.name === "color") { const value = argName(stmt.args, 1); if (!value) return false; style.color = value; return true; }
  if (stmt.name === "opacity") { const value = argNumber(stmt.args, 1); if (value === null) return false; style.opacity = value; return true; }
  if (stmt.name === "hidden") { style.reveal = argName(stmt.args, 1) === "center" ? "grow" : "fade"; return true; }
  if (stmt.name === "untraced") { style.untraced = true; return true; }
  return false;
}
function childLines(entity: ChemEntity): string[] {
  return Object.entries(entity.childStyles).flatMap(([ref, style]) => [
    ...(style.color ? [`color(${ref}, ${style.color});`] : []),
    ...(style.opacity !== undefined ? [`opacity(${ref}, ${num(style.opacity)});`] : []),
    ...(style.reveal ? [`hidden(${ref}${style.reveal === "grow" ? ", center" : ""});`] : []),
    ...(style.untraced ? [`untraced(${ref});`] : []),
  ]);
}
function replaceChildReference(entity: ChemEntity, from: string, to: string): void {
  if (!entity.childStyles[from]) return;
  entity.childStyles[to] = entity.childStyles[from];
  delete entity.childStyles[from];
}
function targets(entity: ChemEntity): StoryTargetSpec[] {
  return chemReferences(entity).map((id) => ({ id, label: id, kind: id.includes(".a") || id.includes(".i") || id.includes(".electron") || id.includes(".marker") ? "circle" : id.includes(".b") || id.includes(".curve") || id.includes(".axis") || id.includes(".rungs") || id.includes(".lines") ? "line" : "text" }));
}

export function formulaAtoms(formula: string): string[] {
  // A bare terminal sign is the charge (`NH4+` keeps its H4 subscript).
  // Magnitude charges require an explicit caret or separating whitespace.
  const clean = formula.replace(/(?:\^\d*[+-]|\s+\d*[+-]|[+-])$/u, "");
  const out: string[] = [];
  for (const match of clean.matchAll(/([A-Z][a-z]?)(\d*)/gu)) {
    const count = Math.max(1, Math.min(24, Number(match[2] || 1)));
    for (let index = 0; index < count; index += 1) out.push(match[1]);
  }
  return out.length ? out : ["?"];
}
export function balanceSides(equation: string): { left: string[]; right: string[] } {
  const [left = "", right = ""] = equation.split(/->|→|=/u, 2);
  return { left: left.split("+").map((value) => value.trim()).filter(Boolean), right: right.split("+").map((value) => value.trim()).filter(Boolean) };
}
export function chemChildStyle(entity: ChemEntity, ref: string): VirtualChildStyle { return entity.childStyles[ref] ?? {}; }
export function chemReferences(entity: ChemEntity): string[] {
  const root = entity.id;
  if (entity.kind === "balance") {
    const sides = balanceSides(entity.equation), limit = entity.limiting ? [`${root}.limit`, `${root}.limit.mark`, `${root}.limit.spare`, `${root}.limit.in`, `${root}.limit.out`, ...sides.left.flatMap((_v, index) => [`${root}.limit.b${index}`, `${root}.limit.n${index}`]), ...sides.right.map((_v, index) => `${root}.limit.y${index}`)] : [];
    return [root, `${root}.parts`, ...limit];
  }
  if (entity.kind === "lewis") {
    const atoms = formulaAtoms(entity.formula);
    return [`${root}.parts`, `${root}.atoms`, `${root}.bonds`, `${root}.pairs`, `${root}.charges`, `${root}.formula`, `${root}.count`, ...atoms.map((_v, index) => `${root}.a${index}`)];
  }
  if (entity.kind === "levels") return [`${root}.parts`, `${root}.rungs`, `${root}.electron`, `${root}.photon`, `${root}.readout`, ...Array.from({ length: entity.nmax }, (_v, index) => `${root}.n${index + 1}`)];
  if (entity.kind === "emission") return [`${root}.parts`, `${root}.strip`, `${root}.lines`, `${root}.labels`, `${root}.axis`];
  if (entity.kind === "cell") return [`${root}.parts`, `${root}.anode`, `${root}.cathode`, `${root}.bridge`, `${root}.wire`, `${root}.meter`, `${root}.volts`, `${root}.electrons`, `${root}.ions`, `${root}.captions`, `${root}.readout`, `${root}.charge`, `${root}.mass`];
  if (entity.kind === "lattice") return [`${root}.parts`, `${root}.ions`, `${root}.labels`, `${root}.water`, `${root}.captions`, `${root}.energy`, `${root}.readout`, ...Array.from({ length: entity.cols * entity.rows }, (_v, index) => `${root}.i${index}`)];
  if (entity.kind === "newman") return [`${root}.parts`, `${root}.circle`, `${root}.front`, `${root}.back`, `${root}.readout`, ...Array.from({ length: 3 }, (_v, index) => [`${root}.f${index}`, `${root}.b${index}`]).flat()];
  if (entity.kind === "profile") return [`${root}.parts`, `${root}.axis`, `${root}.curve`, `${root}.marker`, `${root}.ylab`];
  if (entity.kind === "vibration") return [`${root}.parts`, `${root}.atoms`, `${root}.labels`, `${root}.readout`];
  if (entity.kind === "irspectrum") return [`${root}.parts`, `${root}.axis`, `${root}.curve`, `${root}.peaks`, `${root}.silent`];
  return [`${root}.atoms`, `${root}.bonds`, `${root}.multibonds`];
}

function common<E extends ChemEntity>(definition: {
  kind: E["kind"]; ctor: string; label: string; icon: string; order: number; movable?: boolean;
  create(id: string, x: number, y: number, doc?: SceneDoc, selectedId?: string): E;
  parse(stmt: CallStatement): E | null; line(entity: E): string; fields: FieldSpec[];
  bounds(entity: E): Box; references?: (entity: E) => string[]; replaceReference?: (entity: E, from: string, to: string) => void;
  canCreate?: (doc: SceneDoc) => boolean; blocked?: string; extra?: (entity: E) => string[]; modifiers?: Record<string, (entity: E, stmt: CallStatement) => boolean>;
}) {
  registerEntity<E>({
    kind: definition.kind, ctor: definition.ctor, group: "Chemistry", label: definition.label, icon: definition.icon, order: definition.order, fidelity: "semantic", hint: "Editable chemistry structure; Canvas shows the authored scientific contract while Preview owns exact computation and motion", movable: definition.movable ?? true,
    create: definition.create, parseArgs: definition.parse, ctorLine: definition.line, extraLines: (entity) => [...(definition.extra?.(entity) ?? []), ...childLines(entity)], modifiers: definition.modifiers ?? {},
    canCreate: definition.canCreate, createBlockedReason: definition.blocked, references: definition.references, replaceReference(entity, from, to) { definition.replaceReference?.(entity, from, to); replaceChildReference(entity, from, to); },
    referenceIds: chemReferences, storyTargets: targets, applyReferenceModifier: applyChild,
    anchor(entity) { const box = definition.bounds(entity); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, translate(entity, dx, dy) { if ("x" in entity) { entity.x += dx; entity.y += dy; if (entity.kind === "balance") { entity.limitX += dx; entity.limitY += dy; } } }, bounds: definition.bounds, handles: () => [], dragHandle() {}, fields: definition.fields,
  });
}

common<BalanceChemEntity>({
  kind: "balance", ctor: "balance", label: "Balanced equation", icon: "⚗=", order: 111,
  create: (id, x, y) => ({ ...base(id, "balance"), x, y, equation: "Fe + O2 -> Fe2O3", size: 46, supplied: null, limiting: false, limitX: x, limitY: y + 180, limitWidth: 520, limitRow: 46, limitSize: 20 }),
  parse(stmt) { const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1), equation = argString(stmt.args, 2), size = argNumber(stmt.args, 3); return id && at && equation !== null && stmt.args.length >= 3 && stmt.args.length <= 4 && (stmt.args.length === 3 || size !== null) ? { ...base(id, "balance"), x: at.x, y: at.y, equation, size: Math.max(8, Math.min(200, size ?? 46)), supplied: null, limiting: false, limitX: at.x, limitY: at.y + 180, limitWidth: 520, limitRow: 46, limitSize: 20 } : null; },
  line: (entity) => `balance(${entity.id}, ${pt(entity.x, entity.y)}, "${escapeString(entity.equation)}", ${num(entity.size)});`,
  extra: (entity) => [...(entity.supplied ? [`supply(${entity.id}, "${escapeString(entity.supplied)}");`] : []), ...(entity.limiting ? [`limiting(${entity.id}, ${pt(entity.limitX, entity.limitY)}, ${num(entity.limitWidth)}, ${num(entity.limitRow)}, ${num(entity.limitSize)});`] : [])],
  modifiers: {
    supply(entity, stmt) { const value = argString(stmt.args, 1); if (value === null || stmt.args.length !== 2) return false; entity.supplied = value; return true; },
    limiting(entity, stmt) { const at = argPoint(stmt.args, 1), width = argNumber(stmt.args, 2), row = argNumber(stmt.args, 3), size = argNumber(stmt.args, 4); if (!at || stmt.args.length < 2 || stmt.args.length > 5 || (stmt.args.length > 2 && width === null) || (stmt.args.length > 3 && row === null) || (stmt.args.length > 4 && size === null)) return false; entity.limiting = true; entity.limitX = at.x; entity.limitY = at.y; entity.limitWidth = Math.max(180, width ?? 520); entity.limitRow = Math.max(20, row ?? 46); entity.limitSize = Math.max(8, Math.min(60, size ?? 20)); return true; },
  },
  bounds(entity) { const width = Math.max(300, entity.equation.length * entity.size * .37), equation = { x: entity.x - width / 2, y: entity.y - entity.size, width, height: entity.size * 2 }; if (!entity.limiting) return equation; const limit = { x: entity.limitX - entity.limitWidth / 2, y: entity.limitY - entity.limitRow * 2, width: entity.limitWidth, height: entity.limitRow * 4 }; const x = Math.min(equation.x, limit.x), y = Math.min(equation.y, limit.y); return { x, y, width: Math.max(equation.x + equation.width, limit.x + limit.width) - x, height: Math.max(equation.y + equation.height, limit.y + limit.height) - y }; },
  fields: [...pointFields, sourceField("equation", "Chemical equation", "Use A + B -> C + D."), numberField("size", "Equation size", 8), sourceField("supplied", "Supplied reactants", "Optional formula=10g or formula=0.18mol list; every reactant is required.", true), { key: "limiting", label: "Show limiting-reagent view", input: "checkbox" }, { key: "limitX", label: "Limit view X", input: "number", visibleWhen: { key: "limiting", equals: true } }, { key: "limitY", label: "Limit view Y", input: "number", visibleWhen: { key: "limiting", equals: true } }, { key: "limitWidth", label: "Limit view width", input: "number", min: 180, visibleWhen: { key: "limiting", equals: true } }, { key: "limitRow", label: "Limit row gap", input: "number", min: 20, visibleWhen: { key: "limiting", equals: true } }, { key: "limitSize", label: "Limit text size", input: "number", min: 8, max: 60, visibleWhen: { key: "limiting", equals: true } }],
});

common<LewisChemEntity>({
  kind: "lewis", ctor: "lewis", label: "Lewis structure", icon: "••", order: 112,
  create: (id, x, y) => ({ ...base(id, "lewis"), formula: "NO3-", x, y, unit: 120, size: 30 }),
  parse(stmt) { const id = argName(stmt.args, 0), formula = argString(stmt.args, 1), at = argPoint(stmt.args, 2), unit = argNumber(stmt.args, 3), size = argNumber(stmt.args, 4); return id && formula !== null && at && stmt.args.length >= 3 && stmt.args.length <= 5 && (stmt.args.length < 4 || unit !== null) && (stmt.args.length < 5 || size !== null) ? { ...base(id, "lewis"), formula, x: at.x, y: at.y, unit: Math.max(40, Math.min(400, unit ?? 120)), size: Math.max(10, Math.min(90, size ?? 30)) } : null; },
  line: (entity) => `lewis(${entity.id}, "${escapeString(entity.formula)}", ${pt(entity.x, entity.y)}, ${num(entity.unit)}, ${num(entity.size)});`,
  bounds: (entity) => ({ x: entity.x - entity.unit * 1.25, y: entity.y - entity.unit * 1.2, width: entity.unit * 2.5, height: entity.unit * 2.4 }),
  fields: [sourceField("formula", "Molecular formula", "Main-group formula with optional ionic charge."), ...pointFields, numberField("unit", "Bond spacing", 40), numberField("size", "Atom label size", 10)],
});

common<LevelsChemEntity>({
  kind: "levels", ctor: "levels", label: "Atomic energy levels", icon: "Eₙ", order: 113,
  create: (id, x, y) => ({ ...base(id, "levels"), x, y, width: 360, height: 340, nmax: 6, atomicNumber: 1 }),
  parse(stmt) { const id = argName(stmt.args, 0), at = argPoint(stmt.args, 1), width = argNumber(stmt.args, 2), height = argNumber(stmt.args, 3), nmax = argNumber(stmt.args, 4), z = argNumber(stmt.args, 5); return id && at && stmt.args.length >= 2 && stmt.args.length <= 6 && (stmt.args.length < 3 || width !== null) && (stmt.args.length < 4 || height !== null) && (stmt.args.length < 5 || nmax !== null) && (stmt.args.length < 6 || z !== null) ? { ...base(id, "levels"), x: at.x, y: at.y, width: Math.max(120, width ?? 360), height: Math.max(120, height ?? 340), nmax: Math.max(2, Math.min(12, Math.trunc(nmax ?? 6))), atomicNumber: Math.max(1, Math.min(20, Math.trunc(z ?? 1))) } : null; },
  line: (entity) => `levels(${entity.id}, ${pt(entity.x, entity.y)}, ${num(entity.width)}, ${num(entity.height)}, ${num(entity.nmax)}, ${num(entity.atomicNumber)});`,
  bounds: (entity) => ({ x: entity.x - entity.width / 2, y: entity.y - entity.height / 2, width: entity.width + 170, height: entity.height + 70 }),
  fields: [...pointFields, numberField("width", "Diagram width", 120), numberField("height", "Diagram height", 120), numberField("nmax", "Highest level", 2), numberField("atomicNumber", "Nuclear charge Z", 1)],
});

common<EmissionChemEntity>({
  kind: "emission", ctor: "emission", label: "Emission spectrum", icon: "▥λ", order: 114,
  canCreate: (doc) => doc.entities.some((entity) => entity.kind === "levels"), blocked: "Emission spectrum needs an earlier energy-level diagram.",
  create(id, x, y, doc, selectedId) { const levels = preferReference(doc, selectedId, (entity) => entity.kind === "levels"); return { ...base(id, "emission"), levels: levels?.id ?? "levels", x, y, width: 620, height: 96, fromNm: 380 }; },
  parse(stmt) { const id = argName(stmt.args, 0), levels = argName(stmt.args, 1), at = argPoint(stmt.args, 2), width = argNumber(stmt.args, 3), height = argNumber(stmt.args, 4), from = argNumber(stmt.args, 5); return id && levels && at && stmt.args.length >= 3 && stmt.args.length <= 6 && (stmt.args.length < 4 || width !== null) && (stmt.args.length < 5 || height !== null) && (stmt.args.length < 6 || from !== null) ? { ...base(id, "emission"), levels, x: at.x, y: at.y, width: Math.max(200, width ?? 620), height: Math.max(40, height ?? 96), fromNm: Math.max(1, from ?? 380) } : null; },
  line: (entity) => `emission(${entity.id}, ${entity.levels}, ${pt(entity.x, entity.y)}, ${num(entity.width)}, ${num(entity.height)}, ${num(entity.fromNm)});`,
  references: (entity) => [entity.levels], replaceReference(entity, from, to) { if (entity.levels === from) entity.levels = to; },
  bounds: (entity) => ({ x: entity.x - entity.width / 2, y: entity.y - entity.height / 2, width: entity.width, height: entity.height + 48 }),
  fields: [refField("levels", "Energy levels", ["levels"]), ...pointFields, numberField("width", "Spectrum width", 200), numberField("height", "Spectrum height", 40), numberField("fromNm", "Lowest wavelength (nm)", 1)],
});

common<CellChemEntity>({
  kind: "cell", ctor: "cell", label: "Galvanic cell", icon: "−|+", order: 115,
  create: (id, x, y) => ({ ...base(id, "cell"), metals: "Zn|Cu", x, y, width: 620, height: 300, spec: "resistance=10 carriers=8" }),
  parse(stmt) { const id = argName(stmt.args, 0), metals = argString(stmt.args, 1), at = argPoint(stmt.args, 2), width = argNumber(stmt.args, 3), height = argNumber(stmt.args, 4), spec = argString(stmt.args, 5); return id && metals !== null && at && stmt.args.length >= 3 && stmt.args.length <= 6 && (stmt.args.length < 4 || width !== null) && (stmt.args.length < 5 || height !== null) && (stmt.args.length < 6 || spec !== null) ? { ...base(id, "cell"), metals, x: at.x, y: at.y, width: Math.max(240, width ?? 620), height: Math.max(140, height ?? 300), spec: spec ?? "" } : null; },
  line: (entity) => `cell(${entity.id}, "${escapeString(entity.metals)}", ${pt(entity.x, entity.y)}, ${num(entity.width)}, ${num(entity.height)}${entity.spec ? `, "${escapeString(entity.spec)}"` : ""});`,
  bounds: (entity) => ({ x: entity.x - entity.width / 2, y: entity.y - entity.height / 2, width: entity.width, height: entity.height + 145 }),
  fields: [sourceField("metals", "Metal pair", "Two supported metals separated by |, e.g. Zn|Cu."), ...pointFields, numberField("width", "Bench width", 240), numberField("height", "Bench height", 140), sourceField("spec", "Cell settings", "resistance=<ohms> carriers=<2…40>")],
});

common<LatticeChemEntity>({
  kind: "lattice", ctor: "lattice", label: "Ionic lattice", icon: "⊕⊖", order: 116,
  create: (id, x, y) => ({ ...base(id, "lattice"), formula: "NaCl", x, y, cols: 6, rows: 5, unit: 54 }),
  parse(stmt) { const id = argName(stmt.args, 0), formula = argString(stmt.args, 1), at = argPoint(stmt.args, 2), cols = argNumber(stmt.args, 3), rows = argNumber(stmt.args, 4), unit = argNumber(stmt.args, 5); return id && formula !== null && at && stmt.args.length >= 3 && stmt.args.length <= 6 && (stmt.args.length < 4 || cols !== null) && (stmt.args.length < 5 || rows !== null) && (stmt.args.length < 6 || unit !== null) ? { ...base(id, "lattice"), formula, x: at.x, y: at.y, cols: Math.max(2, Math.min(14, Math.trunc(cols ?? 6))), rows: Math.max(2, Math.min(14, Math.trunc(rows ?? 5))), unit: Math.max(16, Math.min(160, unit ?? 54)) } : null; },
  line: (entity) => `lattice(${entity.id}, "${escapeString(entity.formula)}", ${pt(entity.x, entity.y)}, ${num(entity.cols)}, ${num(entity.rows)}, ${num(entity.unit)});`,
  bounds: (entity) => ({ x: entity.x - entity.cols * entity.unit / 2, y: entity.y - entity.rows * entity.unit / 2, width: entity.cols * entity.unit, height: entity.rows * entity.unit + 74 }),
  fields: [sourceField("formula", "Ionic formula", "A supported 1:1 salt such as NaCl, KBr, or MgO."), ...pointFields, numberField("cols", "Columns", 2), numberField("rows", "Rows", 2), numberField("unit", "Ion spacing", 16)],
});

common<NewmanChemEntity>({
  kind: "newman", ctor: "newman", label: "Newman projection", icon: "⊙", order: 117,
  create: (id, x, y) => ({ ...base(id, "newman"), source: "asset:molecules/butane.sdf", x, y, unit: 120, labelSize: 18 }),
  parse(stmt) { const id = argName(stmt.args, 0), source = argString(stmt.args, 1), at = argPoint(stmt.args, 2), unit = argNumber(stmt.args, 3), size = argNumber(stmt.args, 4); return id && source !== null && at && stmt.args.length >= 3 && stmt.args.length <= 5 && (stmt.args.length < 4 || unit !== null) && (stmt.args.length < 5 || size !== null) ? { ...base(id, "newman"), source, x: at.x, y: at.y, unit: Math.max(40, Math.min(400, unit ?? 120)), labelSize: Math.max(0, Math.min(60, size ?? 18)) } : null; },
  line: (entity) => `newman(${entity.id}, "${escapeString(entity.source)}", ${pt(entity.x, entity.y)}, ${num(entity.unit)}, ${num(entity.labelSize)});`,
  bounds: (entity) => ({ x: entity.x - entity.unit, y: entity.y - entity.unit, width: entity.unit * 2, height: entity.unit * 2.1 }),
  fields: [sourceField("source", "3D molecule asset", "SDF/MOL with a rotatable central single bond."), ...pointFields, numberField("unit", "Projection size", 40), numberField("labelSize", "Group label size", 0)],
});

common<ProfileChemEntity>({
  kind: "profile", ctor: "profile", label: "Torsion profile", icon: "⌁°", order: 118,
  canCreate: (doc) => doc.entities.some((entity) => entity.kind === "newman"), blocked: "Torsion profile needs an earlier Newman projection.",
  create(id, x, y, doc, selectedId) { const torsion = preferReference(doc, selectedId, (entity) => entity.kind === "newman"); return { ...base(id, "profile"), torsion: torsion?.id ?? "torsion", x, y, width: 520, height: 200 }; },
  parse(stmt) { const id = argName(stmt.args, 0), torsion = argName(stmt.args, 1), at = argPoint(stmt.args, 2), width = argNumber(stmt.args, 3), height = argNumber(stmt.args, 4); return id && torsion && at && stmt.args.length >= 3 && stmt.args.length <= 5 && (stmt.args.length < 4 || width !== null) && (stmt.args.length < 5 || height !== null) ? { ...base(id, "profile"), torsion, x: at.x, y: at.y, width: Math.max(180, width ?? 520), height: Math.max(80, height ?? 200) } : null; },
  line: (entity) => `profile(${entity.id}, ${entity.torsion}, ${pt(entity.x, entity.y)}, ${num(entity.width)}, ${num(entity.height)});`,
  references: (entity) => [entity.torsion], replaceReference(entity, from, to) { if (entity.torsion === from) entity.torsion = to; },
  bounds: (entity) => ({ x: entity.x - entity.width / 2, y: entity.y - entity.height / 2 - 22, width: entity.width, height: entity.height + 48 }),
  fields: [refField("torsion", "Newman projection", ["newman"]), ...pointFields, numberField("width", "Plot width", 180), numberField("height", "Plot height", 80)],
});

common<VibrationChemEntity>({
  kind: "vibration", ctor: "vibration", label: "Molecular vibration", icon: "↔ν", order: 119,
  create: (id, x, y) => ({ ...base(id, "vibration"), source: "asset:molecules/water.sdf", x, y, unit: 120, labelSize: 20 }),
  parse(stmt) { const id = argName(stmt.args, 0), source = argString(stmt.args, 1), at = argPoint(stmt.args, 2), unit = argNumber(stmt.args, 3), size = argNumber(stmt.args, 4); return id && source !== null && at && stmt.args.length >= 3 && stmt.args.length <= 5 && (stmt.args.length < 4 || unit !== null) && (stmt.args.length < 5 || size !== null) ? { ...base(id, "vibration"), source, x: at.x, y: at.y, unit: Math.max(20, Math.min(600, unit ?? 120)), labelSize: Math.max(0, Math.min(80, size ?? 20)) } : null; },
  line: (entity) => `vibration(${entity.id}, "${escapeString(entity.source)}", ${pt(entity.x, entity.y)}, ${num(entity.unit)}, ${num(entity.labelSize)});`,
  bounds: (entity) => ({ x: entity.x - entity.unit * 1.2, y: entity.y - entity.unit, width: entity.unit * 2.4, height: entity.unit * 2 }),
  fields: [sourceField("source", "3D molecule asset", "SDF/MOL geometry; flat -2d depictions are invalid."), ...pointFields, numberField("unit", "Molecule scale", 20), numberField("labelSize", "Atom label size", 0)],
});

common<IRSpectrumChemEntity>({
  kind: "irspectrum", ctor: "irspectrum", label: "Infrared spectrum", icon: "IR", order: 120,
  canCreate: (doc) => doc.entities.some((entity) => entity.kind === "vibration"), blocked: "Infrared spectrum needs an earlier molecular vibration analysis.",
  create(id, x, y, doc, selectedId) { const molecule = preferReference(doc, selectedId, (entity) => entity.kind === "vibration"); return { ...base(id, "irspectrum"), molecule: molecule?.id ?? "molecule", x, y, width: 560, height: 170, labelSize: 15 }; },
  parse(stmt) { const id = argName(stmt.args, 0), molecule = argName(stmt.args, 1), at = argPoint(stmt.args, 2), width = argNumber(stmt.args, 3), height = argNumber(stmt.args, 4), size = argNumber(stmt.args, 5); return id && molecule && at && stmt.args.length >= 3 && stmt.args.length <= 6 && (stmt.args.length < 4 || width !== null) && (stmt.args.length < 5 || height !== null) && (stmt.args.length < 6 || size !== null) ? { ...base(id, "irspectrum"), molecule, x: at.x, y: at.y, width: Math.max(160, width ?? 560), height: Math.max(60, height ?? 170), labelSize: Math.max(6, Math.min(40, size ?? 15)) } : null; },
  line: (entity) => `irspectrum(${entity.id}, ${entity.molecule}, ${pt(entity.x, entity.y)}, ${num(entity.width)}, ${num(entity.height)}, ${num(entity.labelSize)});`,
  references: (entity) => [entity.molecule], replaceReference(entity, from, to) { if (entity.molecule === from) entity.molecule = to; },
  bounds: (entity) => ({ x: entity.x - entity.width / 2, y: entity.y - entity.height / 2, width: entity.width, height: entity.height + 38 }),
  fields: [refField("molecule", "Vibration analysis", ["vibration"]), ...pointFields, numberField("width", "Spectrum width", 160), numberField("height", "Spectrum height", 60), numberField("labelSize", "Label size", 6)],
});

common<Molecule3ChemEntity>({
  kind: "molecule3", ctor: "molecule3", label: "3D molecule", icon: "⚛3", order: 121, movable: false,
  create: (id) => ({ ...base(id, "molecule3"), source: "asset:molecules/water.sdf", center: { x: 0, y: 0, z: 0 }, scaleFactor: 1.5, spec: "" }),
  parse(stmt) { const id = argName(stmt.args, 0), source = argString(stmt.args, 1), center = argPoint3(stmt.args, 2), scale = argNumber(stmt.args, 3), spec = argString(stmt.args, 4); return id && source !== null && stmt.args.length >= 2 && stmt.args.length <= 5 && (stmt.args.length < 3 || center) && (stmt.args.length < 4 || scale !== null) && (stmt.args.length < 5 || spec !== null) ? { ...base(id, "molecule3"), source, center: center ?? { x: 0, y: 0, z: 0 }, scaleFactor: Math.max(.01, scale ?? 1.5), spec: spec ?? "" } : null; },
  line: (entity) => `molecule3(${entity.id}, "${escapeString(entity.source)}", ${pt3(entity.center.x, entity.center.y, entity.center.z)}, ${num(entity.scaleFactor)}${entity.spec ? `, "${escapeString(entity.spec)}"` : ""});`,
  bounds(entity) { const center = projectPoint3(entity.center), radius = Math.max(42, entity.scaleFactor * 55); return { x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2 }; },
  fields: [sourceField("source", "Molecule asset", "SDF/MOL asset URI or path."), { key: "center", label: "World center", input: "point3" }, numberField("scaleFactor", "World units per Å", .01, .1), sourceField("spec", "Molecule options", "style=ball|spacefill|wireframe hydrogens=0|1 spin=… axis=x|y|z")],
});
