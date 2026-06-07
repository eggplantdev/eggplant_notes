// Shared result envelope for the AI generation actions (gen-cards, gen-notes): a typed data payload
// on success, an error string on failure. Lives here (not in an action file) because more than one
// action returns it. Distinct from the project's bare ActionResultT — this carries `data`.
export type GenerateResultT<T> = { success: true; data: T } | { success: false; error: string }
