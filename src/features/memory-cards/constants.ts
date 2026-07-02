import type { MultiSelectOptionT } from '@/components/ui/multi-select'

// FSRS card states (ts-fsrs State enum). Index = memory_cards.state integer.
// 0 New · 1 Learning · 2 Review · 3 Relearning. Drives the cards-by-state breakdown.
export const FSRS_STATE_LABELS = ['New', 'Learning', 'Review', 'Relearning'] as const

// A card is "mature" once FSRS stability (≈ days until recall drops to 90%) crosses this.
// 21d is the conventional Anki maturity line.
export const MATURE_STABILITY_DAYS = 21

// Single source for the maturity-filter buckets: the option list (UI) and the `MaturityT` value
// union (query + param-parse guard) both derive from here, so the two stay in lock-step.
export const MATURITY_OPTIONS = [
  { value: 'mature', label: 'Mature' },
  { value: 'young', label: 'Young' },
] as const satisfies readonly MultiSelectOptionT[]

export type MaturityT = (typeof MATURITY_OPTIONS)[number]['value']

// FSRS states that sit on the review schedule (Review · Relearning). New/Learning (0/1) aren't yet
// scheduled, so they're never "overdue"/"due today" — this gates the due filter to match the
// 'Overdue'/'Due today' badges (see is-card-overdue / format-review-status).
export const SCHEDULED_STATES = [2, 3] as const

// Single source for the due-filter buckets: the option list (UI) and the `DueFilterT` value union
// (query + param-parse guard) both derive from here, so the two stay in lock-step. Overdue =
// scheduled card due before today; today = scheduled card due within today (APP_TIME_ZONE).
export const DUE_OPTIONS = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
] as const satisfies readonly MultiSelectOptionT[]

export type DueFilterT = (typeof DUE_OPTIONS)[number]['value']
