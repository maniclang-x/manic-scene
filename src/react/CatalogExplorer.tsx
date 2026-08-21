// The whole manic language, straight from the engine's builtin catalog
// (generated snapshot — see scripts/sync-catalog.mjs). Shows what exists,
// which builtins are canvas-ready, and what each one's signature is.

import { useMemo, useState } from "react";
import { CATALOG, CATALOG_KITS, type CatalogEntry } from "../index.js";

interface CatalogExplorerProps {
  /** Builtin names the canvas can author today. */
  implemented: ReadonlySet<string>;
  onClose(): void;
}

const KIND_LABELS: Record<CatalogEntry["kind"], string> = { ctor: "ctor", verb: "verb", mutverb: "verb·mut" };
const PAGE = 60;

export function CatalogExplorer({ implemented, onClose }: CatalogExplorerProps) {
  const [query, setQuery] = useState("");
  const [kit, setKit] = useState<string>("all");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return CATALOG.builtins.filter((entry) => {
      if (kit !== "all" && entry.kit !== kit) return false;
      if (!needle) return true;
      return entry.name.includes(needle) || entry.summary.toLowerCase().includes(needle);
    });
  }, [query, kit]);

  const readyCount = useMemo(
    () => CATALOG.builtins.filter((entry) => implemented.has(entry.name)).length,
    [implemented],
  );

  return (
    <div className="mse-catalog" aria-label="Manic language catalog">
      <div className="mse-catalog-head">
        <div>
          <span className="mse-eyebrow">THE LANGUAGE · FROM THE ENGINE</span>
          <strong>{CATALOG.builtins.length} builtins · {readyCount} canvas-ready</strong>
        </div>
        <input
          value={query}
          placeholder="Search builtins…"
          onChange={(event) => { setQuery(event.target.value); setLimit(PAGE); }}
          aria-label="Search builtins"
        />
        <button onClick={onClose}>Close</button>
      </div>
      <div className="mse-catalog-kits">
        <button className={kit === "all" ? "active" : ""} onClick={() => { setKit("all"); setLimit(PAGE); }}>all</button>
        {CATALOG_KITS.map((name) => (
          <button key={name} className={kit === name ? "active" : ""} onClick={() => { setKit(name); setLimit(PAGE); }}>{name}</button>
        ))}
      </div>
      <div className="mse-catalog-list">
        {rows.slice(0, limit).map((entry) => (
          <div className="mse-catalog-row" key={entry.name}>
            <div className="mse-catalog-sig">
              <code>{signature(entry)}</code>
              <span className={`mse-catalog-kind ${entry.kind}`}>{KIND_LABELS[entry.kind]}</span>
              <span className="mse-catalog-kit">{entry.kit}</span>
              {implemented.has(entry.name) && <span className="mse-catalog-ready">canvas</span>}
            </div>
            <p>{entry.summary}</p>
          </div>
        ))}
        {rows.length > limit && (
          <button className="mse-catalog-more" onClick={() => setLimit((current) => current + PAGE)}>
            Show {Math.min(PAGE, rows.length - limit)} more of {rows.length - limit}
          </button>
        )}
        {rows.length === 0 && <p className="mse-catalog-empty">Nothing matches.</p>}
      </div>
    </div>
  );
}

function signature(entry: CatalogEntry): string {
  if (entry.params.length === 0) return `${entry.name}(…)`;
  const params = entry.params.map((param) => (param.optional ? `[${param.name}]` : param.name)).join(", ");
  return `${entry.name}(${params})`;
}
