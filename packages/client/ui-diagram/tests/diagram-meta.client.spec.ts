// Pure validation coverage for the wire projection parser: every acceptance
// rule and every rejection path, so the card can trust its render view.
import { describe, expect, it } from 'vitest'
import { parseDiagramMeta } from '../src/client/diagram-meta.ts'

/** A valid full projection with one element of every kind. */
interface MetaFixture {
  path: string
  width: number
  height: number
  elements: Record<string, unknown>[]
}

function validMeta(): MetaFixture {
  return {
    path: '/ws/flow.excalidraw',
    width: 280,
    height: 60,
    elements: [
      {
        id: 'diagram-1', type: 'rectangle', x: 0, y: 0, width: 100, height: 60,
        strokeColor: '#1e1e1e', backgroundColor: '#ffffff', strokeWidth: 2,
        strokeStyle: 'solid', opacity: 100, roundness: null,
      },
      {
        id: 'diagram-2', type: 'text', x: 0, y: 0, width: 100, height: 60,
        strokeColor: '#1e1e1e', backgroundColor: 'transparent', strokeWidth: 2,
        strokeStyle: 'solid', opacity: 100, roundness: null,
        text: 'Start', fontSize: 20, textAlign: 'center', verticalAlign: 'middle',
      },
      {
        id: 'diagram-3', type: 'arrow', x: 10, y: 20, width: 30, height: 40,
        strokeColor: '#1e1e1e', backgroundColor: 'transparent', strokeWidth: 2,
        strokeStyle: 'dashed', opacity: 100, roundness: null,
        points: [[0, 0], [30, 40]], endArrowhead: 'arrow',
      },
    ],
  }
}

describe('parseDiagramMeta', () => {
  it('accepts a full projection with every element kind', () => {
    const view = parseDiagramMeta(validMeta())
    expect(view).not.toBeNull()
    expect(view!.path).toBe('/ws/flow.excalidraw')
    expect(view!.width).toBe(280)
    expect(view!.height).toBe(60)
    expect(view!.elements.map(e => e.type)).toEqual(['rectangle', 'text', 'arrow'])
    const arrow = view!.elements[2]!
    expect(arrow.type).toBe('arrow')
    if (arrow.type === 'arrow') {
      expect(arrow.points).toEqual([[0, 0], [30, 40]])
      expect(arrow.endArrowhead).toBe('arrow')
    }
  })

  it('applies defaults for absent text fields and arrowheads', () => {
    const meta = validMeta()
    const text = meta.elements[1] as Record<string, unknown>
    delete text.fontSize
    delete text.textAlign
    delete text.verticalAlign
    const arrow = meta.elements[2] as Record<string, unknown>
    delete arrow.endArrowhead
    const view = parseDiagramMeta(meta)
    expect(view!.elements[1]).toMatchObject({ fontSize: 20, textAlign: 'left', verticalAlign: 'top' })
    const line = view!.elements[2]!
    if (line.type === 'arrow') expect(line.endArrowhead).toBeNull()
  })

  it.each([
    ['a non-object root', 42],
    ['a null root', null],
    ['a blank path', { ...validMeta(), path: '' }],
    ['a missing path', { width: 1, height: 1, elements: [] }],
    ['a negative width', { ...validMeta(), width: -1 }],
    ['a non-array element list', { ...validMeta(), elements: 'nope' }],
    ['an empty element list', { ...validMeta(), elements: [] }],
    ['a blank element id', { ...validMeta(), elements: [{ ...validMeta().elements[0], id: '' }] }],
    ['an unknown element type', { ...validMeta(), elements: [{ ...validMeta().elements[0], type: 'freedraw' }] }],
    ['non-finite element x', { ...validMeta(), elements: [{ ...validMeta().elements[0], x: Number.NaN }] }],
    ['a negative element width', { ...validMeta(), elements: [{ ...validMeta().elements[0], width: -1 }] }],
    ['a numeric strokeColor', { ...validMeta(), elements: [{ ...validMeta().elements[0], strokeColor: 42 }] }],
    ['an unknown strokeStyle', { ...validMeta(), elements: [{ ...validMeta().elements[0], strokeStyle: 'wavy' }] }],
    ['an out-of-range opacity', { ...validMeta(), elements: [{ ...validMeta().elements[0], opacity: 101 }] }],
    ['a numeric backgroundColor', { ...validMeta(), elements: [{ ...validMeta().elements[0], backgroundColor: 42 }] }],
    ['a non-finite strokeWidth', { ...validMeta(), elements: [{ ...validMeta().elements[0], strokeWidth: Number.NaN }] }],
    ['a string roundness', { ...validMeta(), elements: [{ ...validMeta().elements[0], roundness: 'round' }] }],
    ['a non-object element', { ...validMeta(), elements: [42] }],
    ['a malformed roundness', { ...validMeta(), elements: [{ ...validMeta().elements[0], roundness: { type: 1 } }] }],
    ['a missing text body', { ...validMeta(), elements: [{ ...validMeta().elements[1], text: 7 }] }],
    ['a malformed text fontSize', { ...validMeta(), elements: [{ ...validMeta().elements[1], fontSize: 'big' }] }],
    ['an unknown textAlign', { ...validMeta(), elements: [{ ...validMeta().elements[1], textAlign: 'right' }] }],
    ['an unknown verticalAlign', { ...validMeta(), elements: [{ ...validMeta().elements[1], verticalAlign: 'bottom' }] }],
    ['a single-point connector', { ...validMeta(), elements: [{ ...validMeta().elements[2], points: [[0, 0]] }] }],
    ['a malformed connector point', { ...validMeta(), elements: [{ ...validMeta().elements[2], points: [[0, 0], ['x', 1]] }] }],
    ['an unknown endArrowhead', { ...validMeta(), elements: [{ ...validMeta().elements[2], endArrowhead: 'triangle' }] }],
  ])('rejects %s', (_label, meta) => {
    expect(parseDiagramMeta(meta)).toBeNull()
  })

  it('rejects a projection whose element list exceeds the render cap', () => {
    const meta = validMeta()
    const sample = meta.elements[0]!
    meta.elements = Array.from({ length: 2001 }, () => sample)
    expect(parseDiagramMeta(meta)).toBeNull()
  })

  it('rejects a projection with one invalid element among many', () => {
    const meta = validMeta()
    meta.elements = [...meta.elements, { ...meta.elements[0]!, id: '' }]
    expect(parseDiagramMeta(meta)).toBeNull()
  })

  it('accepts rounded rectangles and un-arrowed lines', () => {
    const meta = validMeta()
    const elements = meta.elements
    const rect = elements[0]!
    rect.roundness = { type: 3 }
    const arrow = elements[2]!
    arrow.type = 'line'
    arrow.endArrowhead = null
    const view = parseDiagramMeta(meta)
    expect(view).not.toBeNull()
    expect(view!.elements[0]).toMatchObject({ roundness: { type: 3 } })
    expect(view!.elements[2]).toMatchObject({ type: 'line', endArrowhead: null })
  })
})
