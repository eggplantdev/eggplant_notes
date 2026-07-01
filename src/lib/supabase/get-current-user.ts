import { cache } from 'react'

import { createClient } from '@/lib/supabase/create-server-client'

// getUser() validates the JWT over the network, and both the (protected) layout and the page call
// it — React cache() dedupes them to one round-trip per render.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
