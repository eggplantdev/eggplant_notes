import type { SubjectRollupT } from '@/features/dashboard/types'

type PropsT = { rows: SubjectRollupT[] }

// Per-subject rollup table: note / card / due counts per subject, plus a "No subject" bucket
// for unassigned notes (appended by the stats builder only when there are any).
export function SubjectRollup({ rows }: PropsT) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">No subjects yet.</p>
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-muted-foreground border-border border-b text-left text-xs uppercase">
          <th className="py-1.5 font-medium">Subject</th>
          <th className="py-1.5 text-right font-medium">Notes</th>
          <th className="py-1.5 text-right font-medium">Cards</th>
          <th className="py-1.5 text-right font-medium">Due</th>
        </tr>
      </thead>
      <tbody className="divide-border divide-y">
        {rows.map((r) => (
          <tr key={r.id ?? '__none__'}>
            <td className="text-foreground py-1.5">{r.title}</td>
            <td className="py-1.5 text-right tabular-nums">{r.notes}</td>
            <td className="py-1.5 text-right tabular-nums">{r.cards}</td>
            <td className="py-1.5 text-right tabular-nums">{r.due}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
