---
description: "Web 交互式 Excalidraw 白板：打开并编辑 diagram 工具产出的 .excalidraw 图表，供画图能力的使用者与维护者阅读。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-diagram-canvas

[English](README.md) | 中文

## 概述

`dsh-client-ui-diagram-canvas` 把只读图表卡片升级为交互式白板：一个全屏 Excalidraw 编辑器覆盖层（注册在 `shell.overlay` 座位），你可以打开 `diagram` 工具产出的 `.excalidraw` 文件，用完整的 Excalidraw 工具集编辑，通过 `diagram.save` Remote 把场景保存回会话工作区，通过 `diagram.read` 从磁盘重新加载，并把场景导出为 PNG 下载。图表卡片的**在编辑器中打开**动作贡献到卡片的打开动作链，因此卡片包不依赖本面板。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

与 `ui-diagram` 和 Host 网关一起挂载：

```yaml
- name: '@deepseek-ai/dsh-client-ui-diagram-canvas'
```

已完成的 `diagram` 调用现在会在打开动作旁显示**在编辑器中打开**；点击后挂载以卡片文件路径为初始内容的白板覆盖层。编辑器支持完整的 Excalidraw 工具集；**保存**会把场景序列化（`serializeAsJSON`）并经 `ctx.remote.diagram.save` 写入，成功后清除未保存标记；**从磁盘重新加载**经 `ctx.remote.diagram.read` 重读文件并干净地替换场景（通过 store 的 `revision` 键重挂编辑器——Excalidraw 只在挂载时读取 `initialData`）；**导出 PNG** 经 `exportToBlob` 渲染场景并在浏览器中下载。

### 共享画布实例

覆盖层与打开动作共享一个在插件 `apply` 中创建的画布实例（open/path/scene/dirty 状态）。store handle 不能挂载在两个 scope——`shell.overlay` 是 root scope，而卡片链是 session scope——因此实例经注册的 inject face 传递。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部——点击展开</summary>

- `canvas-store.ts` 声明共享状态与完整写集（`open`/`close`/`setScene`/`markSaved`/`load`，含 `revision` 编辑器重挂键）。
- `CanvasPanel.tsx` 订阅共享实例，渲染 Excalidraw 编辑器（测试中打桩），把每次 `onChange` 转发进实例，并经注入桥接好保存、重新加载、导出与关闭。
- `OpenInEditorButton.tsx` 以 `select` 谓词占据 `diagram.card.open` 链——恰好接受非空文件路径。
- `reload.ts` 把 `.excalidraw` 文档文本经 Excalidraw 的 `restore` 还原为实时场景；畸形载荷解析为 null。
- `export.ts` 把实时场景渲染为 PNG blob 并触发浏览器下载。
- `src/client/index.ts` 创建画布实例、注册覆盖层与打开动作，并构建基于 `ctx.remote.diagram.save`/`read` 的保存/读取桥。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [`dsh-diagram`](../../../packages/drawing/diagram/README.zh.md)——桥背后的工具与 `diagram.save`/`diagram.read` Host 网关。
- [`ui-diagram`](../ui-diagram/README.zh.md)——本面板扩展其打开动作链的只读卡片。
- [工具卡片展示](../../../.agents/notes/implemented/architecture/2026-08-23-client-derived-tool-presentation.zh.md)——Web 卡片如何从原始事件派生。

-----

<a id="model-experience"></a>
## 模型体验

无——本包是浏览器侧面板，不注册任何面向模型的内容。

#### KV 缓存影响

无——本包既不组装也不发送任何 provider 请求。

<a id="known-limitations-and-deferred-work"></a>

## 已知限制与延期工作

- **包体积**——Excalidraw 编辑器（含内联的懒加载图库）使面板的 `lib/client.js` 约 12 MB 原始 / ~3 MB gzip，与其他客户端 bundle 一样在启动时下载。
- **面板保存不携带会话 id**——覆盖层是 root scope，面板保存会跳过 `diagram/saved` 会话事件；只有附带会话 id 的调用方会记录它。
- **路径策略**——保存/读取桥经 Host `fs` seam 解析路径；按会话相对解析已延期。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
