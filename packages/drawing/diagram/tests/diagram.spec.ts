// Drives the REAL plugin body: mounts `dsh-diagram` on a real `ToolRuntime`
// and a real `LocalFileSystem` backend, then invokes the registered `diagram`
// tool through `ctx.tools.execute` — so the workspace write, the observation
// event, and the replayable meta projection are all the shipping code.
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { LocalFileSystem } from '@deepseek-ai/dsh-fs-local'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import type { FsObservation } from '@deepseek-ai/dsh-fs'
import * as tool from '../src/index.ts'
import { presentDiagramCall, presentDiagramResult } from '../src/index.ts'
import type { DiagramShape } from '../src/spec.ts'

const testToolSignal = new AbortController().signal

let dir: string
let ctx: Context
let observed: { target: { displayPath: string }; observation: FsObservation }[]

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dsh-diagram-'))
  ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(LocalFileSystem, { cwd: dir })
  await ctx.plugin(tool)
  observed = []
  ctx.on('fs/observed', (target, observation) => {
    observed.push({ target, observation })
  })
})

afterEach(async () => {
  await ctx.fiber?.dispose()
  await rm(dir, { recursive: true, force: true })
})

let callCounter = 0
function callDiagram(args: unknown, cwd = dir) {
  return ctx.tools.execute({
    signal: testToolSignal,
    callId: ToolCallId(`call-${++callCounter}`),
    name: 'diagram',
    arguments: args,
    agent: { session: { header: { cwd } } } as never,
  })
}

function text(result: { content: { type: string; text?: string }[] }): string {
  return result.content.filter(b => b.type === 'text').map(b => b.text).join('')
}

const SAMPLE: DiagramShape[] = [
  { kind: 'rect', x: 0, y: 0, w: 100, h: 60, text: 'Start', fillColor: '#ffffff' },
  { kind: 'arrow', points: [{ x: 110, y: 30 }, { x: 200, y: 30 }] },
  { kind: 'diamond', x: 200, y: 0, w: 80, h: 60, text: 'Go?' },
]

