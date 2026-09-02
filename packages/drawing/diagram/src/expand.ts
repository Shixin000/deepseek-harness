/**
 * Deterministic expansion of the {@link DiagramShape} spec into Excalidraw
 * element JSON: every element carries stable ids, seeds, and versions, so a
 * given spec always produces the same document. Connector points are stored
 * relative to the element's top-left origin (Excalidraw's convention), and
 * shape labels become standalone text elements centered on the shape.
 * @module @deepseek-ai/dsh-diagram/expand
 */

import {
  DEFAULT_FILL_COLOR, DEFAULT_FONT_SIZE, DEFAULT_STROKE_COLOR, DEFAULT_STROKE_WIDTH,
  DEFAULT_TEXT_COLOR,
} from './spec.ts'
import type { DiagramPoint, DiagramShape } from './spec.ts'

/** Minimal Excalidraw element fields this package emits (a stable subset of the upstream schema). */
export type ExcalidrawElement = {
  id: string
  type: 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'line' | 'arrow'
  x: number
  y: number
  width: number
  height: number
  angle: 0
  strokeColor: string
  backgroundColor: string
  fillStyle: 'hachure' | 'solid'
  strokeWidth: number
  strokeStyle: 'solid' | 'dashed'
  roughness: 1
  opacity: number
  groupIds: []
  frameId: null
  roundness: { type: 3 } | null
  seed: number
  version: 1
  versionNonce: 1
  isDeleted: false
  boundElements: null
  updated: 1
  link: null
  locked: false
}

/** Text-only element fields appended to the base element. */
export type ExcalidrawTextElement = ExcalidrawElement & {
  type: 'text'
  text: string
  fontSize: number
  fontFamily: 1
  textAlign: 'left' | 'center'
  verticalAlign: 'top' | 'middle'
  containerId: null
  originalText: string
  autoResize: true
  lineHeight: 1.25
}

/** Connector (line/arrow) element fields appended to the base element. */
export type ExcalidrawConnectorElement = ExcalidrawElement & {
  type: 'line' | 'arrow'
  points: [number, number][]
  lastCommittedPoint: null
  startBinding: null
  endBinding: null
  startArrowhead: null
  endArrowhead: 'arrow' | null
}

/** Any element this package writes into a `.excalidraw` document. */
export type ExpandedElement = ExcalidrawElement | ExcalidrawTextElement | ExcalidrawConnectorElement

/**
 * Deterministic per-document element id: `diagram-1`, `diagram-2`, …
 * @param index - the 1-based element position in the document.
 * @returns the stable element id.
 */
export function elementId(index: number): string {
  return `diagram-${index}`
}

/**
 * Expand a validated shape spec into Excalidraw elements. Shape labels become
 * standalone text elements placed after their shape; the returned order is
 * stable and the total element count includes those label texts.
 * @param shapes - the validated element list (see {@link validateShapes}).
 * @returns the expanded elements in spec order.
 */
export function expandShapes(shapes: readonly DiagramShape[]): ExpandedElement[] {
  const elements: ExpandedElement[] = []
  let index = 0
  for (const shape of shapes) {
    const id = elementId(index + 1)
    switch (shape.kind) {
      case 'rect': {
        elements.push(closedShapeElement(id, 'rectangle', shape.x, shape.y, shape.w, shape.h, shape, {
          roundness: shape.rounded === true ? { type: 3 } : null,
        }))
        if (shape.text !== undefined) {
          elements.push(labelElement(elementId(index + 2), shape.text, shape.x, shape.y, shape.w, shape.h))
          index += 1
        }
        break
      }
      case 'ellipse':
        elements.push(closedShapeElement(id, 'ellipse', shape.x, shape.y, shape.w, shape.h, shape, {
          roundness: null,
        }))
        if (shape.text !== undefined) {
          elements.push(labelElement(elementId(index + 2), shape.text, shape.x, shape.y, shape.w, shape.h))
          index += 1
        }
        break
      case 'diamond':
        elements.push(closedShapeElement(id, 'diamond', shape.x, shape.y, shape.w, shape.h, shape, {
          roundness: null,
        }))
        if (shape.text !== undefined) {
          elements.push(labelElement(elementId(index + 2), shape.text, shape.x, shape.y, shape.w, shape.h))
          index += 1
        }
        break
      case 'text':
        elements.push(textElement(id, shape))
        break
      case 'line':
        elements.push(connectorElement(id, 'line', shape.points, shape))
        break
      case 'arrow':
        elements.push(connectorElement(id, 'arrow', shape.points, shape))
        break
    }
    index += 1
  }
  return elements
}

/**
 * Bounding box of the whole diagram in canvas coordinates.
 * @param shapes - the validated element list.
 * @returns the box; a zero-size box when the list is empty.
 */
export function diagramBounds(shapes: readonly DiagramShape[]): { width: number; height: number } {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const shape of shapes) {
    let box: { x: number; y: number; right: number; bottom: number }
    if (shape.kind === 'line' || shape.kind === 'arrow') {
      box = pointsBox(shape.points)
    } else if (shape.kind === 'text') {
      const size = textElementBox(shape)
      box = { x: shape.x, y: shape.y, right: shape.x + size.w, bottom: shape.y + size.h }
    } else {
      box = { x: shape.x, y: shape.y, right: shape.x + shape.w, bottom: shape.y + shape.h }
    }
    minX = Math.min(minX, box.x)
    minY = Math.min(minY, box.y)
    maxX = Math.max(maxX, box.right)
    maxY = Math.max(maxY, box.bottom)
  }
  if (shapes.length === 0) return { width: 0, height: 0 }
  return { width: maxX - minX, height: maxY - minY }
}

