import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  VOCABULARY_CATEGORIES, searchVocabulary,
  type VocabularyAvailability, type VocabularyEntry, type VocabularyFidelity, type VocabularyKind, type VocabularyOperation,
} from "../index.js";

const PAGE = 60;

export interface VocabularyBrowserProps {
  title: string;
  eyebrow?: string;
  entries: readonly VocabularyEntry[];
  availability?(entry: VocabularyEntry): VocabularyAvailability;
  onChoose?(entry: VocabularyEntry): void;
  onClose?(): void;
  variant?: "panel" | "popover";
  style?: CSSProperties;
  placeholder?: string;
  hint?: string;
  showFidelityFilters?: boolean;
  showTechnicalFilters?: boolean;
}

const AVAILABLE: VocabularyAvailability = { enabled: true, reason: "" };
const FIDELITY_LABELS: Record<VocabularyFidelity, string> = {
  exact: "Canvas exact",
  semantic: "Canvas semantic",
  "source-only": "Source only",
};

/** One scalable picker/reference surface shared by Add, Animate, Inspector,
 * Language, and eventually the command palette. */
export function VocabularyBrowser({
  title, eyebrow = "MANIC VOCABULARY", entries, availability, onChoose, onClose,
  variant = "panel", style, placeholder = "Search by name or what you want to do…",
  hint, showFidelityFilters = false,
  showTechnicalFilters = false,
}: VocabularyBrowserProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [fidelity, setFidelity] = useState<VocabularyFidelity | "all">("all");
  const [kind, setKind] = useState<VocabularyKind | "all">("all");
  const [kit, setKit] = useState("all");
  const [operation, setOperation] = useState<VocabularyOperation | "all">("all");
  const [limit, setLimit] = useState(PAGE);
  const [active, setActive] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => VOCABULARY_CATEGORIES.filter((candidate) => entries.some((entry) => entry.category === candidate)), [entries]);
  const kits = useMemo(() => [...new Set(entries.map((entry) => entry.kit))].sort(), [entries]);
  const kinds = useMemo(() => [...new Set(entries.map((entry) => entry.kind))].sort() as VocabularyKind[], [entries]);
  const operations = useMemo(() => [...new Set(entries.flatMap((entry) => entry.operations))].sort() as VocabularyOperation[], [entries]);
  const results = useMemo(() => {
    const filtered = entries.filter((entry) =>
      (category === "all" || entry.category === category)
      && (fidelity === "all" || entry.fidelity === fidelity)
      && (kind === "all" || entry.kind === kind)
      && (kit === "all" || entry.kit === kit)
      && (operation === "all" || entry.operations.includes(operation))
    );
    const searched = searchVocabulary(filtered, query);
    if (!availability) return searched;
    return searched
      .map((entry, index) => ({ entry, index, enabled: availability(entry).enabled }))
      .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.index - b.index)
      .map(({ entry }) => entry);
  }, [availability, category, entries, fidelity, kind, kit, operation, query]);

  useEffect(() => { searchRef.current?.focus(); }, []);
  useEffect(() => { setLimit(PAGE); setActive(0); }, [query, category, fidelity, kind, kit, operation]);
  useEffect(() => { if (active >= results.length) setActive(Math.max(0, results.length - 1)); }, [active, results.length]);

  function choose(entry: VocabularyEntry) {
    if (!onChoose) return;
    const status = availability?.(entry) ?? AVAILABLE;
    if (status.enabled) onChoose(entry);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && onClose) {
      event.preventDefault();
      onClose();
      return;
    }
    if (!onChoose || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(results.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const entry = results[active];
      if (entry) choose(entry);
    }
  }

  return (
    <section
      className={`mse-vocabulary mse-vocabulary-${variant}`}
      style={style}
      role={variant === "popover" ? "dialog" : "region"}
      aria-label={title}
      onKeyDown={onKeyDown}
    >
      <header className="mse-vocabulary-head">
        <div>
          <span className="mse-eyebrow">{eyebrow}</span>
          <strong>{title}</strong>
          {hint && <small>{hint}</small>}
        </div>
        {onClose && <button type="button" className="mse-vocabulary-close" onClick={onClose} aria-label={`Close ${title}`}>×</button>}
      </header>

      <div className="mse-vocabulary-search">
        <span aria-hidden="true">⌕</span>
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          role="combobox"
          aria-expanded="true"
          aria-controls="mse-vocabulary-results"
          aria-activedescendant={results[active] ? `mse-vocabulary-${results[active].name}` : undefined}
          aria-label={`Search ${title}`}
          spellCheck={false}
        />
        {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search">Clear</button>}
      </div>

      <div className="mse-vocabulary-filters" aria-label="Vocabulary categories">
        <button type="button" className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>Suggested / all</button>
        {categories.map((name) => (
          <button type="button" key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name}</button>
        ))}
      </div>

      {showFidelityFilters && (
        <div className="mse-vocabulary-fidelity" aria-label="Canvas support">
          <button type="button" className={fidelity === "all" ? "active" : ""} onClick={() => setFidelity("all")}>All support</button>
          {(Object.keys(FIDELITY_LABELS) as VocabularyFidelity[]).map((level) => (
            <button type="button" key={level} className={fidelity === level ? "active" : ""} onClick={() => setFidelity(level)}>{FIDELITY_LABELS[level]}</button>
          ))}
        </div>
      )}

      {showTechnicalFilters && (
        <div className="mse-vocabulary-technical" aria-label="Technical vocabulary filters">
          <label><span>Kind</span><select value={kind} onChange={(event) => setKind(event.target.value as VocabularyKind | "all")}><option value="all">All kinds</option>{kinds.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Operation</span><select value={operation} onChange={(event) => setOperation(event.target.value as VocabularyOperation | "all")}><option value="all">All operations</option>{operations.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Engine kit</span><select value={kit} onChange={(event) => setKit(event.target.value)}><option value="all">All kits</option>{kits.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
      )}

      <div className="mse-vocabulary-count" role="status">
        <strong>{results.length}</strong> result{results.length === 1 ? "" : "s"}
        {query && <span>for “{query}”</span>}
      </div>

      <div className="mse-vocabulary-results" id="mse-vocabulary-results" role={onChoose ? "listbox" : "list"}>
        {results.slice(0, limit).map((entry, index) => {
          const status = availability?.(entry) ?? AVAILABLE;
          const content = <VocabularyResult entry={entry} status={status} />;
          return onChoose ? (
            <button
              type="button"
              id={`mse-vocabulary-${entry.name}`}
              role="option"
              aria-selected={index === active}
              aria-disabled={!status.enabled}
              className={`mse-vocabulary-row${index === active ? " active" : ""}${status.enabled ? "" : " unavailable"}`}
              key={entry.name}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(entry)}
            >
              {content}
            </button>
          ) : (
            <article className="mse-vocabulary-row" id={`mse-vocabulary-${entry.name}`} role="listitem" key={entry.name}>{content}</article>
          );
        })}
        {results.length > limit && (
          <button type="button" className="mse-vocabulary-more" onClick={() => setLimit((current) => current + PAGE)}>
            Show {Math.min(PAGE, results.length - limit)} more · {results.length - limit} remaining
          </button>
        )}
        {results.length === 0 && <p className="mse-vocabulary-empty">Nothing matches these filters.</p>}
      </div>
    </section>
  );
}

function VocabularyResult({ entry, status }: { entry: VocabularyEntry; status: VocabularyAvailability }) {
  return (
    <>
      <span className="mse-vocabulary-icon" aria-hidden="true">{entry.icon ?? kindIcon(entry.kind)}</span>
      <span className="mse-vocabulary-copy">
        <span>
          <strong>{entry.label}</strong>
          <code>{entry.name}</code>
        </span>
        <small>{entry.summary}</small>
        {!status.enabled && status.reason && <em>{status.reason}</em>}
      </span>
      <span className="mse-vocabulary-meta">
        <b className={`mse-fidelity-${entry.fidelity}`}>{FIDELITY_LABELS[entry.fidelity]}</b>
        <small>{entry.category}</small>
        <code>{entry.signature}</code>
      </span>
    </>
  );
}

function kindIcon(kind: VocabularyEntry["kind"]): string {
  return kind === "verb" ? "▶" : kind === "modifier" ? "✦" : kind === "scene" ? "▣" : kind === "helper" ? "ƒ" : "+";
}
