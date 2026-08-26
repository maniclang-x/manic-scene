# @maniclang/scene

The shared foundation for [Manic](https://maniclang.com) visual editors. It is
used by [Manic Workbench](https://github.com/maniclang-x/manic-workbench) and is
designed for the [Manic web application](https://app.maniclang.com). The core
scene model and codec are framework-agnostic; the optional React entry point
provides the complete visual editor.

## Install

```sh
npm install @maniclang/scene
```

Install React when using `@maniclang/scene/react`:

```sh
npm install @maniclang/scene react react-dom
```

Package: [npmjs.com/package/@maniclang/scene](https://www.npmjs.com/package/@maniclang/scene)

## What it provides

| module | responsibility |
|---|---|
| `model` | The `SceneDoc` — entities, named steps of verb actions, canvas format and template — plus dependency geometry and Canvas-semantic annotations. Entity and verb registries drive the generic codec and UI. |
| `codec` | Scene ⇄ Manic source, with **no special files**: `readSceneSource(file)` projects any .manic file onto the canvas (unsupported statements are skipped + reported, never touched), and `patchSceneSource` writes edits back **surgically** — only the statements that changed are rewritten; comments, blank lines, loops, and unsupported vocabulary stay byte-for-byte intact. An unchanged doc patches to the identical file. |
| `timeline` | `compileScene(doc)` → deterministic per-entity keyframes with real manic easings. A tested core utility only — **the editor has no playback**: the canvas has zero rendering authority, and the only preview, in every form, is the manic engine (`onPreview` → the host runs the configured manic binary). |
| `palette` | Preview approximations of every manic template's semantic palette (`resolveColor(template, name)`); the engine stays the color authority. |
| `starters` | Shared starting-point scenes so Workbench and Web offer identical templates. |
| `assets` | Host-neutral Library/Project catalogue, URI resolution, and optional upload contract. Local filesystems and cloud object stores implement the same `ManicAssetProvider`. |
| `script` | The low-level statement reader for the manic literal-arg subset. |
| `react` (`@maniclang/scene/react`) | The complete scene editor UI — design stage (drag/handles), compact command bar, searchable Add/Animate/Feature/Language browser, schema-driven inspector, story panel (together/seq/stagger), and LaTeX + color fields. React is an optional peer dependency; the core stays dependency-free. |

## Host integration

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
  onPreview={() => runManicBinary()}   // native preview via the configured Manic engine
  assetProvider={assets}               // Library/Project media supplied by the host
/>
```

Asset-backed scenes remain portable: `image()` and `svg()` serialize only
stable `asset:` URIs. The provider supplies a browser-displayable URL for the
Canvas; the host separately makes the same asset available to the Manic engine
for native Preview and rendering. Local Workbench can use a filesystem
catalogue while Manic Web can use authenticated R2 objects without changing the
scene editor or leaking storage URLs into source.

## How to extend (the whole point)

Everything is registry-driven; the codec, timeline, stage, inspector, story
panel, normalized vocabulary index, and searchable authoring browsers are
generic drivers:

- **New entity kind** → one module in `src/entities/` (`registerEntity`: ctor
  parse/serialize, modifiers, geometry, declarative inspector fields) + one
  renderer in `src/react/renderers.tsx` (`registerRenderer`). Nothing else changes.
- **New verb** → sync the catalog, then add one `registerVerb` entry in
  `src/verbs.ts` (parse, serialize, beat length, target contract, Story UI and
  semantic annotation). Register identifier argument positions in `codec.ts`
  and add native-example round-trip coverage.
- **The engine is the vocabulary authority**: `npm run catalog:sync` regenerates
  `src/catalog.ts` from manic-lang's test-enforced builtin catalog (491 builtins,
  19 kits). The editor's **Language** panel browses all of it with subject,
  operation, kit, and exact/semantic/source-only support filters.

## Canvas-ready vocabulary

497 normalized Canvas-understood entries, including 482 of the 491 engine
builtins across entities, verbs, modifiers, helpers, and the whole build-time
computation layer (`let` / `for` /
`if` / `def` / expressions / `rc{i}` interpolation) evaluated with engine
semantics. The editor's **Language** panel lists all 491 engine builtins and
distinguishes Canvas-exact, Canvas-semantic, and Source-only support. Add,
Animate, Story `+ Beat`, Inspector `+ Feature`, Language, and `Cmd/Ctrl+K`
search reuse the same index, so the permanent command bar does not grow with
the builtin count.

The Three surface/field stack is Canvas-semantic: `surface3`, `domainsurface`,
`param3`, `implicit3`, `heightmap3`, `contour3`, `slice3`, `tangentplane3`,
`gradient3`, `vectorfield3`, `volume3`, `trajectory3`, `descend3`, `linmap3`,
and `eigen3` expose their full constructor arguments and live dependencies.
Canvas uses bounded samples and explicit Preview markers for complex evaluation,
isosurface extraction, integration, ODE solving, and eigen analysis. `grid` is
also semantic so `heightmap3` has a real picker and rename-safe dependency.

The Three collections/procedural stack is Canvas-semantic too: `collection3`
and `collection3data` expose stable point families; `child3`, `links3`,
`links3data`, `pieces3`, `ring3`, and `trail3` preserve their live dependencies
and native generated-child ids; `historyplot`/`historyplot3`, `randomwalk3`,
`lsystem3`, `tree3`, and `hilbert3` provide bounded deterministic design
representations. `follow3` is an Applied Inspector relationship, while
zero-duration `attach3` lives in Story with target, XYZ offset, position/rigid
mode, and release-to-`none`. Accumulated history, full procedural counts,
per-frame transforms, depth, and final pixels remain Preview-authoritative.

The Three motion/camera surface completes the kit. Story provides compact XYZ
controls for `move3`, `shift3`, `rotate3`, `grow3`, and `look3`; relationship
pickers for `turn3`, `become3`, `travel3`, `view3`, `present3`, `followshot3`,
and `advect3`; and per-stable-child list controls for `chain3` alongside
`drift3`. Logical generated families are offered only to verbs whose native
semantics accept tags (`turn3`, `view3`, `present3`); exact-entity workflows
exclude tag-only rows/columns. Canvas shows destinations, relations, camera
reticles, and Preview-authoritative motion badges without playing fake 3D
animation. The Three catalog is now 75/75 Canvas-semantic.

The generative kit is fully Canvas-semantic: `repeat`, `lsystem`, `ifs2`,
`mandelbrot`, `polarpath`, and `hull2` expose their native arguments and live
dependencies while drawing deterministic bounded samples. The Canvas labels
those sample budgets explicitly; native Preview owns full point counts,
resolution, triangulation, colour ramps, and final pixels.

The Algo kit is fully authorable without code. `array`, `pointer`,
and `caret` expose fixed slots, live index relationships, and labelled markers;
`stack`/`queue` provide honest empty-container guides whose `push`, `pop`,
`enqueue`, and `dequeue` beats edit values and timing in Story; `list` exposes
singly, doubly, and circular node anatomy with `insert`/`remove` mutations.
`hashmap` adds deterministic buckets and planned collision chains with editable
`put`/`get` beats. `graph` adds labelled directed/undirected weighted edges and
dynamic start-vertex controls for `bfs`, `dfs`, and `dijkstra`. Canvas shows
initial structure, stable generated-child identities, operation
direction, and invalid occupancy/index warnings. Native Preview remains the
authority for live array occupancy, minted cells/nodes/entries, pointer
re-threading, frontier/distance readouts, and algorithm playback. Algo coverage
is now 21/21 builtins: 6 exact, 15 semantic, and 0 Source-only.

The Stats kit is fully authorable without code. Dataset views `histogram`,
`summary`, `boxplot`, `skew`, `correlation`, and `covariance`; inference and
probability views `bayes`, `hypothesis`, `distribution`, `confidence`, and
`bellcurve`/`gaussian`; and seeded experiments `montecarlo`, `randomwalk`,
`lln`, and `clt` all expose native arguments and stable generated children.
Canvas reconstructs the static compositions directly. To keep authoring
responsive, high-count seeded experiments use deterministic bounded samples
with an explicit Inspector/Canvas annotation while Preview renders the full
authored count. Stats coverage is **16/16 builtins: 12 exact, 4 semantic, and
0 Source-only**.

The ML kit is fully authorable without code. Canvas reconstructs deterministic
`activation`, `tensor`, `kernel`, and `tokenize` figures and exposes stable
generated children. `network`, `digit`, `convolve`, `pool`, `embedding`,
`transformer`, `logits`, `attention`, and `topk` provide compact semantic
diagrams with editable dimensions, modes, seeds, inputs, and dependencies.
Story owns `forward`, `feed`, `loss`, `backward`, `checkpoint`, `update`, ML
`restore`, `scan`, `encode`, `sample`, and `attend`; a derived Scan duration is
computed from the output tensor shape. Canvas communicates structure and intent,
while native Preview owns numerical evaluation, learned/checkpointed state, and
animation pixels. ML coverage is **24/24 builtins: 4 exact, 20 semantic, and 0
Source-only**.

The Optics kit is fully Canvas-semantic. `refract`, `lens`, `prism`,
`achromat`, and `lenssystem` expose their full optical inputs and use the shared
Story `Run` control for native parameter sweeps. `rayfan`, `spotdiagram`, and
`fieldspot` provide bounded analysis diagrams with native generated-child names
for styling and Story targeting. Canvas shows interfaces, lenses, rays, spectra,
foci, sensors, spot footprints, and Airy overlays as editable structural
guides; Preview owns Snell's law, Sellmeier dispersion, surface intersections,
aberration values, sweep playback, and exact pixels. Optics coverage is **8/8
builtins: 0 exact, 8 semantic, and 0 Source-only**.

The Physics kit is fully Canvas-semantic. All 38 simulation constructors expose
their native initial conditions without requiring code, from pendulums, springs,
inclines, pulleys, collisions, gases and domino systems through waves,
mechanisms, trajectories and brachistochrone races. Gas `species`, collision
`rule`, and live `speeds` plus generic `phase`, `well`, `timegraph`, and
`energygraph` declarations remain attached to their owning simulation in one
Inspector instead of appearing as duplicate entities. Story supplies `run`,
the pendulum-friendly `swing` alias, and ramp-only `forces`. Canvas shows a
bounded design state and stable generated families; Preview owns integration,
events/collisions, live values and playback. Physics coverage is **48/48
builtins: 0 exact, 48 semantic, and 0 Source-only**.

The Systems kit is fully Canvas-semantic. `architecture`, `flowchart`, and `c4`
provide responsive diagram roots; `node` and `cluster` expose nested ownership,
provider/native/flowchart/C4 roles, labels, descriptions, and technology; and
`connect` keeps curve bends or explicit orthogonal ports editable. `annotate`
stays attached to its connection instead of becoming a duplicate Canvas item.
Persistent `message`/`request` identities use Story `route` and seeded `hotpath`
beats. Canvas draws deterministic bounded topology and runtime intent; Preview
owns auto-fit layout, provider artwork, concrete cluster fan-out, continuity
validation, lane choice, illumination, and exact animation. Systems coverage is
**11/11 builtins: 0 exact, 11 semantic, and 0 Source-only**.

The Circuit kit is fully Canvas-semantic. `circuit` provides an editable
multiline netlist, grid scale, value-label switch, and build share while Canvas
draws a bounded deterministic schematic from the authored topology. `current`,
`probe`, and `scope` stay attached to that circuit in one Inspector, including
node-voltage versus part-current addressing and scope placement. Story offers
shared `run` plus `cut` and `reconnect` with a named part or `cN` address.
Generated component names and `.parts`, `.nodes`, `.labels`, `.charge`,
`.glow`, `.probes`, and `.scopes` families remain targetable. Native Preview is
the sole authority for MNA/nonlinear/transient solving, readings, dot speed,
lamp glow, waveform values, and exact playback. Circuit coverage is **6/6
builtins: 0 exact, 6 semantic, and 0 Source-only**.

The Grid kit is fully Canvas-semantic. One `grid` owner keeps `neighbors`,
`setcell`, `walls`, `evolve`, and `collapse` in a compact Inspector;
Canvas shows the deterministic authored state while Story offers `gridbfs`,
`gridastar`, and shared `run`. Search frontiers, cellular generations, WFC
collapse, and exact playback stay Preview-owned. Grid coverage is **8/8
builtins: 0 exact, 8 semantic, and 0 Source-only**.

The Charts and Process kits are also closed. `racechart` owns its
`racedata`, `raceseries`, optional `raceline`, and `racepanel`
composition; Canvas shows an editable static period and Story owns `race`.
`livehistogram` is intentionally empty on Canvas until `stream`, `emit`,
`advect`, or `branch` produces measurements consumed by `collect` or
`observe`. Relationship badges and Story controls expose the meaning without
fabricating runtime pixels. Charts is **6/6 semantic** and Process is **7/7
semantic**, both with zero Source-only builtins.

The first Chemistry batch makes 20 of 24 kit builtins Canvas-semantic.
`balance` owns `supply` and `limiting`; Story exposes `solve` and `react`.
Lewis structures provide `octet` and `resonate`; energy levels feed
`emission` and `drop`; cells and lattices expose `discharge` and `dissolve`.
Newman projections feed torsion `profile`, molecular `vibration` feeds
`irspectrum`, and `molecule3` is a proper initial-camera 3D asset proxy.
Inspector preserves every native input and dependency while Canvas shows
editable scientific intent; Preview remains authoritative for chemistry,
generated geometry, numerical values, animation, and exact pixels. Chemistry
coverage is **20/24 semantic**, with `structure`, `tally`, `twist`, and
`vibrate` still Source-only.

Raw `glsl` is also Canvas-semantic without pretending to emulate a GPU in SVG:
the Canvas shows the full-frame pass and binding status, the Inspector edits the
complete Shadertoy-style `mainImage` source, and declared `u_<parameter>` plus
camera uniforms remain visible relationships. Native Preview compiles and owns
the actual full-resolution pixels.

Named timing composition is authorable without code: a generic `timing`
controller can create one `timed(clock)` Story card, whose `during` phase cards
contain sequential, together, or staggered groups. Canvas-known beats remain
editable; unsupported inner simulation statements stay visible as preserved
Source-owned chips. Phase cards show their declared budget and known usage,
while native Preview and Check remain the scheduling authority.

Core composition is dependency-aware: `gradient` supports multi-stop linear,
radial, along-path, and curvature modes; `plate` and `cursor` style readable
text; `clip` and `mask` follow their region through target moves and renames.
The Canvas is an authoring map, not a second renderer: it communicates what
exists, which runtime behaviour is applied, and what depends on what. Features
that cannot be pixel-exact receive semantic badges, relationship overlays, and
Inspector explanations while native Preview remains the visual truth. A
`"speed"` gradient therefore round-trips and shows a `⚡` semantic guide; only
time-sampled simulation trajectories are valid native targets (ordinary
geometric lines continue to use `along` or `"curvature"`).

The calculus layer is deliberately relational. A `plot` owns the editable
formula/domain/scale; derivative and accumulation curves, tangents, normals,
slope readouts and triangles, roots, vertical guides, curve dots and labels,
coordinate boxes, Riemann rectangles, Taylor approximations, Newton walks,
extrema, inflections, areas, integrals, and limits all retain a live reference
to that curve. `band` similarly owns two editable plot references and their
optional shared x-slice. Independent `param`, `polar`, `spline`, and
`trajectory` paths keep their formulas, domains, knots, or ODE contract
editable. Canvas provides deterministic bounded design geometry and
relationship guides; Manic Preview remains the numerical and pixel authority.
The complete `examples/calculus-one.manic` acceptance case projects as 71
entities and 227 actions with zero skipped statements and byte-exact identity.

Math coordinate systems and circular regions are also direct Canvas objects:
`plane`/`numberplane`, `complexplane`, `polarplane`, `numberline`, `arc`,
`sector`, and `annulus` expose their native dimensions, ranges, divisions,
angles, radii, fill, and outline controls. Generated axes, grids, ticks, labels,
rings, and spokes retain their native child/tag identities for Story targeting;
the equivalent `numberplane` spelling is preserved when source is edited.

Linear algebra is authorable with the same split between stable design geometry
and native playback. `matrix`, `linmap`, `determinant`, `eigen`,
`diagonalise`/`diagonalize`, `linsolve`, `span`, and `project` have direct
Canvas geometry; `gridmap`, `rref`, and `squish` expose their matrices, vectors,
states, generated child targets, and semantic playback intent. Story offers the
native `to(id, morph, …)` driver for grid maps and squishes, while Preview owns
continuous interpolation and row-operation reveals.

The Math kit is fully onboarded. `arrowfield`/`vectorfield` provide bounded
formula samples, `field` is an explicitly non-drawing reusable declaration,
and `domaincolor`/`warp` provide honest complex-function thumbnails and morph
intent alongside an editable `colorwheel`. `table` and its three aliases retain
addressable cells, rows, columns, labels, and rules; `pie` exposes every equal
sector; and `leastsquares` exposes its points, fit, residuals, and equation.
Unsupported complex thumbnail functions such as `zeta` remain editable and
visibly Preview-owned instead of displaying fabricated Canvas pixels.

The Geo kit is fully onboarded at 26/26 exact builtins. Its remaining
Euclidean constructions retain explicit dependency graphs: triangle centres
and circles, projections, intersections, reflected/rotated/interpolated points,
and full lines follow their referenced points. Common tangents keep their four
construction references editable but, matching native Manic, are recomputed at
scene build rather than during timeline playback.
Native multi-result constructors expose their real child ids (`id0`/`id1`,
`id.a`/`id.b`, and hyperbola branches) in the Inspector and Story surfaces.
The overloaded `tangent(point, centre, rim)` form shares the existing Tangent
entry without mixing its controls with `tangent(curve, x, length)`; child
colour, hidden state, tags, references, and rename propagation round-trip.

The 3D layer follows the same honesty contract. Canvas projects `grid3`,
`line3`, `arrow3`, `curve3`, `point3`, `axes3`, `frame3`, `cube3`, `sphere3`,
`prism3`, `pyramid3`, `midpoint3`, `cross3`, and `link3` through the authored
initial `camera3`, while `pin3`, `label3`, `thick`, and `morph3` remain editable
relationships. Generated axes, frame and cross-product children stay
addressable in Inspector and Story without inventing native root geometry.
OBJ assets are selectable as `model3` or grouped `assembly3` objects;
`extrude3`, `revolve3`, `tube3`, `project3`, and `projectpath3` retain editable
source/formula relationships. `finish3` is an Applied Inspector feature whose
material intent is visible while Preview remains the lighting and mesh truth.
Collections, stable children, procedural trees/grammars/walks, live history
charts, `follow3`, and Story-level `attach3` use the same semantic contract.
It does not fake camera playback: `orbit3`, `roll3`, `look3`, `view3`, and
`followshot3` appear as scene-level intent, `cycle` and `erase` remain editable Story beats, and Manic Preview is
the authority for motion, depth, morph sampling and final pixels. The complete
`examples/derivative-of-ln-x.manic` acceptance case projects as 75 entities
and 98 actions with zero skipped statements and byte-exact identity.

Live motion relationships are source-backed rather than simulated. A visible
`parameter` exposes its bounded initial value and editable `bind` mappings;
`morph` keeps a target blueprint; and `turn`, `flow`, `become`, `attach`,
`oscillate`, `shake`, and `followshot` appear as editable Story intent with
Canvas pivots, guides, reticles, or semantic markers where useful. Native
Preview remains responsible for sampling and playback.

Publishing composition is also first-class: `creator` exposes structured brand
fields, while `socials` and `endcard` are contextual profile features with
responsive Canvas proxies and generated-child targets. `safezone` draws the
native platform clearance guide, and `figure` shows the destination relationship
for native group fitting. Story now authors `speak` narration (with an optional
caption relationship), while its Inspector owns the one paired global
`voice(...)` provider, preset, pace, and language configuration. Preview remains
the authority for synthesis and final audio.

Creator workflows are Canvas-semantic end to end: `quiz` owns editable answer
cards, correctness, responsive layout, explanation and timing; overloaded
`timing` also creates standalone named-phase controllers; `timerstyle` exposes
native clock appearance; `countdown` provides a standalone timer; and `run`
records the effective target-owned duration without simulating playback. Native
Preview remains authoritative for fitted type, countdown motion and reveal state.

## Develop

```sh
npm ci
npm test        # round-trips, expression engine, surgical patching, and corpus invariants
npm run typecheck
npm run build   # emits dist/ (consumed by workbench via file:../manic-scene)
```

## Publish

Maintainers with publish access to the `@maniclang` npm scope should release
from a clean, reviewed commit. Synchronize the engine catalogue when the Manic
engine vocabulary has changed, verify the package contents, and then publish:

```sh
npm ci
npm run catalog:sync
git diff --exit-code
npm test
npm run typecheck
npm run build
npm login
npm whoami
npm publish --dry-run --access public
npm publish --access public
```

Published npm versions are immutable. Update the `version` in `package.json`
before publishing a subsequent release.

## Manic ecosystem

- Product: [maniclang.com](https://maniclang.com)
- Web application: [app.maniclang.com](https://app.maniclang.com)
- Documentation: [docs.maniclang.com](https://docs.maniclang.com)
- Manic engine and releases: [github.com/maniclang-x/manic](https://github.com/maniclang-x/manic)
- Manic Workbench: [github.com/maniclang-x/manic-workbench](https://github.com/maniclang-x/manic-workbench)
- Manic Create: [app.maniclang.com/create](https://app.maniclang.com/create)
- Platform API contract: [npm package](https://www.npmjs.com/package/@maniclang/api-spec) · [source](https://github.com/maniclang-x/manic-api-spec)
- MCP server: [npm package](https://www.npmjs.com/package/@maniclang/mcp-server) · [source](https://github.com/maniclang-x/manic-mcp-server)
- Browser extension: [github.com/maniclang-x/manic-browser-extension](https://github.com/maniclang-x/manic-browser-extension)
- Homebrew tap: [github.com/maniclang-x/homebrew-tap](https://github.com/maniclang-x/homebrew-tap)
- Issues: [github.com/maniclang-x/manic-scene/issues](https://github.com/maniclang-x/manic-scene/issues)

## License

`@maniclang/scene` is available under the [MIT License](LICENSE).

This license applies to this shared scene-editor package only. The compiled
Manic engine, Manic-owned runtime assets, hosted services, and other Manic
products remain governed by their own licenses and terms. Third-party software,
fonts, icons, and artwork retain their respective licenses.
