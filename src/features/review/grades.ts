// Single source for the four review grades — FSRS Rating 1..4 in Anki order (Again..Easy),
// each with its button label + shadcn variant. Plain data (no ts-fsrs import) so both the
// server scheduler (scheduling.ts derives its grade list from this) and the client rating
// island consume it without pulling the FSRS engine into the client bundle.
export const GRADES = [
  { grade: 1, label: 'Again', variant: 'glowy-red' },
  { grade: 2, label: 'Hard', variant: 'outline' },
  { grade: 3, label: 'Good', variant: 'default' },
  { grade: 4, label: 'Easy', variant: 'ghost' },
] as const