/** Shared element fields for every expanded element. */
function baseElement(id: string, type: ExcalidrawElement['type'], style: {
  strokeColor?: string
  fillColor?: string
  dashed?: boolean
  strokeWidth?: number
  opacity?: number
}, x: number, y: number, width: number, height: number, extra: {
  backgroundColor?: string
  fillStyle?: 'hachure' | 'solid'
  roundness?: { type: 3 } | null
}): ExcalidrawElement {
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: style.strokeColor ?? DEFAULT_STROKE_COLOR,
    backgroundColor: extra.backgroundColor ?? style.fillColor ?? DEFAULT_FILL_COLOR,
    fillStyle: extra.fillStyle ?? (style.fillColor === undefined ? 'hachure' : 'solid'),
    strokeWidth: style.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    strokeStyle: style.dashed === true ? 'dashed' : 'solid',
    roughness: 1,
    opacity: style.opacity ?? 100,
    groupIds: [],
    frameId: null,
    roundness: extra.roundness ?? null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
  }
}

/** A rectangle/ellipse/diamond element. */
function closedShapeElement(
  id: string,
  type: 'rectangle' | 'ellipse' | 'diamond',
  x: number,
  y: number,
  w: number,
  h: number,
  shape: Extract<DiagramShape, { kind: 'rect' | 'ellipse' | 'diamond' }>,
  extra: { roundness: { type: 3 } | null },
): ExcalidrawElement {
  return baseElement(id, type, shape, x, y, w, h, {
    ...extra,
  })
}

/** A standalone text element; the box is centered when the spec supplies no width. */
function textElement(id: string, shape: Extract<DiagramShape, { kind: 'text' }>): ExcalidrawTextElement {
  const fontSize = shape.fontSize ?? DEFAULT_FONT_SIZE
  const { w, h } = textElementBox(shape)
  return {
    ...baseElement(id, 'text', {}, shape.x, shape.y, w, h, {
      backgroundColor: 'transparent',
    }),
    type: 'text',
    text: shape.text,
    fontSize,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    originalText: shape.text,
    autoResize: true,
    lineHeight: 1.25,
    strokeColor: shape.color ?? DEFAULT_TEXT_COLOR,
  }
}

/** The text element's box: the spec width when given, else the estimate. */
function textElementBox(shape: Extract<DiagramShape, { kind: 'text' }>): { w: number; h: number } {
  const fontSize = shape.fontSize ?? DEFAULT_FONT_SIZE
  if (shape.w !== undefined) return { w: shape.w, h: estimateTextHeight(shape.text, fontSize) }
  const [w, h] = estimateTextBox(shape.text, fontSize)
  return { w, h }
}

/** A centered label text element overlaying its shape's box. */
function labelElement(
  id: string,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
): ExcalidrawTextElement {
  const fontSize = DEFAULT_FONT_SIZE
  return {
    ...baseElement(id, 'text', {}, x, y, w, h, {
      backgroundColor: 'transparent',
    }),
    type: 'text',
    text,
    fontSize,
    fontFamily: 1,
    textAlign: 'center',
    verticalAlign: 'middle',
    containerId: null,
    originalText: text,
    autoResize: true,
    lineHeight: 1.25,
    strokeColor: DEFAULT_TEXT_COLOR,
  }
}

/** A line/arrow element with points stored relative to its top-left origin. */
function connectorElement(
  id: string,
  type: 'line' | 'arrow',
  points: readonly DiagramPoint[],
  shape: Extract<DiagramShape, { kind: 'line' | 'arrow' }>,
): ExcalidrawConnectorElement {
  const box = pointsBox(points)
  const relative = points.map(point => [point.x - box.x, point.y - box.y] as [number, number])
  return {
    ...baseElement(id, type, shape, box.x, box.y, box.right - box.x, box.bottom - box.y, {
      backgroundColor: 'transparent',
    }),
    type,
    points: relative,
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: type === 'arrow' ? 'arrow' : null,
  }
}

/** Bounding box of a point list. */
function pointsBox(points: readonly DiagramPoint[]): { x: number; y: number; right: number; bottom: number } {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return { x: minX, y: minY, right: maxX, bottom: maxY }
}

/**
 * Estimate a text box: wide (CJK) code points count one em, narrow ones 0.55
 * em, times the font size; the height grows with line breaks.
 * @param text - the label text to measure.
 * @param fontSize - the font size in px.
 * @returns the estimated box as `[width, height]`.
 */
export function estimateTextBox(text: string, fontSize: number): [number, number] {
  const width = Math.max(estimateTextWidth(text, fontSize), fontSize * 2)
  return [width, estimateTextHeight(text, fontSize)]
}

/** Estimated pixel width of one text line at the given font size. */
function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0
  for (const line of text.split('\n')) {
    let lineWidth = 0
    for (const codePoint of line) {
      lineWidth += codePoint > '\u2e7f' ? 1 : 0.55
    }
    width = Math.max(width, lineWidth * fontSize)
  }
  return width
}

/** Estimated pixel height of multi-line text at the given font size. */
function estimateTextHeight(text: string, fontSize: number): number {
  const lines = text.split('\n').length
  return lines * fontSize * 1.25
}
