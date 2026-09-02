// @vitest-environment jsdom
// Reload-from-disk parsing: turns a .excalidraw document's text back into a
// live editor scene through Excalidraw's restore, resolving null for anything
// that is not a valid document (including a restore failure) so the panel can
// show a reload error instead of crashing.
import { describe, expect, it, vi } from 'vitest'

const restore = vi.fn<(data: object, a: null, b: null, opts: object) => { elements: unknown[]; appState: object; files: object }>()

vi.mock('@excalidraw/excalidraw', () => ({
  restore: (data: object, a: null, b: null, opts: object) => restore(data, a, b, opts),
}))

import { parseScene } from '../src/client/reload.ts'

const DOCUMENT = {
  type: 'excalidraw',
  elements: [{ id: 'a', type: 'rectangle', x: 0, y: 0, width: 1, height: 1 }],
  appState: { viewBackgroundColor: '#fff' },
  files: {},
}

describe('parseScene', () => {
  it('restores a valid document into a live scene', () => {
    restore.mockReturnValue({ elements: DOCUMENT.elements, appState: DOCUMENT.appState, files: DOCUMENT.files })
    expect(parseScene(JSON.stringify(DOCUMENT))).toEqual({
      elements: DOCUMENT.elements,
      appState: DOCUMENT.appState,
      files: DOCUMENT.files,
    })
    expect(restore).toHaveBeenCalledWith(DOCUMENT, null, null, { repairBindings: true })
  })

  it('resolves null for malformed payloads', () => {
    expect(parseScene('not json')).toBeNull()
    expect(parseScene('42')).toBeNull()
    expect(parseScene(JSON.stringify({ type: 'excalidraw' }))).toBeNull()
  })

  it('resolves null when restore fails', () => {
    restore.mockImplementation(() => { throw new Error('corrupt scene') })
    expect(parseScene(JSON.stringify(DOCUMENT))).toBeNull()
  })
})
