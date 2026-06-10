// Client-side draft: id is a crypto.randomUUID() React key, not a DB id; skip excludes the row from the committed payload.
export type ImportDraftT = {
  id: string
  title: string
  content: string
  skip: boolean
}

// Base64-encoded PDF for the vision-model wire payload, plus the original filename for UI confirmation.
export type PdfSourceT = { dataBase64: string; filename: string }
