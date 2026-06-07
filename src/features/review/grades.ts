// FSRS Rating 1..4 in Anki order (Again..Easy). Plain data (no ts-fsrs import) so the client
// rating island can consume it without pulling the FSRS engine into the client bundle.
export const GRADES = [
  { grade: 1, label: 'Again', variant: 'glowy-red' },
  { grade: 2, label: 'Hard', variant: 'outline' },
  { grade: 3, label: 'Good', variant: 'default' },
  { grade: 4, label: 'Easy', variant: 'glowy-green' },
] as const
