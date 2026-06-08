import { notFound } from 'next/navigation'

// Guards a route on an RLS-scoped fetch: a missing OR not-owned row resolves to null/undefined,
// which means 404. An assertion function (not a return) so it narrows the value in place — callers
// can keep their `Promise.all` destructuring and use the row directly after the call. notFound()
// throws (returns `never`), satisfying the assertion's "throw or hold" contract.
export function assertFound<T>(value: T): asserts value is NonNullable<T> {
  if (value == null) notFound()
}
