---
description: "The model-facing diagram tool: writes Excalidraw-format files from a validated shape spec, for users and maintainers of the drawing capability."
kind: "package-reference"
---

# @deepseek-ai/dsh-diagram

English | [中文](README.zh.md)

## Summary

`dsh-diagram` lets the agent produce visual diagrams as [Excalidraw](https://excalidraw.com) files: the `diagram` tool accepts a compact shape spec, validates it, expands it deterministically into well-formed `.excalidraw` documents, and writes them into the session workspace through the session's `fs` service. The companion `diagram_read` tool summarizes an existing document (types, geometry, labels, connector points) so the model can modify it without parsing raw JSON. The model never writes raw Excalidraw JSON — the tool owns the element expansion, so every artifact opens in Excalidraw-compatible editors and renders inline in the Web client.

## Table of Contents

- [Use this package](#use-this-package)
- [The shape spec](#the-shape-spec)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the plugin to register the `diagram` tool:

```yaml
- name: '@deepseek-ai/dsh-diagram'
```

### Configuration

| Field | Default | Meaning |
|---|---|---|
| `maxElements` | `500` | Maximum number of spec shapes one call accepts. |
| `maxMetaBytes` | `524288` | Serialized byte cap of the presentation projection kept for replay; beyond it the Web card falls back to path-only. |

### The tool contract

`diagram` takes `file` (a workspace path ending in `.excalidraw`) and `elements` (the shape list). A call either writes the document and returns `{ path, elementCount, width, height }`, or fails with every validation problem listed, so the model can fix its spec in one iteration. The canonical value stays small; the expanded elements ride only in the replayable `presentationMeta` projection.

`diagram_read` takes `file` and returns a bounded structural summary: `elementCount`, canvas `width`/`height`, and up to 200 element summaries (id, type, geometry, label text, connector points), with `truncated` and the true total when the cap cuts the list. The 16 MB read cap rejects oversized files explicitly.

-----

<a id="the-shape-spec"></a>
## The shape spec

Six shape kinds, all in canvas coordinates (x right, y down):

| Kind | Fields | Notes |
|---|---|---|
| `rect` | `x y w h`, `text?`, `rounded?` | Label text renders centered. |
| `ellipse` | `x y w h`, `text?` | Label text renders centered. |
| `diamond` | `x y w h`, `text?` | Label text renders centered. |
| `text` | `x y text`, `w? fontSize? color?` | Standalone label. |
| `line` | `points: [{x,y}, …]` | At least 2 points. |
| `arrow` | `points: [{x,y}, …]` | Arrowhead at the last point. |

Every shape except `text` also accepts `strokeColor`, `fillColor` (hex triplet or CSS named color), `dashed`, `strokeWidth` (1–50), and `opacity` (0–100); `text` accepts `color` and `fontSize` (8–96). Expansion is deterministic: the same spec always produces the same document (stable ids, seeds, and versions).

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

- `src/spec.ts` validates the constraints the runtime schema cannot express: finite geometry, positive sizes, connector point counts, color formats, and bounded fields.
- `src/expand.ts` maps each spec shape to an Excalidraw element (`rectangle`/`ellipse`/`diamond`/`text`/`line`/`arrow`) with stable ids (`diagram-1`, …), relative connector points, and label texts as standalone centered text elements; `diagramBounds` computes the canvas size from the spec.
- `src/write.ts` assembles the `.excalidraw` envelope (`type: 'excalidraw'`, `version: 2`, `elements`, `appState`, `files: {}`) and writes it through `ctx.fs` with the shared `fs/write-intent` waterfall and a `fs/observed` `present` observation, so the session's sandbox and observation policy apply.
- `src/read-tool.ts` parses and summarizes an existing document with the same validation spirit as the write path: malformed elements are skipped, geometry coerces to finite numbers, and the summary is bounded by the element cap with an explicit total.
- `src/remote.ts` backs the interactive whiteboard (`diagram.save`/`diagram.read` Remote methods) and records the log-only `diagram/saved` session event when the caller attaches a session id.
- `src/index.ts` registers both tools, the `tool:diagram` and `tool:diagram_read` system-prompt sections, and the replayable `presentationMeta` projection.
- No runtime invariant companion is published because tool registration is a registry-owned effect (disposal proven by the HMR-safety spec) and the validation/expansion pipeline is pure over its inputs; the package emits no cordis events.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Generated tool catalog](../../../docs/tool-catalog.md#deepseek-aidsh-diagram) — the exact schema the model receives.
- [Web client diagram card](../../../packages/client/ui-diagram/README.md) — the inline read-only rendering.
- [Excalidraw file format](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/transform.md) — the on-disk document contract.

-----

<a id="model-experience"></a>
## Model Experience

### Request context and condition

#### What the model sees

The `diagram` and `diagram_read` tools appear in the tool schema and their guidance sections in the system prompt whenever this plugin is mounted: the tools' `parameters`, the `tool:diagram`/`tool:diagram_read` prose, and the `<path>`/`<type>`/`<content>` envelope in every result. The canonical value carries only `path`, `elementCount`, `width`, and `height` (plus the bounded element summary for reads) — never expanded write elements.

#### Token effect

Fixed per call: the schemas (~2.5 KB), the section prose (~200 tokens), and the short result envelopes. The expanded element list never reaches the model.

#### KV Cache effect

The tool schema and section are part of a stable prefix assembled per agent preset; nothing in this package changes between requests, so it does not invalidate an already-reusable prefix.

## Known Limitations and Deferred Work

- **The whiteboard is a Web-client concern** — the interactive editor lives in the ui-diagram-canvas package; this package only writes, reads, and serves files.
- **Label text is a standalone element** — shape labels are not bound Excalidraw text (no `containerId`/`boundElements`), so moving a shape in an editor does not move its label.
- **Rounded rect uses one roundness preset** — the `rounded` flag maps to a fixed corner radius; per-corner radii are not expressible.
- **Connector endpoints are free, not bound** — arrows/lines never attach to shapes (`startBinding`/`endBinding` are null), so reshaping a shape in an editor does not drag its connectors.
- **Aspects of Excalidraw's schema are fixed** — angle, roughness, and seed are constant; the spec cannot express rotations or roughness variations.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
