# Agent Note: 图表读取工具、画布重新加载与 `diagram/saved` 会话事件

Status: implemented

[English](2026-08-30-diagram-read-tool-canvas-reload-session-event.md) | 中文

## 问题

画图能力此前交付了面向模型的 `diagram` 写入工具和一个只能保存的交互式白板面板。模型在修改已有 `.excalidraw` 文档之前无法查看它（只能手工解析原始 Excalidraw JSON），面板无法在外部编辑后重读磁盘版本，画布保存也没有记录任何会话事件——任何未来把已保存的画布内容用于模型可见用途的做法都会违反 model-visible ⟺ logged 规则。

## 决策

**`diagram_read` 工具。** 第二个面向模型的工具（`diagram_read`，16 MB 字节上限、200 条元素汇总上限）把已有 `.excalidraw` 文档解析为有界结构汇总：元素总数、画布边界，以及每个元素的 id/类型/几何/标签/连线点。即使截断砍掉返回列表，`elementCount` 仍报告文档的真实总数，模型可见散文会说明上限。它与写入工具走同一 seam 记录 `fs/observed` `present` 观测，因此观测策略同样作用于读取。

**系统提示指引。** 插件注册 `tool:diagram_read` 分节（顺序 `TOOL_DIAGRAM_READ = 1260`，紧邻写入工具的 `1250`），告诉模型在修改已有图表时优先使用读取工具而非解析原始 JSON。

**画布重新加载与 PNG 导出。** 白板面板新增"从磁盘重新加载"与"导出 PNG"动作。重新加载经新的 `diagram.read` Remote 与 Excalidraw 自身的 `restore`（修复元素版本与绑定），然后干净地（非 dirty）替换场景，并通过 store 维护的 `revision` 键重挂编辑器——这是必需的，因为被 memo 化的 Excalidraw 组件只在挂载时读取 `initialData`。导出经 `exportToBlob` 渲染场景并触发浏览器下载；两种失败都显示为面板错误，绝不崩溃。

**`diagram/saved` 会话事件。** 保存 Remote 在调用方附带会话 id 时记录仅日志的 `diagram/saved` 事件（`{ path, elementCount }`）；无会话调用方跳过它。该事件的存在保证未来把已保存的画布内容用于模型可见用途时可以从会话日志重建。

**Host Remote `read`。** `DiagramRemote.read` 复用写入路径的路径策略（`.excalidraw` 后缀、`ctx.fs.resolve`/`readBytes`，同样的 16 MB 上限）。

## 备选方案

**让模型用现有 `read` 工具读原始 `.excalidraw` JSON。** 拒绝：原始 Excalidraw JSON 噪声大、带版本、充满渲染状态；有界结构汇总才是模型规划编辑时真正需要的东西。

**通过 `excalidrawAPI.updateScene` 把磁盘版本推入已挂载的编辑器。** 拒绝，改用重挂键方案：`initialData` 是面板唯一声明的数据通道，重挂是确定且可测的，而命令式 API 需要穿透组件 props shares 的额外管道。

**在画布内容真正进入模型请求之前跳过会话事件。** 拒绝：规则要求事件随读取能力一起落地，而 Remote 已经携带记录它所需的会话上下文。

## 后果

画图能力现在是闭环：模型写图、结构化读图，用户可以通过白板编辑磁盘文件，支持重新加载与 PNG 导出。工具目录、gen-tool-catalog 黄金列表，以及内嵌 diagram 指引的 Web 快照（`fresh-round-trip`、`cordis-tool-round`、`ptc-round`）都新增了该工具/分节，必须随之重新生成。读取工具与保存事件的 `elementCount` 语义不同——前者是文档真实总数（可能大于返回列表），后者是解析出的 `elements.length`——这是刻意的：模型需要真实总数来察觉截断，事件只需报告写入内容。
