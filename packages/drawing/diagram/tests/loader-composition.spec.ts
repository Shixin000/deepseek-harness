// Proves `maxElements` is real configurability and not a constant: the cap is
// set in a cordis.yml booted through the real Loader, and the accepted input
// follows it — the model-facing rejection text names the configured limit.
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import * as Diagram from '@deepseek-ai/dsh-diagram'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

function agent(ctx: Context): Agent {
  const scope = ctx.plugin(() => {})
  const id = SessionId('diagram-loader-agent')
  const session = Session.create(id)
  const value: Agent = {
    id, options: {}, session, inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle', ctx: scope.ctx,
    followup: () => {}, steer: () => {}, inject: () => {}, send: () => {}, cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  ctx.agents.register(value)
  return value
}

function resultText(result: { content: { type: string; text?: string }[] }): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('')
}

async function boot(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-diagram-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-agent'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-fs-local'",
    '  config:',
    `    cwd: ${root}`,
    "- name: '@deepseek-ai/dsh-diagram'",
    '  config:',
    '    maxElements: 2',
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-agent', AgentRegistry],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['@deepseek-ai/dsh-fs-local', LocalFileSystem],
    ['@deepseek-ai/dsh-diagram', Diagram],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  return ctx
}

describe('dsh-diagram loader composition', () => {
  it('enforces the maxElements cap configured through cordis.yml', async () => {
    const ctx = await boot()
    const owner = agent(ctx)
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: ToolCallId('call-loader-cap'),
      name: 'diagram',
      arguments: {
        file: 'flow.excalidraw',
        elements: [
          { kind: 'rect', x: 0, y: 0, w: 10, h: 10 },
          { kind: 'rect', x: 20, y: 0, w: 10, h: 10 },
          { kind: 'rect', x: 40, y: 0, w: 10, h: 10 },
        ],
      },
      agent: owner,
    })
    expect(result.isError).toBe(true)
    expect(resultText(result)).toContain('at most 2 shapes')
  })

  it('accepts a spec within the configured cap and writes the document', async () => {
    const ctx = await boot()
    const owner = agent(ctx)
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: ToolCallId('call-loader-ok'),
      name: 'diagram',
      arguments: {
        file: 'flow.excalidraw',
        elements: [
          { kind: 'rect', x: 0, y: 0, w: 10, h: 10 },
          { kind: 'arrow', points: [{ x: 20, y: 5 }, { x: 40, y: 5 }] },
        ],
      },
      agent: owner,
    })
    expect(result.isError).toBe(false)
    expect(resultText(result)).toContain('Wrote 2 shapes')
  })
})
