export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/notes', label: 'Notes' },
  { href: '/import', label: 'Import' },
  { href: '/memory-cards', label: 'Memory cards' },
  { href: '/subjects', label: 'Subjects' },
] as const

// Rendered in its own desktop cluster (right side), but part of the flat list on mobile.
export const SETTINGS_ITEM = { href: '/settings', label: 'Settings' } as const

export const ALL_NAV_ITEMS = [...NAV_ITEMS, SETTINGS_ITEM]
