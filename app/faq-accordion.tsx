'use client'

import { useState } from 'react'
import { PlusIcon, MinusIcon } from 'lucide-react'

interface FaqItem {
  q: string
  a: string
}

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="divide-y divide-border">
      {items.map((item, i) => {
        const isOpen = open === i
        return (
          <div key={i}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="
                w-full flex items-center justify-between gap-4
                py-5 text-left transition-colors duration-150
              "
            >
              <span className={`text-sm font-medium ${isOpen ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'} transition-colors`}>
                {item.q}
              </span>
              {isOpen
                ? <MinusIcon className="w-4 h-4 text-accent flex-shrink-0" />
                : <PlusIcon  className="w-4 h-4 text-text-disabled flex-shrink-0" />
              }
            </button>
            {isOpen && (
              <div className="pb-5 text-sm text-text-secondary leading-relaxed">
                {item.a}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
