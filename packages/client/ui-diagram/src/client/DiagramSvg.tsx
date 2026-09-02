/**
 * Pure SVG rendering of validated Excalidraw elements: rectangles, ellipses,
 * diamonds, text, lines, and arrows with arrowheads. The renderer is
 * deliberately dependency-free (no Excalidraw runtime — client bundles load
 * eagerly, and the ~1.5 MB editor belongs to the interactive whiteboard
 * phase), fully testable in jsdom, and a pure function of its inputs.
 * @module @deepseek-ai/dsh-client-ui-diagram/DiagramSvg
 */

import type { DiagramElementView } from './diagram-meta.ts'

/** Rounded-rect corner radius applied to `roundness: { type: 3 }`. */
const ROUNDED_RADIUS = 8

/** Dashed stroke pattern. */
const DASHED_PATTERN = '6 4'

/** One diagram rendered into an inline SVG fitted to its element bounds. */
export function DiagramSvg({ elements, title }: {
  elements: readonly DiagramElementView[]
  title: string
}) {
  const bounds = elementBounds(elements)
  const pad = 16
  const viewBox = [
    bounds.minX - pad,
    bounds.minY - pad,
    bounds.width + pad * 2,
    bounds.height + pad * 2,
  ].join(' ')
  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={title}
      data-testid="diagram-svg"
      className="dsh-diagram-canvas"
    >
      <defs>
        {elements.map(element => element.type === 'arrow' && element.endArrowhead === 'arrow'
          ? <ArrowheadMarker key={element.id} id={arrowheadId(element.id)} color={element.strokeColor} />
          : null)}
      </defs>
      {elements.map(element => <ElementShape key={element.id} element={element} />)}
    </svg>
  )
}

/** One validated element drawn as SVG primitives. */
function ElementShape({ element }: { element: DiagramElementView }) {
  const common = {
    fill: element.backgroundColor === 'transparent' ? 'none' : element.backgroundColor,
    stroke: element.strokeColor,
    strokeWidth: element.strokeWidth,
    strokeDasharray: element.strokeStyle === 'dashed' ? DASHED_PATTERN : undefined,
    opacity: element.opacity / 100,
  }
  switch (element.type) {
    case 'rectangle':
      return (
        <rect
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rx={element.roundness === null ? undefined : ROUNDED_RADIUS}
          {...common}
        />
      )
    case 'ellipse':
      return (
        <ellipse
          cx={element.x + element.width / 2}
          cy={element.y + element.height / 2}
          rx={element.width / 2}
          ry={element.height / 2}
          {...common}
        />
      )
    case 'diamond':
      return (
        <polygon
          points={[
            `${element.x + element.width / 2},${element.y}`,
            `${element.x + element.width},${element.y + element.height / 2}`,
            `${element.x + element.width / 2},${element.y + element.height}`,
            `${element.x},${element.y + element.height / 2}`,
          ].join(' ')}
          {...common}
        />
      )
    case 'text':
      return <TextElement element={element} />
    case 'line':
    case 'arrow':
      return (
        <polyline
          points={element.points.map(([px, py]) => `${element.x + px},${element.y + py}`).join(' ')}
          markerEnd={element.endArrowhead === 'arrow' ? `url(#${arrowheadId(element.id)})` : undefined}
          {...common}
        />
      )
  }
}

/** Multi-line text honoring the element's alignment fields. */
function TextElement({ element }: { element: Extract<DiagramElementView, { type: 'text' }> }) {
  const lines = element.text.split('\n')
  const anchor = element.textAlign === 'center' ? 'middle' : 'start'
  const x = element.textAlign === 'center' ? element.x + element.width / 2 : element.x
  const firstBaseline = element.verticalAlign === 'middle'
    ? element.y + element.height / 2 - ((lines.length - 1) * element.fontSize * 1.25) / 2 + element.fontSize * 0.85
    : element.y + element.fontSize
  return (
    <text
      x={x}
      y={firstBaseline}
      fontSize={element.fontSize}
      fill={element.strokeColor}
      textAnchor={anchor}
    >
      {lines.map((line, index) => (
        <tspan
          key={index}
          x={x}
          dy={index === 0 ? undefined : element.fontSize * 1.25}
        >
          {line}
        </tspan>
      ))}
    </text>
  )
}

/** Triangle marker at the arrow tip, colored like the arrow stroke. */
function ArrowheadMarker({ id, color }: { id: string; color: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="8"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
  )
}

/** SVG marker id for one arrow element; ids are caller-controlled strings. */
function arrowheadId(elementId: string): string {
  return `dsh-diagram-arrow-${elementId}`
}

/** Union bounds of all elements; zero-size box for an empty list. */
function elementBounds(elements: readonly DiagramElementView[]): {
  minX: number
  minY: number
  width: number
  height: number
} {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const element of elements) {
    let right = element.x + element.width
    let bottom = element.y + element.height
    if (element.type === 'line' || element.type === 'arrow') {
      for (const [px, py] of element.points) {
        right = Math.max(right, element.x + px)
        bottom = Math.max(bottom, element.y + py)
      }
    }
    minX = Math.min(minX, element.x)
    minY = Math.min(minY, element.y)
    maxX = Math.max(maxX, right)
    maxY = Math.max(maxY, bottom)
  }
  if (elements.length === 0) return { minX: 0, minY: 0, width: 0, height: 0 }
  return { minX, minY, width: maxX - minX, height: maxY - minY }
}
