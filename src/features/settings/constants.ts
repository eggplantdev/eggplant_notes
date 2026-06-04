// Daily-goal bounds. DEFAULT_DAILY_GOAL MUST equal the user_settings.daily_goal DB default
// (5) — it's the read-side fallback when no row exists yet (trigger gap / race). MAX is a
// sane upper bound shared by the Zod schema and the form input.
export const DEFAULT_DAILY_GOAL = 5
export const MAX_DAILY_GOAL = 500
