---
description: "The drawing group map: the model-facing diagram tool that writes Excalidraw-format diagram files into the workspace, for users and maintainers navigating the group."
kind: "package-group"
---

# packages/drawing

English | [中文](README.zh.md)

## Summary

The drawing group gives agents a deterministic way to produce visual diagrams: the `diagram` tool accepts a compact, validated shape spec and writes an [Excalidraw](https://excalidraw.com) file (`.excalidraw`) into the session workspace. The model never writes raw Excalidraw JSON — the tool expands the spec into well-formed elements, so every artifact opens in Excalidraw-compatible editors. Interactive hosts render the produced file inline; the group itself ships the tool and the file contract, with rendering owned by the Web client (`dsh-client-ui-diagram`).

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

| Package | Role | ctx key |
|---|---|---|
| [`diagram`](diagram/README.md) | Lets the agent create or replace Excalidraw diagram files from a structured shape spec | registers on `ctx.tools` |

-----

<a id="related-documentation"></a>
## Related documentation

- [Drawing subsystem](../../docs/subsystems/drawing.md) — the shape spec vocabulary and deterministic expansion contract.
- [Generated tool catalog](../../docs/tool-catalog.md#deepseek-aidsh-diagram) — the `diagram` schema the model receives.
- [Generated configuration catalog](../../docs/config-catalog.md#deepseek-aidsh-diagram) — every accepted config field.
- [Web client diagram card](../../packages/client/ui-diagram/README.md) — the read-only inline rendering of produced diagrams.
- [Excalidraw file format](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/transform.md) — the on-disk `.excalidraw` document the tool writes.

-----

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
