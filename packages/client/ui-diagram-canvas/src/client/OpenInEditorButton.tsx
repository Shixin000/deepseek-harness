/**
 * The "Open in editor" action contributed into the diagram card's open-action
 * chain: opens the whiteboard overlay seeded with the card's file path. The
 * occupant lives in this package so the card package never depends on the
 * canvas panel; the chain's `select` passes the card's owner currency as the
 * `matched` value.
 * @module @deepseek-ai/dsh-client-ui-diagram-canvas/OpenInEditorButton
 */

import type { EngineStoreInstance } from '@deepseek-ai/dsh-client-store'
import type { DiagramCardOpenOwnerProps } from '@deepseek-ai/dsh-client-ui-diagram/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { CanvasActions, CanvasState } from './canvas-store.ts'
import css from './OpenInEditorButton.module.css'

/** Injected face: the one canvas instance shared with the overlay. */
export interface OpenInEditorInjected {
  canvas: EngineStoreInstance<CanvasState, CanvasActions>
}

/** Full props of the card open-action occupant. */
export type OpenInEditorButtonProps = {
  /** The chain match: the card's owner currency (its produced file path). */
  matched: DiagramCardOpenOwnerProps
} & PropsLocale<'diagram-canvas'>
  & InjectFace<OpenInEditorInjected>

/** Open the whiteboard for the card's file. */
export function OpenInEditorButton({ matched, canvas, t }: OpenInEditorButtonProps) {
  if (matched.file === '') return null
  return (
    <button type="button" className={css.open} onClick={() => { canvas.actions.open(matched.file) }}>
      {t('panel.openInEditor')}
    </button>
  )
}
