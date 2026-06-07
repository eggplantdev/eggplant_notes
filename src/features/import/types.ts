// A previewed note row in the import panel before commit: a stable client id (React key) and a skip
// toggle alongside the editable title/content. Skipped rows are excluded from the committed payload.
export type ImportDraftT = {
  id: string
  title: string
  content: string
  skip: boolean
}
