/**
 * The model-facing `diagram` tool: write one `.excalidraw` document into the
 * session workspace from a validated shape spec. The tool owns the file
 * contract, validation feedback, the write observation, and the replayable
 * card projection; it never guesses geometry or invents elements the model did
 * not ask for — a spec problem fails the call with every issue listed.
 * @module @deepseek-ai/dsh-diagram
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { FsTarget } from '@deepseek-ai/dsh-fs'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, GenericResultView, ToolExecution, ToolResult } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { diagramBounds, expandShapes } from './expand.ts'
import type { ExcalidrawElement } from './expand.ts'
import { validateShapes } from './spec.ts'
import type { DiagramShape } from './spec.ts'
import { parseDiagramFile, serializeDiagram, writeDiagram } from './write.ts'
import { applyReadTool } from './read-tool.ts'
export { DiagramRemote } from './remote.ts'
export type {
  DiagramReadRequest, DiagramReadResult, DiagramRemoteFailure, DiagramSaveRequest, DiagramSaveResult,
} from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-diagram'

/** Services required by the diagram tool. */
export const inject = ['tools', 'fs', 'systemPrompt']

/** Plugin config; the schema supplies the defaults. */
export interface Config {
  /** Maximum number of spec shapes one call accepts. */
  maxElements?: number
  /** Maximum serialized bytes of the presentation projection kept for replay. */
  maxMetaBytes?: number
}

export const Config: z<Config> = z.object({
  maxElements: z.number().default(500),
  maxMetaBytes: z.number().default(524288),
})

/** The shape after schemastery applied the defaults. */
type ResolvedConfig = Required<Config>

/** The `diagram` tool's validated arguments. */
interface DiagramToolArgs {
  file: string
  elements: DiagramShape[]
}

/** Canonical diagram-tool output; the elements themselves stay out of it. */
interface DiagramToolValue {
  path: string
  elementCount: number
  width: number
  height: number
}

/** Projection persisted on `tool/result` so the Web card survives replay. */
type DiagramMeta = {
  path: string
  width: number
  height: number
  elements?: ExcalidrawElement[]
}

/** Model-facing confirmation prose; never echoes the full element list. */
function formatDiagramOutput(value: DiagramToolValue): string {
  return `<path>${value.path}</path>
<type>diagram</type>
<content>
Wrote ${value.elementCount} shapes to ${value.path} (${Math.round(value.width)}x${Math.round(value.height)} canvas)
</content>`
}

/** The calling agent's session workspace cwd, or undefined outside an agent. */
function sessionCwd(exec: ToolExecution): string | undefined {
  return exec.agent?.session.header.cwd
}

/** Project the replayable card payload, bounded by the configured byte cap. */
function projectMeta(args: DiagramToolArgs, value: DiagramToolValue, maxMetaBytes: number): DiagramMeta {
  const elements = expandShapes(args.elements)
  const base: DiagramMeta = { path: value.path, width: value.width, height: value.height }
  const withElements: DiagramMeta = { ...base, elements }
  if (JSON.stringify(withElements).length > maxMetaBytes) return base
  return withElements
}

/**
 * Pure pending-card intent: a generic card pointing at the touched file.
 * @param args - the validated tool arguments.
 * @returns the pending-card render intent.
 */
export function presentDiagramCall(args: DiagramToolArgs): GenericCallView {
  return { card: 'generic', title: `Diagram ${args.file}`, locations: [{ path: args.file }] }
}

/**
 * Pure completed-card intent: a generic card, absent for failed calls.
 * @param args - the validated tool arguments.
 * @param result - the settled tool result.
 * @returns the completed-card render intent, or undefined for failed calls.
 */
export function presentDiagramResult(args: DiagramToolArgs, result: ToolResult): GenericResultView | undefined {
  if (result.isError) return undefined
  return { card: 'generic', title: `Diagram ${args.file}` }
}

