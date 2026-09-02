/** `diagram` namespace dictionaries for the dedicated tool card. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'diagram'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'card.title': '图表',
  'card.shapes': '{count} 个形状',
  'card.open': '打开',
  'card.pending': '正在生成图表…',
  'card.failed': '图表生成失败',
  'card.noPreview': '暂无预览',
} satisfies Record<string, string>

/** The diagram namespace key union. */
export type DiagramKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'card.title': 'Diagram',
  'card.shapes': '{count} shapes',
  'card.open': 'Open',
  'card.pending': 'Writing diagram…',
  'card.failed': 'Diagram failed',
  'card.noPreview': 'No preview available',
} satisfies Record<DiagramKey, string>
