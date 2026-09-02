/**
 * The model-facing `diagram_read` tool: load an existing `.excalidraw`
 * document and return a bounded structural summary — every element's type,
 * geometry, label text, and connector points — so the model understands and
 * modifies the diagram without parsing raw Excalidraw JSON. The canonical
 * value and the persisted presentation meta carry the same summary; the
 * model-facing prose stays short.
 * @module @deepseek-ai/dsh-diagram/read-tool
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, ToolExecution } from '@deepseek-ai/dsh-tools'
import type { FsTarget } from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-fs'
import { DIAGRAM_EXTENSION } from './write.ts'

/** Inclusive byte cap for one diagram read; larger files fail explicitly. */
export const DIAGRAM_READ_TOOL_MAX_BYTES = 16 * 1024 * 1024

/** Maximum summarized elements; larger documents report a truncation flag. */
export const DIAGRAM_READ_TOOL_MAX_ELEMENTS = 200

/** One summarized element: the model-visible projection of an Excalidraw element. */
export interface ReadElementSummary {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  /** Label text for text elements and shape labels. */
  text?: string
  /** Connector points for line/arrow elements, absolute canvas coordinates. */
  points?: number[][]
}

/** Canonical `diagram_read` result. */
export interface DiagramReadToolValue {
  path: string
  /** Total valid elements in the document; larger than `elements.length` when truncated. */
  elementCount: number
  width: number
  height: number
  /** Element summaries; `truncated` is true when the cap cut the list. */
  elements: ReadElementSummary[]
  truncated: boolean
}

/** The tool's validated arguments. */
interface DiagramReadToolArgs {
  file: string
}

/**
 * Parse and summarize a `.excalidraw` document, or return a human problem.
 * @param text - the document text to parse.
 * @param path - display path for the summary.
 * @param maxElements - element summary cap; larger documents truncate.
 * @returns the bounded structural summary.
 */
export function summarizeDocument(text: string, path: string, maxElements: number): DiagramReadToolValue {
  let document: unknown
  try {
    document = JSON.parse(text)
  } catch (error: unknown) {
    // v8 ignore -- JSON.parse throws SyntaxError (an Error); the fallback keeps any throw honest
    throw new Error(`not a valid .excalidraw document: ${error instanceof Error ? error.message : /* v8 ignore next */ String(error)}`)
  }
  if (typeof document !== 'object' || document === null) {
    throw new Error('not a valid .excalidraw document: expected an object')
  }
  const record = document as Record<string, unknown>
  if (record.type !== 'excalidraw' || !Array.isArray(record.elements)) {
    throw new Error('not a valid .excalidraw document: missing type/excalidraw or elements array')
  }
  const elements = record.elements as unknown[]
  const summarized: ReadElementSummary[] = []
  let elementCount = 0
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let truncated = false
  for (const element of elements) {
    if (summarized.length >= maxElements) {
      truncated = true
      // Count valid elements past the cap so the total stays the document's true count.
      if (summarizeElement(element) !== null) elementCount += 1
      continue
    }
    const summary = summarizeElement(element)
    if (summary === null) continue
    elementCount += 1
    summarized.push(summary)
    minX = Math.min(minX, summary.x)
    minY = Math.min(minY, summary.y)
    maxX = Math.max(maxX, summary.x + summary.width)
    maxY = Math.max(maxY, summary.y + summary.height)
  }
  if (summarized.length === 0) return { path, elementCount, width: 0, height: 0, elements: [], truncated }
  return {
    path,
    elementCount,
    width: maxX - minX,
    height: maxY - minY,
    elements: summarized,
    truncated,
  }
}

/** Project one raw element into its summary; null skips malformed entries. */
function summarizeElement(element: unknown): ReadElementSummary | null {
  if (typeof element !== 'object' || element === null) return null
  const record = element as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id === '') return null
  if (typeof record.type !== 'string') return null
  if (!isFiniteNumber(record.x) || !isFiniteNumber(record.y)) return null
  const width = finiteOrZero(record.width)
  const height = finiteOrZero(record.height)
  const summary: ReadElementSummary = {
    id: record.id,
    type: record.type,
    x: record.x,
    y: record.y,
    width,
    height,
  }
  if (typeof record.text === 'string' && record.text !== '') {
    summary.text = record.text
  }
  if (Array.isArray(record.points)) {
    const points: number[][] = []
    for (const point of record.points) {
      if (!Array.isArray(point) || point.length < 2 || !isFiniteNumber(point[0]) || !isFiniteNumber(point[1])) continue
      points.push([point[0], point[1]])
    }
    if (points.length > 0) summary.points = points
  }
  return summary
}

