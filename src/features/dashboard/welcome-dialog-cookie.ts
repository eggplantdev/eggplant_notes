// Shared between the server page (reads it to gate rendering) and the client dialog (writes it on
// dismiss). Plain module so both the server component and the 'use client' dialog can import it.
export const WELCOME_SEEN_COOKIE = 'clc_welcome_seen'

// ~1 year. The dialog is a one-time onboarding nudge; persistence is per-browser (cookie), not
// per-account — a cross-device "seen" flag would need a DB column instead.
export const WELCOME_SEEN_MAX_AGE = 60 * 60 * 24 * 365
