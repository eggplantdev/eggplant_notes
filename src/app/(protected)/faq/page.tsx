import { PageShell } from '@/components/layout/page-shell'
import { FaqAccordion } from '@/features/faq/components/faq-accordion'
import { FAQ_SECTIONS } from '@/features/faq/faq-data'

export default function FaqPage() {
  return (
    <PageShell
      title="FAQ"
      subtitle="How your data, the AI features, and the CLI API work."
      width="wide"
    >
      <FaqAccordion sections={FAQ_SECTIONS} />
    </PageShell>
  )
}
