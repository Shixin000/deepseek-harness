---
description: "面向模型的 diagram 工具：根据经校验的形状规格写出 Excalidraw 格式文件，供画图能力的使用者与维护者阅读。"
kind: "package-reference"
---

# @deepseek-ai/dsh-diagram

[English](README.md) | 中文

## 概述

`dsh-diagram` 让 agent 能以 [Excalidraw](https://excalidraw.com) 文件的形式产出可视化图表：`diagram` 工具接受一份紧凑的形状规格，校验它，确定性地展开为结构良好的 `.excalidraw` 文档，并通过会话的 `fs` 服务写入会话工作区。配套的 `diagram_read` 工具会汇总已有文档（类型、几何、标签、连线点），让模型无需解析原始 JSON 即可修改它。模型从不直接书写原始 Excalidraw JSON——元素展开由工具负责，因此每个产物都能在兼容 Excalidraw 的编辑器中打开，并能在 Web 客户端内联渲染。

## 目录

- [使用本包](#use-this-package)
- [形状规格](#the-shape-spec)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

挂载插件以注册 `diagram` 工具：

```yaml
- name: '@deepseek-ai/dsh-diagram'
```

### 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `maxElements` | `500` | 单次调用可接受的形状规格条数上限。 |
| `maxMetaBytes` | `524288` | 为回放保留的展示投影的序列化字节上限；超过后 Web 卡片退化为仅路径展示。 |

### 工具契约

`diagram` 接受 `file`（以 `.excalidraw` 结尾的工作区路径）和 `elements`（形状列表）。一次调用要么写入文档并返回 `{ path, elementCount, width, height }`，要么失败并列出全部校验问题，让模型能一次迭代修正规格。canonical 返回值保持很小；展开后的元素只存在于可回放的 `presentationMeta` 投影中。

`diagram_read` 接受 `file` 并返回有界结构汇总：`elementCount`、画布 `width`/`height`，以及最多 200 条元素汇总（id、类型、几何、标签文本、连线点）；截断时携带 `truncated` 与真实总数。16 MB 读取上限会显式拒绝超大文件。

-----

<a id="the-shape-spec"></a>
## 形状规格

六种形状，全部使用画布坐标（x 向右，y 向下）：

| 种类 | 字段 | 说明 |
|---|---|---|
| `rect` | `x y w h`、`text?`、`rounded?` | 标签文本居中渲染。 |
| `ellipse` | `x y w h`、`text?` | 标签文本居中渲染。 |
| `diamond` | `x y w h`、`text?` | 标签文本居中渲染。 |
| `text` | `x y text`、`w? fontSize? color?` | 独立标签。 |
| `line` | `points: [{x,y}, …]` | 至少 2 个点。 |
| `arrow` | `points: [{x,y}, …]` | 箭头位于最后一个点。 |

除 `text` 外的每种形状还接受 `strokeColor`、`fillColor`（十六进制三元组或 CSS 命名颜色）、`dashed`、`strokeWidth`（1–50）与 `opacity`（0–100）；`text` 接受 `color` 与 `fontSize`（8–96）。展开是确定性的：同样的规格总是产生同样的文档（稳定的 id、seed 与 version）。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部——点击展开</summary>

- `src/spec.ts` 校验运行时 schema 无法表达的约束：有限几何值、正尺寸、连线点数、颜色格式与有界字段。
- `src/expand.ts` 把每种规格形状映射为 Excalidraw 元素（`rectangle`/`ellipse`/`diamond`/`text`/`line`/`arrow`），带稳定 id（`diagram-1`、…）、相对连线点，形状标签展开为独立的居中文本元素；`diagramBounds` 根据规格计算画布尺寸。
- `src/write.ts` 组装 `.excalidraw` 信封（`type: 'excalidraw'`、`version: 2`、`elements`、`appState`、`files: {}`），并通过 `ctx.fs` 写入，走共享的 `fs/write-intent` waterfall 与 `fs/observed` `present` 观测，使会话的沙箱与观测策略生效。
- `src/read-tool.ts` 以与写入路径相同的校验精神解析并汇总已有文档：跳过畸形元素、几何值强制为有限数，汇总受元素上限约束并给出真实总数。
- `src/remote.ts` 支撑交互白板（`diagram.save`/`diagram.read` Remote 方法），并在调用方附带会话 id 时记录仅日志的 `diagram/saved` 会话事件。
- `src/index.ts` 注册两个工具、`tool:diagram` 与 `tool:diagram_read` 系统提示分节，以及可回放的 `presentationMeta` 投影。
- 不发布运行时不变式伴生入口：工具注册属于注册表持有的效应（释放由 HMR 安全规范证明），校验/展开管线对输入是纯函数；本包不发出任何 cordis 事件。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [生成的工具目录](../../../docs/tool-catalog.zh.md#deepseek-aidsh-diagram)——模型接收的精确 schema。
- [Web 客户端图表卡片](../../../packages/client/ui-diagram/README.zh.md)——内联只读渲染。
- [Excalidraw 文件格式](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/transform.md)——磁盘文档契约。

-----

<a id="model-experience"></a>
## 模型体验

### 请求上下文与条件

#### 模型看到什么

只要挂载本插件，`diagram` 与 `diagram_read` 工具就会出现在工具 schema 及其系统提示指引分节中：工具的 `parameters`、`tool:diagram`/`tool:diagram_read` 散文，以及每次结果中的 `<path>`/`<type>`/`<content>` 信封。canonical 值只携带 `path`、`elementCount`、`width` 与 `height`（读取时另有有界元素汇总）——绝不含展开后的写入元素。

#### Token 影响

每次调用固定：schema（约 2.5 KB）、分节散文（约 200 token）与简短的结果信封。展开后的元素列表从不进入模型。

#### KV 缓存影响

工具 schema 与分节属于按 agent 预设组装的稳定前缀的一部分；本包在请求之间不产生任何变化，因此不会使已可复用的前缀失效。

<a id="known-limitations-and-deferred-work"></a>

## 已知限制与延期工作

- **交互白板属于 Web 客户端职责**——交互编辑器在 ui-diagram-canvas 包中；本包只负责写入、读取与服务文件。
- **标签文本是独立元素**——形状标签不是绑定的 Excalidraw 文本（无 `containerId`/`boundElements`），在编辑器中移动形状不会带动其标签。
- **圆角矩形使用单一圆角预设**——`rounded` 标志映射到固定圆角半径；无法表达逐角半径。
- **连线端点自由、不绑定**——箭头/直线从不吸附形状（`startBinding`/`endBinding` 为 null），在编辑器中调整形状不会拖动连线。
- **Excalidraw schema 的部分字段固定**——angle、roughness 与 seed 恒定；规格无法表达旋转或粗糙度变化。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
