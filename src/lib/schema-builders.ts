import { z } from 'zod'

// Builder for the project's required, trimmed, length-capped text fields (note/subject titles, card
// prompts). Emits the standard messages "{label} is required" / "{label} must be {max} characters or
// fewer". Optional/blank-to-null text keeps its own per-feature transform — those shapes diverge.
export function trimmedString(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`)
}
