import { CLC_BASE_URL_PLACEHOLDER, CLC_SKILL_TEMPLATE } from '@/features/api-tokens/skill-template'

// Inject the deployment origin into the skill markdown. Single source for the placeholder→origin swap
// so the /api/skill download route and the Settings copy button can't drift. Kept out of the GENERATED
// skill-template.ts (which gets overwritten by gen-skill-template.mjs) so the helper survives regen.
export function fillSkillTemplate(origin: string): string {
  return CLC_SKILL_TEMPLATE.replaceAll(CLC_BASE_URL_PLACEHOLDER, origin)
}
