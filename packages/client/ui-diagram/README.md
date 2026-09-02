---
description: "The Web diagram tool card: inline read-only SVG rendering of .excalidraw diagrams produced by the diagram tool, for users and maintainers of the drawing capability."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-diagram

English | [中文](README.zh.md)

## Summary

`dsh-client-ui-diagram` renders `diagram` tool calls inline in the conversation: a compact card with the produced file, its shape count, an open action, and a dependency-free SVG preview of the diagram. The card derives everything from the raw wire call/result slice (including the persisted `result.meta` projection), so it renders identically live and on replay, and malformed or unsupported data falls back to a no-preview note instead of crashing.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the plugin alongside the tool that produces diagrams:

```yaml
- name: '@deepseek-ai/dsh-client-ui-diagram'
```

The card appears for every `diagram` call in the session. A running call shows a pending note; a failed call shows the failure; a settled call renders the validated `result.meta` elements as inline SVG with a header showing the file and shape count. The **Open** action calls the session file opener; it is offered only on settled, successful calls whose file argument parses.

### The SVG preview

The preview renders the Excalidraw element subset the `dsh-diagram` tool emits: rectangles (with optional rounded corners), ellipses, diamonds, text (multi-line, honoring `textAlign`/`verticalAlign`), lines, and arrows with arrowheads. Stroke color/width, dashed style, fill color, and opacity are honored. `backgroundColor: 'transparent'` draws no fill.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

- `src/client/diagram-meta.ts` validates the untrusted wire projection (`result.meta`) into a discriminated-union render view; any violation returns null and the card falls back.
- `src/client/DiagramSvg.tsx` is a pure, dependency-free SVG renderer over the validated elements — no Excalidraw runtime is bundled (client bundles load eagerly, so the ~1.5 MB editor is deferred to the interactive whiteboard phase).
- `src/client/DiagramCard.tsx` derives the card state (pending/failed/rendered/no-preview) from the block kind, `isError`, and the parsed meta, and threads the file argument to the owner's `openFile`.
- `src/client/index.ts` registers the `diagram` locale namespace and the keyed `tool.call.toolview` row.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-diagram`](../../../packages/drawing/diagram/README.md) — the tool that produces the `.excalidraw` files and the persisted projection this card renders.
- [Tool card presentation](../../../.agents/notes/implemented/architecture/2026-08-23-client-derived-tool-presentation.md) — how Web cards derive from raw events.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser-side card that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Read-only preview** — the card never edits; the interactive whiteboard is a later phase that will reuse the same file contract.
- **Hachure fills render solid** — Excalidraw's sketchy `hachure` fill style is not reproduced; filled shapes draw with a solid fill.
- **Text is not measured** — the preview trusts the element's declared text box; very long labels can overflow their box visually (they are not clipped).

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
