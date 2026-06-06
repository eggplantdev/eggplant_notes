// Segment-safe: matches exact path or any child path, never a sibling (`/notes` ≠ `/notesomething`).
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
