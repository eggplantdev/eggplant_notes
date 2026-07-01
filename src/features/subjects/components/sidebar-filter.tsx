'use client'

import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'

type SidebarFilterPropsT = {
  value: string
  onChange: (next: string) => void
}

export function SidebarFilter({ value, onChange }: SidebarFilterPropsT) {
  return (
    <div className="relative mb-2">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter notes…"
        className="text-control h-7 w-full pl-8"
      />
    </div>
  )
}