/** Register the `diagram` tool and its system-prompt guidance. */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  if (!Number.isInteger(resolved.maxElements) || resolved.maxElements < 1) {
    throw new Error('tool-diagram: maxElements must be a positive integer')
  }
  if (!Number.isInteger(resolved.maxMetaBytes) || resolved.maxMetaBytes < 1) {
    throw new Error('tool-diagram: maxMetaBytes must be a positive integer')
  }

  ctx.systemPrompt.section({
    name: 'tool:diagram',
    order: ctx.systemPrompt.getSectionOrder('TOOL_DIAGRAM'),
    text: 'Use the diagram tool to create visual diagrams (flowcharts, architecture, wireframes) as .excalidraw files in the workspace. Describe shapes with the structured element spec: rect/ellipse/diamond shapes (with optional centered text), standalone text, and line/arrow connectors through point lists. All coordinates use canvas units (x right, y down).',
  })
  ctx.systemPrompt.section({
    name: 'tool:diagram_read',
    order: ctx.systemPrompt.getSectionOrder('TOOL_DIAGRAM_READ'),
    text: 'Use the diagram_read tool to inspect an existing .excalidraw diagram: it returns a bounded summary of element types, geometry, labels, and connector points (at most 200 elements), plus the canvas bounds. Prefer diagram_read over parsing Excalidraw JSON directly when modifying or reasoning about an existing diagram.',
  })

  applyReadTool(ctx)

  ctx.tools.register(defineTool({
    name: 'diagram',
    description: 'Create or replace an Excalidraw diagram file (.excalidraw) in the workspace from a structured shape spec.',
    parameters: {
      file: {
        type: 'string',
        required: true,
        description: 'Output path, resolved against the session workspace; must end with .excalidraw.',
      },
      elements: {
        type: 'array',
        required: true,
        description: 'Shapes to draw, in draw order. rect/ellipse/diamond take x, y, w, h and optional centered text; text takes x, y and text; line/arrow take a points list (at least 2 points).',
        items: {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: { type: 'string', required: true, const: 'rect' },
                x: { type: 'number', required: true },
                y: { type: 'number', required: true },
                w: { type: 'number', required: true },
                h: { type: 'number', required: true },
                text: { type: 'string' },
                rounded: { type: 'boolean' },
                strokeColor: { type: 'string' },
                fillColor: { type: 'string' },
                dashed: { type: 'boolean' },
                strokeWidth: { type: 'integer' },
                opacity: { type: 'integer' },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: { type: 'string', required: true, const: 'ellipse' },
                x: { type: 'number', required: true },
                y: { type: 'number', required: true },
                w: { type: 'number', required: true },
                h: { type: 'number', required: true },
                text: { type: 'string' },
                strokeColor: { type: 'string' },
                fillColor: { type: 'string' },
                dashed: { type: 'boolean' },
                strokeWidth: { type: 'integer' },
                opacity: { type: 'integer' },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: { type: 'string', required: true, const: 'diamond' },
                x: { type: 'number', required: true },
                y: { type: 'number', required: true },
                w: { type: 'number', required: true },
                h: { type: 'number', required: true },
                text: { type: 'string' },
                strokeColor: { type: 'string' },
                fillColor: { type: 'string' },
                dashed: { type: 'boolean' },
                strokeWidth: { type: 'integer' },
                opacity: { type: 'integer' },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: { type: 'string', required: true, const: 'text' },
                x: { type: 'number', required: true },
                y: { type: 'number', required: true },
                text: { type: 'string', required: true },
                w: { type: 'number' },
                fontSize: { type: 'integer' },
                color: { type: 'string' },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: { type: 'string', required: true, const: 'line' },
                points: {
                  type: 'array',
                  required: true,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      x: { type: 'number', required: true },
                      y: { type: 'number', required: true },
                    },
                  },
                },
                strokeColor: { type: 'string' },
                dashed: { type: 'boolean' },
                strokeWidth: { type: 'integer' },
                opacity: { type: 'integer' },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: { type: 'string', required: true, const: 'arrow' },
                points: {
                  type: 'array',
                  required: true,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      x: { type: 'number', required: true },
                      y: { type: 'number', required: true },
                    },
                  },
                },
                strokeColor: { type: 'string' },
                dashed: { type: 'boolean' },
                strokeWidth: { type: 'integer' },
                opacity: { type: 'integer' },
              },
            },
          ],
        },
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
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatDiagramOutput(value) }],
      presentationMeta: (args, value) => projectMeta(args, value, resolved.maxMetaBytes),
    },
    async execute(args: DiagramToolArgs, exec) {
      const file = parseDiagramFile(args.file)
      if (args.elements.length === 0) {
        throw new Error('elements must contain at least 1 shape')
      }
      if (args.elements.length > resolved.maxElements) {
        throw new Error(`elements must contain at most ${resolved.maxElements} shapes`)
      }
      const problems = validateShapes(args.elements)
      if (problems.length > 0) {
        throw new Error(`invalid elements: ${problems.join('; ')}`)
      }
      const elements = expandShapes(args.elements)
      const bounds = diagramBounds(args.elements)
      const json = serializeDiagram(elements)
      const resolveOptions: { cwd?: string; signal?: AbortSignal } = { signal: exec.signal }
      const cwd = sessionCwd(exec)
      if (cwd !== undefined) resolveOptions.cwd = cwd
      const target: FsTarget = await ctx.fs.resolve(file, resolveOptions)
      await writeDiagram(ctx, target, json, exec.signal, exec)
      return {
        path: target.displayPath,
        elementCount: elements.length,
        width: bounds.width,
        height: bounds.height,
      }
    },
    // Pure display: a generic card with the touched file location. The Web
    // client derives its own card from the wire call/result events.
    presentCall: presentDiagramCall,
    presentResult: presentDiagramResult,
  }))
}
