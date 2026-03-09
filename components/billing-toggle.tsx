'use client'

import type { BillingInterval } from '@/types'

interface BillingToggleProps {
  value:    BillingInterval
  onChange: (interval: BillingInterval) => void
}

export function BillingToggle({ value, onChange }: BillingToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange('monthly')}
        className={`text-sm font-medium transition-colors duration-150 ${
          value === 'monthly' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
        }`}
      >
        Monthly
      </button>

      {/* Toggle pill */}
      <button
        onClick={() => onChange(value === 'monthly' ? 'annual' : 'monthly')}
        className="relative w-11 h-6 rounded-full bg-surface-2 border border-border-2 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-accent/40"
        aria-label="Toggle billing interval"
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-accent transition-all duration-150 ${
            value === 'annual' ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>

      <button
        onClick={() => onChange('annual')}
        className={`flex items-center gap-2 text-sm font-medium transition-colors duration-150 ${
          value === 'annual' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
        }`}
      >
        Annual
        <span className="bg-success-muted border border-success text-success text-xs font-semibold px-2 py-0.5 rounded-lg">
          2 months free
        </span>
      </button>
    </div>
  )
}
