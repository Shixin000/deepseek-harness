// @vitest-environment jsdom
// Canvas panel overlay: mounts nothing while closed, renders the Excalidraw
// editor once open, forwards editor changes into the shared store, and wires
// the save bridge and close action.
import { afterEach } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'

import { createCanvasStore } from '../src/client/canvas-store.ts'
import type { CanvasScene } from '../src/client/canvas-store.ts'
import { CanvasPanel } from '../src/client/CanvasPanel.tsx'
import { en, zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, en)

// The Excalidraw editor is a heavy canvas component; the panel contract we
// own is the store wiring around it, so the component is stubbed. Mounts are
// counted so the remount-key behavior (reload replaces the initialData) is
// observable.
let mounts = 0
vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: (props: {
    key?: number
    initialData: unknown
    onChange?: (elements: unknown[], appState: unknown, files: unknown) => void
  }) => {
    mounts += 1
    return (
      <button
        type="button"
        data-testid="mock-excalidraw"
        data-initial={props.initialData === null ? 'null' : 'scene'}
        data-mounts={mounts}
        onClick={() => props.onChange?.([{ id: 'e1' }], { viewBackgroundColor: '#fff' }, {})}
      >
        mock
      </button>
    )
  },
  exportToBlob: async () => new Blob(['png']),
}))

/** One store + one live instance shared by the panel and the assertions. */
function bench(initial: { open: boolean; path: string }) {
  const store = createCanvasStore()
  const instance = store.create()
  if (initial.open) instance.actions.open(initial.path)
  const save = vi.fn(async () => true)
  const reload = vi.fn(async () => null) as ReturnType<typeof vi.fn> & ((path: string) => Promise<CanvasScene | null>)
  const props = {
    canvas: instance,
    save,
    reload,
    t,
    useSessions: (() => []) as never,
    useSessionPendingInteraction: (() => undefined) as never,
    useWorkspaces: (() => []) as never,
  }
  return { instance, save, reload, props }
}

