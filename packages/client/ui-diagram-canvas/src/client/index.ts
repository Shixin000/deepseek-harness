/**
 * Interactive whiteboard plugin, browser half: registers the diagram-canvas
 * locale dictionaries, the `shell.overlay` canvas panel, and the
 * "Open in editor" action contributed into the diagram card's open-action
 * slot. The panel and the action share one canvas store handle created in
 * this apply, so an open action and the overlay always see the same state.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { serializeAsJSON } from '@excalidraw/excalidraw'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { DiagramCardOpenOwnerProps } from '@deepseek-ai/dsh-client-ui-diagram/client'
import type {} from '@deepseek-ai/dsh-client-ui-diagram/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type { CanvasScene } from './canvas-store.ts'
import { CanvasPanel } from './CanvasPanel.tsx'
import { OpenInEditorButton } from './OpenInEditorButton.tsx'
import { createCanvasStore } from './canvas-store.ts'
import { en, NS, zh, type DiagramCanvasKey } from './locales.ts'
import { parseScene } from './reload.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The interactive whiteboard panel and card open action copy. */
    'diagram-canvas': DiagramCanvasKey
  }
}

/** Required services: the slot registry, the locale registry, and the Remote face. */
export const inject = ['slots', 'locale', 'remote']

/**
 * Client plugin body: register the dictionaries, the overlay, and the open action.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-diagram-canvas: dictionaries')
  // One canvas INSTANCE shared by the overlay and the open action (a store
  // handle cannot mount in two scopes — shell.overlay is root, the card chain
  // is session — so the instance travels through the inject faces instead).
  const canvas = createCanvasStore().create()
  const save = (path: string, scene: CanvasScene): Promise<boolean> =>
    ctx.remote.diagram.save({ path, content: serializeAsJSON(scene.elements, scene.appState, scene.files, 'local') })
      .then(result => result.ok)
  const reload = (path: string): Promise<CanvasScene | null> =>
    ctx.remote.diagram.read({ path })
      .then(result => result.ok && result.value.ok ? parseScene(result.value.content) : null)
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'diagram-canvas',
    locale: NS,
    inject: (): { canvas: typeof canvas; save: typeof save; reload: typeof reload } => ({ canvas, save, reload }),
  }, CanvasPanel))
  ctx.slots.inject('diagram.card.open', () => ctx.slots.register({
    name: 'diagram.card.open',
    select: (owner: DiagramCardOpenOwnerProps) => owner.file === '' ? null : owner,
    locale: NS,
    inject: (): { canvas: typeof canvas } => ({ canvas }),
  }, OpenInEditorButton))
}
