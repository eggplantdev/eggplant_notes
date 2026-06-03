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

export type ComboboxOptionT = { value: string; label: string }

type ComboboxPropsT = {
  options: readonly ComboboxOptionT[]
  onChange: (value: string) => void
  // Omit `value` for action-style use (always shows the placeholder, no persistent selection,
  // re-selecting the same option fires `onChange` again). Provide it for value-bound selects
  // (trigger shows the selected label + a check beside the active option).
  value?: string
  // Set on the trigger so an external `<Label htmlFor>` can target it.
  id?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
}

// Generic searchable select built on Command (cmdk) inside a Popover. Pure primitive — no
// domain knowledge; callers supply options + handler. The trigger width drives the popover
// width via the Radix CSS var, so size it through `className` (e.g. `w-48`, `w-full`).
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
}: ComboboxPropsT) {
  const [open, setOpen] = useState(false)
  const selectedLabel = options.find((option) => option.value === value)?.label

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          className={cn('justify-between', !selectedLabel && 'text-muted-foreground', className)}
        >
          {selectedLabel ?? placeholder}
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                // `value` is the (unique) option id so cmdk never collides on duplicate
                // labels; `keywords` keeps search matching the visible label. `data-checked`
                // drives the CommandItem's own trailing check (no second icon).
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
