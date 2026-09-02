// @vitest-environment jsdom
// SVG renderer behavior: one element of every kind maps to the expected SVG
// primitives, and style fields land on the right attributes.
import { afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DiagramSvg } from '../src/client/DiagramSvg.tsx'
import type { DiagramElementView } from '../src/client/diagram-meta.ts'

afterEach(cleanup)

function element(over: Partial<DiagramElementView> & { type: DiagramElementView['type'] }): DiagramElementView {
  return {
    id: 'e1',
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    strokeWidth: 2,
    strokeStyle: 'solid',
    opacity: 100,
    roundness: null,
    ...over,
  } as DiagramElementView
}

const ARROW: DiagramElementView = element({
  id: 'arrow-1',
  type: 'arrow',
  x: 10,
  y: 20,
  width: 30,
  height: 40,
  points: [[0, 0], [30, 40]],
  endArrowhead: 'arrow',
})

describe('DiagramSvg', () => {
  it('renders a rounded rectangle, an ellipse, and a diamond with styles', () => {
    const { container } = render(<DiagramSvg
      title="flow"
      elements={[
        element({ id: 'r1', type: 'rectangle', roundness: { type: 3 }, backgroundColor: '#ffffff', strokeStyle: 'dashed', opacity: 50 }),
        element({ id: 'e2', type: 'ellipse', x: 200, y: 10, width: 40, height: 20 }),
        element({ id: 'd1', type: 'diamond', x: 300, y: 0, width: 80, height: 60, backgroundColor: '#ffeeaa' }),
      ]}
    />)
    const rect = container.querySelector('rect')!
    expect(rect).not.toBeNull()
    expect(rect.getAttribute('rx')).toBe('8')
    expect(rect.getAttribute('fill')).toBe('#ffffff')
    expect(rect.getAttribute('stroke-dasharray')).toBe('6 4')
    expect(rect.getAttribute('opacity')).toBe('0.5')
    const ellipse = container.querySelector('ellipse')!
    expect(ellipse.getAttribute('cx')).toBe('220')
    expect(ellipse.getAttribute('cy')).toBe('20')
    expect(ellipse.getAttribute('rx')).toBe('20')
    expect(ellipse.getAttribute('fill')).toBe('none')
    const diamond = container.querySelector('polygon')!
    expect(diamond.getAttribute('points')).toBe('340,0 380,30 340,60 300,30')
  })

  it('renders multi-line text with the element alignment', () => {
    const { container } = render(<DiagramSvg title="labels" elements={[
      element({
        type: 'text',
        text: 'Start\nNext',
        fontSize: 20,
        textAlign: 'center',
        verticalAlign: 'middle',
        strokeColor: '#ff0000',
      }),
    ]} />)
    const text = container.querySelector('text')!
    expect(text.getAttribute('text-anchor')).toBe('middle')
    expect(text.getAttribute('x')).toBe('50')
    expect(text.getAttribute('font-size')).toBe('20')
    expect(text.getAttribute('fill')).toBe('#ff0000')
    const lines = container.querySelectorAll('tspan')
    expect(lines).toHaveLength(2)
    expect(lines[0]!.textContent).toBe('Start')
    expect(lines[1]!.textContent).toBe('Next')
    expect(lines[1]!.getAttribute('dy')).toBe('25')
  })

  it('renders top-left aligned single-line text', () => {
    const { container } = render(<DiagramSvg title="labels" elements={[
      element({ type: 'text', text: 'Note', x: 4, y: 8, fontSize: 20, textAlign: 'left', verticalAlign: 'top' }),
    ]} />)
    const text = container.querySelector('text')!
    expect(text.getAttribute('text-anchor')).toBe('start')
    expect(text.getAttribute('x')).toBe('4')
    expect(text.getAttribute('y')).toBe('28')
    expect(container.querySelectorAll('tspan')).toHaveLength(1)
  })

  it('renders arrows with a marker and lines without one', () => {
    const { container } = render(<DiagramSvg title="connectors" elements={[
      ARROW,
      element({ type: 'line', id: 'line-1', points: [[0, 0], [5, 5], [10, 0]], endArrowhead: null }),
    ]} />)
    const marker = container.querySelector('marker')
    expect(marker?.getAttribute('id')).toBe('dsh-diagram-arrow-arrow-1')
    const polylines = container.querySelectorAll('polyline')
    expect(polylines).toHaveLength(2)
    expect(polylines[0]!.getAttribute('points')).toBe('10,20 40,60')
    expect(polylines[0]!.getAttribute('marker-end')).toBe('url(#dsh-diagram-arrow-arrow-1)')
    expect(polylines[1]!.getAttribute('points')).toBe('0,0 5,5 10,0')
    expect(polylines[1]!.hasAttribute('marker-end')).toBe(false)
    const markerPath = container.querySelector('marker path')!
    expect(markerPath.getAttribute('fill')).toBe('#1e1e1e')
  })

  it('fits the viewBox to the element bounds with padding', () => {
    const { container } = render(<DiagramSvg title="bounds" elements={[
      element({ type: 'rectangle', x: -10, y: 5, width: 20, height: 30 }),
      ARROW,
    ]} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('viewBox')).toBe('-26 -11 82 87')
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('bounds')
  })

  it('renders an empty diagram as a zero-size box', () => {
    const { container } = render(<DiagramSvg title="empty" elements={[]} />)
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('-16 -16 32 32')
  })
})
