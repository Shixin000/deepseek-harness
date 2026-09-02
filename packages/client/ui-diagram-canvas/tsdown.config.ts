import { dirname, resolve } from 'node:path'
import { clientBundle } from '../tsdown.client.ts'

// The Excalidraw editor lazily imports its diagram libraries, and its
// dagre-d3-es dependency keeps one runtime `import()` back into its own
// graphlib module. rolldown would split those into hash-named chunks the
// module loader cannot serve and the `files` list cannot publish, so both are
// pinned into the single lib/client.js artifact (see ClientBundleOptions.client).
export default clientBundle('@deepseek-ai/dsh-client-ui-diagram-canvas', ['lib/types/index.js', 'lib/types/invariant.js'], {
  client: {
    outputOptions: { inlineDynamicImports: true },
    plugins: [{
      name: 'dsh-client-inline-dagre-graphlib',
      resolveDynamicImport(specifier: string | unknown[], importer: string | undefined) {
        if (typeof specifier === 'string' && specifier.includes('graphlib/graph') && importer !== undefined) {
          return { id: resolve(dirname(importer), specifier) }
        }
        return null
      },
    }],
  },
})
