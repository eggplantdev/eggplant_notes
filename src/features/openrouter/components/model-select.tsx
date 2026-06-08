'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown, Star } from 'lucide-react'
import { useState, useTransition } from 'react'

import { toastActionResult } from '@/components/forms/toast-result'
import { Button } from '@/components/ui/button'
import { SegmentedToggle, type SegmentedOptionT } from '@/components/ui/segmented-toggle'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { listFavoriteModels } from '@/features/openrouter/actions/list-favorite-models'
import { listOpenRouterModels } from '@/features/openrouter/actions/list-models'
import { toggleFavoriteModel } from '@/features/openrouter/actions/toggle-favorite-model'
import {
  filterModels,
  formatModelPricing,
  RECOMMENDED_FALLBACK,
  sortModels,
  type ModelSortT,
  type OpenRouterModelT,
  type SortDirT,
} from '@/features/openrouter/models'
import { cn } from '@/lib/utils'

// Seed the picker with the curated set so the trigger labels a known id (the common case) before
// the live catalog loads. Prices are unknown offline → 0, hidden until the live fetch lands. These
// same ids also seed a new account's pinned set (DB default), so the seed and the pins stay aligned.
const RECOMMENDED_SEED = RECOMMENDED_FALLBACK

// Sort field shown as a segmented control so all options are visible at once; direction (asc/desc)
// is a separate toggle. See sortModels.
const SORT_OPTIONS: SegmentedOptionT<ModelSortT>[] = [
  { value: 'name', label: 'Name' },
  { value: 'input', label: 'Input $' },
  { value: 'output', label: 'Output $' },
]

// Searchable model picker over the live OpenRouter catalog. The selected value (settings default or
// per-generate override) is controlled by the consumer; favorites are GLOBAL per-user state, so the
// picker owns them internally — self-loaded (with the catalog) and toggled directly, no props. The
// 300+ catalog is fetched lazily on first open (server-cached), so the page render never pays for it.
// `defaultModelId` tags the settings default with "(default)". `filter='file'` scopes to vision models.
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
  const [favorites, setFavorites] = useState<string[]>([])
  const [sort, setSort] = useState<ModelSortT>('name')
  const [sortDir, setSortDir] = useState<SortDirT>('asc')
  const [loaded, setLoaded] = useState(false)
  const [isLoading, startLoad] = useTransition()

  // Lazy-load the catalog AND the user's favorites the first time the popover opens (event-driven,
  // not an effect). Both are global/server-cached, so re-opens reuse the loaded lists.
  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && !loaded && !isLoading) {
      startLoad(async () => {
        const [models, favs] = await Promise.all([listOpenRouterModels(), listFavoriteModels()])
        setCatalog(models)
        setFavorites(favs)
        setLoaded(true)
      })
    }
  }

  // Optimistically flip the star, then persist; revert + toast on failure. Favorites is global
  // per-user state the picker owns, so local state is the source of truth for the UI.
  function toggleFavorite(modelId: string) {
    const previous = favorites
    setFavorites((ids) =>
      ids.includes(modelId) ? ids.filter((id) => id !== modelId) : [...ids, modelId],
    )
    void toggleFavoriteModel({ modelId }).then((result) => {
      if (!toastActionResult(result)) setFavorites(previous)
    })
  }

  const models = filterModels(catalog, filter)
  const isFavorite = (m: OpenRouterModelT) => favorites.includes(m.id)
  // Two disjoint groups: the user's pinned picks on top, then everything else. Same field+direction
  // comparator sorts both; cmdk re-ranks by relevance once the user types.
  const pinned = sortModels(models.filter(isFavorite), sort, sortDir)
  const rest = sortModels(
    models.filter((m) => !isFavorite(m)),
    sort,
    sortDir,
  )
  const selectedLabel = catalog.find((m) => m.id === value)?.label ?? value

  function renderItem(m: OpenRouterModelT) {
    const starred = isFavorite(m)
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
          <span className="flex items-center gap-2">
            <button
              type="button"
              // Stop the click reaching cmdk's onSelect — starring must not also pick the model.
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                toggleFavorite(m.id)
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-pressed={starred}
              aria-label={starred ? `Unfavorite ${m.label}` : `Favorite ${m.label}`}
              className="text-muted-foreground hover:text-foreground -m-1 p-1"
            >
              <Star className={cn('size-3.5', starred && 'fill-current text-amber-500')} />
            </button>
            <span>
              {m.label}
              {m.id === defaultModelId ? ' (default)' : ''}
            </span>
          </span>
          {loaded && (
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {formatModelPricing(m)}
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
          <div className="flex flex-col gap-1.5 border-b px-2 py-2">
            <span className="text-muted-foreground text-xs font-medium">Sort by</span>
            <div className="flex items-center gap-1.5">
              <SegmentedToggle
                value={sort}
                onChange={setSort}
                options={SORT_OPTIONS}
                size="sm"
                ariaLabel="Sort field"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                data-testid={testId ? `${testId}-sort-dir` : undefined}
                aria-label={`Sort direction: ${sortDir === 'asc' ? 'ascending' : 'descending'}`}
                className="h-7 gap-1 text-xs"
              >
                {sortDir === 'asc' ? (
                  <ArrowUp className="size-3.5" />
                ) : (
                  <ArrowDown className="size-3.5" />
                )}
                {sortDir === 'asc' ? 'Asc' : 'Desc'}
              </Button>
            </div>
          </div>
          <CommandList>
            <CommandEmpty>{isLoading ? 'Loading models…' : 'No models found.'}</CommandEmpty>
            {pinned.length > 0 && (
              <CommandGroup heading="Pinned">{pinned.map(renderItem)}</CommandGroup>
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
