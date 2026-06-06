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

export type MultiSelectOptionT = { value: string; label: string }

type MultiSelectPropsT = {
  options: readonly MultiSelectOptionT[]
  // The popover stays open on toggle so several can be picked in one go (callers debounce any commit).
  values: string[]
  onValuesChange: (values: string[]) => void
  // Set on the trigger so an external `<Label htmlFor>` can target it.
  id?: string
  // Controllable so a caller can hook open/close (e.g. to flush a debounced commit); omit both to self-manage.
  open?: boolean
  onOpenChange?: (open: boolean) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  // Forwarded to the trigger so callers can target it in E2E.
  'data-testid'?: string
}

// Multi-select sibling of Combobox; trigger width drives popover width via the Radix CSS var.
export function MultiSelect({
  options,
  values,
  onValuesChange,
  id,
  open: openProp,
  onOpenChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results.',
  className,
  'data-testid': dataTestId,
}: MultiSelectPropsT) {
  const [openInternal, setOpenInternal] = useState(false)
  const open = openProp ?? openInternal
  const setOpen = onOpenChange ?? setOpenInternal
  const count = values.length

  function toggle(value: string) {
    onValuesChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          data-testid={dataTestId}
          variant="outline"
          size="sm"
          role="combobox"
          aria-label={placeholder}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn('justify-between', count === 0 && 'text-muted-foreground', className)}
        >
          {count === 0 ? placeholder : `${placeholder} (${count})`}
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
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  data-checked={values.includes(option.value)}
                  onSelect={() => toggle(option.value)}
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
