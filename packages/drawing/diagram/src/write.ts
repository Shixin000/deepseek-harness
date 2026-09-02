/**
 * `.excalidraw` document assembly and workspace write. The document keeps the
 * minimal stable Excalidraw envelope (`type`, `version`, `source`, `elements`,
 * `appState`, `files`) so any Excalidraw-compatible editor can open it; writes
 * go through `ctx.fs` so the session's sandbox and observation policy apply.
 * @module @deepseek-ai/dsh-diagram/write
 */

import type { Context } from '@deepseek-ai/cordis'
import type { FsTarget, FsWriteOutcome } from '@deepseek-ai/dsh-fs'
import type { ExpandedElement } from './expand.ts'

/** Stable marker of who produced the document. */
export const DIAGRAM_SOURCE = 'dsh diagram tool'

/** The `.excalidraw` file extension the tool accepts, case-insensitively. */
export const DIAGRAM_EXTENSION = '.excalidraw'

/** A complete Excalidraw document as written by this package. */
export interface DiagramDocument {
  type: 'excalidraw'
  version: 2
  source: string
  elements: readonly ExpandedElement[]
  appState: { viewBackgroundColor: string }
  files: Record<string, never>
}

/**
 * Serialize expanded elements into the `.excalidraw` document text.
 * @param elements - the expanded elements in spec order.
 * @returns the pretty-printed JSON document.
 */
export function serializeDiagram(elements: readonly ExpandedElement[]): string {
  const document: DiagramDocument = {
    type: 'excalidraw',
    version: 2,
    source: DIAGRAM_SOURCE,
    elements,
    appState: { viewBackgroundColor: '#ffffff' },
    files: {},
  }
  return JSON.stringify(document, null, 2)
}

/**
 * Validate the file argument the schema cannot constrain: non-blank and an
 * `.excalidraw` suffix.
 * @param file - the schema-validated file argument.
 * @returns the trimmed path when valid.
 */
export function parseDiagramFile(file: string): string {
  const trimmed = file.trim()
  if (trimmed.length === 0) throw new Error('file must be a non-empty string')
  if (!trimmed.toLowerCase().endsWith(DIAGRAM_EXTENSION)) {
    throw new Error(`file must end with ${DIAGRAM_EXTENSION}`)
  }
  return trimmed
}

/**
 * Write one diagram document through the session's filesystem service and
 * record the observation. The write is unconditional (the tool always
 * replaces the whole document), matching the bare `write`-tool path.
 * @param ctx - the plugin context carrying the `fs` service and event bus.
 * @param target - the resolved write target.
 * @param json - the serialized document.
 * @param signal - aborts before atomic publication takes effect.
 * @param actor - the caller presented to the write-intent slot and observation.
 * @returns the write outcome, whose version the observation records.
 */
export async function writeDiagram(
  ctx: Context,
  target: FsTarget,
  json: string,
  signal: AbortSignal,
  actor: object | undefined,
): Promise<FsWriteOutcome> {
  const intent = await ctx.waterfall('fs/write-intent', target, actor, () => undefined)
  const outcome = await ctx.fs.writeText(target, json, intent, signal)
  ctx.emit('fs/observed', target, { kind: 'present', version: outcome.version }, actor)
  return outcome
}
