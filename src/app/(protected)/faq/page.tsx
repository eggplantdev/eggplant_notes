import { headers } from 'next/headers'

import { PageShell } from '@/components/layout/page-shell'
import { fillSkillTemplate } from '@/features/api-tokens/skill'
import { ContactDialog } from '@/features/contact/components/contact-dialog'
import { FaqAccordion } from '@/features/faq/components/faq-accordion'
import { SkillPreview } from '@/features/faq/components/skill-preview'
import { FAQ_SECTIONS } from '@/features/faq/faq-data'
import { originFromHeaders } from '@/lib/request-origin'

export default async function FaqPage() {
  // Inject the origin server-side (same path as the Settings copy/download) so the FAQ skill preview is
  // single-sourced from SKILL_TEMPLATE and can't drift from the downloaded skill.
  const skill = fillSkillTemplate(originFromHeaders(await headers()))

  return (
    <PageShell
      title="FAQ"
      subtitle="How your data, the AI features, and the CLI API work."
      width="wide"
    >
      <FaqAccordion
        sections={FAQ_SECTIONS}
        slots={{ skill: <SkillPreview skill={skill} />, contact: <ContactDialog /> }}
      />
    </PageShell>
  )
}
