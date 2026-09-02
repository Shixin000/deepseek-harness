// Drives the REAL DiagramRemote gateway: mount it beside a real LocalFileSystem
// and exercise save/read through the public service methods — the same calls
// the Gateway dispatches for ctx.remote.diagram.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LocalFileSystem } from '@deepseek-ai/dsh-fs-local'
import DiagramRemote, { DIAGRAM_READ_MAX_BYTES } from '../src/remote.ts'

let dir: string
let ctx: Context
let remote: DiagramRemote

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dsh-diagram-remote-'))
  ctx = new Context()
  ctx.provide('sessions', { get: () => undefined })
  await ctx.plugin(LocalFileSystem, { cwd: dir })
  await ctx.plugin(DiagramRemote)
  remote = ctx.get('diagram') as DiagramRemote
})

afterEach(async () => {
  await ctx.fiber?.dispose()
  await rm(dir, { recursive: true, force: true })
})

const DOCUMENT = '{"type":"excalidraw","version":2,"source":"test","elements":[],"appState":{},"files":{}}'

describe('DiagramRemote', () => {
  it('saves a document into the workspace and reports the resolved path', async () => {
    const result = await remote.save({ path: 'flow.excalidraw', content: DOCUMENT })
    expect(result).toMatchObject({ ok: true, path: join(dir, 'flow.excalidraw') })
    if (result.ok) {
      expect(result.bytes).toBe(Buffer.byteLength(DOCUMENT))
      expect(await readFile(join(dir, 'flow.excalidraw'), 'utf8')).toBe(DOCUMENT)
    }
  })

  it('reads back a saved document', async () => {
    await writeFile(join(dir, 'flow.excalidraw'), DOCUMENT)
    const result = await remote.read({ path: 'flow.excalidraw' })
    expect(result).toMatchObject({ ok: true, path: join(dir, 'flow.excalidraw') })
    if (result.ok) {
      expect(result.content).toBe(DOCUMENT)
      expect(result.bytes).toBe(Buffer.byteLength(DOCUMENT))
    }
  })

  it('rejects paths without the .excalidraw suffix', async () => {
    expect(await remote.save({ path: 'flow.json', content: DOCUMENT })).toMatchObject({
      ok: false,
      code: 'invalid-path',
    })
    expect(await remote.read({ path: 'flow.json' })).toMatchObject({ ok: false, code: 'invalid-path' })
    expect(await remote.save({ path: '   ', content: DOCUMENT })).toMatchObject({ ok: false, code: 'invalid-path' })
  })

  it('fails explicitly on an unwritable target', async () => {
    const result = await remote.save({ path: '/nonexistent-dir/flow.excalidraw', content: DOCUMENT })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('write-failed')
  })

  it('fails explicitly when the read target is missing', async () => {
    const result = await remote.read({ path: 'missing.excalidraw' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('read-failed')
  })

  it('records the log-only diagram/saved event for the owning session', async () => {
    const appended: Array<{ type: string; data: object }> = []
    const sessionsCtx = new Context()
    sessionsCtx.provide('sessions', {
      get: (id: string) => id === 'session-1'
        ? { append: (type: string, data: object) => { appended.push({ type, data }) } }
        : undefined,
    })
    await sessionsCtx.plugin(LocalFileSystem, { cwd: dir })
    await sessionsCtx.plugin(DiagramRemote)
    const sessionsRemote = sessionsCtx.get('diagram') as DiagramRemote
    const result = await sessionsRemote.save({
      path: 'flow.excalidraw',
      content: DOCUMENT,
      sessionId: 'session-1',
    })
    expect(result.ok).toBe(true)
    expect(appended).toEqual([{
      type: 'diagram/saved',
      data: { path: join(dir, 'flow.excalidraw'), elementCount: 0 },
    }])

    // A save without a sessionId skips the event; an unknown session id is a no-op.
    const noSession = await sessionsRemote.save({ path: 'flow.excalidraw', content: DOCUMENT })
    expect(noSession.ok).toBe(true)
    const unknownSession = await sessionsRemote.save({
      path: 'flow.excalidraw',
      content: DOCUMENT,
      sessionId: 'session-unknown',
    })
    expect(unknownSession.ok).toBe(true)
    expect(appended).toHaveLength(1)
    await sessionsCtx.fiber?.dispose()
  })

  it('counts elements from a parseable payload and zero otherwise', async () => {
    const appended: Array<{ type: string; data: object }> = []
    const sessionsCtx = new Context()
    sessionsCtx.provide('sessions', {
      get: () => ({ append: (type: string, data: object) => { appended.push({ type, data }) } }),
    })
    await sessionsCtx.plugin(LocalFileSystem, { cwd: dir })
    await sessionsCtx.plugin(DiagramRemote)
    const sessionsRemote = sessionsCtx.get('diagram') as DiagramRemote
    const withElements = await sessionsRemote.save({
      path: 'flow.excalidraw',
      content: '{"type":"excalidraw","elements":[{"id":"a"},{"id":"b"}]}',
      sessionId: 's',
    })
    expect(withElements.ok).toBe(true)
    expect(appended[0]).toMatchObject({ data: { elementCount: 2 } })
    const garbage = await sessionsRemote.save({ path: 'flow.excalidraw', content: 'nope', sessionId: 's' })
    expect(garbage.ok).toBe(true)
    expect(appended[1]).toMatchObject({ data: { elementCount: 0 } })
    const noElements = await sessionsRemote.save({
      path: 'flow.excalidraw',
      content: '{"type":"excalidraw"}',
      sessionId: 's',
    })
    expect(noElements.ok).toBe(true)
    expect(appended[2]).toMatchObject({ data: { elementCount: 0 } })
    await sessionsCtx.fiber?.dispose()
  })

  it('fails explicitly on an oversized document read', async () => {
    await writeFile(join(dir, 'big.excalidraw'), 'x'.repeat(DIAGRAM_READ_MAX_BYTES + 1))
    const result = await remote.read({ path: 'big.excalidraw' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('read-failed')
  })
})
