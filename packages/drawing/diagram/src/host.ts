/**
 * Host-plane entry for the diagram Remote gateway. The tool plugin stays in
 * agent presets (per-session), while this service must live on the host plane
 * so the Gateway can resolve it for `ctx.remote.diagram` calls; typert-loader
 * discovers the package's `./typert` artifact and registers the descriptors.
 * @module @deepseek-ai/dsh-diagram/host
 */

import DiagramRemote from './remote.ts'

export default DiagramRemote
