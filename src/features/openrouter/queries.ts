import { getCredentialRow } from '@/features/openrouter/credential'
import { DEFAULT_OPENROUTER_MODEL } from '@/features/openrouter/models'

// Whether the caller has connected OpenRouter — drives the gating of every AI surface. Used by the
// nav (which only needs the boolean). Backed by the request-cached credential row, so this shares
// one read with the page status + credits badge instead of issuing its own.
export async function isOpenRouterConnected(): Promise<boolean> {
  return Boolean(await getCredentialRow())
}

// Connection + persisted default model — the AI pages need both (gating + the dialog's
// pre-selected model). defaultModel falls back to the hard default when unset/not connected.
export type OpenRouterStatusT = { connected: boolean; defaultModel: string }
export async function getOpenRouterStatus(): Promise<OpenRouterStatusT> {
  const data = await getCredentialRow()
  return { connected: Boolean(data), defaultModel: data?.model ?? DEFAULT_OPENROUTER_MODEL }
}
