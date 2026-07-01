import { NextResponse } from 'next/server'

import { errorJson } from '@/features/api-tokens/route-helpers'
import { fillSkillTemplate } from '@/features/api-tokens/skill'
import { originFromHeaders } from '@/lib/request-origin'
import { getCurrentUser } from '@/lib/supabase/get-current-user'

// GET /api/skill — serves the eggplant-notes agent skill with the deployment origin injected as BASE.
// Session-gated: it's a Settings feature, and gating keeps it tidy (the body is non-secret either way).
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return errorJson(401, 'Not authenticated')

  const filled = fillSkillTemplate(originFromHeaders(request.headers))

  return new NextResponse(filled, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="eggplant-notes.skill.md"',
    },
  })
}
