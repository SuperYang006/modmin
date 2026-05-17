interface RichTextEditorState {
  fieldKey: string
  flush: () => string | undefined
  uploadingCount: number
}

const richTextEditorStateMap = new Map<string, RichTextEditorState>()

export function registerRichTextEditorState(editorId: string, fieldKey: string, flush: () => string | undefined) {
  const existing = richTextEditorStateMap.get(editorId)
  richTextEditorStateMap.set(editorId, {
    fieldKey,
    flush,
    uploadingCount: existing?.uploadingCount ?? 0,
  })
}

export function unregisterRichTextEditorState(editorId: string) {
  richTextEditorStateMap.delete(editorId)
}

export function setRichTextEditorUploading(editorId: string, uploadingCount: number) {
  const existing = richTextEditorStateMap.get(editorId)
  if (!existing) return

  richTextEditorStateMap.set(editorId, {
    ...existing,
    uploadingCount: Math.max(0, uploadingCount),
  })
}

export function flushRichTextEditors() {
  const values: Record<string, string> = {}

  richTextEditorStateMap.forEach((state) => {
    const value = state.flush()
    if (state.fieldKey && value !== undefined) {
      values[state.fieldKey] = value
    }
  })

  return values
}

export function hasUploadingRichTextImages() {
  return Array.from(richTextEditorStateMap.values()).some((state) => state.uploadingCount > 0)
}
