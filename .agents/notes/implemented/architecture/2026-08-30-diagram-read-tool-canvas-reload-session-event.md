# Agent Note: Diagram read tool, canvas reload, and the `diagram/saved` session event

Status: implemented

English | [中文](2026-08-30-diagram-read-tool-canvas-reload-session-event.zh.md)

## Problem

The drawing capability shipped a model-facing `diagram` write tool and an interactive whiteboard panel that could only save. The model had no way to inspect an existing `.excalidraw` document before modifying it (it would have to parse raw Excalidraw JSON by hand), the panel could not re-read the on-disk revision after external edits, and canvas saves recorded no session event — so any future model-visible use of saved canvas content would violate the model-visible ⟺ logged rule.

## Decision

**`diagram_read` tool.** A second model-facing tool (`diagram_read`, 16 MB byte cap, 200-element summary cap) parses an existing `.excalidraw` document into a bounded structural summary: element count, canvas bounds, and per-element id/type/geometry/label/connector points. `elementCount` reports the document's true total even when truncation cuts the returned list, and the model-facing prose states the cap. It records an `fs/observed` `present` observation through the same seam as the write tool, so observation policy applies to reads too.

**System prompt guidance.** The plugin registers a `tool:diagram_read` section (order `TOOL_DIAGRAM_READ = 1260`, adjacent to the write tool's `1250`) telling the model to prefer the read tool over parsing raw JSON when modifying an existing diagram.

**Canvas reload and PNG export.** The whiteboard panel gains Reload-from-disk and Export-PNG actions. Reload goes through the new `diagram.read` Remote and Excalidraw's own `restore` (repairing element versions/bindings), then replaces the scene cleanly (non-dirty) and remounts the editor through a store-tracked `revision` key — required because the memoized Excalidraw component reads `initialData` only at mount. Export renders the scene through `exportToBlob` and triggers a browser download; both failures surface as panel errors, never crashes.

**`diagram/saved` session event.** The save Remote records a log-only `diagram/saved` event (`{ path, elementCount }`) when the caller attaches a session id; a session-less caller skips it. The event exists so a later model-visible use of saved canvas content is reconstructable from the session log.

**Host Remote `read`.** `DiagramRemote.read` reuses the write path's path policy (`.excalidraw` suffix, `ctx.fs.resolve`/`readBytes` with the same 16 MB cap).

## Alternatives considered

**Have the model read raw `.excalidraw` JSON with the existing `read` tool.** Rejected: raw Excalidraw JSON is noisy, versioned, and full of render state; a bounded structural summary is what the model actually needs to plan edits.

**Push the disk revision into the mounted editor via `excalidrawAPI.updateScene`.** Rejected in favor of the remount-key approach: `initialData` is the panel's only declared data channel, the remount is deterministic and testable, and the imperative API would need plumbing through the component props shares.

**Skip the session event until canvas content actually enters a model request.** Rejected: the rule requires the event to land with the read capability, and the Remote already carries the session context needed to record it.

## Consequences

The drawing capability is now a closed loop: the model writes diagrams, reads them back structurally, and the user can edit on disk through the whiteboard with reload and PNG export. The tool catalog, gen-tool-catalog golden, and web snapshots that embed the diagram guidance (`fresh-round-trip`, `cordis-tool-round`, `ptc-round`) all gained the new tool/section and must be regenerated with them. `elementCount` semantics differ between the read tool (true document total, possibly larger than the returned list) and the save event (parsed `elements.length`), which is intentional: the model needs the true total to notice truncation, the event only reports what was written.
