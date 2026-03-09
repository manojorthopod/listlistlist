'use client'

import { useState, useEffect, useRef } from 'react'
import { CoinsIcon, ExternalLinkIcon } from 'lucide-react'
import type { CreditBalance } from '@/types'

export default function CreditBadge() {
  const [balance,  setBalance]  = useState<CreditBalance | null>(null)
  const [open,     setOpen]     = useState(false)
  const containerRef            = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/credits')
      .then((r) => r.json())
      .then((d: CreditBalance) => setBalance(d))
      .catch(() => {})
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!balance) return null

  const isLow = balance.subscriptionCredits <= 5

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg
          border border-border hover:border-border-2
          bg-surface transition-colors duration-150
          text-sm
        "
        aria-label="Credit balance"
      >
        {/* Monthly dot */}
        <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
        <span className={isLow ? 'text-warning font-semibold' : 'text-text-primary font-medium'}>
          {balance.subscriptionCredits}
        </span>
        <span className="text-text-disabled">monthly</span>

        {balance.topupCredits > 0 && (
          <>
            <span className="text-border-2 mx-0.5">·</span>
            <span className="w-1.5 h-1.5 rounded-full bg-text-secondary flex-shrink-0" />
            <span className="text-text-primary font-medium">{balance.topupCredits}</span>
            <span className="text-text-disabled">top-up</span>
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="
            absolute right-0 top-full mt-2 w-64
            bg-surface-2 border border-border-2 rounded-xl shadow-lg p-4
            z-50 space-y-3
          "
        >
          <p className="text-xs text-text-secondary uppercase tracking-widest font-medium">
            Credit balance
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-text-secondary">Monthly</span>
              </div>
              <span className={`text-sm font-semibold ${isLow ? 'text-warning' : 'text-text-primary'}`}>
                {balance.subscriptionCredits}
              </span>
            </div>

            {balance.topupCredits > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-text-secondary" />
                  <span className="text-text-secondary">Top-up</span>
                </div>
                <span className="text-sm font-semibold text-text-primary">
                  {balance.topupCredits}
                </span>
              </div>
            )}

            <div className="border-t border-border pt-2 flex items-center justify-between">
              <span className="text-sm text-text-secondary">Total</span>
              <span className="text-sm font-bold text-text-primary">{balance.totalCredits}</span>
            </div>
          </div>

          {balance.creditsResetAt && (
            <p className="text-xs text-text-secondary">
              Resets{' '}
              {new Date(balance.creditsResetAt).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short',
              })}
            </p>
          )}

          {isLow && (
            <div className="rounded-lg bg-warning-muted border border-warning px-3 py-2 text-xs text-warning">
              Running low. Buy more before they run out.
            </div>
          )}

          <a
            href="/account"
            className="
              flex items-center justify-center gap-1.5 w-full
              bg-accent hover:bg-accent-hover text-white text-sm font-semibold
              rounded-lg px-3 py-2 transition-colors duration-150
            "
            onClick={() => setOpen(false)}
          >
            <CoinsIcon className="w-3.5 h-3.5" />
            Buy more credits
            <ExternalLinkIcon className="w-3 h-3 opacity-60" />
          </a>
        </div>
      )}
    </div>
  )
}
