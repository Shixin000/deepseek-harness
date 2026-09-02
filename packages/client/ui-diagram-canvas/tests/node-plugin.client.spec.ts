// The node half is deliberately empty: mounting it must not register anything
// model-facing or fail.
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as plugin from '../src/index.ts'

describe('ui-diagram-canvas node half', () => {
  it('applies without registering services', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin(plugin).await()
    expect(ctx.tools).toBeUndefined()
    await fiber.dispose()
  })
})
