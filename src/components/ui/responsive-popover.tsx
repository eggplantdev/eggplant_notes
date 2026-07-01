'use client'

import { type ReactNode } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { cn } from '@/lib/utils'

type ResponsivePopoverPropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: ReactNode
  children: ReactNode
  // Screen-reader label for the mobile sheet, which has no visible title.
  title: string
  // Desktop Popover only — see the Combobox `modal` note. The mobile Sheet is always modal.
  modal?: boolean
  // Applied to the desktop PopoverContent only (width/padding); the mobile Sheet owns its own layout.
  contentClassName?: string
}

// A trigger-anchored searchable list (Popover + CommandInput) breaks on mobile: the soft keyboard
// overlays the visual viewport and hides the popover's search input, since Radix anchors the popover
// to the layout viewport it can't see shrink. On mobile we swap the Popover for a bottom Sheet —
// pinned to `bottom: 0`, so with the layout viewport resized by the keyboard (see the root layout's
// `interactiveWidget`) the search input stays above the keyboard.
export function ResponsivePopover({
  open,
  onOpenChange,
  trigger,
  children,
  title,
  modal,
  contentClassName,
}: ResponsivePopoverPropsT) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[85svh] gap-0 rounded-t-xl p-1"
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          {children}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal={modal}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className={cn('p-0', contentClassName)} align="start">
        {children}
      </PopoverContent>
    </Popover>
  )
}
