// "1 note" / "3 notes" — count prefixed to a singular/plural noun. Defaults the plural to
// `${singular}s`; pass an explicit plural for irregular nouns. Used by the list-header counts.
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}
