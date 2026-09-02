// diagram_read tool behavior: parses a real .excalidraw document into a
// bounded structural summary, enforces path/size policy, and fails loudly on
// malformed documents.
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { LocalFileSystem } from '@deepseek-ai/dsh-fs-local'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import * as tool from '../src/index.ts'
import { presentReadCall, summarizeDocument } from '../src/read-tool.ts'

const testToolSignal = new AbortController().signal

let dir: string
let ctx: Context

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dsh-diagram-read-'))
  ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(LocalFileSystem, { cwd: dir })
  await ctx.plugin(tool)
})

afterEach(async () => {
  await ctx.fiber?.dispose()
  await rm(dir, { recursive: true, force: true })
})

let callCounter = 0
function callRead(file: string) {
  return ctx.tools.execute({
    signal: testToolSignal,
    callId: ToolCallId(`read-${++callCounter}`),
    name: 'diagram_read',
    arguments: { file },
    agent: { session: { header: { cwd: dir } } } as never,
  })
}

function text(result: { content: { type: string; text?: string }[] }): string {
  return result.content.filter(b => b.type === 'text').map(b => b.text).join('')
}

const DOCUMENT = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  source: 'test',
  elements: [
    {
      id: 'diagram-1', type: 'rectangle', x: 0, y: 0, width: 100, height: 60,
      strokeColor: '#1e1e1e', backgroundColor: '#ffffff', strokeWidth: 2,
      strokeStyle: 'solid', opacity: 100, roundness: null, text: 'Box', version: 1, versionNonce: 1,
      isDeleted: false, boundElements: null, updated: 1, link: null, locked: false,
    },
    {
      id: 'diagram-2', type: 'arrow', x: 110, y: 20, width: 30, height: 40,
      strokeColor: '#1e1e1e', backgroundColor: 'transparent', strokeWidth: 2,
      strokeStyle: 'solid', opacity: 100, roundness: null, version: 1, versionNonce: 1,
      isDeleted: false, boundElements: null, updated: 1, link: null, locked: false,
      points: [[0, 0], [30, 40]], endArrowhead: 'arrow',
    },
    { id: 'diagram-3', type: 'text', x: 5, y: 5, width: 40, height: 20, text: 'hi', version: 1 },
  ],
  appState: { viewBackgroundColor: '#ffffff' },
  files: {},
})

