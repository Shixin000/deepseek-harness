/** Diagram UI slot declarations and their composed component props. */
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * Selector-routed extension rendered in the diagram card's header row:
     * the first occupant that accepts the owner renders. The card owner
     * supplies the file path the produced call wrote; a canvas panel registers
     * here to offer "Open in editor" without the card depending on it.
     */
    'diagram.card.open': { kind: 'chain'; scope: 'session'; owner: DiagramCardOpenOwnerProps }
  }
}

/** Owner currency for the diagram card's open-action chain. */
export interface DiagramCardOpenOwnerProps {
  /** The workspace file path the diagram call produced; '' when unknown. */
  file: string
}

/** Full props of a registered diagram card open-action occupant. */
export type DiagramCardOpenProps = PropsRuntime<'diagram.card.open'>
