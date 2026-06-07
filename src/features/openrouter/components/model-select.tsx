'use client'

import { ChevronsUpDown } from 'lucide-react'
import { useState, useTransition } from 'react'

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
import { listOpenRouterModels } from '@/features/openrouter/actions/list-models'
import {
  filterModels,
  formatPricePerM,
  RECOMMENDED_FALLBACK,
  RECOMMENDED_MODEL_IDS,
  type OpenRouterModelT,
} from '@/features/openrouter/models'
import { cn } from '@/lib/utils'

// Seed the picker with the curated set so the trigger labels a recommended id (the common case)
// before the live catalog loads. Prices are unknown offline → 0, hidden until the live fetch lands.
const RECOMMENDED_SEED = RECOMMENDED_FALLBACK

// Searchable model picker over the live OpenRouter catalog. Pure controlled primitive — persistence
// (settings) or per-generate override (dialog) lives in the consumer. The 300+ catalog is fetched
// lazily on first open (server-cached), so the page render never pays for it. `defaultModelId` tags
// the settings default with "(default)". `filter='file'` scopes to vision models (Phase 8 PDF surface).
export function ModelSelect({
  value,
  onChange,
  defaultModelId,
  filter = 'text',
  disabled,
  testId,
  modal,
}: {
  value: string
  onChange: (modelId: string) => void
  defaultModelId?: string
  filter?: 'text' | 'file'
  disabled?: boolean
  testId?: string
  // Set when rendered inside a Dialog: makes the Popover mount its own scroll-lock so wheel events
  // reach the list. Without it the Dialog's react-remove-scroll swallows wheel on the portalled
  // popover (keyboard still scrolls via cmdk's scrollIntoView). Leave off for standalone use.
  modal?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState<OpenRouterModelT[]>(RECOMMENDED_SEED)
  const [loaded, setLoaded] = useState(false)
  const [isLoading, startLoad] = useTransition()

  // Lazy-load the catalog the first time the popover opens (event-driven, not an effect). Re-opens
  // reuse the loaded list; the server caches it across requests anyway.
  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && !loaded && !isLoading) {
      startLoad(async () => {
        setCatalog(await listOpenRouterModels())
        setLoaded(true)
      })
    }
  }

  const models = filterModels(catalog, filter)
  const recommended = models.filter((m) => RECOMMENDED_MODEL_IDS.includes(m.id))
  // Recommended keeps its curated cost-order (cheap→strong); the long "All models" list is sorted
  // alphabetically by label for findability. cmdk re-ranks by relevance once the user types a query.
  const rest = models
    .filter((m) => !RECOMMENDED_MODEL_IDS.includes(m.id))
    .sort((a, b) => a.label.localeCompare(b.label))
  const selectedLabel = catalog.find((m) => m.id === value)?.label ?? value

  function renderItem(m: OpenRouterModelT) {
    return (
      <CommandItem
        key={m.id}
        value={m.id}
        keywords={[m.label]}
        data-checked={value === m.id}
        onSelect={() => {
          onChange(m.id)
          setOpen(false)
        }}
      >
        <div className="flex w-full items-center justify-between gap-3">
          <span>
            {m.label}
            {m.id === defaultModelId ? ' (default)' : ''}
          </span>
          {loaded && (
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {formatPricePerM(m.inputPrice)} in · {formatPricePerM(m.outputPrice)} out
            </span>
          )}
        </div>
      </CommandItem>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={modal}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          data-testid={testId}
          className="w-full justify-between"
        >
          {selectedLabel}
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('w-(--radix-popover-trigger-width) p-0', 'min-w-72')}
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search models…" />
          <CommandList>
            <CommandEmpty>{isLoading ? 'Loading models…' : 'No models found.'}</CommandEmpty>
            {recommended.length > 0 && (
              <CommandGroup heading="Recommended">{recommended.map(renderItem)}</CommandGroup>
            )}
            {rest.length > 0 && (
              <CommandGroup heading="All models">{rest.map(renderItem)}</CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
