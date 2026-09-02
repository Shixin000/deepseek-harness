/**
 * Typings for the `@excalidraw/utils` subpaths the Excalidraw package's type
 * entry re-exports but never ships: `@excalidraw/utils` has no stable npm
 * release, so the re-exported `exportToBlob`/`exportToCanvas` names would
 * otherwise resolve to an error type. Only the narrow surface this package
 * uses is declared; the runtime implementation comes from the Excalidraw
 * bundle itself, so these declarations are types-only.
 */

declare module '@excalidraw/utils/export' {
  import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types'
  import type { ExcalidrawElement, NonDeleted } from '@excalidraw/excalidraw/element/types'

  export interface ExportOpts {
    elements: readonly NonDeleted<ExcalidrawElement>[]
    appState?: Partial<Omit<AppState, 'offsetTop' | 'offsetLeft'>>
    files: BinaryFiles | null
    maxWidthOrHeight?: number
    getDimensions?: (width: number, height: number) => { width: number; height: number; scale?: number }
  }

  export const exportToCanvas: (opts: ExportOpts & { exportPadding?: number }) => Promise<HTMLCanvasElement>
  export const exportToBlob: (opts: ExportOpts & { mimeType?: string; quality?: number; exportPadding?: number }) => Promise<Blob>
  export const exportToSvg: (opts: ExportOpts & { exportPadding?: number }) => Promise<SVGSVGElement>
  export const exportToClipboard: (opts: ExportOpts & { mimeType?: string; quality?: number; type: 'png' | 'svg' | 'json' }) => Promise<void>
}
