import { isAccountEmpty } from '@/features/sample-data/queries'
import { cookies } from 'next/headers'
import { WelcomeDialog } from './welcome-dialog'

import { WELCOME_SEEN_COOKIE } from '@/features/dashboard/welcome-dialog-cookie'
export async function WelcomeDialogServer() {
  const welcomeSeen = (await cookies()).get(WELCOME_SEEN_COOKIE)?.value === '1'
  if (welcomeSeen) return <></>
  const isEmpty = await isAccountEmpty()
  if (!isEmpty) return <></>

  return <WelcomeDialog />
}
