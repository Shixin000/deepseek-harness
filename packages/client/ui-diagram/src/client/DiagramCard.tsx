/**
 * The `diagram` tool card: a replay-stable inline view derived only from the
 * raw call/result slice. Running calls show a pending note, failed calls show
 * the failure, and settled calls render the validated `result.meta`
 * projection as an inline SVG with an open action; malformed or missing meta
 * falls back to a no-preview note instead of crashing the replay. The header
 * also renders the `diagram.card.open` chain — a canvas panel registers there
 * to offer "Open in editor" without this card depending on it.
 * @module @deepseek-ai/dsh-client-ui-diagram/DiagramCard
 */

import type { PropsLocale, PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from './contract/slots.ts'
import { parseDiagramMeta } from './diagram-meta.ts'
import type { DiagramMetaView } from './diagram-meta.ts'
import { DiagramSvg } from './DiagramSvg.tsx'
import css from './DiagramCard.module.css'

type DiagramCardProps = ToolCallViewProps
  & PropsLocale<'diagram'>
  & PropsRenderSlots<'diagram.card.open'>

/** The `file` argument from the raw call head, or '' when unavailable. */
function diagramFile(argsRaw: string): string {
  if (argsRaw === '') return ''
  try {
    const parsed = JSON.parse(argsRaw) as unknown
    if (typeof parsed === 'object' && parsed !== null) {
      const file = (parsed as Record<string, unknown>).file
      if (typeof file === 'string' && file !== '') return file
    }
  } catch {
    // Streaming can expose a truncated JSON prefix; the card just omits the
    // path rather than showing a corrupted one.
  }
  return ''
}

/** The final path segment, for the compact header. */
function basename(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index === -1 ? path : path.slice(index + 1)
}

/** Replay-stable diagram card over the durable call/result slice. */
export function DiagramCard({ block, openFile, renderSlotChain, t }: DiagramCardProps) {
  const settled = 'kind' in block
  const argsRaw = (settled ? block.call?.argsRaw : block.argsRaw) ?? ''
  const file = diagramFile(argsRaw)
  const meta: DiagramMetaView | null = settled ? parseDiagramMeta(block.meta) : null
  const body = !settled
    ? <p className={css.note}>{t('card.pending')}</p>
    : block.isError
      ? <p className={css.note}>{t('card.failed')}</p>
      : meta !== null
        ? <DiagramSvg elements={meta.elements} title={file !== '' ? file : t('card.title')} />
        : <p className={css.note}>{t('card.noPreview')}</p>
  return (
    <div className={css.card}>
      <div className={css.header}>
        <span className={css.title}>{t('card.title')}</span>
        {file !== '' && <span className={css.file} title={file}>{basename(file)}</span>}
        {meta !== null && <span className={css.count}>{t('card.shapes', { count: meta.elements.length })}</span>}
        {settled && !block.isError && file !== ''
          ? (
            <button type="button" className={css.open} onClick={() => { openFile(file) }}>{t('card.open')}</button>
          )
          : null}
        {renderSlotChain('diagram.card.open', { file })}
      </div>
      <div className={css.body}>{body}</div>
    </div>
  )
}
