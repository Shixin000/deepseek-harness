/**
 * Diagram card plugin, browser half: registers the `diagram` locale
 * dictionaries and the keyed `tool.call.toolview` row that renders `diagram`
 * tool calls inline. The card derives everything from the raw wire call/result
 * slice, so it renders identically live and on replay; its header carries the
 * `diagram.card.open` chain a canvas panel can extend.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import { DiagramCard } from './DiagramCard.tsx'
import type {} from './contract/slots.ts'
export type { DiagramCardOpenOwnerProps, DiagramCardOpenProps } from './contract/slots.ts'
import { en, NS, zh, type DiagramKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The dedicated diagram tool card's copy. */
    diagram: DiagramKey
  }
}

/** Required services: the slot registry and the locale registry. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: register the dictionaries and the keyed tool row.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-diagram: dictionaries')
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'diagram',
    locale: NS,
    children: { 'diagram.card.open': { kind: 'chain', scope: 'session' } },
  }, DiagramCard))
}
