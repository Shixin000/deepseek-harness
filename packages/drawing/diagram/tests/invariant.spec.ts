import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as DiagramInvariant from '@deepseek-ai/dsh-diagram/invariant'

describe('dsh-diagram invariant companion', () => {
  it('registers its companion without rejecting', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(DiagramInvariant).then(() => undefined)).resolves.toBeUndefined()
    await ctx.fiber?.dispose()
  })
})