/** Whether a wire value is a finite number usable as geometry. */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** A finite number or zero for malformed optional dimensions. */
function finiteOrZero(value: unknown): number {
  return isFiniteNumber(value) ? value : 0
}

/** The calling agent's session workspace cwd, or undefined outside an agent. */
function sessionCwd(exec: ToolExecution): string | undefined {
  return exec.agent?.session.header.cwd
}

/** Model-facing prose; never echoes the full element list. */
function formatReadOutput(value: DiagramReadToolValue): string {
  const cap = value.truncated ? ` (first ${value.elements.length} of ${value.elementCount} shown)` : ''
  return `<path>${value.path}</path>
<type>diagram</type>
<content>
Read ${value.elementCount} elements${cap} (${Math.round(value.width)}x${Math.round(value.height)} canvas)
</content>`
}

/**
 * Pure pending-card intent for a diagram read.
 * @param args - the validated tool arguments.
 * @returns the pending-card render intent.
 */
export function presentReadCall(args: DiagramReadToolArgs): GenericCallView {
  return { card: 'generic', title: `Diagram read ${args.file}`, locations: [{ path: args.file }] }
}

/**
 * Register the `diagram_read` tool.
 * @param ctx - host context carrying tools and fs services.
 */
export function applyReadTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'diagram_read',
    description: 'Read an existing Excalidraw diagram file (.excalidraw) and return a structured summary of its elements: types, geometry, labels, and connector points.',
    parameters: {
      file: {
        type: 'string',
        required: true,
        description: 'Path to read, resolved against the session workspace; must end with .excalidraw.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          elementCount: { type: 'integer', required: true },
          width: { type: 'number', required: true },
          height: { type: 'number', required: true },
          elements: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                type: { type: 'string', required: true },
                x: { type: 'number', required: true },
                y: { type: 'number', required: true },
                width: { type: 'number', required: true },
                height: { type: 'number', required: true },
                text: { type: 'string' },
                points: {
                  type: 'array',
                  items: {
                    type: 'array',
                    items: { type: 'number' },
                  },
                },
              },
            },
          },
          truncated: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatReadOutput(value) }],
      presentationMeta: (_args, value) => value,
    },
    async execute(args: DiagramReadToolArgs, exec) {
      const file = args.file.trim()
      if (file.length === 0) throw new Error('file must be a non-empty string')
      if (!file.toLowerCase().endsWith(DIAGRAM_EXTENSION)) {
        throw new Error(`file must end with ${DIAGRAM_EXTENSION}`)
      }
      const resolveOptions: { cwd?: string; signal?: AbortSignal } = { signal: exec.signal }
      const cwd = sessionCwd(exec)
      if (cwd !== undefined) resolveOptions.cwd = cwd
      const target: FsTarget = await ctx.fs.resolve(file, resolveOptions)
      let info: Awaited<ReturnType<Context['fs']['stat']>>
      let bytes: Uint8Array
      try {
        info = await ctx.fs.stat(target, exec.signal)
        if (info === undefined) throw new Error('file not found')
        bytes = await ctx.fs.readBytes(target, exec.signal, DIAGRAM_READ_TOOL_MAX_BYTES)
      } catch (error: unknown) {
        // v8 ignore -- the fs seam throws Error instances; the fallback keeps any throw honest
        throw new Error(`cannot read diagram: ${error instanceof Error ? error.message : /* v8 ignore next */ String(error)}`)
      }
      // Record the present observation (a no-op when no policy plugin listens).
      ctx.emit('fs/observed', target, { kind: 'present', version: info.version }, exec)
      const text = new TextDecoder().decode(bytes)
      return summarizeDocument(text, target.displayPath, DIAGRAM_READ_TOOL_MAX_ELEMENTS)
    },
    presentCall: presentReadCall,
  }))
}
