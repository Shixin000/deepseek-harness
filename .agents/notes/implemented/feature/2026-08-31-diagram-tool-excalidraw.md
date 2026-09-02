# Agent Note: The `diagram` tool — deterministic Excalidraw diagrams from a validated shape spec

Status: implemented

English | [中文](2026-08-31-diagram-tool-excalidraw.zh.md)

## Problem

The harness gives the model bash, filesystem, and web tools but no way to produce visual diagrams. A flowchart, architecture sketch, or wireframe is the artifact users ask for constantly, and no reference coding agent ships a drawing primitive either — every one falls back to ASCII art or ad-hoc SVG in `write`. Raw Excalidraw JSON is a poor model-facing format: the element schema is large, ids/seeds/versions are boilerplate, and an invalid document fails silently in editors.

## Decision

Add a model-facing `diagram(file, elements)` tool that writes deterministic Excalidraw `.excalidraw` documents into the session workspace, plus a browser card (`@deepseek-ai/dsh-client-ui-diagram`) that renders the produced file inline as dependency-free SVG.

### The model speaks a six-shape spec, never raw Excalidraw JSON

The tool accepts a compact, validated vocabulary — `rect`/`ellipse`/`diamond` (each with optional centered text), `text`, and `line`/`arrow` through point lists — in canvas coordinates. `packages/drawing/diagram` validates the constraints the runtime schema cannot express (finite geometry, positive sizes, connector point counts, color formats, bounded stroke/font/opacity fields) and expands the spec deterministically into Excalidraw elements with stable ids (`diagram-1`, …), relative connector points, and labels as standalone centered text elements. The same spec always produces the same document — the file, the persisted projection, and the Web card's preview all derive from that deterministic expansion.

### Small canonical value, elements ride only in the replayable projection

The canonical result is `{ path, elementCount, width, height }`; the model never sees the expanded element list. The elements persist on `tool/result` as `presentationMeta` (bounded by `maxMetaBytes`, default 512 KB), so the Web card renders identically live and on replay without re-reading the file or touching model context.

### Read-only rendering without the Excalidraw runtime

The Web card renders the validated `result.meta` elements as inline SVG (`DiagramSvg`), deliberately dependency-free. Client bundles are single-file CJS emitted eagerly at boot — the ~1.5 MB `@excalidraw/excalidraw` editor would land in every startup path with no code-splitting relief. The interactive whiteboard phase that justifies that cost is deferred; the `.excalidraw` file contract is already in place for it.

### The write goes through the session filesystem

`write.ts` assembles the minimal stable Excalidraw envelope (`type: 'excalidraw'`, `version: 2`, `elements`, `appState`, `files`) and writes through `ctx.fs` with the shared `fs/write-intent` waterfall and a `fs/observed` `present` observation, so the session's sandbox and observation policy apply to diagram files like any other tool output. The tool registers into the standard agent preset alongside the fs tools.

## Why no cordis-catalog entry / no `@mode`

Not applicable — the tool is a plain `ctx.tools` registration with no typed event or mode declaration.

## Alternatives considered

**Have the model write raw Excalidraw JSON through `write`.** Rejected: the element schema is large, ids/seeds/versions are boilerplate, and an invalid document fails silently in editors. The structured spec keeps the model-facing surface small and the validation feedback explicit.

**Render with the embedded `@excalidraw/excalidraw` component in view mode.** Rejected for phase one: client bundles are single-file CJS emitted eagerly at boot, so the ~1.5 MB editor would land in every startup path with no code-splitting relief. A dependency-free SVG renderer over the validated element subset keeps the boot small and the card fully jsdom-testable; the interactive whiteboard phase that justifies the editor cost is deferred.

**Keep the model-facing result rich.** Rejected: the expanded elements never reach the model. The canonical value stays at `{ path, elementCount, width, height }` and the elements persist only in the replayable `presentationMeta` projection, so a large diagram costs model context nothing.

**Write through a separate diagram-specific storage path.** Rejected: the write goes through `ctx.fs` with the shared `fs/write-intent` waterfall and `fs/observed` observation, so the session's sandbox and observation policy apply to diagram files exactly like other tool output.

## Consequences

The `diagram` tool is model-visible: it adds the tool schema and the `tool:diagram` prompt section to every standard-preset agent, so recorded-session snapshots and prompt-dependent goldens change when the tool is composed.

Diagram files are workspace artifacts like any other produced file: they appear in the deliverables row, can be opened through the session opener, and are subject to the filesystem observation policy.

The Web card renders only the validated element subset (rect/ellipse/diamond/text/line/arrow); an element kind added to the expansion later must be added to the renderer and its validator in the same change, or the card falls back to its no-preview note.

## Verification

- `packages/drawing/diagram`: 29 unit/integration tests, per-file 100% statement/branch coverage; a Loader composition spec proves `maxElements` is real configurability from `cordis.yml`.
- `packages/client/ui-diagram`: 50 tests (jsdom component specs + registration/HMR-removal spec), per-file 100% coverage; the wire projection parser (`diagram-meta`) rejects every malformed field before the card renders.
- Regenerated `docs/tool-catalog.md` and `docs/config-catalog.md` (both locales), new `docs/subsystems/drawing.md` page, bilingual package/group READMEs, and the `TOOL_DIAGRAM` prompt-section slot.
