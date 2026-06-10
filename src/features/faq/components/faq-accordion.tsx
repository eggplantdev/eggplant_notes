'use client'

import { type ReactNode, useState } from 'react'

import { AccordionArrow } from '@/components/ui/accordion-arrow'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { type FaqSectionT } from '@/features/faq/faq-data'

// `slots` maps an item's `slot` key (e.g. 'skill', 'contact') to a rendered node injected below its
// prose — the agent-skill preview, the contact-dialog trigger, etc. Passed as props (not imported
// here) so Server Components can cross into this Client boundary.
type PropsT = { sections: readonly FaqSectionT[]; slots?: Record<string, ReactNode> }

// Multi-open disclosure: a Set of open item keys means each item is its own controlled `Collapsible`,
// so opening one answer never closes another. The expand animation is baked into CollapsibleContent.
export function FaqAccordion({ sections, slots }: PropsT) {
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
                <Collapsible key={itemId} open={isOpen} onOpenChange={() => toggle(itemId)}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="group flex w-full cursor-pointer items-center justify-between gap-3 py-4 text-left"
                    >
                      <span className="font-medium">{item.question}</span>
                      <AccordionArrow isOpen={isOpen} className="shrink-0 duration-300" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="flex flex-col gap-4 pb-4">
                      <p className="text-muted-foreground text-sm">{item.answer}</p>
                      {item.slot && slots?.[item.slot]}
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
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
