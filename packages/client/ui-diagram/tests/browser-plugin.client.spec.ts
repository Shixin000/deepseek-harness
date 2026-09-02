// ui-diagram browser half: keyed toolview registration + locale dictionaries,
// and fiber-teardown removal (HMR safety) against the real SlotRegistry.
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { apply, inject } from '../src/client/index.ts'
import { DiagramCard } from '../src/client/DiagramCard.tsx'
import { en, zh } from '../src/client/locales.ts'

/** Provide the presentation registries and capture the plugin's registrations. */
function providePresentation(ctx: Context): {
  slots: SlotRegistry
  dictionaries: Array<{ namespace: string; dictionaries: unknown }>
} {
  const slots = new SlotRegistry(ctx)
  slots.register({
    name: 'root',
    children: { 'tool.call.toolview': { kind: 'keyed', scope: 'session' } },
  } as never, () => null)
  const capture = { slots, dictionaries: [] as Array<{ namespace: string; dictionaries: unknown }> }
  ctx.provide('locale', {
    register(namespace: string, dictionaries: unknown) {
      capture.dictionaries.push({ namespace, dictionaries })
      return () => {}
    },
    bind: () => () => '',
  })
  return capture
}

describe('ui-diagram browser half', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'locale'])
  })

  it('registers the dedicated diagram row and its locale dictionaries', async () => {
    const ctx = new Context()
    const presentation = providePresentation(ctx)
    await ctx.plugin({ inject: [...inject], apply }).await()
    const entry = presentation.slots.entries('tool.call.toolview')[0]
    expect(entry?.options).toMatchObject({ key: 'diagram' })
    expect(entry?.locale).toBe('diagram')
    expect(entry?.component).toBe(DiagramCard)
    expect(presentation.dictionaries).toEqual([{ namespace: 'diagram', dictionaries: { zh, en } }])
  })

  it('removes the toolview registration when the fiber disposes (HMR safety)', async () => {
    const ctx = new Context()
    const presentation = providePresentation(ctx)
    const fiber = await ctx.plugin({ inject: [...inject], apply }).await()
    expect(presentation.slots.entries('tool.call.toolview')).toHaveLength(1)
    await fiber.dispose()
    expect(presentation.slots.entries('tool.call.toolview')).toHaveLength(0)
  })
})
