# Drawing

English | [中文](drawing.zh.md)

The diagram capability owned by the [`drawing/`](../../packages/drawing/README.md) group: the model-facing `diagram` tool writes deterministic Excalidraw `.excalidraw` documents from a validated shape spec, and the Web client renders them inline. Tool behavior, the shape spec, and configuration are on the [package README](../../packages/drawing/diagram/README.md); the browser card lives in [`@deepseek-ai/dsh-client-ui-diagram`](../../packages/client/ui-diagram/README.md).

Source: [`packages/drawing/diagram/src/expand.ts`](../../packages/drawing/diagram/src/expand.ts)

## The shape spec — one callable vocabulary

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

## Deterministic expansion

`expandShapes` maps each spec shape to an Excalidraw element with stable ids (`diagram-1`, …), relative connector points, and label texts as standalone centered text elements; `diagramBounds` computes the canvas size from the spec. The same spec always produces the same document — the `.excalidraw` file, the persisted `presentationMeta` projection, and the Web card's SVG preview all derive from that deterministic expansion.
