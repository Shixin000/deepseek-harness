/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-diagram-canvas`.
 * @module @deepseek-ai/dsh-client-ui-diagram-canvas/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-diagram-canvas'

/** Cordis companion plugin name. */
export const name = 'client-ui-diagram-canvas-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the overlay panel registration and locale dictionaries
 * are registry-owned registrations whose disposal is proven by the HMR-safety
 * spec. The panel renders wire data and emits no cordis events.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