describe('diagram_read tool', () => {
  it('registers a `diagram_read` tool with a file parameter', async () => {
    const schema = ctx.tools.schemas().find(s => s.name === 'diagram_read')
    expect(schema).toBeDefined()
    const props = (schema!.parameters as { properties?: Record<string, unknown> }).properties ?? {}
    expect(Object.keys(props)).toEqual(['file'])
  })

  it('registers guidance sections for both diagram tools', async () => {
    const assembly = await (ctx.get('systemPrompt') as { assemble(): Promise<{ sections: { name: string }[] }> }).assemble()
    const names = assembly.sections.map(s => s.name)
    expect(names).toContain('tool:diagram')
    expect(names).toContain('tool:diagram_read')
  })

  it('summarizes a valid document: elements, labels, points, and bounds', async () => {
    await writeFile(join(dir, 'flow.excalidraw'), DOCUMENT)
    const result = await callRead('flow.excalidraw')
    expect(result.isError).toBe(false)
    if (result.isError) throw new Error('expected diagram_read success')
    expect(result.value).toMatchObject({
      path: join(dir, 'flow.excalidraw'),
      elementCount: 3,
      width: 140,
      height: 60,
      truncated: false,
    })
    const elements = (result.value as { elements: { id: string; type: string; text?: string; points?: number[][] }[] }).elements
    expect(elements[0]).toMatchObject({ id: 'diagram-1', type: 'rectangle', text: 'Box', x: 0, y: 0, width: 100, height: 60 })
    expect(elements[1]).toMatchObject({ id: 'diagram-2', type: 'arrow', points: [[0, 0], [30, 40]] })
    expect(elements[2]).toMatchObject({ id: 'diagram-3', type: 'text', text: 'hi' })
    expect(text(result)).toContain('Read 3 elements')
    // The meta projection carries the same summary for the replayable card.
    expect(result.meta).toEqual(result.value)
  })

  it('rejects a missing file and a non-.excalidraw path', async () => {
    const missing = await callRead('missing.excalidraw')
    expect(missing.isError).toBe(true)
    expect(text(missing)).toContain('cannot read diagram')

    const wrongExt = await callRead('flow.json')
    expect(wrongExt.isError).toBe(true)
    expect(text(wrongExt)).toContain('file must end with .excalidraw')
  })

  it('rejects a malformed document with a readable problem', async () => {
    await writeFile(join(dir, 'bad.excalidraw'), 'not json')
    const bad = await callRead('bad.excalidraw')
    expect(bad.isError).toBe(true)
    expect(text(bad)).toContain('not a valid .excalidraw document')

    await writeFile(join(dir, 'wrong.excalidraw'), JSON.stringify({ type: 'other', elements: [] }))
    const wrong = await callRead('wrong.excalidraw')
    expect(wrong.isError).toBe(true)
    expect(text(wrong)).toContain('missing type/excalidraw')

    await writeFile(join(dir, 'scalar.excalidraw'), '42')
    const scalar = await callRead('scalar.excalidraw')
    expect(scalar.isError).toBe(true)
    expect(text(scalar)).toContain('expected an object')
  })

  it('skips malformed elements and truncates above the summary cap', () => {
    const summary = summarizeDocument(JSON.stringify({
      type: 'excalidraw',
      elements: [
        { id: 'ok', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 },
        { notAnElement: true },
      ],
    }), '/ws/x.excalidraw', 1)
    expect(summary.elementCount).toBe(1)
    expect(summary.truncated).toBe(true)
    expect(summary.elements).toHaveLength(1)
  })

  it('skips elements with missing ids, unknown types, or non-finite geometry', () => {
    const summary = summarizeDocument(JSON.stringify({
      type: 'excalidraw',
      elements: [
        { type: 'rectangle', x: 0, y: 0, width: 10, height: 10 },
        { id: 'no-type', x: 0, y: 0, width: 10, height: 10 },
        { id: 'bad-geometry', type: 'rectangle', x: Number.NaN, y: 0, width: 10, height: 10 },
        { id: 'ok', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 },
      ],
    }), '/ws/x.excalidraw', 10)
    expect(summary.elementCount).toBe(1)
    expect(summary.elements[0]?.id).toBe('ok')
  })

  it('skips malformed connector points and empty texts', () => {
    const summary = summarizeDocument(JSON.stringify({
      type: 'excalidraw',
      elements: [
        { id: 'a', type: 'arrow', x: 0, y: 0, width: 1, height: 1, points: [[0, 0], ['x', 1], [1]] },
        { id: 'b', type: 'text', x: 0, y: 0, width: 1, height: 1, text: '' },
      ],
    }), '/ws/x.excalidraw', 10)
    expect(summary.elements[0]?.points).toEqual([[0, 0]])
    expect(summary.elements[1]?.text).toBeUndefined()
  })

  it('summarizes an empty document as a zero-size canvas', () => {
    const summary = summarizeDocument(JSON.stringify({ type: 'excalidraw', elements: [] }), '/ws/x.excalidraw', 10)
    expect(summary).toEqual({ path: '/ws/x.excalidraw', elementCount: 0, width: 0, height: 0, elements: [], truncated: false })
  })

  it('skips non-object elements and non-string texts, and drops all-bad points', () => {
    const summary = summarizeDocument(JSON.stringify({
      type: 'excalidraw',
      elements: [
        null,
        { id: 'a', type: 'text', x: 0, y: 0, width: 1, height: 1, text: 42 },
        { id: 'b', type: 'arrow', x: 0, y: 0, width: 1, height: 1, points: [['x', 1], [1]] },
      ],
    }), '/ws/x.excalidraw', 10)
    expect(summary.elementCount).toBe(2)
    expect(summary.elements[0]?.text).toBeUndefined()
    expect(summary.elements[1]?.points).toBeUndefined()
  })

  it('rejects a blank file path and accepts case-insensitive extensions', async () => {
    const blank = await callRead('   ')
    expect(blank.isError).toBe(true)
    expect(text(blank)).toContain('file must be a non-empty string')

    await writeFile(join(dir, 'UPPER.EXCALIDRAW'), DOCUMENT)
    const upper = await callRead('UPPER.EXCALIDRAW')
    expect(upper.isError).toBe(false)
  })

  it('defaults malformed dimensions to zero and shows the truncation cap in prose', async () => {
    await writeFile(join(dir, 'big.excalidraw'), JSON.stringify({
      type: 'excalidraw',
      elements: Array.from({ length: 5 }, (_, i) => ({
        id: `e${i}`, type: 'rectangle', x: i, y: 0, width: 'wide', height: 10,
      })),
    }))
    const result = await callRead('big.excalidraw')
    expect(result.isError).toBe(false)
    if (result.isError) throw new Error('expected success')
    const elements = (result.value as { elements: { width: number }[] }).elements
    expect(elements[0]?.width).toBe(0)
    expect(text(result)).toContain('Read 5 elements')

    await writeFile(join(dir, 'capped.excalidraw'), JSON.stringify({
      type: 'excalidraw',
      elements: Array.from({ length: 201 }, (_, i) => ({
        id: `c${i}`, type: 'rectangle', x: i, y: 0, width: 1, height: 1,
      })),
    }))
    const capped = await callRead('capped.excalidraw')
    expect(capped.isError).toBe(false)
    expect(text(capped)).toContain('(first 200 of 201 shown)')
  })

  it('resolves a relative path without a session cwd when called without an agent', async () => {
    await writeFile(join(dir, 'flow.excalidraw'), DOCUMENT)
    const result = await ctx.tools.execute({
      signal: testToolSignal,
      callId: ToolCallId('read-no-agent'),
      name: 'diagram_read',
      arguments: { file: 'flow.excalidraw' },
    })
    expect(result.isError).toBe(false)
  })

  it('presents a generic pending card pointing at the file', () => {
    expect(presentReadCall({ file: 'flow.excalidraw' })).toEqual({
      card: 'generic',
      title: 'Diagram read flow.excalidraw',
      locations: [{ path: 'flow.excalidraw' }],
    })
  })
})
