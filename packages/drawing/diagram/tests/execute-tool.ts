// The diagram specs drive the real tools through the batch executor, which takes
// raw model calls and answers one outcome per call. These specs each assert a
// single call, so this helper supplies that call and returns its one result.
import type { Context } from '@deepseek-ai/cordis'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-tools'

/**
 * Execute one diagram tool call and return its settled result.
 * @param ctx - context with the tools service mounted.
 * @param callId - provider-issued call identity to correlate the outcome.
 * @param name - registered tool name.
 * @param args - arguments serialized as the model would send them.
 * @param agent - owning Agent supplying scope and execution context, if any.
 * @returns the single settled result.
 */
export async function executeTool(
  ctx: Context,
  callId: string,
  name: string,
  args: unknown,
  agent?: unknown,
) {
  const batch = await ctx.tools.execute({
    signal: new AbortController().signal,
    calls: [{ type: 'tool-call', id: ToolCallId(callId), name, arguments: JSON.stringify(args) }],
    ...agent === undefined ? {} : { agent: agent as never },
  })
  const outcome = batch.results[0]
  if (outcome === undefined) throw new Error('the batch executor returned no outcome')
  return outcome.result
}
