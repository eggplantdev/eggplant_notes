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
