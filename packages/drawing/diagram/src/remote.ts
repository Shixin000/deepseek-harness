/**
 * Host-side Remote gateway for the interactive whiteboard: saves the edited
 * Excalidraw scene back into the session workspace and reads an existing
 * `.excalidraw` file for re-opening. The write goes through `ctx.fs` like the
 * `diagram` tool, so the session's sandbox applies; a session event for the
 * save is deferred until canvas content enters a model request (the M-C
 * milestone), per the model-visible ⟺ logged rule.
 * @module @deepseek-ai/dsh-diagram/remote
 */

import type { Context } from '@deepseek-ai/cordis'
import type { FsTarget, FsWriteOutcome } from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-fs'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { DiagramReadRequest, DiagramReadResult, DiagramSaveRequest, DiagramSaveResult } from './types.ts'
import type {} from '@deepseek-ai/dsh-session/types'
import { DIAGRAM_EXTENSION } from './write.ts'

/** Inclusive byte cap for one canvas read; larger files fail explicitly. */
export const DIAGRAM_READ_MAX_BYTES = 16 * 1024 * 1024

/** Validate and resolve the requested path (absolute, or backend-default cwd). */
async function resolveDiagramTarget(
  ctx: Context,
  path: string,
): Promise<{ ok: true; target: FsTarget } | { ok: false; message: string }> {
  const trimmed = path.trim()
  if (trimmed.length === 0 || !trimmed.toLowerCase().endsWith(DIAGRAM_EXTENSION)) {
    return { ok: false, message: `path must end with ${DIAGRAM_EXTENSION}` }
  }
  const target = await ctx.fs.resolve(trimmed)
  return { ok: true, target }
}

/** The host gateway backing canvas save/load through `ctx.remote.diagram`. */
export class DiagramRemote extends TypertRemoteService {
  static inject = ['fs', 'sessions']

  /**
   * @param ctx - Host context carrying the filesystem seam.
   */
  constructor(ctx: Context) {
    super(ctx, 'diagram')
  }

  /**
   * Write the edited scene into the workspace as a `.excalidraw` document.
   * @param request - output path, serialized document, and the optional owning session.
   * @returns the resolved path and byte count, or an explicit failure.
   */
  @Remote('save')
  async save(request: DiagramSaveRequest): Promise<DiagramSaveResult> {
    const resolved = await resolveDiagramTarget(this.ctx, request.path)
    if (!resolved.ok) return { ok: false, code: 'invalid-path', message: resolved.message }
    let outcome: FsWriteOutcome
    try {
      outcome = await this.ctx.fs.writeText(resolved.target, request.content)
      void outcome
    } catch (error: unknown) {
      return {
        ok: false,
        code: 'write-failed',
        // v8 ignore -- the fs seam throws Error instances; the fallback keeps any throw honest
        message: error instanceof Error ? error.message : /* v8 ignore next */ String(error),
      }
    }
    const bytes = new TextEncoder().encode(request.content).byteLength
    recordDiagramSave(this.ctx, request.sessionId, resolved.target.displayPath, request.content)
    return { ok: true, path: resolved.target.displayPath, bytes }
  }

  /**
   * Read an existing `.excalidraw` document for the canvas panel.
   * @param request - input path.
   * @returns the document text (bounded), or an explicit failure.
   */
  @Remote('read')
  async read(request: DiagramReadRequest): Promise<DiagramReadResult> {
    const resolved = await resolveDiagramTarget(this.ctx, request.path)
    if (!resolved.ok) return { ok: false, code: 'invalid-path', message: resolved.message }
    let bytes: Uint8Array
    try {
      bytes = await this.ctx.fs.readBytes(resolved.target, undefined, DIAGRAM_READ_MAX_BYTES)
    } catch (error: unknown) {
      return {
        ok: false,
        code: 'read-failed',
        // v8 ignore -- the fs seam throws Error instances; the fallback keeps any throw honest
        message: error instanceof Error ? error.message : /* v8 ignore next */ String(error),
      }
    }
    return {
      ok: true,
      path: resolved.target.displayPath,
      content: new TextDecoder().decode(bytes),
      bytes: bytes.byteLength,
    }
  }
}

export default DiagramRemote

/** Count elements in a serialized document; 0 when the payload is not parseable. */
function countElements(content: string): number {
  try {
    const parsed = JSON.parse(content) as { elements?: unknown }
    return Array.isArray(parsed.elements) ? parsed.elements.length : 0
  } catch {
    return 0
  }
}

/**
 * Record the log-only `diagram/saved` event for the owning session, when one
 * is attached. The save itself never depends on this: a session-less caller
 * (or a Host without the session store) simply skips the event.
 */
function recordDiagramSave(ctx: Context, sessionId: string | undefined, path: string, content: string): void {
  if (sessionId === undefined) return
  const sessions = ctx.get('sessions') as { get(id: string): { append(type: string, data: object): void } | undefined } | undefined
  const session = sessions?.get(sessionId)
  session?.append('diagram/saved', { path, elementCount: countElements(content) })
}
