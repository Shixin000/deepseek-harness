/**
 * Reload-from-disk parsing for the canvas panel: turn a `.excalidraw`
 * document's text back into a live editor scene. Excalidraw's own `restore`
 * repairs element versions and bindings, so the panel always mounts a
 * consistent scene; malformed payloads resolve to null and the panel shows
 * the reload error rather than crashing the editor.
 * @module @deepseek-ai/dsh-client-ui-diagram-canvas/reload
 */

import { restore } from '@excalidraw/excalidraw'
import type { CanvasScene } from './canvas-store.ts'

/**
 * Parse serialized document text into a live scene; never throws.
 * @param content - the `.excalidraw` document text from the read Remote.
 * @returns the restored scene, or null when the payload is not a document.
 */
export function parseScene(content: string): CanvasScene | null {
  let restored: ReturnType<typeof restore>
  try {
    const document: unknown = JSON.parse(content)
    if (typeof document !== 'object' || document === null) return null
    const record = document as Record<string, unknown>
    if (!Array.isArray(record.elements)) return null
    restored = restore(record, null, null, { repairBindings: true })
  } catch {
    // Malformed JSON or a restore failure is a reload error, not a crash.
    return null
  }
  return {
    elements: restored.elements,
    // RestoredAppState omits the viewport-computed offset/width/height fields;
    // the editor fills them at mount, so widening to the scene's AppState is safe.
    appState: restored.appState as CanvasScene['appState'],
    files: restored.files,
  }
}
