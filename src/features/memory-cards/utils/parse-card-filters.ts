import {
  DUE_OPTIONS,
  FSRS_STATE_LABELS,
  MATURITY_OPTIONS,
  type DueFilterT,
  type MaturityT,
} from '@/features/memory-cards/constants'

export type CardFiltersT = { states: number[]; maturity: MaturityT[]; due: DueFilterT[] }

// Parse + validate the /memory-cards listing filter params off the raw URL searchParams. Junk is
// dropped so a hand-typed or stale deep link can't smuggle a bad predicate into the query: states
// keep only valid FSRS state indices (0..len-1, derived from FSRS_STATE_LABELS so a new state
// widens the bound automatically); maturity and due keep only known buckets.
export function parseCardFilters(params: {
  state?: string
  maturity?: string
  due?: string
}): CardFiltersT {
  const states = (params.state ?? '')
    .split(',')
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n < FSRS_STATE_LABELS.length)
  const maturity = (params.maturity ?? '')
    .split(',')
    .filter((v): v is MaturityT => MATURITY_OPTIONS.some((option) => option.value === v))
  const due = (params.due ?? '')
    .split(',')
    .filter((v): v is DueFilterT => DUE_OPTIONS.some((option) => option.value === v))
  return { states, maturity, due }
}
