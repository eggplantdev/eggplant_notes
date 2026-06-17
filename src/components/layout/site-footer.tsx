import { BrandLogo } from '@/components/brand/brand-logo'
import { ContactDialog } from '@/features/contact/components/contact-dialog'

export function SiteFooter() {
  return (
    <footer className="container-shell mt-auto flex items-center justify-between gap-3 py-6 text-sm">
      <ContactDialog />
      <div className="text-muted-foreground flex items-center gap-2">
        <span>© 2026 eggplant_dev</span>
        <BrandLogo className="size-6" />
      </div>
    </footer>
  )
}
