'use client'

import type { BillingInterval } from '@/types'

interface BillingToggleProps {
  value:    BillingInterval
  onChange: (interval: BillingInterval) => void
}

export function BillingToggle({ value, onChange }: BillingToggleProps) {
  return (
    <div className="inline-flex items-center gap-3 bg-surface-2 border border-border rounded-lg p-1">
      <button
        onClick={() => onChange('monthly')}
        className={`px-4 py-1.5 rounded text-sm font-medium transition-all duration-150 ${
          value === 'monthly'
            ? 'bg-white text-text-primary shadow-card'
            : 'text-text-secondary hover:text-text-primary'
        }`}
      >
        Monthly
      </button>
      <button
        onClick={() => onChange('annual')}
        className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-all duration-150 ${
          value === 'annual'
            ? 'bg-white text-text-primary shadow-card'
            : 'text-text-secondary hover:text-text-primary'
        }`}
      >
        Annual
        <span className="bg-success-muted border border-success text-success text-xs font-medium px-2 py-0.5 rounded">
          2 months free
        </span>
      </button>
    </div>
  )
}
