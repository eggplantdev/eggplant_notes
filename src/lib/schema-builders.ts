import { z } from 'zod'

// Builder for the project's required, trimmed, length-capped text fields (note/subject titles, card
// prompts). Emits the standard messages "{label} is required" / "{label} must be {max} characters or
// fewer". Optional/blank-to-null text keeps its own per-feature transform — those shapes diverge.
export function trimmedString(label: string, max: number, min = 1) {
  return z
    .string()
    .trim()
    .min(min, min === 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be ${max} characters or fewer`)
}
