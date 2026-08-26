// The complete Manic language as a read-only projection of the same normalized
// vocabulary index used by Add, Animate, and Inspector.

import { useMemo } from "react";
import { allVocabularyEntries, CATALOG } from "../index.js";
import { VocabularyBrowser } from "./VocabularyBrowser.js";

interface CatalogExplorerProps {
  onClose(): void;
}

export function CatalogExplorer({ onClose }: CatalogExplorerProps) {
  const entries = useMemo(() => allVocabularyEntries(), []);
  const supported = entries.filter((entry) => entry.fidelity !== "source-only").length;
  return <VocabularyBrowser
    title="The Manic Language"
    eyebrow="FROM THE ENGINE"
    hint={`${CATALOG.builtins.length} engine builtins · ${supported} understood by the Canvas · Source-only vocabulary remains fully discoverable.`}
    entries={entries}
    onClose={onClose}
    placeholder="Search native names, tasks, categories, or kits…"
    showFidelityFilters
    showTechnicalFilters
  />;
}
