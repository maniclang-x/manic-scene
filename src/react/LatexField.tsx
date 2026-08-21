// Easy LaTeX authoring: a mono textarea with a live KaTeX preview (the engine
// is KaTeX-grade RaTeX, so the preview is honest) and a snippet palette that
// inserts the common structures at the cursor.

import { useMemo, useRef } from "react";
import katex from "katex";

interface Snippet { label: string; tex: string; }

const SNIPPETS: Snippet[] = [
  { label: "a/b", tex: "\\frac{a}{b}" },
  { label: "∫", tex: "\\int_{a}^{b} " },
  { label: "∑", tex: "\\sum_{i=1}^{n} " },
  { label: "lim", tex: "\\lim_{x \\to \\infty} " },
  { label: "√", tex: "\\sqrt{x}" },
  { label: "xⁿ", tex: "x^{n}" },
  { label: "xᵢ", tex: "x_{i}" },
  { label: "π", tex: "\\pi" },
  { label: "θ", tex: "\\theta" },
  { label: "Δ", tex: "\\Delta " },
  { label: "∞", tex: "\\infty" },
  { label: "±", tex: "\\pm" },
  { label: "≤", tex: "\\le" },
  { label: "·", tex: "\\cdot " },
  { label: "→", tex: "\\to " },
  { label: "d/dx", tex: "\\frac{d}{dx}" },
  { label: "( )", tex: "\\left( x \\right)" },
  { label: "color", tex: "\\textcolor{cyan}{x}" },
];

interface LatexFieldProps {
  value: string;
  onChange(next: string): void;
}

export function LatexField({ value, onChange }: LatexFieldProps) {
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  const preview = useMemo(() => {
    try {
      return { html: katex.renderToString(value || "\\;", { throwOnError: false, displayMode: true }), error: null };
    } catch (error) {
      return { html: "", error: (error as Error).message };
    }
  }, [value]);

  function insert(tex: string) {
    const area = areaRef.current;
    const start = area?.selectionStart ?? value.length;
    const end = area?.selectionEnd ?? start;
    const next = value.slice(0, start) + tex + value.slice(end);
    onChange(next);
    // Land the cursor inside the first placeholder brace, or after the snippet.
    const brace = tex.indexOf("{");
    const caret = start + (brace >= 0 ? brace + 1 : tex.length);
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(caret, caret + (brace >= 0 ? 1 : 0));
    });
  }

  return (
    <div className="mse-latex">
      <div className="mse-latex-snippets" aria-label="LaTeX snippets">
        {SNIPPETS.map((snippet) => (
          <button key={snippet.tex} type="button" title={snippet.tex} onClick={() => insert(snippet.tex)}>
            {snippet.label}
          </button>
        ))}
      </div>
      <textarea
        ref={areaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        rows={3}
        aria-label="LaTeX source"
      />
      <div
        className="mse-latex-preview"
        aria-label="LaTeX preview"
        dangerouslySetInnerHTML={preview.error ? undefined : { __html: preview.html }}
      >
        {preview.error ? preview.error : undefined}
      </div>
      <small>Backslashes are kept raw (backticks in source). The engine typesets the truth.</small>
    </div>
  );
}
