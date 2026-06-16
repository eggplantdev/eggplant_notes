import { BrandLogo } from '@/components/brand/brand-logo'
import { ContactDialog } from '@/features/contact/components/contact-dialog'

// Non-domain layout primitive. Uses the shared `container-shell` @utility so its edges line up with
// AppNav. Rendered once in the (protected) layout, so it's authed-only by construction.
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="container-shell flex items-center justify-between gap-3 py-6 text-sm">
        <ContactDialog />
        <div className="text-muted-foreground flex items-center gap-2">
          <span>© 2026 eggplant_dev</span>
          <BrandLogo className="size-6" />
        </div>
      </div>
    </footer>
  )
}
