'use client'

import { useState } from 'react'
import { SlidersHorizontalIcon } from 'lucide-react'

interface Props {
  hasStripeAccount: boolean
}

export function ManageSubscriptionButton({ hasStripeAccount }: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)

    try {
      const res  = await fetch('/api/portal', { method: 'POST' })
      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Failed to open the billing portal')
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!hasStripeAccount) {
    return (
      <p className="text-xs text-text-disabled">
        No billing account yet. Subscribe to a plan to manage billing here.
      </p>
    )
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="
          inline-flex items-center gap-2
          border border-border-2 hover:border-accent
          text-text-primary font-medium rounded-lg px-4 py-2.5 text-sm
          transition-colors duration-150
          disabled:opacity-40 disabled:cursor-not-allowed
        "
      >
        <SlidersHorizontalIcon className="w-4 h-4" />
        {loading ? 'Opening…' : 'Manage subscription'}
      </button>
      {error && (
        <p className="mt-2 text-xs text-error">{error}</p>
      )}
    </div>
  )
}
