// FSRS card states (ts-fsrs State enum). Index = memory_cards.state integer.
// 0 New · 1 Learning · 2 Review · 3 Relearning. Drives the cards-by-state breakdown.
export const FSRS_STATE_LABELS = ['New', 'Learning', 'Review', 'Relearning'] as const

// A card is "mature" once FSRS stability (≈ days until recall drops to 90%) crosses this.
// 21d is the conventional Anki maturity line. NOTE: mirrors the dashboard's own copy — the
// dashboard still computes its (now-unused) mature/young aggregate; consolidate if that's removed.
export const MATURE_STABILITY_DAYS = 21
