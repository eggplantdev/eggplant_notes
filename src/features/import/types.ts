// A previewed note row in the import panel before commit: a stable client id (React key) and a skip
// toggle alongside the editable title/content. Skipped rows are excluded from the committed payload.
export type ImportDraftT = {
  id: string
  title: string
  content: string
  skip: boolean
}

// A PDF chosen as the import source: base64 bytes for the wire + the original filename. Read by
// SourceInput, held by ImportPanel, sent to the vision generateNotes path (Phase 8).
export type PdfSourceT = { dataBase64: string; filename: string }
