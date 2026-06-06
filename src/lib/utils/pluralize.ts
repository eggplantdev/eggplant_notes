// Pass an explicit plural for irregular nouns; defaults to `${singular}s`.
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}
