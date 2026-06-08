'use client'

import { createContext, useContext, type ReactNode } from 'react'

import type { PromptKeyT } from '@/features/openrouter/constants'

// Provides resolved system prompts to GenerateDialog without prop-drilling the map through every form
// wrapper (editable-system-prompts). No provider → undefined → the dialog uses the built-in.
const PromptDefaultsContext = createContext<Record<PromptKeyT, string> | undefined>(undefined)

export function PromptDefaultsProvider({
  value,
  children,
}: {
  value: Record<PromptKeyT, string>
  children: ReactNode
}) {
  return <PromptDefaultsContext value={value}>{children}</PromptDefaultsContext>
}

export function usePromptDefault(key: PromptKeyT): string | undefined {
  return useContext(PromptDefaultsContext)?.[key]
}
