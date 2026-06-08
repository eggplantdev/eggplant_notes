import type { ComponentPropsWithoutRef, ElementType } from 'react'

import { cn } from '@/lib/utils'

// Bordered, padded, vertically-stacked container — the repeated `flex flex-col gap-N rounded-lg
// border p-4` shape. Polymorphic (`as` defaults to `div`, e.g. `as="form"`) and forwards native
// props. `gap` is the inter-child gap (the two values in use). Grid/danger boxes that already have a
// named home (SettingsSection) keep it — this is for the raw, repeated div/form case.
type BoxPropsT<T extends ElementType> = {
  as?: T
  gap?: 3 | 4
} & Omit<ComponentPropsWithoutRef<T>, 'as'>

export function Box<T extends ElementType = 'div'>({
  as,
  gap = 4,
  className,
  ...rest
}: BoxPropsT<T>) {
  const Tag = as ?? 'div'
  return (
    <Tag
      className={cn(
        'flex flex-col rounded-lg border p-4',
        gap === 3 ? 'gap-3' : 'gap-4',
        className,
      )}
      {...rest}
    />
  )
}
