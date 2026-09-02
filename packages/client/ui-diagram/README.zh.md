---
description: "Web 图表工具卡片：diagram 工具产出的 .excalidraw 图表的内联只读 SVG 渲染，供画图能力的使用者与维护者阅读。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-diagram

[English](README.md) | 中文

## 概述

`dsh-client-ui-diagram` 在会话中内联渲染 `diagram` 工具调用：一张紧凑卡片，包含产出文件、形状数量、打开动作，以及一张无依赖的 SVG 图表预览。卡片的一切都从原始线上调用/结果切片派生（包括持久化的 `result.meta` 投影），因此实时与回放渲染完全一致；畸形或不支持的数据会退化为"暂无预览"提示，而不会崩溃。

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

与产出图表的工具一同挂载：

```yaml
- name: '@deepseek-ai/dsh-client-ui-diagram'
```

会话中的每次 `diagram` 调用都会出现卡片。运行中的调用显示"正在生成"提示；失败的调用显示失败提示；已完成的调用把经校验的 `result.meta` 元素渲染为内联 SVG，头部显示文件名与形状数量。**打开**动作调用会话文件打开器；仅在已完成的成功调用且文件参数可解析时提供。

### SVG 预览

预览渲染 `dsh-diagram` 工具发出的 Excalidraw 元素子集：矩形（可选圆角）、椭圆、菱形、文本（多行，遵循 `textAlign`/`verticalAlign`）、直线与带箭头的箭头。描边颜色/宽度、虚线样式、填充色与透明度均生效；`backgroundColor: 'transparent'` 表示不填充。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部——点击展开</summary>

- `src/client/diagram-meta.ts` 把不可信的线上投影（`result.meta`）校验为判别联合渲染视图；任何违规都返回 null 并由卡片回退。
- `src/client/DiagramSvg.tsx` 是基于已校验元素的纯、零依赖 SVG 渲染器——不打包 Excalidraw 运行时（客户端 bundle 急切加载，约 1.5 MB 的编辑器推迟到交互白板阶段）。
- `src/client/DiagramCard.tsx` 从块类型、`isError` 与解析后的 meta 派生卡片状态（进行中/失败/已渲染/无预览），并把文件参数传给所有者的 `openFile`。
- `src/client/index.ts` 注册 `diagram` 语言命名空间与 keyed `tool.call.toolview` 行。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [`dsh-diagram`](../../../packages/drawing/diagram/README.zh.md)——产出 `.excalidraw` 文件与本卡片渲染的持久化投影的工具。
- [工具卡片展示](../../../.agents/notes/implemented/architecture/2026-08-23-client-derived-tool-presentation.zh.md)——Web 卡片如何从原始事件派生。

-----

<a id="model-experience"></a>
## 模型体验

无——本包是浏览器侧卡片，不注册任何面向模型的内容。

#### KV 缓存影响

无——本包既不组装也不发送任何 provider 请求。

<a id="known-limitations-and-deferred-work"></a>

## 已知限制与延期工作

- **只读预览**——卡片从不编辑；交互白板是后续阶段，将复用同一文件契约。
- **Hachure 填充渲染为实心**——Excalidraw 的草图式 `hachure` 填充样式不会复现；带填充的形状以实心渲染。
- **文本不做测量**——预览信任元素声明的文本框；很长的标签可能视觉上溢出其盒子（不会被裁剪）。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