describe('dsh-diagram tool', () => {
  it('registers a `diagram` tool whose schema accepts file + elements with all six shape kinds', async () => {
    const schema = ctx.tools.schemas().find(s => s.name === 'diagram')
    expect(schema).toBeDefined()
    const props = (schema!.parameters as { properties?: Record<string, unknown> }).properties ?? {}
    expect(Object.keys(props)).toEqual(['file', 'elements'])
    const items = (props.elements as { items?: { oneOf?: { properties?: { kind?: { const?: string } } }[] } }).items
    const kinds = items?.oneOf?.map(variant => variant.properties?.kind?.const)
    expect(kinds).toEqual(['rect', 'ellipse', 'diamond', 'text', 'line', 'arrow'])
  })

  it('writes a parseable .excalidraw document and records the observation', async () => {
    const result = await callDiagram({ file: 'flow.excalidraw', elements: SAMPLE })
    expect(result.isError).toBe(false)
    if (result.isError) throw new Error('expected diagram success')
    expect(result.value).toMatchObject({
      path: join(dir, 'flow.excalidraw'),
      elementCount: 5, // 3 shapes + 2 labels
      width: 280,
      height: 60,
    })
    expect(text(result)).toContain('Wrote 5 shapes')

    const document = JSON.parse(await readFile(join(dir, 'flow.excalidraw'), 'utf8')) as {
      type: string
      version: number
      elements: [
        { id: string; type: string; x: number; y: number; width: number; height: number },
        { id: string; type: string; text: string; textAlign: string; verticalAlign: string },
        { id: string; type: string },
        { id: string; type: string },
        { id: string; type: string },
      ]
    }
    expect(document.type).toBe('excalidraw')
    expect(document.version).toBe(2)
    expect(document.elements.map(e => e.id)).toEqual(['diagram-1', 'diagram-2', 'diagram-3', 'diagram-4', 'diagram-5'])
    expect(document.elements[0]).toMatchObject({ type: 'rectangle', x: 0, y: 0, width: 100, height: 60 })
    expect(document.elements[1]).toMatchObject({ type: 'text', text: 'Start', textAlign: 'center', verticalAlign: 'middle' })

    // The meta projection carries the elements for the replayable Web card.
    expect(result.meta).toMatchObject({ path: join(dir, 'flow.excalidraw'), width: 280, height: 60 })
    expect((result.meta as { elements?: unknown[] }).elements).toHaveLength(5)

    expect(observed).toHaveLength(1)
    expect(observed[0]?.observation).toMatchObject({ kind: 'present' })
  })

  it('expands arrows to connector elements with relative points and an end arrowhead', async () => {
    const result = await callDiagram({
      file: 'arrows.excalidraw',
      elements: [
        { kind: 'arrow', points: [{ x: 10, y: 20 }, { x: 40, y: 60 }] },
        { kind: 'line', points: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }], dashed: true, strokeColor: '#ff0000' },
      ],
    })
    expect(result.isError).toBe(false)
    const document = JSON.parse(await readFile(join(dir, 'arrows.excalidraw'), 'utf8')) as {
      elements: [
        { type: 'arrow'; x: number; y: number; points: [number, number][]; endArrowhead: string | null; startArrowhead: string | null },
        { type: 'line'; x: number; y: number; points: [number, number][]; endArrowhead: string | null; strokeStyle: string; strokeColor: string },
      ]
    }
    const [arrow, line] = document.elements
    expect(arrow).toMatchObject({ type: 'arrow', x: 10, y: 20, endArrowhead: 'arrow', startArrowhead: null })
    expect(arrow.points).toEqual([[0, 0], [30, 40]])
    expect(line).toMatchObject({
      type: 'line',
      x: 0,
      y: 0,
      strokeStyle: 'dashed',
      strokeColor: '#ff0000',
      endArrowhead: null,
    })
    expect(line.points).toEqual([[0, 0], [5, 5], [10, 0]])
  })

  it('rejects invalid geometry with every problem listed', async () => {
    const result = await callDiagram({
      file: 'bad.excalidraw',
      elements: [
        { kind: 'rect', x: 0, y: 0, w: 0, h: 10 },
        { kind: 'arrow', points: [{ x: 0, y: 0 }] },
        { kind: 'text', x: 0, y: 0, text: '' },
      ],
    })
    expect(result.isError).toBe(true)
    expect(text(result)).toContain('invalid elements:')
    expect(text(result)).toContain('elements[0]: w and h must be positive finite numbers')
    expect(text(result)).toContain('elements[1]: points must contain at least 2 points')
    expect(text(result)).toContain('elements[2]: text must be non-empty')
  })

  it('rejects a non-.excalidraw file and an empty element list', async () => {
    const extension = await callDiagram({ file: 'flow.json', elements: SAMPLE })
    expect(extension.isError).toBe(true)
    expect(text(extension)).toContain('file must end with .excalidraw')

    const empty = await callDiagram({ file: 'empty.excalidraw', elements: [] })
    expect(empty.isError).toBe(true)
    expect(text(empty)).toContain('elements must contain at least 1 shape')
  })

  it('enforces the maxElements config cap', async () => {
    const ctxCapped = new Context()
    await ctxCapped.plugin(SystemPrompt)
    await ctxCapped.plugin(ToolRuntime)
    await ctxCapped.plugin(LocalFileSystem, { cwd: dir })
    await ctxCapped.plugin(tool, { maxElements: 2 })
    try {
      const result = await ctxCapped.tools.execute({
        signal: testToolSignal,
        callId: ToolCallId('call-cap'),
        name: 'diagram',
        arguments: { file: 'cap.excalidraw', elements: SAMPLE },
        agent: { session: { header: { cwd: dir } } } as never,
      })
      expect(result.isError).toBe(true)
      expect(text(result)).toContain('at most 2 shapes')
    } finally {
      await ctxCapped.fiber?.dispose()
    }
  })

  it('drops the meta elements above the maxMetaBytes cap while keeping the summary', async () => {
    const ctxCapped = new Context()
    await ctxCapped.plugin(SystemPrompt)
    await ctxCapped.plugin(ToolRuntime)
    await ctxCapped.plugin(LocalFileSystem, { cwd: dir })
    await ctxCapped.plugin(tool, { maxMetaBytes: 64 })
    try {
      const result = await ctxCapped.tools.execute({
        signal: testToolSignal,
        callId: ToolCallId('call-meta'),
        name: 'diagram',
        arguments: { file: 'meta.excalidraw', elements: SAMPLE },
        agent: { session: { header: { cwd: dir } } } as never,
      })
      expect(result.isError).toBe(false)
      expect(result.meta).toEqual({ path: join(dir, 'meta.excalidraw'), width: 280, height: 60 })
    } finally {
      await ctxCapped.fiber?.dispose()
    }
  })

  it('resolves a relative file against the session cwd, not the backend cwd', async () => {
    const sessionDir = await mkdtemp(join(tmpdir(), 'dsh-diagram-session-'))
    try {
      const result = await callDiagram({ file: 'note.excalidraw', elements: SAMPLE }, sessionDir)
      expect(result.isError).toBe(false)
      if (result.isError) throw new Error('expected diagram success')
      expect(result.value).toEqual({
        path: join(sessionDir, 'note.excalidraw'),
        elementCount: 5,
        width: 280,
        height: 60,
      })
      await expect(readFile(join(sessionDir, 'note.excalidraw'), 'utf8')).resolves.toContain('"type": "excalidraw"')
    } finally {
      await rm(sessionDir, { recursive: true, force: true })
    }
  })

  it('produces a deterministic document for the same spec', async () => {
    const first = await callDiagram({ file: 'a.excalidraw', elements: SAMPLE })
    const second = await callDiagram({ file: 'b.excalidraw', elements: SAMPLE })
    expect(first.isError).toBe(false)
    expect(second.isError).toBe(false)
    const a = await readFile(join(dir, 'a.excalidraw'), 'utf8')
    const b = await readFile(join(dir, 'b.excalidraw'), 'utf8')
    expect(a).toBe(b)
  })

  it('rejects a misconfigured plugin at load', async () => {
    const badElements = new Context()
    await badElements.plugin(SystemPrompt)
    await badElements.plugin(ToolRuntime)
    await badElements.plugin(LocalFileSystem, { cwd: dir })
    await expect(badElements.plugin(tool, { maxElements: 0 }))
      .rejects.toMatchObject({ message: 'tool-diagram: maxElements must be a positive integer' })
    const badMeta = new Context()
    await badMeta.plugin(SystemPrompt)
    await badMeta.plugin(ToolRuntime)
    await badMeta.plugin(LocalFileSystem, { cwd: dir })
    await expect(badMeta.plugin(tool, { maxMetaBytes: -1 }))
      .rejects.toMatchObject({ message: 'tool-diagram: maxMetaBytes must be a positive integer' })
  })

  it('presents a generic pending card with the touched file and a result card on success only', () => {
    const args = { file: 'flow.excalidraw', elements: SAMPLE }
    expect(presentDiagramCall(args)).toEqual({
      card: 'generic',
      title: 'Diagram flow.excalidraw',
      locations: [{ path: 'flow.excalidraw' }],
    })
    expect(presentDiagramResult(args, { isError: false } as never)).toEqual({
      card: 'generic',
      title: 'Diagram flow.excalidraw',
    })
    expect(presentDiagramResult(args, { isError: true } as never)).toBeUndefined()
  })
})
