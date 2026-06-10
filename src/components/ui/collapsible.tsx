'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import * as React from 'react'
import { Collapsible as CollapsiblePrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

// Radix Collapsible with a baked-in framer-motion height/opacity animation, so every disclosure in the
// app expands the same way instead of each accordion re-rolling its own toggle. `CollapsibleContent`
// owns the animation; the trigger styling stays per-call-site. Supports controlled and uncontrolled use.

// The open state has to reach `CollapsibleContent` to drive AnimatePresence, but Radix doesn't expose it
// as a render prop — so we mirror it through context from the Root wrapper.
const CollapsibleOpenContext = React.createContext<boolean>(false)

function Collapsible({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen

  function handleOpenChange(nextOpen: boolean) {
    if (!isControlled) setUncontrolledOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  return (
    <CollapsibleOpenContext value={isOpen}>
      <CollapsiblePrimitive.Root
        data-slot="collapsible"
        open={controlledOpen}
        defaultOpen={defaultOpen}
        onOpenChange={handleOpenChange}
        {...props}
      />
    </CollapsibleOpenContext>
  )
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return <CollapsiblePrimitive.CollapsibleTrigger data-slot="collapsible-trigger" {...props} />
}

function CollapsibleContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  const isOpen = React.useContext(CollapsibleOpenContext)
  const shouldReduceMotion = useReducedMotion()

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        // `forceMount` hands the open/close timing to AnimatePresence so the exit animation can play
        // before unmount; overflow-hidden clips the height tween, so pad the children, not this element.
        <CollapsiblePrimitive.CollapsibleContent
          data-slot="collapsible-content"
          forceMount
          asChild
          {...props}
        >
          <motion.div
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={
              shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
            }
            className={cn('overflow-hidden', className)}
          >
            {children}
          </motion.div>
        </CollapsiblePrimitive.CollapsibleContent>
      )}
    </AnimatePresence>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
