// @vitest-environment jsdom
// Open-in-editor action: renders only for a non-empty matched file and opens
// the shared canvas store with that path.
import { afterEach } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { createCanvasStore } from '../src/client/canvas-store.ts'
import { OpenInEditorButton } from '../src/client/OpenInEditorButton.tsx'
import { en, zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, en)

/** One store + one live instance shared by the component and the assertions. */
function bench(file: string) {
  const store = createCanvasStore()
  const instance = store.create()
  const props = {
    matched: { file },
    canvas: instance,
    t,
  }
  return { props, instance }
}

describe('OpenInEditorButton', () => {
  it('renders nothing for an empty file', () => {
    const { props } = bench('')
    const { container } = render(<OpenInEditorButton {...props} />)
    expect(container.querySelector('button')).toBeNull()
  })

  it('renders the action and opens the canvas store with the matched path', () => {
    const { props, instance } = bench('/ws/flow.excalidraw')
    const { getByText } = render(<OpenInEditorButton {...props} />)
    fireEvent.click(getByText('在编辑器中打开'))
    expect(instance.getSnapshot()).toMatchObject({ open: true, path: '/ws/flow.excalidraw' })
  })
})
