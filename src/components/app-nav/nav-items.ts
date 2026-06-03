// Primary nav destinations, consumed by the desktop bar's left cluster (app-nav.tsx) and,
// flattened, by the mobile surfaces below.
export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/notes', label: 'Notes' },
  { href: '/review', label: 'Review' },
  { href: '/subjects', label: 'Subjects' },
] as const

// Account-cluster entry — rendered apart from NAV_ITEMS on desktop (right side), but part
// of the flat list on mobile.
export const SETTINGS_ITEM = { href: '/settings', label: 'Settings' } as const

// Every route with a nav entry, flattened — used by the mobile sheet and the mobile
// current-page label. Desktop renders NAV_ITEMS + SETTINGS_ITEM in separate clusters.
export const ALL_NAV_ITEMS = [...NAV_ITEMS, SETTINGS_ITEM]
