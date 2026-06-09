import { revalidatePath } from 'next/cache'

// The routes that render a GenerateDialog (its server boundary resolves the user's prompts). After a
// Save/Reset, revalidate them so a later navigation re-seeds the dialog from the new override state.
// `/notes/[id]` uses the 'page' form to cover every dynamic note page. Shared by both prompt actions.
export function revalidatePromptSurfaces(): void {
  revalidatePath('/notes/new')
  revalidatePath('/notes/[id]', 'page')
  revalidatePath('/import')
  revalidatePath('/memory-cards/new')
}
