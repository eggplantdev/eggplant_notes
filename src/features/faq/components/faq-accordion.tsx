'use client'

import { useState } from 'react'

import { AccordionArrow } from '@/components/ui/accordion-arrow'
import { type FaqSectionT } from '@/features/faq/faq-data'

type PropsT = { sections: readonly FaqSectionT[] }

// Multi-open disclosure: each item tracks its own open state by `${sectionId}:${index}` key,
// so opening one answer never closes another. Mirrors the group-button + AccordionArrow idiom
// used elsewhere (e.g. import/source-input) rather than pulling in a new accordion dependency.
export function FaqAccordion({ sections }: PropsT) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="flex flex-col gap-10">
      {sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          {section.intro && <p className="text-muted-foreground text-sm">{section.intro}</p>}
          <div className="divide-border flex flex-col divide-y border-t border-b">
            {section.items.map((item, index) => {
              const itemId = `faq-${section.id}-${index}`
              const isOpen = open.has(itemId)
              return (
                <div key={itemId}>
                  <button
                    type="button"
                    onClick={() => toggle(itemId)}
                    aria-expanded={isOpen}
                    aria-controls={itemId}
                    className="group flex w-full cursor-pointer items-center justify-between gap-3 py-4 text-left"
                  >
                    <span className="font-medium">{item.question}</span>
                    <AccordionArrow isOpen={isOpen} className="shrink-0 duration-300" />
                  </button>
                  {/* Always mounted so the trigger's aria-controls always resolves; hidden when closed. */}
                  <div id={itemId} hidden={!isOpen} className="flex flex-col gap-4 pb-4">
                    <p className="text-muted-foreground text-sm">{item.answer}</p>
                    {item.endpoints && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="text-muted-foreground border-b">
                              <th scope="col" className="py-2 pr-4 font-medium">
                                Method
                              </th>
                              <th scope="col" className="py-2 pr-4 font-medium">
                                Endpoint
                              </th>
                              <th scope="col" className="py-2 font-medium">
                                Purpose
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.endpoints.map((row) => (
                              <tr
                                key={`${row.method} ${row.endpoint}`}
                                className="border-b last:border-b-0"
                              >
                                <td className="py-2 pr-4 font-mono">{row.method}</td>
                                <td className="py-2 pr-4 font-mono">{row.endpoint}</td>
                                <td className="text-muted-foreground py-2">{row.purpose}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
