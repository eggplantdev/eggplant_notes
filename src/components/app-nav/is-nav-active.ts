// Segment-safe active match: a link is active for its exact path or any child path,
// but never bleeds into an unrelated sibling (e.g. `/notes` matches `/notes/new` but
// not `/notesomething`). Same hazard class as the proxy.ts startsWith fix.
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
