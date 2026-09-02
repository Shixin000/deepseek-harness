/** `diagram-canvas` namespace dictionaries for the whiteboard panel. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'diagram-canvas'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'panel.title': '画布',
  'panel.untitled': '未命名',
  'panel.openInEditor': '在编辑器中打开',
  'panel.save': '保存',
  'panel.reload': '从磁盘重新加载',
  'panel.export': '导出 PNG',
  'panel.close': '关闭',
  'panel.saved': '已保存',
  'panel.saveError': '保存失败',
  'panel.openError': '打开失败',
  'panel.reloadError': '重新加载失败',
  'panel.exportError': '导出失败',
  'panel.dirty': '未保存',
} satisfies Record<string, string>

/** The diagram-canvas namespace key union. */
export type DiagramCanvasKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'panel.title': 'Canvas',
  'panel.untitled': 'Untitled',
  'panel.openInEditor': 'Open in editor',
  'panel.save': 'Save',
  'panel.reload': 'Reload from disk',
  'panel.export': 'Export PNG',
  'panel.close': 'Close',
  'panel.saved': 'Saved',
  'panel.saveError': 'Save failed',
  'panel.openError': 'Open failed',
  'panel.reloadError': 'Reload failed',
  'panel.exportError': 'Export failed',
  'panel.dirty': 'Unsaved',
} satisfies Record<DiagramCanvasKey, string>
