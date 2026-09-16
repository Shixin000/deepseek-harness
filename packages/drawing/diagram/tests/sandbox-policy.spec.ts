// The diagram tool under a CONFINING filesystem. The session workspace is a
// sibling of the deployment fallback root, and neither is an automatic
// temporary write grant, so a write into the session's own workspace survives
// the fence only when the tool stamps that session's sandbox policy. Boots the
// real Loader composition (session projections -> sandbox policy -> sandboxed
// filesystem -> diagram) and drives the registered tool with a real Session.
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { SESSION_FORMAT_VERSION, Session, SessionId } from '@deepseek-ai/dsh-session'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { unsupportedInbox } from '@deepseek-ai/dsh-agent-loop-testkit'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SandboxPolicyService from '@deepseek-ai/dsh-sandbox-policy'
import SandboxedFileSystem from '@deepseek-ai/dsh-fs-sandbox'
import * as Diagram from '@deepseek-ai/dsh-diagram'
import { assertWorkspaceOutsideTemp, outsideTempWorkspaceParent } from '../../../../scripts/snapshot-workspace-parent.ts'

let base: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (base !== undefined) await rm(base, { recursive: true, force: true })
  base = undefined
})

/** A real session whose immutable cwd is the workspace its writes must reach. */
function agent(ctx: Context, cwd: string): Agent {
  const scope = ctx.plugin(() => {})
  const id = SessionId('diagram-sandbox-agent')
  const session = Session.create(id, undefined, {
    version: SESSION_FORMAT_VERSION,
    id,
    createdAt: 0,
    cwd,
    isSeeded: false,
  })
  const value: Agent = {
    id, options: {}, session, inbox: unsupportedInbox(),
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

/** Boot a fenced composition: the configured root is a sibling of the session workspace. */
async function boot(): Promise<{ ctx: Context; workspace: string; launch: string }> {
  const directory = await mkdtemp(join(outsideTempWorkspaceParent(), '.dsh-diagram-sbx-'))
  base = directory
  assertWorkspaceOutsideTemp(directory)
  const workspace = join(directory, 'session-ws')
  const launch = join(directory, 'launch-root')
  await mkdir(workspace)
  await mkdir(launch)
  const configPath = join(directory, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-agent'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-session-projection'",
    "- name: '@deepseek-ai/dsh-sandbox-policy'",
    '  config:',
    '    mode: workspace-write',
    `    workspaceRoot: ${launch}`,
    "- name: '@deepseek-ai/dsh-fs-sandbox'",
    '  config:',
    `    cwd: ${launch}`,
    "- name: '@deepseek-ai/dsh-diagram'",
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(directory).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-agent', AgentRegistry],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['@deepseek-ai/dsh-session-projection', SessionProjectionRegistry],
    ['@deepseek-ai/dsh-sandbox-policy', SandboxPolicyService],
    ['@deepseek-ai/dsh-fs-sandbox', SandboxedFileSystem],
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
  return { ctx, workspace, launch }
}

const SHAPES = [
  { kind: 'rect', x: 0, y: 0, w: 100, h: 60, text: 'Start' },
  { kind: 'arrow', points: [{ x: 110, y: 30 }, { x: 200, y: 30 }] },
]

/** The written document's declared format, read back from disk. */
async function documentType(path: string): Promise<string> {
  return (JSON.parse(await readFile(path, 'utf8')) as { type: string }).type
}

describe('dsh-diagram writes under a confining filesystem', () => {
  it('writes into the calling session workspace, not the deployment fallback root', async () => {
    const { ctx, workspace, launch } = await boot()
    const owner = agent(ctx, workspace)
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: ToolCallId('call-sbx-session'),
      name: 'diagram',
      arguments: { file: 'flow.excalidraw', elements: SHAPES },
      agent: owner,
    })
    expect(result.isError).toBe(false)
    expect(await documentType(join(workspace, 'flow.excalidraw'))).toBe('excalidraw')
    expect(existsSync(join(launch, 'flow.excalidraw'))).toBe(false)
  })

  it('still denies a write outside both the session workspace and the fallback root', async () => {
    const { ctx, workspace } = await boot()
    const owner = agent(ctx, workspace)
    const escape = join(base as string, 'escape.excalidraw')
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: ToolCallId('call-sbx-escape'),
      name: 'diagram',
      arguments: { file: escape, elements: SHAPES },
      agent: owner,
    })
    expect(result.isError).toBe(true)
    expect(resultText(result)).toContain('file access denied')
    expect(existsSync(escape)).toBe(false)
  })

  it('resolves an agentless call against the configured fallback root', async () => {
    const { ctx, launch } = await boot()
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: ToolCallId('call-sbx-agentless'),
      name: 'diagram',
      arguments: { file: 'flow.excalidraw', elements: SHAPES },
    })
    expect(result.isError).toBe(false)
    expect(await documentType(join(launch, 'flow.excalidraw'))).toBe('excalidraw')
  })
})
