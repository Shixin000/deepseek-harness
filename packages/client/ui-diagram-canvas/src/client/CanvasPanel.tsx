/**
 * The interactive whiteboard overlay: a full-screen Excalidraw editor mounted
 * through the `shell.overlay` list seat. The panel renders the shared canvas
 * instance's current scene, forwards every editor change back into it
 * (marking the panel dirty), offers Save and Reload-from-disk (through the
 * injected callbacks) and Close. Opening with a path from the diagram card
 * seeds the editor with the card's persisted elements; Reload replaces the
 * scene with the on-disk revision without marking the panel dirty. The
 * editor is remounted through the store's `revision` key because Excalidraw
 * reads `initialData` only at mount.
 * @module @deepseek-ai/dsh-client-ui-diagram-canvas/CanvasPanel
 */

import { useState, useSyncExternalStore } from 'react'
import type { ComponentProps } from 'react'
import type { EngineStoreInstance } from '@deepseek-ai/dsh-client-store'
import { Excalidraw } from '@excalidraw/excalidraw'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { CanvasActions, CanvasScene, CanvasState } from './canvas-store.ts'
import { diagramBaseName, downloadScene } from './export.ts'
import css from './CanvasPanel.module.css'

/** Injected face: the shared canvas instance and the save/reload bridges. */
export interface CanvasPanelInjected {
  /** The one canvas instance shared with the open action. */
  canvas: EngineStoreInstance<CanvasState, CanvasActions>
  /** Persist one scene to its path through the workspace RPC; resolves true on success. */
  save: ((path: string, scene: CanvasScene) => Promise<boolean>) | undefined
  /** Load the on-disk revision for one path through the workspace RPC; resolves the scene or null. */
  reload: ((path: string) => Promise<CanvasScene | null>) | undefined
}

/** Full props of the registered overlay occupant. */
export type CanvasPanelProps =
  PropsRuntime<'shell.overlay'>
  & PropsLocale<'diagram-canvas'>
  & InjectFace<CanvasPanelInjected>

/** The whiteboard overlay occupant. */
export function CanvasPanel({ canvas, save, reload, t }: CanvasPanelProps) {
  const state = useSyncExternalStore(
    fn => canvas.store.subscribe(fn),
    () => canvas.store.getSnapshot(),
  )
  const [actionError, setActionError] = useState<'reload' | 'export' | null>(null)
  if (!state.open) return null
  // A const snapshot lets the export closure below use the narrowed non-null scene.
  const scene = state.scene
  const excalidrawProps: ComponentProps<typeof Excalidraw> = {
    initialData: scene === null
      ? null
      : { elements: [...scene.elements], appState: scene.appState, files: scene.files },
    onChange: (elements, appState, files) => {
      canvas.actions.setScene({ elements, appState, files })
    },
    UIOptions: {
      canvasActions: {
        loadScene: false,
        saveToActiveFile: false,
        export: false,
      },
    },
  }
  return (
    <div className={css.overlay} data-testid="diagram-canvas-panel">
      <div className={css.bar}>
        <span className={css.title}>{t('panel.title')}</span>
        <span className={css.path} title={state.path}>
          {state.path === '' ? t('panel.untitled') : state.path}
        </span>
        {state.dirty && <span className={css.dirty}>{t('panel.dirty')}</span>}
        {actionError !== null && (
          <span className={css.error}>{actionError === 'reload' ? t('panel.reloadError') : t('panel.exportError')}</span>
        )}
        {reload !== undefined && state.path !== '' && (
          <button
            type="button"
            className={css.reload}
            onClick={() => {
              void reload(state.path).then((scene) => {
                if (scene === null) {
                  setActionError('reload')
                } else {
                  setActionError(null)
                  canvas.actions.load(scene)
                }
              })
            }}
          >
            {t('panel.reload')}
          </button>
        )}
        {scene !== null && (
          <button
            type="button"
            className={css.export}
            onClick={() => {
              void downloadScene(scene, diagramBaseName(state.path)).then((ok) => { setActionError(ok ? null : 'export') })
            }}
          >
            {t('panel.export')}
          </button>
        )}
        {save !== undefined && (
          <button
            type="button"
            className={css.save}
            onClick={() => {
              if (state.scene !== null) void save(state.path, state.scene).then((ok) => { if (ok) canvas.actions.markSaved() })
            }}
          >
            {t('panel.save')}
          </button>
        )}
        <button type="button" className={css.close} onClick={() => { canvas.actions.close() }}>{t('panel.close')}</button>
      </div>
      <div className={css.editor}>
        <Excalidraw key={state.revision} {...excalidrawProps} />
      </div>
    </div>
  )
}
