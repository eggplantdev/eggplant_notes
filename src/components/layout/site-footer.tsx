import { ContactDialog } from '@/features/contact/components/contact-dialog'

// Non-domain layout primitive. Uses the shared `container-shell` @utility so its edges line up with
// AppNav. Rendered once in the (protected) layout, so it's authed-only by construction.
export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-16 border-t">
      <div className="container-shell flex flex-col items-center justify-between gap-3 py-6 text-sm sm:flex-row">
        <span className="font-heading text-base font-semibold">Eggplant</span>
        <div className="text-muted-foreground flex items-center gap-3">
          <span>© {year} Eggplant</span>
          <ContactDialog />
        </div>
      </div>
    </footer>
  )
}
