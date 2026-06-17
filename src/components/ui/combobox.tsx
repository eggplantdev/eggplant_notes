'use client'

import { ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// Local to this primitive — no external consumer; callers pass plain `{value,label}` literals.
type ComboboxOptionT = { value: string; label: string }

type ComboboxPropsT = {
  options: readonly ComboboxOptionT[]
  onChange: (value: string) => void
  // Omit for action-style use (re-selecting the same option fires `onChange` again); provide for a value-bound select.
  value?: string
  // Set on the trigger so an external `<Label htmlFor>` can target it.
  id?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
  // Set when the combobox lives inside a modal Dialog, so clicking an option (its popover portals
  // outside the dialog) isn't treated as an outside-click that dismisses the dialog.
  modal?: boolean
}

// Trigger width drives popover width via the Radix CSS var, so size it through `className`.
export function Combobox({
  options,
  onChange,
  value,
  id,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results.',
  className,
  disabled,
  modal,
}: ComboboxPropsT) {
  const [open, setOpen] = useState(false)
  const selectedLabel = options.find((option) => option.value === value)?.label

  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          disabled={disabled}
          variant="outline"
          size="sm"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'min-w-0 justify-between',
            !selectedLabel && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-fit min-w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                // `value` is the unique option id so cmdk doesn't collide on duplicate labels; `keywords` keeps search matching the label.
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  data-checked={value === option.value}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
