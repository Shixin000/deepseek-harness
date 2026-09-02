/**
 * PNG export for the canvas panel: render the live scene through Excalidraw's
 * `exportToBlob` and trigger a browser download. Pure client-side — the
 * render happens in the browser, so no workspace RPC is involved; failures
 * resolve false and the panel shows the export error.
 * @module @deepseek-ai/dsh-client-ui-diagram-canvas/export
 */

import { exportToBlob } from '@excalidraw/excalidraw'
import type { NonDeleted } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { CanvasScene } from './canvas-store.ts'

/**
 * The download file base name for one workspace path ('x' for 'a/b/x.excalidraw', 'diagram' when empty).
 * @param path - the workspace file path.
 * @returns the base name without the .excalidraw extension.
 */
export function diagramBaseName(path: string): string {
  const leaf = path.split('/').pop()
  return leaf !== undefined && leaf !== '' ? leaf.replace(/\.excalidraw$/i, '') : 'diagram'
}

/**
 * Render the scene to a PNG and download it.
 * @param scene - the live editor scene.
 * @param baseName - download file name without extension.
 * @returns true when the download was triggered, false on any render failure.
 */
export async function downloadScene(scene: CanvasScene, baseName: string): Promise<boolean> {
  let url: string | undefined
  try {
    const blob = await exportToBlob({
      // The editor keeps deleted elements for undo; export renders the live ones.
      elements: scene.elements.filter((element): element is NonDeleted<ExcalidrawElement> => !element.isDeleted),
      appState: scene.appState,
      files: scene.files,
      mimeType: 'image/png',
    })
    url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${baseName}.png`
    anchor.click()
    return true
  } catch {
    return false
  } finally {
    if (url !== undefined) URL.revokeObjectURL(url)
  }
}
