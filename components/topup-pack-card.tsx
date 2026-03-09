'use client'

import { useState } from 'react'
import { CoinsIcon } from 'lucide-react'
import type { TopupPack } from '@/types'

interface TopupPackCardProps {
  pack:            TopupPack
  isAuthenticated: boolean
}

export function TopupPackCard({ pack, isAuthenticated }: TopupPackCardProps) {
  const [loading, setLoading] = useState(false)

  async function handlePurchase() {
    if (!isAuthenticated) {
      window.location.href = '/sign-up'
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pack.id }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface border border-border hover:border-border-2 rounded-xl p-6 flex flex-col gap-4 transition-colors duration-150">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-xl font-semibold text-text-primary">{pack.name}</h4>
          <p className="text-text-secondary text-sm mt-1">
            {pack.credits.toLocaleString()} credits
          </p>
        </div>
        <CoinsIcon className="w-5 h-5 text-accent shrink-0 mt-0.5" />
      </div>

      <div className="flex items-end gap-1">
        <span className="text-3xl font-bold text-text-primary">£{pack.price_gbp}</span>
        <span className="text-text-secondary text-sm mb-1.5">one-time</span>
      </div>

      <p className="text-text-secondary text-xs font-mono">
        £{pack.price_per_credit.toFixed(2)} per credit · Credits never expire
      </p>

      <button
        onClick={handlePurchase}
        disabled={loading}
        className="w-full border border-border-2 hover:border-accent text-text-primary font-medium rounded-lg px-5 py-2.5 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Redirecting…' : `Buy ${pack.name}`}
      </button>
    </div>
  )
}
