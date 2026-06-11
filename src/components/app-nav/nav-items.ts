// The brand logo (AppNav / MobileNav) is the dashboard link, so no separate Dashboard tab here.
export const NAV_ITEMS = [
  { href: '/notes', label: 'Notes' },
  { href: '/memory-cards', label: 'Memory cards' },
  { href: '/subjects', label: 'Subjects' },
  { href: '/faq', label: 'FAQ' },
] as const

// Rendered in its own desktop cluster (right side), but part of the flat list on mobile.
export const SETTINGS_ITEM = { href: '/settings', label: 'Settings' } as const

export const ALL_NAV_ITEMS = [...NAV_ITEMS, SETTINGS_ITEM]
