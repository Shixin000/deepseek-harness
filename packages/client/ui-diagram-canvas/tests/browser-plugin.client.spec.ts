// ui-diagram-canvas browser half: overlay + open-action registrations, locale
// dictionaries, and fiber-teardown removal (HMR safety) against the real
// SlotRegistry.
/** The heavyweight editor is not needed for registration assertions. */
vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: () => null,
  serializeAsJSON: () => '{}',
  restore: (data: { elements: unknown[]; appState: unknown; files: unknown }) => ({
    elements: data.elements,
    appState: data.appState,
    files: data.files,
  }),
  exportToBlob: async () => new Blob(['png']),
}))

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { apply, inject } from '../src/client/index.ts'
import { CanvasPanel } from '../src/client/CanvasPanel.tsx'
import { OpenInEditorButton } from '../src/client/OpenInEditorButton.tsx'
import { en, zh } from '../src/client/locales.ts'

/** Provide the presentation registries and capture the plugin's registrations. */
function providePresentation(ctx: Context): {
  slots: SlotRegistry
  dictionaries: Array<{ namespace: string; dictionaries: unknown }>
  read: ReturnType<typeof vi.fn>
} {
  const slots = new SlotRegistry(ctx)
  slots.register({
    name: 'root',
    children: {
      'shell.overlay': { kind: 'list', scope: 'root' },
      'diagram.card.open': { kind: 'chain', scope: 'session' },
    },
  } as never, () => null)
  const capture = { slots, dictionaries: [] as Array<{ namespace: string; dictionaries: unknown }> }
  const read = vi.fn(async () => ({
    ok: true as const,
    value: {
      ok: true as const,
      path: '/ws/x.excalidraw',
      content: JSON.stringify({ type: 'excalidraw', elements: [{ id: 'disk' }], appState: {}, files: {} }),
      bytes: 1,
    },
  }))
  ctx.provide('locale', {
    register(namespace: string, dictionaries: unknown) {
      capture.dictionaries.push({ namespace, dictionaries })
      return () => {}
    },
    bind: () => () => '',
  })
  ctx.provide('remote', {
    diagram: {
      save: vi.fn(async () => ({ ok: true as const, path: '/ws/x.excalidraw', bytes: 1 })),
      read,
    },
  })
  return { ...capture, read }
}

describe('ui-diagram-canvas browser half', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote'])
  })

  it('registers the overlay, the open action, and the dictionaries', async () => {
    const ctx = new Context()
    const presentation = providePresentation(ctx)
    await ctx.plugin({ inject: [...inject], apply }).await()
    const overlay = presentation.slots.entries('shell.overlay')[0]
    expect(overlay?.options).toMatchObject({ id: 'diagram-canvas' })
    expect(overlay?.component).toBe(CanvasPanel)
    // Exercise the render-time inject factories directly (slot rendering is
    // outside this spec's scope) so the wiring is covered.
    const overlayFace = overlay?.inject?.() as {
      canvas: { actions: object }
      save: (path: string, scene: object) => Promise<boolean>
      reload: (path: string) => Promise<object | null>
    }
    expect(overlayFace.canvas.actions).toBeDefined()
    await expect(overlayFace.save('/ws/x.excalidraw', { elements: [], appState: {}, files: {} })).resolves.toBe(true)
    await expect(overlayFace.reload('/ws/x.excalidraw')).resolves.toMatchObject({ elements: [{ id: 'disk' }] })
    presentation.read.mockResolvedValueOnce({ ok: false as const, error: { code: 'read-failed', message: 'boom' } })
    await expect(overlayFace.reload('/ws/x.excalidraw')).resolves.toBeNull()
    const open = presentation.slots.entries('diagram.card.open')[0]
    expect(open?.select?.({ file: '' } as never)).toBeNull()
    expect(open?.select?.({ file: '/ws/flow.excalidraw' } as never)).toMatchObject({ file: '/ws/flow.excalidraw' })
    const openFace = open?.inject?.() as { canvas: { actions: object } }
    expect(openFace.canvas.actions).toBeDefined()
    expect(open?.component).toBe(OpenInEditorButton)
    expect(presentation.dictionaries).toEqual([{ namespace: 'diagram-canvas', dictionaries: { zh, en } }])
  })

  it('removes both registrations when the fiber disposes (HMR safety)', async () => {
    const ctx = new Context()
    const presentation = providePresentation(ctx)
    const fiber = await ctx.plugin({ inject: [...inject], apply }).await()
    expect(presentation.slots.entries('shell.overlay')).toHaveLength(1)
    expect(presentation.slots.entries('diagram.card.open')).toHaveLength(1)
    await fiber.dispose()
    expect(presentation.slots.entries('shell.overlay')).toHaveLength(0)
    expect(presentation.slots.entries('diagram.card.open')).toHaveLength(0)
  })
})
