// @vitest-environment jsdom
// PNG export helpers: the download base name derivation and the blob render
// + browser download trigger, including the failure arm (export or download
// machinery throwing resolves false so the panel shows the export error).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanvasScene } from '../src/client/canvas-store.ts'

const exportToBlob = vi.fn<(opts: object) => Promise<Blob>>()
const createObjectURL = vi.fn(() => 'blob:mock')
const revokeObjectURL = vi.fn()

vi.mock('@excalidraw/excalidraw', () => ({ exportToBlob: (opts: object) => exportToBlob(opts) }))

import { diagramBaseName, downloadScene } from '../src/client/export.ts'

let clicks = 0
beforeEach(() => {
  clicks = 0
  exportToBlob.mockReset()
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const SCENE: CanvasScene = {
  elements: [
    { id: 'a', type: 'rectangle', x: 0, y: 0, width: 1, height: 1, isDeleted: false },
    { id: 'b', type: 'text', x: 0, y: 0, width: 1, height: 1, isDeleted: true },
  ] as never,
  appState: { viewBackgroundColor: '#fff' } as CanvasScene['appState'],
  files: {},
}

describe('diagramBaseName', () => {
  it('derives the leaf name without the .excalidraw extension', () => {
    expect(diagramBaseName('a/b/flow.excalidraw')).toBe('flow')
    expect(diagramBaseName('FLOW.EXCALIDRAW')).toBe('FLOW')
    expect(diagramBaseName('')).toBe('diagram')
  })
})

describe('downloadScene', () => {
  it('renders the live elements, downloads a named PNG, and revokes the URL', async () => {
    exportToBlob.mockResolvedValue(new Blob(['png']))
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { clicks += 1 })
    await expect(downloadScene(SCENE, 'flow')).resolves.toBe(true)
    expect(exportToBlob).toHaveBeenCalledWith(expect.objectContaining({
      mimeType: 'image/png',
      elements: [{ id: 'a', type: 'rectangle', x: 0, y: 0, width: 1, height: 1, isDeleted: false }],
    }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clicks).toBe(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('resolves false when the export throws, and still cleans up any URL', async () => {
    exportToBlob.mockRejectedValue(new Error('canvas blocked'))
    await expect(downloadScene(SCENE, 'flow')).resolves.toBe(false)
    expect(clicks).toBe(0)
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })
})