describe('CanvasPanel', () => {
  it('renders nothing while the overlay is closed', () => {
    const { props } = bench({ open: false, path: '' })
    const { container } = render(<CanvasPanel {...props} />)
    expect(container.querySelector('[data-testid="diagram-canvas-panel"]')).toBeNull()
  })

  it('renders the editor, path, and save/close actions once open', () => {
    const { props } = bench({ open: true, path: '/ws/flow.excalidraw' })
    const { getByTestId, getByText } = render(<CanvasPanel {...props} />)
    expect(getByTestId('diagram-canvas-panel')).toBeTruthy()
    expect(getByTestId('mock-excalidraw')).toBeTruthy()
    expect(getByText('/ws/flow.excalidraw')).toBeTruthy()
    expect(getByText('保存')).toBeTruthy()
    expect(getByText('关闭')).toBeTruthy()
  })

  it('forwards editor changes into the store and marks the panel dirty', () => {
    const { instance, props } = bench({ open: true, path: '/ws/flow.excalidraw' })
    const { getByTestId } = render(<CanvasPanel {...props} />)
    fireEvent.click(getByTestId('mock-excalidraw'))
    expect(instance.getSnapshot().dirty).toBe(true)
    expect(instance.getSnapshot().scene).toMatchObject({ elements: [{ id: 'e1' }] })
  })

  it('saves through the bridge and clears the dirty flag on success', async () => {
    const { instance, save, props } = bench({ open: true, path: '/ws/flow.excalidraw' })
    const { getByTestId, getByText } = render(<CanvasPanel {...props} />)
    fireEvent.click(getByTestId('mock-excalidraw'))
    fireEvent.click(getByText('保存'))
    await vi.waitFor(() => { expect(instance.getSnapshot().dirty).toBe(false) })
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('keeps the dirty flag when the save bridge fails', async () => {
    const { instance, props } = bench({ open: true, path: '/ws/flow.excalidraw' })
    props.save = vi.fn(async () => false)
    const { getByTestId, getByText } = render(<CanvasPanel {...props} />)
    fireEvent.click(getByTestId('mock-excalidraw'))
    fireEvent.click(getByText('保存'))
    await vi.waitFor(() => { expect(props.save).toHaveBeenCalledTimes(1) })
    expect(instance.getSnapshot().dirty).toBe(true)
  })

  it('does not save without an editor scene', () => {
    const { save, props } = bench({ open: true, path: '/ws/flow.excalidraw' })
    const { getByText } = render(<CanvasPanel {...props} />)
    fireEvent.click(getByText('保存'))
    expect(save).not.toHaveBeenCalled()
  })

  it('omits the save action when the save bridge is not wired', () => {
    const { props } = bench({ open: true, path: '/ws/flow.excalidraw' })
    props.save = undefined as never
    const { queryByText } = render(<CanvasPanel {...props} />)
    expect(queryByText('保存')).toBeNull()
  })

  it('reloads from disk into a clean scene and remounts the editor', async () => {
    const { instance, reload, props } = bench({ open: true, path: '/ws/flow.excalidraw' })
    const scene = { elements: [{ id: 'disk' }], appState: { viewBackgroundColor: '#fff' }, files: {} } as unknown as CanvasScene
    reload.mockResolvedValue(scene)
    const { getByTestId, getByText } = render(<CanvasPanel {...props} />)
    const before = Number(getByTestId('mock-excalidraw').dataset.mounts)
    fireEvent.click(getByText('从磁盘重新加载'))
    await vi.waitFor(() => { expect(instance.getSnapshot().dirty).toBe(false) })
    expect(reload).toHaveBeenCalledWith('/ws/flow.excalidraw')
    expect(instance.getSnapshot().scene).toEqual(scene)
    expect(instance.getSnapshot().dirty).toBe(false)
    await vi.waitFor(() => { expect(Number(getByTestId('mock-excalidraw').dataset.mounts)).toBeGreaterThan(before) })
  })

  it('shows the reload error and keeps the scene when the disk read fails', async () => {
    const { instance, reload, props } = bench({ open: true, path: '/ws/flow.excalidraw' })
    const before = instance.getSnapshot().scene
    reload.mockResolvedValue(null)
    const { getByText } = render(<CanvasPanel {...props} />)
    fireEvent.click(getByText('从磁盘重新加载'))
    await vi.waitFor(() => { expect(getByText('重新加载失败')).toBeTruthy() })
    expect(instance.getSnapshot().scene).toBe(before)
  })

  it('omits the reload action when the reload bridge is not wired or the canvas is untitled', () => {
    const wired = bench({ open: true, path: '/ws/flow.excalidraw' })
    wired.props.reload = undefined as never
    const { queryByText, rerender } = render(<CanvasPanel {...wired.props} />)
    expect(queryByText('从磁盘重新加载')).toBeNull()
    const untitled = bench({ open: true, path: '' })
    rerender(<CanvasPanel {...untitled.props} />)
    expect(queryByText('从磁盘重新加载')).toBeNull()
  })

  it('exports the scene as a PNG download and clears any prior error', async () => {
    const { instance, props } = bench({ open: true, path: '/ws/flow.excalidraw' })
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { getByTestId, getByText, queryByText } = render(<CanvasPanel {...props} />)
    fireEvent.click(getByTestId('mock-excalidraw'))
    fireEvent.click(getByText('导出 PNG'))
    await vi.waitFor(() => { expect(click).toHaveBeenCalled() })
    expect(instance.getSnapshot().dirty).toBe(true)
    expect(queryByText('导出失败')).toBeNull()
  })

  it('shows the export error and keeps the scene when the export machinery fails', async () => {
    const { props } = bench({ open: true, path: '/ws/flow.excalidraw' })
    URL.createObjectURL = vi.fn(() => { throw new Error('no object URL in this environment') })
    const { getByTestId, getByText } = render(<CanvasPanel {...props} />)
    fireEvent.click(getByTestId('mock-excalidraw'))
    fireEvent.click(getByText('导出 PNG'))
    await vi.waitFor(() => { expect(getByText('导出失败')).toBeTruthy() })
  })

  it('closes the overlay through the close action', () => {
    const { instance, props } = bench({ open: true, path: '/ws/flow.excalidraw' })
    const { getByText } = render(<CanvasPanel {...props} />)
    fireEvent.click(getByText('关闭'))
    expect(instance.getSnapshot().open).toBe(false)
  })

  it('renders the untitled label for an empty path', () => {
    const { props } = bench({ open: true, path: '' })
    const { getByText } = render(<CanvasPanel {...props} />)
    expect(getByText('未命名')).toBeTruthy()
  })
})
