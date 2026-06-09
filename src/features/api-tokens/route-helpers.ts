import { NextResponse } from 'next/server'

import type { AuthErrorT } from '@/features/api-tokens/authenticate-request'

// Shared JSON helpers for the token API routes — uniform error envelope `{ error }` + status.
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
