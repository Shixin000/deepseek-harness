# Agent Note：`diagram` 工具——基于经校验形状规格的确定性 Excalidraw 图表

Status: implemented

[English](2026-08-31-diagram-tool-excalidraw.md) | 中文

## 问题

harness 给了模型 bash、文件系统与 web 工具，却没有产出可视化图表的方式。流程图、架构草图或线框图是用户最常要求的产物，且没有任何参考 coding agent 提供绘图原语——它们都退而求其次用 `write` 手写 ASCII 图或临时 SVG。原始 Excalidraw JSON 是糟糕的模型面向格式：元素 schema 庞大，id/seed/version 全是样板，无效文档还会在编辑器中静默失败。

## 决策

新增面向模型的 `diagram(file, elements)` 工具，把确定性的 Excalidraw `.excalidraw` 文档写入会话工作区；同时新增浏览器卡片（`@deepseek-ai/dsh-client-ui-diagram`），把产出的文件内联渲染为无依赖的 SVG。

### 模型说六种形状的规格，绝不写原始 Excalidraw JSON

工具接受一份紧凑、经校验的词汇——`rect`/`ellipse`/`diamond`（各带可选的居中文本）、`text` 与经过点列表的 `line`/`arrow`——全部使用画布坐标。`packages/drawing/diagram` 校验运行时 schema 无法表达的约束（有限几何值、正尺寸、连线点数、颜色格式、有界的描边/字号/透明度字段），并把规格确定性地展开为带稳定 id（`diagram-1`、…）、相对连线点与独立居中文本标签的 Excalidraw 元素。同样的规格总是产生同样的文档——文件、持久化投影与 Web 卡片预览都派生自这一确定性展开。

### 小 canonical 值，元素只存在于可回放投影中

canonical 结果是 `{ path, elementCount, width, height }`；模型永远看不到展开后的元素列表。元素以 `presentationMeta` 的形式持久化在 `tool/result` 上（受 `maxMetaBytes` 限制，默认 512 KB），因此 Web 卡片在实时与回放时渲染完全一致，无需重读文件、也不触碰模型上下文。

### 不带 Excalidraw 运行时做只读渲染

Web 卡片把经校验的 `result.meta` 元素渲染为内联 SVG（`DiagramSvg`），刻意零依赖。客户端 bundle 是启动时急切加载的单文件 CJS——约 1.5 MB 的 `@excalidraw/excalidraw` 编辑器会进入每次启动路径且无法代码分割。需要为其体积买单的交互白板阶段被推迟；`.excalidraw` 文件契约已经就位。

### 写入走会话文件系统

`write.ts` 组装最小稳定 Excalidraw 信封（`type: 'excalidraw'`、`version: 2`、`elements`、`appState`、`files`），并通过 `ctx.fs` 写入，走共享的 `fs/write-intent` waterfall 与 `fs/observed` `present` 观测——会话的沙箱与观测策略对图表文件与其他工具输出一视同仁。工具与 fs 工具一起注册进标准 agent preset。

## 为什么没有 cordis-catalog 条目 / 没有 `@mode`

不适用——工具是普通 `ctx.tools` 注册，无类型化事件或模式声明。

## 备选方案

**让模型通过 `write` 直接书写原始 Excalidraw JSON。** 已拒绝：元素 schema 庞大，id/seed/version 全是样板，无效文档还会在编辑器中静默失败。结构化规格让模型面向面保持小巧，校验反馈明确。

**用嵌入的 `@excalidraw/excalidraw` 组件以 view mode 渲染。** 第一阶段已拒绝：客户端 bundle 是启动时急切加载的单文件 CJS，约 1.5 MB 的编辑器会进入每次启动路径且无法代码分割。零依赖的 SVG 渲染器只画经校验的元素子集，保持启动轻量且卡片可完全 jsdom 测试；为编辑器体积买单的交互白板阶段被推迟。

**保持模型面向结果丰富。** 已拒绝：展开后的元素从不进入模型。canonical 值保持在 `{ path, elementCount, width, height }`，元素只持久化在可回放的 `presentationMeta` 投影中，因此大图表对模型上下文零开销。

**走独立的图表专用存储路径写入。** 已拒绝：写入经 `ctx.fs` 与共享的 `fs/write-intent` waterfall 及 `fs/observed` 观测，会话的沙箱与观测策略对图表文件与其他工具输出一视同仁。

## 影响

`diagram` 工具对模型可见：它为每个标准 preset agent 增加工具 schema 与 `tool:diagram` 提示词分节，因此组合该工具时，录制会话快照与依赖提示词的 golden 会变化。

图表文件与其他产出文件一样是工作区产物：出现在 deliverables 行，可通过会话打开器打开，并受文件系统观测策略约束。

Web 卡片只渲染经校验的元素子集（rect/ellipse/diamond/text/line/arrow）；日后在展开中新增元素种类，必须在同一变更中同步加入渲染器与其校验器，否则卡片退化为"暂无预览"提示。

## 验证

- `packages/drawing/diagram`：29 个单元/集成测试，逐文件 100% 语句/分支覆盖；Loader 组合测试证明 `maxElements` 是来自 `cordis.yml` 的真实可配置项。
- `packages/client/ui-diagram`：50 个测试（jsdom 组件测试 + 注册/HMR 移除测试），100% 覆盖；线上投影解析器（`diagram-meta`）在卡片渲染前拒绝每个畸形字段。
- 重新生成 `docs/tool-catalog.md` 与 `docs/config-catalog.md`（双语）、新增 `docs/subsystems/drawing.md` 页面、双语包/组 README，以及 `TOOL_DIAGRAM` 提示词分节插槽。
