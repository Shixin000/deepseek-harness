---
description: "The Web interactive Excalidraw whiteboard: open and edit .excalidraw diagrams produced by the diagram tool, for users and maintainers of the drawing capability."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-diagram-canvas

English | [中文](README.zh.md)

## Summary

`dsh-client-ui-diagram-canvas` turns the read-only diagram card into an interactive whiteboard: a full-screen Excalidraw editor overlay (registered in the `shell.overlay` seat) where you can open a `.excalidraw` file produced by the `diagram` tool, edit it with the full Excalidraw toolset, save the scene back into the session workspace through the `diagram.save` Remote, reload the on-disk revision through `diagram.read`, and export the scene as a PNG download. The diagram card's **Open in editor** action contributes into the card's open-action chain, so the card package never depends on this panel.

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

Mount the plugin alongside `ui-diagram` and the Host gateway:

```yaml
- name: '@deepseek-ai/dsh-client-ui-diagram-canvas'
```

A settled `diagram` call now shows **Open in editor** beside the card's open action; clicking it mounts the whiteboard overlay seeded with the card's file path. The editor supports the full Excalidraw toolset; **Save** serializes the scene (`serializeAsJSON`) and writes it through `ctx.remote.diagram.save`, clearing the dirty marker on success; **Reload from disk** re-reads the file through `ctx.remote.diagram.read` and replaces the scene cleanly (remounting the editor through the store's `revision` key, since Excalidraw reads `initialData` only at mount); **Export PNG** renders the scene through `exportToBlob` and downloads it in the browser.

### The shared canvas instance

The overlay and the open action share one canvas instance (open/path/scene/dirty state) created in the plugin's `apply`. A store handle cannot mount in two scopes — `shell.overlay` is root-scoped while the card chain is session-scoped — so the instance travels through the registrations' inject faces instead.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

- `canvas-store.ts` declares the shared state and the complete write set (`open`/`close`/`setScene`/`markSaved`/`load`, with the `revision` editor remount key).
- `CanvasPanel.tsx` subscribes to the shared instance, renders the Excalidraw editor (stubbed in tests), forwards every `onChange` into the instance, and wires Save, Reload, Export, and Close through the injected bridges.
- `OpenInEditorButton.tsx` occupies the `diagram.card.open` chain with a `select` that accepts exactly non-empty file paths.
- `reload.ts` parses a `.excalidraw` document's text back into a live scene through Excalidraw's `restore`; malformed payloads resolve null.
- `export.ts` renders the live scene to a PNG blob and triggers a browser download.
- `src/client/index.ts` creates the canvas instance, registers the overlay and the open action, and builds the save/reload bridges over `ctx.remote.diagram.save`/`read`.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-diagram`](../../../packages/drawing/diagram/README.md) — the tool and the `diagram.save`/`diagram.read` Host gateway behind the bridge.
- [`ui-diagram`](../ui-diagram/README.md) — the read-only card whose open-action chain this panel extends.
- [Tool card presentation](../../../.agents/notes/implemented/architecture/2026-08-23-client-derived-tool-presentation.md) — how Web cards derive from raw events.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser-side panel that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Bundle size** — the Excalidraw editor (with its lazily loaded diagram libraries inlined) makes the panel's `lib/client.js` about 12 MB raw / ~3 MB gzip, downloaded at startup like every client bundle.
- **Panel saves do not carry a session id** — the overlay is root-scoped, so saves through the panel skip the `diagram/saved` session event; only callers that attach a session id record it.
- **Path policy** — the save/read bridge resolves paths through the Host `fs` seam; session-relative resolution is deferred.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
