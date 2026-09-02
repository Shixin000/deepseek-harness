---
description: "drawing 组地图：面向模型的 diagram 工具，将 Excalidraw 格式的图表文件写入工作区，供浏览本组的用户与维护者阅读。"
kind: "package-group"
---

# packages/drawing

[English](README.md) | 中文

## 概述

drawing 组为 agent 提供一种确定性地生成可视化图表的方式：`diagram` 工具接受一份紧凑、经校验的形状规格，并将 [Excalidraw](https://excalidraw.com) 文件（`.excalidraw`）写入会话工作区。模型从不直接书写原始 Excalidraw JSON——工具会把规格展开为结构良好的元素，因此每个产物都能在兼容 Excalidraw 的编辑器中打开。交互式宿主会在聊天内联渲染产出的文件；本组负责工具与文件契约，渲染由 Web 客户端（`dsh-client-ui-diagram`）负责。

## 目录

- [包](#packages)
- [相关文档](#related-documentation)
- [开发备注](#dev-note)

-----

<a id="packages"></a>
## 包

| 包 | 职责 | ctx 键 |
|---|---|---|
| [`diagram`](diagram/README.zh.md) | 让 agent 从结构化形状规格创建或替换 Excalidraw 图表文件 | 注册到 `ctx.tools` |

-----

<a id="related-documentation"></a>
## 相关文档

- [画图子系统](../../docs/subsystems/drawing.zh.md)——形状规格词汇与确定性展开契约。
- [生成的工具目录](../../docs/tool-catalog.zh.md#deepseek-aidsh-diagram)——模型接收的 `diagram` schema。
- [生成的配置目录](../../docs/config-catalog.zh.md#deepseek-aidsh-diagram)——每个受支持配置字段。
- [Web 客户端图表卡片](../../packages/client/ui-diagram/README.zh.md)——产出图表的只读内联渲染。
- [Excalidraw 文件格式](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/transform.md)——工具写入的磁盘 `.excalidraw` 文档。

-----

<a id="dev-note"></a>
## 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
