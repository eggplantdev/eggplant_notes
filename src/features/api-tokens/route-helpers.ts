import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { AuthErrorT } from '@/features/api-tokens/authenticate-request'
import type { Database } from '@/lib/supabase/types'

export function errorJson(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

export function authError(error: AuthErrorT): NextResponse {
  return errorJson(error.status, error.message)
}

// Parse a JSON request body, returning a 400 NextResponse on malformed/empty input instead of letting
// req.json() throw into a 500. The success branch hands back the raw value for Zod validation.
export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; res: NextResponse }> {
  try {
    return { ok: true, body: await request.json() }
  } catch {
    return { ok: false, res: errorJson(400, 'Request body must be valid JSON') }
  }
}

// Shared DELETE-by-id for the `[id]` token routes: `delete().eq('id',…).select('id').maybeSingle()`
// then the uniform 500/404/200 mapping. RLS scopes the delete to the owner, so a non-owned/nonexistent
// id matches zero rows → 404 (never leaks existence). Mirrors run-delete-row.ts but takes an injected
// (minted-JWT) client instead of creating a cookie client.
export async function deleteRowResponse(
  supabase: SupabaseClient<Database>,
  table: keyof Database['public']['Tables'],
  id: string,
  label: string,
): Promise<NextResponse> {
  // A dynamic table name collapses Supabase's per-table column typing to `never`, so cast the whole
  // result to the known `{ id }` shape (same rationale as run-delete-row.ts). Every table routed through
  // here has an `id` column, so the cast is sound.
  const { data, error } = (await supabase
    .from(table)
    .delete()
    .eq('id' as never, id)
    .select('id')
    .maybeSingle()) as unknown as {
    data: { id: string } | null
    error: { message: string } | null
  }
  if (error) {
    console.error(`[DELETE ${table}] delete error`, error)
    return errorJson(500, `Failed to delete ${label.toLowerCase()}`)
  }
  if (!data) return errorJson(404, `${label} not found`)
  return NextResponse.json({ id: data.id })
}
