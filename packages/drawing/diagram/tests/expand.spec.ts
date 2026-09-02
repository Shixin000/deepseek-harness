// Pure unit coverage for the spec validator and the deterministic expansion:
// every shape kind maps to the expected Excalidraw element, bounds are exact,
// and every validation rule the runtime schema cannot express is exercised.
import { describe, expect, it } from 'vitest'
import { diagramBounds, elementId, expandShapes, estimateTextBox } from '../src/expand.ts'
import type { ExcalidrawElement } from '../src/expand.ts'
import { DEFAULT_FONT_SIZE, validateShapes } from '../src/spec.ts'
import type { DiagramShape } from '../src/spec.ts'
import { DIAGRAM_EXTENSION, DIAGRAM_SOURCE, parseDiagramFile, serializeDiagram } from '../src/write.ts'

const RECT: DiagramShape = { kind: 'rect', x: 10, y: 20, w: 100, h: 50, text: 'Box' }

describe('validateShapes', () => {
  it('accepts every shape kind with defaults only', () => {
    const shapes: DiagramShape[] = [
      { kind: 'rect', x: 0, y: 0, w: 1, h: 1 },
      { kind: 'ellipse', x: 0, y: 0, w: 1, h: 1 },
      { kind: 'diamond', x: 0, y: 0, w: 1, h: 1 },
      { kind: 'text', x: 0, y: 0, text: 'hi' },
      { kind: 'line', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
      { kind: 'arrow', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
    ]
    expect(validateShapes(shapes)).toEqual([])
  })

  it('rejects non-finite geometry, zero sizes, and empty labels', () => {
    expect(validateShapes([
      { kind: 'rect', x: Number.NaN, y: 0, w: 10, h: 10 },
      { kind: 'ellipse', x: 0, y: 0, w: 0, h: 10 },
      { kind: 'diamond', x: 0, y: 0, w: 10, h: Number.POSITIVE_INFINITY },
      { kind: 'rect', x: 0, y: 0, w: 10, h: 10, text: '' },
    ])).toEqual([
      'elements[0]: x and y must be finite numbers',
      'elements[1]: w and h must be positive finite numbers',
      'elements[2]: w and h must be positive finite numbers',
      'elements[3]: text must be non-empty when present',
    ])
  })

  it('rejects non-finite text coordinates', () => {
    expect(validateShapes([
      { kind: 'text', x: Number.NaN, y: 0, text: 'hi' },
    ])).toEqual([
      'elements[0]: x and y must be finite numbers',
    ])
  })

  it('rejects connector point lists with fewer than two points and non-finite points', () => {
    expect(validateShapes([
      { kind: 'line', points: [{ x: 0, y: 0 }] },
      { kind: 'arrow', points: [{ x: 0, y: 0 }, { x: Number.NEGATIVE_INFINITY, y: 0 }] },
    ])).toEqual([
      'elements[0]: points must contain at least 2 points',
      'elements[1].points[1]: x and y must be finite numbers',
    ])
  })

  it('rejects malformed colors, stroke widths, opacities, font sizes, and text widths', () => {
    expect(validateShapes([
      { kind: 'rect', x: 0, y: 0, w: 1, h: 1, strokeColor: 'not a color!', fillColor: '#12' },
      { kind: 'rect', x: 0, y: 0, w: 1, h: 1, strokeWidth: 0, opacity: 101 },
      { kind: 'text', x: 0, y: 0, text: 't', color: 'zz', fontSize: 7, w: 0 },
    ])).toEqual([
      'elements[0].strokeColor: expected a hex triplet (#rgb/#rrggbb/#rrggbbaa) or a CSS named color',
      'elements[0].fillColor: expected a hex triplet (#rgb/#rrggbb/#rrggbbaa) or a CSS named color',
      'elements[1].strokeWidth: must be an integer between 1 and 50',
      'elements[1].opacity: must be an integer between 0 and 100',
      'elements[2]: w must be a positive finite number when present',
      'elements[2]: fontSize must be an integer between 8 and 96',
      'elements[2].color: expected a hex triplet (#rgb/#rrggbb/#rrggbbaa) or a CSS named color',
    ])
  })

  it('accepts the boundary values of every bounded field', () => {
    expect(validateShapes([
      { kind: 'rect', x: 0, y: 0, w: 1, h: 1, strokeWidth: 1, opacity: 0, strokeColor: '#abc' },
      { kind: 'text', x: 0, y: 0, text: 't', fontSize: 8, w: 1, color: 'red' },
    ])).toEqual([])
    expect(validateShapes([
      { kind: 'rect', x: 0, y: 0, w: 1, h: 1, strokeWidth: 50, opacity: 100 },
      { kind: 'text', x: 0, y: 0, text: 't', fontSize: 96 },
    ])).toEqual([])
  })
})

describe('expandShapes', () => {
  it('maps each closed shape kind to its Excalidraw type with defaults', () => {
    const elements = expandShapes([
      RECT,
      { kind: 'ellipse', x: 0, y: 0, w: 20, h: 10, text: 'E' },
      { kind: 'ellipse', x: 40, y: 0, w: 30, h: 20 },
      { kind: 'diamond', x: 0, y: 0, w: 20, h: 10 },
    ])
    expect(elements.map(e => e.type)).toEqual(['rectangle', 'text', 'ellipse', 'text', 'ellipse', 'diamond'])
    const [rect, label, ellipse, ellipseLabel, ellipsePlain, diamond] = elements
    expect(rect).toMatchObject({
      id: 'diagram-1',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      strokeColor: '#1e1e1e',
      backgroundColor: 'transparent',
      strokeStyle: 'solid',
      roundness: null,
    })
    expect(label).toMatchObject({
      type: 'text',
      text: 'Box',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      textAlign: 'center',
      verticalAlign: 'middle',
    })
    expect(ellipse).toMatchObject({ id: 'diagram-3', type: 'ellipse', width: 20, height: 10 })
    expect(ellipseLabel).toMatchObject({ type: 'text', text: 'E' })
    expect(ellipsePlain).toMatchObject({ id: 'diagram-5', type: 'ellipse', width: 30, height: 20 })
    expect(diamond).toMatchObject({ id: 'diagram-6', type: 'diamond', width: 20, height: 10 })
  })

  it('applies style fields and rounded corners', () => {
    const [rect] = expandShapes([
      { kind: 'rect', x: 0, y: 0, w: 10, h: 10, rounded: true, dashed: true, strokeColor: '#ff0000', fillColor: '#00ff00', strokeWidth: 4, opacity: 50 },
    ])
    expect(rect).toMatchObject({
      strokeColor: '#ff0000',
      backgroundColor: '#00ff00',
      fillStyle: 'solid',
      strokeStyle: 'dashed',
      strokeWidth: 4,
      opacity: 50,
      roundness: { type: 3 },
    })
  })

  it('maps text and connectors with relative points', () => {
    const elements = expandShapes([
      { kind: 'text', x: 5, y: 6, text: 'Hi' },
      { kind: 'arrow', points: [{ x: 10, y: 10 }, { x: 30, y: 50 }], dashed: true },
    ])
    const [text, arrow] = elements
    expect(text).toMatchObject({ id: 'diagram-1', type: 'text', x: 5, y: 6, text: 'Hi', fontSize: DEFAULT_FONT_SIZE, textAlign: 'left', verticalAlign: 'top' })
    expect(arrow).toMatchObject({
      id: 'diagram-2',
      type: 'arrow',
      x: 10,
      y: 10,
      width: 20,
      height: 40,
      endArrowhead: 'arrow',
      strokeStyle: 'dashed',
    })
    expect((arrow as ExcalidrawElement & { points: [number, number][] }).points).toEqual([[0, 0], [20, 40]])
  })

  it('keeps ids sequential even when labels consume ids', () => {
    const elements = expandShapes([RECT, RECT])
    expect(elements.map(e => e.id)).toEqual(['diagram-1', 'diagram-2', 'diagram-3', 'diagram-4'])
  })

  it('computes the exact diagram bounds including connectors and text', () => {
    expect(diagramBounds([
      { kind: 'rect', x: 10, y: 20, w: 100, h: 50 },
      { kind: 'arrow', points: [{ x: -5, y: 0 }, { x: 200, y: 300 }] },
    ])).toEqual({ width: 205, height: 300 })
    // Standalone text with an explicit width and a line break.
    expect(diagramBounds([
      { kind: 'text', x: 0, y: 0, text: 'a\nb', w: 40, fontSize: 10 },
    ])).toEqual({ width: 40, height: 25 })
    expect(diagramBounds([])).toEqual({ width: 0, height: 0 })
  })

  it('estimates a text box from wide and narrow code points', () => {
    const [width, height] = estimateTextBox('Hi 你好', 20)
    // H + i narrow (0.55 em each), space narrow, 你 + 好 wide (1 em each).
    expect(width).toBeCloseTo((0.55 + 0.55 + 0.55 + 1 + 1) * 20)
    expect(height).toBe(1 * 20 * 1.25)
  })

  it('generates sequential element ids', () => {
    expect(elementId(1)).toBe('diagram-1')
    expect(elementId(42)).toBe('diagram-42')
  })
})

describe('serializeDiagram / parseDiagramFile', () => {
  it('serializes the stable Excalidraw envelope', () => {
    const json = serializeDiagram(expandShapes([RECT]))
    const document = JSON.parse(json) as { type: string; version: number; source: string; files: object }
    expect(document.type).toBe('excalidraw')
    expect(document.version).toBe(2)
    expect(document.source).toBe(DIAGRAM_SOURCE)
    expect(document.files).toEqual({})
  })

  it('accepts only non-blank paths with the .excalidraw suffix', () => {
    expect(parseDiagramFile('  flow.excalidraw  ')).toBe('flow.excalidraw')
    expect(parseDiagramFile('DASH.EXCALIDRAW')).toBe('DASH.EXCALIDRAW')
    expect(() => parseDiagramFile('   ')).toThrow('file must be a non-empty string')
    expect(() => parseDiagramFile('flow.json')).toThrow(`file must end with ${DIAGRAM_EXTENSION}`)
  })
})
