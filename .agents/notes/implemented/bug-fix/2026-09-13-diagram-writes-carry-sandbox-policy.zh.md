# Agent Note: Diagram writes carry the calling session's sandbox policy

Status: implemented

[English](2026-09-13-diagram-writes-carry-sandbox-policy.md) | 中文

## Problem

`diagram` 工具与白板的 `diagram.save` Remote 会把目标解析到调用会话的工作区，随后调用 `ctx.fs.writeText` 写入时却不带单次调用的沙箱策略。受限文件系统正是从该策略推导可写根——缺省时退回不带会话的 `SandboxPolicyService.resolve()`，其根是配置的部署回退根而非会话工作区——因此在工作区不同于启动目录的会话里，`/diagram file:flow.excalidraw` 在会话自己的工作区上以 `FS_SANDBOX_DENIED` 失败。该缺陷一直潜伏，因为所有图表测试（含 Loader 组合测试）都挂载不受限的 `dsh-fs-local` 后端，没有任何用例把受限文件系统交给该工具。

## Decision

[`sandbox.ts`](../../../../packages/drawing/diagram/src/sandbox.ts) 负责这两半管线。`diagramSandboxPolicy(ctx, session)` 读取可选的 `sandboxPolicy` 服务，并为调用会话解析单次调用策略；调用方未指定会话时取无会话策略；未挂载策略服务时返回 `undefined`（此时文件系统不受限，无需策略）。`diagramResolutionCwd(policy, sessionCwd)` 在存在策略时返回其工作区根，否则返回会话 cwd，使路径解析与文件系统限制按构造共享同一个根。

两条工具路径都使用它们：`diagram` 把解析出的策略传给 `writeDiagram`，由后者将其作为 `ctx.fs.writeText` 的第五个参数标注；`diagram_read` 以同样方式解析路径，但读取不受限。`DiagramRemote.save` 通过 `ctx.sessions` 解析请求中的 `sessionId`，解析该会话的策略并传给 `writeText`；`DiagramRemote.read` 使用无会话策略，因为根作用域的白板面板不指定会话。`diagram/saved` 事件现在接收策略已经查到的那个 `Session`，因此一次保存只做一次查找。`@deepseek-ai/dsh-sandbox` 与 `@deepseek-ai/dsh-sandbox-policy` 为 peer 依赖，与 `tool-fs` 一致。

## Alternatives considered

**让文件系统退回写入会话，而不是由调用方提供策略。** 否决：`SandboxedFileSystem.checkedTarget` 在该处拿不到会话，而文件系统服务被多个会话共享，因此唯一能命名会话的位置是持有 agent 会话的调用方。这正是 `write`/`edit` 工具既有约定。

**在 `writeDiagram` 内从 `actor` 参数解析策略。** 否决：actor 是观测身份而非会话；从它推导会话会把 write-intent 与观测座位耦合到会话查找上，并让没有 `ToolExecution` 的 Remote 路径无从取得策略。

**公开 `sandbox_permissions`/`justification` 并把拒绝映射到 `[sandbox: …]` 升级标记。** 推迟而非否决：图表工具目前没有升级路径，只映射拒绝标记会让模型去用其 schema 并不接受的字段。该缺口记录在本包 README 的已知限制中。

**让图表写入改走共享的 `write` 工具。** 否决：该工具拥有元素展开与整文档替换，委托要么会把展开后的 JSON 当成用户输入重新校验，要么绕过工具执行器自身的 schema。

## Consequences

工作区不同于启动目录的会话可以重新写入图表，且失败模式回到预期：同时落在会话工作区与回退根之外的目标仍被拒绝，磁盘上不留文件。原子写入路径、`fs/write-intent` waterfall 与 `fs/observed` 观测均未改变，无会话调用方仍使用部署回退根。

[`sandbox-policy.spec.ts`](../../../../packages/drawing/diagram/tests/sandbox-policy.spec.ts) 启动真实的 Loader 组合（会话投影、沙箱策略、受限文件系统、图表工具），把会话工作区与回退根作为同级目录放在所有自动临时可写授权之外，再用真实 `Session` 驱动已注册的工具：会话作用域写入落在会话工作区，无会话写入落在配置的根，两者之外的写入被拒绝且不留文件。`remote.spec.ts` 为 `DiagramRemote.save` 固定同样三件事。去掉策略标注后这些测试会失败。
