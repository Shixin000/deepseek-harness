# 画图（Drawing）

[English](drawing.md) | 中文

由 [`drawing/`](../../packages/drawing/README.zh.md) 组拥有的图表能力：面向模型的 `diagram` 工具根据经校验的形状规格写入确定性的 Excalidraw `.excalidraw` 文档，Web 客户端将其内联渲染。工具行为、形状规格与配置见[包 README](../../packages/drawing/diagram/README.zh.md)；浏览器卡片位于 [`@deepseek-ai/dsh-client-ui-diagram`](../../packages/client/ui-diagram/README.zh.md)。

Source: [`packages/drawing/diagram/src/expand.ts`](../../packages/drawing/diagram/src/expand.ts)

## 形状规格——一套可调用的词汇

```ts ignore-check
/**
 * One shape in the `diagram` tool's element list. Six kinds, all in canvas
 * coordinates (x right, y down): closed shapes (rect/ellipse/diamond, each
 * with an optional centered label), standalone text, and connectors
 * (line/arrow through at least two points). Shared visual style fields are
 * optional; the expansion supplies defaults.
 */
type DiagramShape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; text?: string; rounded?: boolean }
  | { kind: 'ellipse'; x: number; y: number; w: number; h: number; text?: string }
  | { kind: 'diamond'; x: number; y: number; w: number; h: number; text?: string }
  | { kind: 'text'; x: number; y: number; text: string; w?: number; fontSize?: number; color?: string }
  | { kind: 'line'; points: { x: number; y: number }[] }
  | { kind: 'arrow'; points: { x: number; y: number }[] }
```

## 确定性展开

`expandShapes` 把每种规格形状映射为带稳定 id（`diagram-1`、…）的 Excalidraw 元素、相对连线点，以及作为独立居中文本元素的形状标签；`diagramBounds` 根据规格计算画布尺寸。同样的规格总是产生同样的文档——`.excalidraw` 文件、持久化的 `presentationMeta` 投影与 Web 卡片的 SVG 预览都派生自这一确定性展开。
