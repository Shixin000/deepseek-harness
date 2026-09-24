---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-09-23-diagram-saved-event

English | [中文](2026-09-23-diagram-saved-event.zh.md)

## Summary

Adds the log-only `diagram/saved` Session event, carrying the workspace path and element count of a canvas save through the diagram Remote.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-09-23-diagram-saved-event
baseline: false
changes:
  - root: "event:diagram/saved"
    previous: null
    after: "bfa9b4ef71ecd0a138acdd82088d8923929dd2a004aa48a7426e0165096006ef"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Additive and log-only: existing records remain valid, no existing event, field, or envelope changes, and the event is never required at read time. It records UI state already derivable from the tool result, so a build that does not know the type still replays and serves the session; absence of the event simply means no canvas save was recorded.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/client/ui-diagram packages/client/ui-diagram-canvas packages/drawing/diagram: 137 tests, all passing except 5 that need mkdtemp outside the workspace and fail with EPERM under the local sandbox. pnpm run typecheck: 0 errors. pnpm run build: recorded 267 client artifacts.

<a id="dev-note"></a>
## Dev Note

None.
