// Phase-1 import safety caps. The preview/edit gate is the dedup guard; these only bound the work so
// a pathological file can't balloon the bulk insert or the client-side split.
export const MAX_IMPORT_BYTES = 1_000_000 // ~1 MB source file / pasted text
export const MAX_IMPORT_NOTES = 100 // sections committed per import
