/**
 * Sandbox-policy plumbing shared by the tool and Remote paths. A confining
 * filesystem fence derives its writable roots from the per-call policy, so
 * every diagram mutation resolves that policy for the calling session and
 * stamps it onto the write; path resolution then uses the same workspace root
 * the fence will compare against, instead of the backend's default cwd.
 * @module @deepseek-ai/dsh-diagram/sandbox
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import type { SandboxPolicyService } from '@deepseek-ai/dsh-sandbox-policy'
import type { Session } from '@deepseek-ai/dsh-session'

/**
 * The sandbox policy one diagram operation runs under.
 * @param ctx - host context that may carry `sandboxPolicy`.
 * @param session - the calling session; omitted for agentless callers.
 * @returns the per-call policy, or undefined when no policy service is mounted
 *   (the filesystem is then unfenced and the mutation needs no policy).
 */
export function diagramSandboxPolicy(
  ctx: Context,
  session: Session | undefined,
): SandboxExecutionPolicy | undefined {
  const service: SandboxPolicyService | undefined = ctx.get('sandboxPolicy')
  if (service === undefined) return undefined
  return session === undefined ? service.resolve() : service.resolve({ session })
}

/**
 * The working directory a diagram path resolves against: the policy's
 * workspace root when a policy exists, else the calling session's cwd.
 * @param policy - the resolved per-call policy.
 * @param sessionCwd - the session workspace used when no policy is mounted.
 * @returns the cwd for `ctx.fs.resolve`, or undefined for the backend default.
 */
export function diagramResolutionCwd(
  policy: SandboxExecutionPolicy | undefined,
  sessionCwd: string | undefined,
): string | undefined {
  return policy?.workspaceRoot ?? sessionCwd
}
