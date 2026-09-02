// @vitest-environment jsdom
// Diagram card behavior: pending, failed, rendered, and no-preview states
// derive from the raw call/result slice, and the open action reaches the
// owner's file opener.
import { afterEach } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { DiagramCard } from '../src/client/DiagramCard.tsx'
import { en, zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, en)

/** Minimal props the card reads; t is the real localized translate. */
function props(block: ToolCallBlock, openFile = vi.fn()) {
  return {
    toolName: 'diagram',
    callId: 'call-1',
    block,
    t,
    openFile,
    loadImage: (() => undefined) as never,
    useSession: (() => undefined) as never,
    useSessions: (() => []) as never,
    useWorkspaces: (() => []) as never,
    useProjection: (() => undefined) as never,
    useConversation: (() => undefined) as never,
    useChat: (() => undefined) as never,
    useSessionPendingInteraction: (() => undefined) as never,
    useTrajectory: (() => undefined) as never,
    useInput: (() => undefined) as never,
    inputActions: {} as never,
    sessionId: 's1' as never,
    renderSlot: (() => null) as never,
    renderSlotChain: (() => null) as never,
    useStore: (() => undefined) as never,
    SessionProvider: (() => null) as never,
  }
}

const ARGS = JSON.stringify({ file: '/ws/flow.excalidraw', elements: [] })

const META = {
  path: '/ws/flow.excalidraw',
  width: 280,
  height: 60,
  elements: [{
    id: 'diagram-1', type: 'rectangle', x: 0, y: 0, width: 100, height: 60,
    strokeColor: '#1e1e1e', backgroundColor: '#ffffff', strokeWidth: 2,
    strokeStyle: 'solid', opacity: 100, roundness: null,
  }],
}

describe('DiagramCard', () => {
  it('shows a pending note for a running call', () => {
    const { getByText } = render(<DiagramCard {...props({
      callId: 'call-1',
      name: 'diagram',
      argsRaw: ARGS,
      turn: 1,
      step: 1,
      time: 1,
      subCalls: [],
    })} />)
    expect(getByText('正在生成图表…')).toBeTruthy()
  })

  it('shows a failure note for a settled error', () => {
    const { getByText } = render(<DiagramCard {...props({
      kind: 'tool-result',
      seq: 1,
      time: 2,
      callId: 'call-1',
      call: { name: 'diagram', argsRaw: ARGS },
      callTime: 1,
      content: [{ type: 'text', text: 'boom' }],
      isError: true,
      subCalls: [],
    })} />)
    expect(getByText('图表生成失败')).toBeTruthy()
  })

  it('renders the SVG from valid meta with the shape count and an open action', () => {
    const openFile = vi.fn()
    const { getByTestId, getByText } = render(<DiagramCard {...props({
      kind: 'tool-result',
      seq: 1,
      time: 2,
      callId: 'call-1',
      call: { name: 'diagram', argsRaw: ARGS },
      callTime: 1,
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
      meta: META,
      subCalls: [],
    }, openFile)} />)
    expect(getByTestId('diagram-svg')).toBeTruthy()
    expect(getByText('1 个形状')).toBeTruthy()
    expect(getByText('flow.excalidraw')).toBeTruthy()
    fireEvent.click(getByText('打开'))
    expect(openFile).toHaveBeenCalledWith('/ws/flow.excalidraw')
  })

  it('falls back to the no-preview note for settled calls without valid meta', () => {
    const { getByText, queryByTestId } = render(<DiagramCard {...props({
      kind: 'tool-result',
      seq: 1,
      time: 2,
      callId: 'call-1',
      call: { name: 'diagram', argsRaw: ARGS },
      callTime: 1,
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
      meta: { path: '/ws/flow.excalidraw', width: -1, elements: [] },
      subCalls: [],
    })} />)
    expect(getByText('暂无预览')).toBeTruthy()
    expect(queryByTestId('diagram-svg')).toBeNull()
  })

  it('omits the file chip and open action when the args are not parseable', () => {
    const { queryByText } = render(<DiagramCard {...props({
      kind: 'tool-result',
      seq: 1,
      time: 2,
      callId: 'call-1',
      call: { name: 'diagram', argsRaw: '{"file":' },
      callTime: 1,
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
      meta: META,
      subCalls: [],
    })} />)
    expect(queryByText('flow.excalidraw')).toBeNull()
    expect(queryByText('打开')).toBeNull()
  })

  it('omits the file chip for empty args or args without a file field', () => {
    const empty = render(<DiagramCard {...props({
      kind: 'tool-result',
      seq: 1,
      time: 2,
      callId: 'call-1',
      call: { name: 'diagram', argsRaw: '' },
      callTime: 1,
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
      meta: META,
      subCalls: [],
    })} />)
    expect(empty.queryByText('flow.excalidraw')).toBeNull()

    const noFile = render(<DiagramCard {...props({
      kind: 'tool-result',
      seq: 1,
      time: 2,
      callId: 'call-1',
      call: { name: 'diagram', argsRaw: '{}' },
      callTime: 1,
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
      meta: META,
      subCalls: [],
    })} />)
    expect(noFile.queryByText('flow.excalidraw')).toBeNull()
  })

  it('renders without a file chip when the call head is outside the window', () => {
    const { queryByText } = render(<DiagramCard {...props({
      kind: 'tool-result',
      seq: 1,
      time: 2,
      callId: 'call-1',
      call: null,
      callTime: null,
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
      meta: META,
      subCalls: [],
    })} />)
    expect(queryByText('flow.excalidraw')).toBeNull()
    expect(queryByText('暂无预览')).toBeNull()
  })

  it('shows a bare filename without directory separators as-is', () => {
    const { getByText } = render(<DiagramCard {...props({
      kind: 'tool-result',
      seq: 1,
      time: 2,
      callId: 'call-1',
      call: { name: 'diagram', argsRaw: JSON.stringify({ file: 'flow.excalidraw' }) },
      callTime: 1,
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
      meta: META,
      subCalls: [],
    })} />)
    expect(getByText('flow.excalidraw')).toBeTruthy()
  })

  it('does not offer an open action on a failed call even with a file', () => {
    const { queryByText } = render(<DiagramCard {...props({
      kind: 'tool-result',
      seq: 1,
      time: 2,
      callId: 'call-1',
      call: { name: 'diagram', argsRaw: ARGS },
      callTime: 1,
      content: [{ type: 'text', text: 'boom' }],
      isError: true,
      subCalls: [],
    })} />)
    expect(queryByText('打开')).toBeNull()
  })
})
