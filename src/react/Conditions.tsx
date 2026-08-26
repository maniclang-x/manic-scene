import { useEffect, useState } from "react";
import { CANVAS_SIZES, type CanvasFormat, type ConditionalBranchMeta, type ConditionalMeta, type SceneDoc } from "../index.js";

const FORMAT_LABELS: Record<CanvasFormat, string> = { "16:9": "Landscape", square: "Square", portrait: "Portrait" };
const RESPONSIVE_PRESETS = [
  ["h > 1.45*w", "Portrait · h > 1.45w"],
  ["w > 1.25*h", "Landscape · w > 1.25h"],
  ["h > w", "Taller than wide"],
  ["w > h", "Wider than tall"],
] as const;

interface ConditionsProps {
  doc: SceneDoc;
  conditionals: readonly ConditionalMeta[];
  onFormat(format: CanvasFormat): void;
  onChangeCondition(conditionalId: string, branchIndex: number, expression: string): void;
  onRevealSource?(offset: number): void;
}

export function Conditions({ doc, conditionals, onFormat, onChangeCondition, onRevealSource }: ConditionsProps) {
  const responsive = conditionals.filter((conditional) => conditional.branches.some((branch) => branch.condition && /\b[wh]\b/u.test(branch.condition)));
  return (
    <section className="mse-conditions" aria-label="Conditional and responsive logic">
      <div className="mse-conditions-head">
        <div>
          <span className="mse-eyebrow">CONDITIONS</span>
          <strong>{conditionals.length} branch group{conditionals.length === 1 ? "" : "s"}</strong>
          <small>Canvas shows the evaluated result. Inactive branches remain visible here and unchanged in Source.</small>
        </div>
        {responsive.length > 0 && (
          <div className="mse-condition-formats" aria-label="Test responsive canvas formats">
            <span>Real canvas format</span>
            {(Object.keys(CANVAS_SIZES) as CanvasFormat[]).map((format) => (
              <button key={format} className={doc.format === format && !doc.size ? "active" : ""} onClick={() => onFormat(format)}>
                {FORMAT_LABELS[format]}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mse-condition-groups">
        {conditionals.map((conditional, index) => (
          <details className="mse-condition-group" key={conditional.id} open={conditionals.length <= 3 || index === 0}>
            <summary>
              <span className="mse-condition-icon">⑂</span>
              <strong>{conditionalSummary(conditional)}</strong>
              <small>{conditional.evaluations === 0 ? "not reached" : `${conditional.evaluations} evaluation${conditional.evaluations === 1 ? "" : "s"}`}</small>
            </summary>
            <div className="mse-condition-branches">
              {conditional.branches.map((branch, branchIndex) => (
                <ConditionBranch
                  key={branchIndex}
                  conditional={conditional}
                  branch={branch}
                  branchIndex={branchIndex}
                  onChange={onChangeCondition}
                  onRevealSource={onRevealSource}
                />
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function ConditionBranch({ conditional, branch, branchIndex, onChange, onRevealSource }: {
  conditional: ConditionalMeta;
  branch: ConditionalBranchMeta;
  branchIndex: number;
  onChange(conditionalId: string, branchIndex: number, expression: string): void;
  onRevealSource?(offset: number): void;
}) {
  const [draft, setDraft] = useState(branch.condition ?? "");
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => setDraft(branch.condition ?? ""), [branch.condition]);
  const status = branchStatus(conditional, branch);
  const preset = RESPONSIVE_PRESETS.find(([value]) => value === branch.condition)?.[0] ?? "custom";
  const affected = branch.entityIds.length + branch.stepIndexes.length;
  return (
    <article className={`mse-condition-branch ${status}`}>
      <div className="mse-condition-branch-main">
        <span className="mse-condition-status">{statusIcon(status)}</span>
        <div>
          <strong>{branch.kind === "else-if" ? "ELSE IF" : branch.kind.toUpperCase()}</strong>
          {branch.condition ? <code>{branch.condition}</code> : <span>fallback branch</span>}
          <small>{branchResult(conditional, branch)} · {branch.statementCount} authored statement{branch.statementCount === 1 ? "" : "s"}{affected ? ` · affects ${branch.entityIds.length} entities and ${branch.stepIndexes.length} Story cards` : ""}</small>
        </div>
        <div className="mse-condition-actions">
          {branch.condition && /\b[wh]\b/u.test(branch.condition) && (
            <select aria-label="Responsive condition preset" value={preset} onChange={(event) => {
              if (event.target.value === "custom") { setAdvanced(true); return; }
              onChange(conditional.id, branchIndex, event.target.value);
            }}>
              {RESPONSIVE_PRESETS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              <option value="custom">Custom expression…</option>
            </select>
          )}
          {branch.condition && <button type="button" onClick={() => setAdvanced((open) => !open)}>{advanced ? "Close" : "Advanced"}</button>}
          {onRevealSource && <button type="button" onClick={() => onRevealSource(branch.conditionSpan?.start ?? conditional.span.start)}>Source</button>}
        </div>
      </div>
      {advanced && branch.condition && (
        <form className="mse-condition-expression" onSubmit={(event) => { event.preventDefault(); onChange(conditional.id, branchIndex, draft); }}>
          <label><span>Condition expression</span><input value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} /></label>
          <button type="submit" disabled={!draft.trim() || draft.trim() === branch.condition}>Apply</button>
          <small>Advanced expressions use native Manic syntax. Applying changes only this expression.</small>
        </form>
      )}
    </article>
  );
}

function branchStatus(conditional: ConditionalMeta, branch: ConditionalBranchMeta): "active" | "mixed" | "inactive" | "unresolved" | "unreached" {
  if (conditional.evaluations === 0) return "unreached";
  if (branch.selected === conditional.evaluations && conditional.unresolved === 0) return "active";
  if (branch.selected > 0) return "mixed";
  if (conditional.unresolved > 0) return "unresolved";
  return "inactive";
}

function statusIcon(status: ReturnType<typeof branchStatus>): string {
  return status === "active" ? "✓" : status === "mixed" ? "◐" : status === "unresolved" ? "?" : status === "unreached" ? "·" : "○";
}

function branchResult(conditional: ConditionalMeta, branch: ConditionalBranchMeta): string {
  if (conditional.evaluations === 0) return "Not reached in the active program path";
  if (conditional.evaluations === 1) return branch.selected === 1 ? "Active on Canvas" : conditional.unresolved ? "Could not evaluate" : "Inactive, preserved";
  return `${branch.selected} of ${conditional.evaluations} generated evaluations selected this branch${conditional.unresolved ? ` · ${conditional.unresolved} unresolved` : ""}`;
}

function conditionalSummary(conditional: ConditionalMeta): string {
  const selected = conditional.branches.filter((branch) => branch.selected > 0);
  if (conditional.evaluations === 0) return "Conditional inside an inactive branch";
  if (conditional.unresolved === conditional.evaluations) return "Conditional could not be evaluated";
  if (conditional.evaluations === 1 && selected.length === 1) return `${selected[0].condition ?? "else"} is active`;
  return `${selected.length} branch${selected.length === 1 ? "" : "es"} selected across generated instances`;
}
