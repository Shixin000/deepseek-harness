/**
 * Local validation of the persisted `diagram` tool projection (`result.meta`):
 * the wire value is untrusted, so the card derives its render view only after
 * every field it draws has been checked. Malformed or unsupported input
 * yields null and the card falls back to its generic presentation — a display
 * path must never crash a replay. Validated views are a discriminated union,
 * so each variant carries exactly the fields its renderer draws.
 * @module @deepseek-ai/dsh-client-ui-diagram/diagram-meta
 */

/** Fields every element shares after validation. */
export interface DiagramBaseView {
  id: string
  x: number
  y: number
  width: number
  height: number
  strokeColor: string
  backgroundColor: string
  strokeWidth: number
  strokeStyle: 'solid' | 'dashed'
  opacity: number
  roundness: { type: 3 } | null
}

/** A closed shape: rectangle, ellipse, or diamond. */
export interface DiagramShapeView extends DiagramBaseView {
  type: 'rectangle' | 'ellipse' | 'diamond'
}

/** A text label. */
export interface DiagramTextView extends DiagramBaseView {
  type: 'text'
  text: string
  fontSize: number
  textAlign: 'left' | 'center'
  verticalAlign: 'top' | 'middle'
}

/** A connector: line or arrow with absolute points. */
export interface DiagramConnectorView extends DiagramBaseView {
  type: 'line' | 'arrow'
  points: [number, number][]
  endArrowhead: 'arrow' | null
}

/** One validated element the SVG renderer draws. */
export type DiagramElementView = DiagramShapeView | DiagramTextView | DiagramConnectorView

/** Validated diagram projection the card renders. */
export interface DiagramMetaView {
  path: string
  width: number
  height: number
  elements: DiagramElementView[]
}

/** Hard cap on rendered elements; beyond it the card falls back. */
const MAX_RENDERED_ELEMENTS = 2000

const ELEMENT_TYPES = new Set(['rectangle', 'ellipse', 'diamond', 'text', 'line', 'arrow'])

/** Validate one element object into its render view, or null on any violation. */
function parseElement(value: unknown): DiagramElementView | null {
  if (typeof value !== 'object' || value === null) return null
  const element = value as Record<string, unknown>
  if (typeof element.id !== 'string' || element.id === '') return null
  if (typeof element.type !== 'string' || !ELEMENT_TYPES.has(element.type)) return null
  if (!isFiniteNumber(element.x) || !isFiniteNumber(element.y)) return null
  if (!isFiniteNumber(element.width) || element.width < 0 || !isFiniteNumber(element.height) || element.height < 0) return null
  if (typeof element.strokeColor !== 'string') return null
  if (typeof element.backgroundColor !== 'string') return null
  if (!isFiniteNumber(element.strokeWidth) || element.strokeWidth < 0) return null
  if (element.strokeStyle !== 'solid' && element.strokeStyle !== 'dashed') return null
  if (!isFiniteNumber(element.opacity) || element.opacity < 0 || element.opacity > 100) return null
  let roundness: { type: 3 } | null = null
  if (element.roundness !== null) {
    if (typeof element.roundness !== 'object') return null
    if ((element.roundness as Record<string, unknown>).type !== 3) return null
    roundness = { type: 3 }
  }
  const base: DiagramBaseView = {
    id: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    strokeColor: element.strokeColor,
    backgroundColor: element.backgroundColor,
    strokeWidth: element.strokeWidth,
    strokeStyle: element.strokeStyle,
    opacity: element.opacity,
    roundness,
  }
  const type = element.type as DiagramElementView['type']
  switch (type) {
    case 'rectangle':
    case 'ellipse':
    case 'diamond':
      return { ...base, type }
    case 'text': {
      if (typeof element.text !== 'string') return null
      if (element.fontSize !== undefined && !isFiniteNumber(element.fontSize)) return null
      if (element.textAlign !== undefined && element.textAlign !== 'left' && element.textAlign !== 'center') return null
      if (element.verticalAlign !== undefined && element.verticalAlign !== 'top' && element.verticalAlign !== 'middle') return null
      return {
        ...base,
        type,
        text: element.text,
        fontSize: element.fontSize === undefined ? 20 : element.fontSize,
        textAlign: element.textAlign === undefined ? 'left' : element.textAlign,
        verticalAlign: element.verticalAlign === undefined ? 'top' : element.verticalAlign,
      }
    }
    case 'line':
    case 'arrow': {
      if (!Array.isArray(element.points) || element.points.length < 2) return null
      const points: [number, number][] = []
      for (const point of element.points) {
        if (!Array.isArray(point) || point.length !== 2 || !isFiniteNumber(point[0]) || !isFiniteNumber(point[1])) return null
        points.push([point[0], point[1]])
      }
      if (element.endArrowhead !== undefined && element.endArrowhead !== null && element.endArrowhead !== 'arrow') return null
      return {
        ...base,
        type,
        points,
        endArrowhead: element.endArrowhead === 'arrow' ? 'arrow' : null,
      }
    }
  }
}

/**
 * Validate the persisted projection into the render view, or null.
 * @param meta - the raw `result.meta` wire value from the `diagram` tool.
 * @returns the validated render view, or null when any field is malformed or
 *   unsupported (the card then falls back to its generic presentation).
 */
export function parseDiagramMeta(meta: unknown): DiagramMetaView | null {
  if (typeof meta !== 'object' || meta === null) return null
  const record = meta as Record<string, unknown>
  if (typeof record.path !== 'string' || record.path === '') return null
  if (!isFiniteNumber(record.width) || record.width < 0 || !isFiniteNumber(record.height) || record.height < 0) return null
  if (!Array.isArray(record.elements)) return null
  if (record.elements.length === 0 || record.elements.length > MAX_RENDERED_ELEMENTS) return null
  const elements: DiagramElementView[] = []
  for (const raw of record.elements) {
    const element = parseElement(raw)
    if (element === null) return null
    elements.push(element)
  }
  return { path: record.path, width: record.width, height: record.height, elements }
}

/** Whether a wire value is a finite number usable as geometry. */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
