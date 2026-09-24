---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-09-23-diagram-saved-event

[English](2026-09-23-diagram-saved-event.md) | 中文

## 概述

新增仅日志的 `diagram/saved` Session 事件，记录通过 diagram Remote 保存画布时写入的工作区路径与元素数量。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

属于追加且仅日志的变更：已有记录仍然有效，现有事件、字段与信封均未改变，读取时也不要求该事件存在。它记录的 UI 状态本就可由工具结果推导，因此不认识该类型的构建仍能回放并提供该会话；缺少该事件只表示没有记录到画布保存。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/client/ui-diagram packages/client/ui-diagram-canvas packages/drawing/diagram：共 137 个测试，除 5 个需要在工作区之外调用 mkdtemp、在本地沙箱下以 EPERM 失败外全部通过。pnpm run typecheck：0 个错误。pnpm run build：记录 267 个客户端产物。

<a id="dev-note"></a>
## 开发备注

无。
