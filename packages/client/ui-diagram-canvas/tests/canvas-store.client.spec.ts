// Canvas store behavior: the shared open/close/scene/dirty state both the
// open action and the overlay render from.
import { describe, expect, it } from 'vitest'
import { createCanvasStore } from '../src/client/canvas-store.ts'
import type { CanvasScene } from '../src/client/canvas-store.ts'

function scene(): CanvasScene {
  return { elements: [], appState: { viewBackgroundColor: '#fff' } as CanvasScene['appState'], files: {} }
}

describe('createCanvasStore', () => {
  it('starts closed with no path, scene, or dirty flag', () => {
    const handle = createCanvasStore()
    const instance = handle.create()
    expect(instance.getSnapshot()).toEqual({ open: false, path: '', scene: null, dirty: false, revision: 0 })
  })

  it('open() mounts the overlay for a path with a fresh scene', () => {
    const handle = createCanvasStore()
    const instance = handle.create()
    instance.actions.open('/ws/flow.excalidraw')
    expect(instance.getSnapshot()).toMatchObject({ open: true, path: '/ws/flow.excalidraw', scene: null, dirty: false, revision: 1 })
  })

  it('setScene() records the editor scene and marks the panel dirty', () => {
    const handle = createCanvasStore()
    const instance = handle.create()
    instance.actions.open('/ws/flow.excalidraw')
    instance.actions.setScene(scene())
    const snapshot = instance.getSnapshot()
    expect(snapshot.dirty).toBe(true)
    expect(snapshot.scene).toEqual(scene())
  })

  it('markSaved() clears the dirty flag without touching the scene', () => {
    const handle = createCanvasStore()
    const instance = handle.create()
    instance.actions.open('/ws/flow.excalidraw')
    instance.actions.setScene(scene())
    instance.actions.markSaved()
    expect(instance.getSnapshot()).toMatchObject({ dirty: false, scene: scene() })
  })

  it('load() replaces the scene cleanly and bumps the remount revision', () => {
    const handle = createCanvasStore()
    const instance = handle.create()
    instance.actions.open('/ws/flow.excalidraw')
    instance.actions.setScene(scene())
    instance.actions.load(scene())
    const snapshot = instance.getSnapshot()
    expect(snapshot).toMatchObject({ dirty: false, scene: scene(), revision: 2 })
  })

  it('close() unmounts the overlay but keeps the edited path', () => {
    const handle = createCanvasStore()
    const instance = handle.create()
    instance.actions.open('/ws/flow.excalidraw')
    instance.actions.close()
    expect(instance.getSnapshot()).toMatchObject({ open: false, path: '/ws/flow.excalidraw' })
  })
})
