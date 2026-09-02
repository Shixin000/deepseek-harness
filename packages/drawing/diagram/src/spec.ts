/**
 * The structured diagram spec the `diagram` tool accepts: a compact shape
 * vocabulary the model can emit reliably, expanded by this package into
 * well-formed Excalidraw elements. All geometry uses canvas coordinates
 * (top-left origin, x grows right, y grows down). The runtime schema
 * validation in the tool already guarantees types and required keys; this
 * module owns the constraints the schema DSL cannot express.
 * @module @deepseek-ai/dsh-diagram/spec
 */

/** A 2-D point in canvas coordinates. */
export interface DiagramPoint {
  x: number
  y: number
}

/** Shared visual style of a closed shape or connector. */
export interface DiagramShapeStyle {
  /** Stroke color: a hex triplet (#rgb/#rrggbb/#rrggbbaa) or a CSS named color. */
  strokeColor?: string
  /** Fill color; omitted means transparent (no fill). */
  fillColor?: string
  /** Dashed outline instead of solid. */
  dashed?: boolean
  /** Stroke width in px, 1–50; default 2. */
  strokeWidth?: number
  /** Opacity 0–100; default 100. */
  opacity?: number
}

/** Axis-aligned rectangle, optionally rounded, with an optional centered label. */
export interface DiagramRect extends DiagramShapeStyle {
  kind: 'rect'
  x: number
  y: number
  w: number
  h: number
  /** Centered label text. */
  text?: string
  /** Rounded corners. */
  rounded?: boolean
}

/** Axis-aligned ellipse with an optional centered label. */
export interface DiagramEllipse extends DiagramShapeStyle {
  kind: 'ellipse'
  x: number
  y: number
  w: number
  h: number
  /** Centered label text. */
  text?: string
}

/** Rotated square (diamond) with an optional centered label. */
export interface DiagramDiamond extends DiagramShapeStyle {
  kind: 'diamond'
  x: number
  y: number
  w: number
  h: number
  /** Centered label text. */
  text?: string
}

/** Standalone text label. */
export interface DiagramText {
  kind: 'text'
  x: number
  y: number
  /** Non-empty label; may contain \n line breaks. */
  text: string
  /** Text box width; default is estimated from the text length. */
  w?: number
  /** Font size in px, 8–96; default 20. */
  fontSize?: number
  /** Text color; a hex triplet or a CSS named color. */
  color?: string
}

/** Open polyline through at least two points. */
export interface DiagramLine extends DiagramShapeStyle {
  kind: 'line'
  points: DiagramPoint[]
}

/** Polyline through at least two points with an arrowhead at the last point. */
export interface DiagramArrow extends DiagramShapeStyle {
  kind: 'arrow'
  points: DiagramPoint[]
}

/** One shape in the `diagram` tool's element list. */
export type DiagramShape =
  | DiagramRect
  | DiagramEllipse
  | DiagramDiamond
  | DiagramText
  | DiagramLine
  | DiagramArrow

/** Default stroke color matching Excalidraw's default theme foreground. */
export const DEFAULT_STROKE_COLOR = '#1e1e1e'

/** Default text color. */
export const DEFAULT_TEXT_COLOR = '#1e1e1e'

/** Default stroke width in px. */
export const DEFAULT_STROKE_WIDTH = 2

/** Default shape fill: transparent (no fill). */
export const DEFAULT_FILL_COLOR = 'transparent'

/** Default font size for text shapes in px. */
export const DEFAULT_FONT_SIZE = 20

const COLOR_PATTERN = /^(?:#[0-9a-fA-F]{3,8}|[A-Za-z]{3,24})$/

/**
 * Validate every constraint the tool's runtime schema cannot express.
 * @param shapes - the schema-validated element list; entries are typed but
 *   may still violate numeric, size, or format bounds.
 * @returns one human-readable problem per invalid shape; empty means valid.
 */
export function validateShapes(shapes: readonly DiagramShape[]): string[] {
  const problems: string[] = []
  shapes.forEach((shape, index) => {
    const where = `elements[${index}]`
    switch (shape.kind) {
      case 'rect':
      case 'ellipse':
      case 'diamond':
        if (!isFiniteNumber(shape.x) || !isFiniteNumber(shape.y)) {
          problems.push(`${where}: x and y must be finite numbers`)
        }
        if (!isFiniteNumber(shape.w) || shape.w <= 0 || !isFiniteNumber(shape.h) || shape.h <= 0) {
          problems.push(`${where}: w and h must be positive finite numbers`)
        }
        if (shape.text !== undefined && shape.text.length === 0) {
          problems.push(`${where}: text must be non-empty when present`)
        }
        break
      case 'text':
        if (!isFiniteNumber(shape.x) || !isFiniteNumber(shape.y)) {
          problems.push(`${where}: x and y must be finite numbers`)
        }
        if (shape.text.length === 0) {
          problems.push(`${where}: text must be non-empty`)
        }
        if (shape.w !== undefined && (!isFiniteNumber(shape.w) || shape.w <= 0)) {
          problems.push(`${where}: w must be a positive finite number when present`)
        }
        if (shape.fontSize !== undefined && (!Number.isInteger(shape.fontSize) || shape.fontSize < 8 || shape.fontSize > 96)) {
          problems.push(`${where}: fontSize must be an integer between 8 and 96`)
        }
        break
      case 'line':
      case 'arrow':
        if (shape.points.length < 2) {
          problems.push(`${where}: points must contain at least 2 points`)
        }
        shape.points.forEach((point, pointIndex) => {
          if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
            problems.push(`${where}.points[${pointIndex}]: x and y must be finite numbers`)
          }
        })
        break
    }
    if (shape.kind !== 'text' && shape.strokeColor !== undefined && !COLOR_PATTERN.test(shape.strokeColor)) {
      problems.push(`${where}.strokeColor: expected a hex triplet (#rgb/#rrggbb/#rrggbbaa) or a CSS named color`)
    }
    if (shape.kind !== 'text' && shape.fillColor !== undefined && !COLOR_PATTERN.test(shape.fillColor)) {
      problems.push(`${where}.fillColor: expected a hex triplet (#rgb/#rrggbb/#rrggbbaa) or a CSS named color`)
    }
    if (shape.kind === 'text' && shape.color !== undefined && !COLOR_PATTERN.test(shape.color)) {
      problems.push(`${where}.color: expected a hex triplet (#rgb/#rrggbb/#rrggbbaa) or a CSS named color`)
    }
    if (shape.kind !== 'text' && shape.strokeWidth !== undefined
      && (!Number.isInteger(shape.strokeWidth) || shape.strokeWidth < 1 || shape.strokeWidth > 50)) {
      problems.push(`${where}.strokeWidth: must be an integer between 1 and 50`)
    }
    if (shape.kind !== 'text' && shape.opacity !== undefined
      && (!Number.isInteger(shape.opacity) || shape.opacity < 0 || shape.opacity > 100)) {
      problems.push(`${where}.opacity: must be an integer between 0 and 100`)
    }
  })
  return problems
}

/** Whether a value is a finite JSON number usable as geometry. */
function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value)
}
