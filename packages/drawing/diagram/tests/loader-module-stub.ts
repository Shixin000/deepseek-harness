/**
 * Test stub for the Cordis Loader's Node-internal module surface.
 *
 * A composition test drives the real Loader and only exercises `import`; the
 * remaining Node loader members exist on the runtime type but are never called.
 * The loader's `internal.ts` keeps `LoadCache` unexported, so the one member the
 * stub cannot declare moves through `never`, and the rest are typed exactly.
 */

import type { ModuleLoaderV2 } from '../../../../vendor/loader/src/internal.ts'

/**
 * Build the `ctx.loader.internal` stub that resolves a fixed module map.
 * @param modules - specifier to plugin namespace map the Loader may import.
 * @returns the stub to assign to `ctx.loader.internal`.
 */
export function loaderInternalStub(modules: ReadonlyMap<string, unknown>): ModuleLoaderV2 {
  const jobs = new Map()
  return {
    version: 'v2',
    // LoadCache is not exported by the loader's internal module; nothing in this
    // composition reads the cache, so the empty map only satisfies the type.
    loadCache: jobs as never,
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
    register() {},
    async getOrCreateModuleJob() {
      throw new Error('loader stub: getOrCreateModuleJob is unused')
    },
    resolveSync() {
      throw new Error('loader stub: resolveSync is unused')
    },
    async load() {
      throw new Error('loader stub: load is unused')
    },
  }
}
