export type ActionResultT = { success: true } | { success: false; error: string }

// For actions whose success destination is server-born (a new row's id) and the client can't know it
// up front. redirectTo is REQUIRED on success, so the caller navigates without an optional-field guard.
// Client-known destinations (edits, deletes, static pages) use plain ActionResultT + a literal push.
export type RedirectResultT =
  | { success: true; redirectTo: string }
  | { success: false; error: string }
