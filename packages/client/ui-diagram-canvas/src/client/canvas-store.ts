/**
 * Canvas panel view state: whether the whiteboard overlay is open, the file
 * path being edited, the live Excalidraw scene, and the dirty flag. The store
 * is declared on the shell.overlay registration; the open-action occupant
 * shares the same handle, so one writable set serves both entries.
 * @module @deepseek-ai/dsh-client-ui-diagram-canvas/canvas-store
 */

import { defineStore } from '@deepseek-ai/dsh-client-store'
import type { EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

/** One live Excalidraw scene kept by the panel. */
export interface CanvasScene {
  readonly elements: readonly ExcalidrawElement[]
  readonly appState: AppState
  readonly files: BinaryFiles
}

/** Panel state both the open action and the overlay render from. */
export interface CanvasState {
  /** Whether the whiteboard overlay is mounted. */
  open: boolean
  /** Workspace path being edited; '' means a fresh untitled canvas. */
  path: string
  /** Latest scene from the editor, or null before any change. */
  scene: CanvasScene | null
  /** Whether unsaved edits exist since the last save/load. */
  dirty: boolean
  /**
   * Editor remount key: bumped whenever the seeded scene is replaced, because
   * the memoized Excalidraw component reads `initialData` only at mount.
   */
  revision: number
}

/** Complete write set for the canvas panel state. */
export type CanvasActions = {
  /** Open the overlay for one path; a fresh canvas starts empty. */
  open: (draft: CanvasState, path: string) => void
  /** Close the overlay. */
  close: (draft: CanvasState) => void
  /** Record the editor's latest scene and mark the panel dirty. */
  setScene: (draft: CanvasState, scene: CanvasScene) => void
  /** Clear the dirty flag after a successful save/load. */
  markSaved: (draft: CanvasState) => void
  /** Replace the scene with a disk revision; the panel stays clean. */
  load: (draft: CanvasState, scene: CanvasScene) => void
}

/**
 * Create the canvas panel store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createCanvasStore(): EngineStoreHandle<CanvasState, CanvasActions> {
  return defineStore({
    init: (): CanvasState => ({ open: false, path: '', scene: null, dirty: false, revision: 0 }),
    actions: {
      open: (d, path) => {
        d.open = true
        d.path = path
        d.scene = null
        d.dirty = false
        d.revision += 1
      },
      close: (d) => {
        d.open = false
      },
      setScene: (d, scene) => {
        d.scene = scene
        d.dirty = true
      },
      markSaved: (d) => {
        d.dirty = false
      },
      load: (d, scene) => {
        d.scene = scene
        d.dirty = false
        d.revision += 1
      },
    },
  })
}

/** The store handle type consumed type-only by components. */
export type CanvasStore = ReturnType<typeof createCanvasStore>
