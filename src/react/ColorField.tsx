// One color control for everything: template-aware palette swatches (named
// colors stay template-aware in the engine) plus an exact hex — via the native
// picker or typed (#rgb, #rgba, #rrggbb, #rrggbbaa — everything the engine's
// `color(id, #…)` accepts).

import { useState } from "react";
import { COLOR_OPTIONS, resolveColor, type ManicTemplate } from "../index.js";

const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;

interface ColorFieldProps {
  /** Palette name or hex literal; null = engine default (only when nullable). */
  value: string | null;
  template: ManicTemplate;
  nullable?: boolean;
  onChange(next: string | null): void;
}

export function ColorField({ value, template, nullable, onChange }: ColorFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const isHex = value?.startsWith("#") ?? false;

  return (
    <div className="mse-colorfield">
      <div className="mse-swatches">
        {nullable && (
          <button
            type="button"
            className={`mse-swatch mse-swatch-default${value === null ? " active" : ""}`}
            title="Engine default"
            onClick={() => onChange(null)}
          >
            —
          </button>
        )}
        {COLOR_OPTIONS.map((name) => (
          <button
            type="button"
            key={name}
            className={`mse-swatch${value === name ? " active" : ""}`}
            style={{ background: resolveColor(template, name) }}
            title={`${name} — template-aware`}
            onClick={() => onChange(name)}
          />
        ))}
      </div>
      <div className="mse-hexrow">
        <input
          type="color"
          value={pickerHex(value, template)}
          onChange={(event) => { setDraft(null); onChange(event.target.value); }}
          title="Pick an exact hex color"
          aria-label="Exact hex color"
        />
        <input
          className="mse-hextext"
          value={draft ?? (isHex ? value ?? "" : "")}
          placeholder="#rrggbb"
          spellCheck={false}
          onChange={(event) => {
            const next = event.target.value.trim();
            setDraft(next);
            if (HEX_PATTERN.test(next)) {
              onChange(next.toLowerCase());
              setDraft(null);
            }
          }}
          onBlur={() => setDraft(null)}
          aria-label="Hex color literal"
        />
        <span className="mse-color-current">{value ?? "default"}</span>
      </div>
    </div>
  );
}

/** The native picker needs exactly #rrggbb. */
function pickerHex(value: string | null, template: ManicTemplate): string {
  const resolved = value?.startsWith("#") ? value : resolveColor(template, value ?? "fg");
  const hex = resolved.slice(1);
  if (hex.length === 6) return `#${hex.toLowerCase()}`;
  if (hex.length === 8) return `#${hex.slice(0, 6).toLowerCase()}`;
  if (hex.length === 3 || hex.length === 4) {
    return `#${hex.slice(0, 3).split("").map((char) => char + char).join("").toLowerCase()}`;
  }
  return "#eff5ff";
}
