'use client'

import { type MultiSelectOptionT } from '@/components/ui/multi-select'
import { UrlMultiSelectFilter } from '@/components/ui/url-multi-select-filter'

type SubjectFilterPropsT = {
  options: MultiSelectOptionT[]
  // Subject ids currently in the URL (`?subjects=a,b`) — server-derived, the source of truth.
  selectedIds: string[]
  // Forwarded to the trigger so a parent grid can size it (e.g. `w-full`).
  triggerClassName?: string
}

// Subject ("topic") filter entry point; delegates to the generic URL-driven multiselect.
export function SubjectFilter({ options, selectedIds, triggerClassName }: SubjectFilterPropsT) {
  return (
    <UrlMultiSelectFilter
      paramKey="subjects"
      options={options}
      selectedValues={selectedIds}
      placeholder="Subjects"
      searchPlaceholder="Search subjects…"
      emptyMessage="No subjects found."
      triggerClassName={triggerClassName}
    />
  )
}
