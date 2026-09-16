# Agent Note: Diagram writes carry the calling session's sandbox policy

Status: implemented

English | [中文](2026-09-13-diagram-writes-carry-sandbox-policy.zh.md)

## Problem

The `diagram` tool and the whiteboard's `diagram.save` Remote resolved their target against the calling session's workspace, then wrote through `ctx.fs.writeText` without a per-call sandbox policy. A confining filesystem derives its writable roots from that policy — falling back to `SandboxPolicyService.resolve()` with no session, whose root is the configured deployment fallback rather than the session workspace — so `/diagram file:flow.excalidraw` inside a session whose workspace differs from the launch directory failed with `FS_SANDBOX_DENIED` on the session's own workspace. The defect stayed latent because every diagram test mounted the unfenced `dsh-fs-local` backend, including the Loader composition, so no suite ever handed the tool a fenced filesystem.

## Decision

[`sandbox.ts`](../../../../packages/drawing/diagram/src/sandbox.ts) owns both halves of the plumbing. `diagramSandboxPolicy(ctx, session)` reads the optional `sandboxPolicy` service and resolves the per-call policy for the calling session, or the agentless policy when the caller names none, or `undefined` when no policy service is mounted (the filesystem is then unfenced and needs no policy). `diagramResolutionCwd(policy, sessionCwd)` returns the policy's workspace root when one exists and the session cwd otherwise, so path resolution and the fence compare against the same root by construction.

Both tool paths use them: `diagram` passes the resolved policy to `writeDiagram`, which stamps it as the fifth argument of `ctx.fs.writeText`, and `diagram_read` resolves its path the same way while leaving reads unfenced. `DiagramRemote.save` resolves the requested `sessionId` through `ctx.sessions`, resolves that session's policy, and passes it to `writeText`; `DiagramRemote.read` uses the agentless policy because the root-scope whiteboard panel names no session. The `diagram/saved` event now takes the resolved `Session` the policy already looked up, so the save records one lookup instead of two. `@deepseek-ai/dsh-sandbox` and `@deepseek-ai/dsh-sandbox-policy` are peer dependencies, matching `tool-fs`.

## Alternatives considered

**Make the fence fall back to the writing session instead of the caller supplying a policy.** Rejected: `SandboxedFileSystem.checkedTarget` has no session at that point and the filesystem service is shared across sessions, so the caller — which does hold the agent's session — is the only place that can name it. This is the existing `write`/`edit` tool contract.

**Resolve the policy inside `writeDiagram` from the `actor` argument.** Rejected: the actor is an observation identity, not a session; deriving a session from it would couple the write-intent and observation slots to session lookup and leave the Remote path — which has no `ToolExecution` — without a policy.

**Advertise `sandbox_permissions`/`justification` and map denials to the `[sandbox: …]` escalation marker.** Deferred, not rejected: the diagram tools have no escalation path today, and mapping the denial marker without the parameters would point the model at fields its schema does not accept. The gap is recorded in the package README's limitations.

**Route diagram writes through the shared `write` tool.** Rejected: the tool owns element expansion and full-document replacement, so delegating would either re-validate the expanded JSON as user input or bypass the tool executor's own schema.

## Consequences

A session whose workspace differs from the launch directory can write diagrams again, and the failure mode is now the intended one: a target outside both the session workspace and the fallback root is still denied and leaves no file on disk. The atomic write path, the `fs/write-intent` waterfall, and the `fs/observed` observation are unchanged, and an agentless caller keeps its deployment fallback root.

[`sandbox-policy.spec.ts`](../../../../packages/drawing/diagram/tests/sandbox-policy.spec.ts) boots the real Loader composition (session projections, sandbox policy, sandboxed filesystem, diagram) with the session workspace and the fallback root as siblings outside every automatic temporary write grant, then drives the registered tool with a real `Session`: the session-scoped write lands in the session workspace, an agentless write lands in the configured root, and a write outside both is denied leaving no file. `remote.spec.ts` pins the same three facts for `DiagramRemote.save`. The tests fail without the policy stamp.
