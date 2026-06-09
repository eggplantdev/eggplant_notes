import type { ZodType } from 'zod'

import { runTableAction, type TableActionResultT } from '@/lib/supabase/run-table-action'
import type { Database } from '@/lib/supabase/types'

type DeletableTableT = keyof Database['public']['Tables']

// Shared core of every delete action: validate the id, then
// `delete().eq('id', …).select('id').single()` — the single() confirms a row was actually removed
// (RLS scopes the delete to the owner). Callers own the entity-specific revalidate/redirect tail,
// which varies too much (conditional paths, layout mode, redirect-vs-return) to fold in here.
export async function runDeleteRow(
  idSchema: ZodType<string>,
  table: DeletableTableT,
  id: string,
): Promise<TableActionResultT<{ id: string }>> {
  return runTableAction(idSchema, id, (supabase, validId) =>
    supabase
      .from(table)
      .delete()
      // A dynamic table name collapses Supabase's per-table column typing to `never`; every table
      // routed through here has an `id` column, so the cast is sound.
      .eq('id' as never, validId)
      .select('id')
      .single(),
  ) as Promise<TableActionResultT<{ id: string }>>
}
