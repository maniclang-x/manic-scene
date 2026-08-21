# @maniclang/scene

The framework-agnostic foundation for **Manic visual editors** — used by Manic
Workbench today and intended for Manic Web (`platform/web`) next. No React, no
DOM: just the scene document and the code that keeps it honest.

## What it provides

| module | responsibility |
|---|---|
| `model` | The `SceneDoc` — entities, named steps of verb actions, canvas format, template — plus the **verb registry** (`VERBS`). Onboarding a new verb = one registry entry + one codec case + one timeline case. |
| `codec` | Scene ⇄ Manic source, with **no special files**: `readSceneSource(file)` projects any .manic file onto the canvas (unsupported statements are skipped + reported, never touched), and `patchSceneSource` writes edits back **surgically** — only the statements that changed are rewritten; comments, blank lines, loops, and unsupported vocabulary stay byte-for-byte intact. An unchanged doc patches to the identical file. |
| `timeline` | `compileScene(doc)` → deterministic per-entity keyframes with real manic easings. A tested core utility only — **the editor has no playback**: the canvas has zero rendering authority, and the only preview, in every form, is the manic engine (`onPreview` → the host runs the configured manic binary). |
| `palette` | Preview approximations of every manic template's semantic palette (`resolveColor(template, name)`); the engine stays the color authority. |
| `starters` | Shared starting-point scenes so Workbench and Web offer identical templates. |
| `script` | The low-level statement reader for the manic literal-arg subset. |
| `react` (`@maniclang/scene/react`) | The complete scene editor UI — design stage (drag/handles), grouped toolbar, schema-driven inspector, story panel (together/seq/stagger), LaTeX + color fields, catalog explorer. React is an optional peer dependency; the core stays dependency-free. |

## Host integration (Workbench today, Web next)

The editor authors the scene and generates Manic code — nothing else. The host
owns files and the real engine:

> **Bundler note:** when consuming this package as a linked/`file:` dependency,
> dedupe React in the host bundler (`resolve: { dedupe: ["react", "react-dom"] }`
> in Vite) — otherwise the library's dev copy of React is bundled alongside the
> host's and every hook throws `Cannot read properties of null (reading 'useState')`.

```tsx
import { SceneEditor } from "@maniclang/scene/react";
import "@maniclang/scene/editor.css";
import "katex/dist/katex.min.css"; // equation sketch + LaTeX field preview

<SceneEditor
  source={fileContent}                 // full .manic source
  onSourceChange={saveFile}            // surgical patches to the same file
  onOpenSource={() => showCodeEditor()}
  onPreview={() => runManicBinary()}   // true preview via the configured manic engine
/>
```

## How to extend (the whole point)

Everything is registry-driven; the codec, timeline, stage, inspector, story
panel, and toolbar are generic drivers:

- **New entity kind** → one module in `src/entities/` (`registerEntity`: ctor
  parse/serialize, modifiers, geometry, declarative inspector fields) + one
  renderer in `src/react/renderers.tsx` (`registerRenderer`). Nothing else changes.
- **New verb** → one `registerVerb` entry in `src/verbs.ts` (parse, serialize,
  beat length, timeline apply, UI hints). Nothing else changes.
- **The engine is the vocabulary authority**: `npm run catalog:sync` regenerates
  `src/catalog.ts` from manic-lang's test-enforced builtin catalog (490 builtins,
  19 kits). The editor's **Language** panel browses all of it and badges what is
  canvas-ready.

## Canvas-ready vocabulary

~50 builtins: 10 entity kinds (text · caption · equation · counter · circle ·
rect · dot · line · arrow · polygon), 18 verbs (show · draw · type · karaoke ·
wordpop · say · move · shift · scale · spin · to · rewrite · pulse · flash ·
recolor · fade · wait · section · cue), the full text-behaviour and shape-style
modifier sets, and the whole build-time computation layer (`let` / `for` /
`if` / `def` / expressions / `rc{i}` interpolation) evaluated with engine
semantics. The editor's **Language** panel lists all 490 engine builtins and
badges what's canvas-ready.

## Develop

```sh
npm install
npm test        # round-trips, expression engine, surgical patching, 416-file corpus invariants
npm run build   # emits dist/ (consumed by workbench via file:../manic-scene)
```
