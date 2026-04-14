'use client'

import { useState, useEffect } from 'react'
import { UsersIcon, ClipboardIcon, ClipboardCheckIcon } from 'lucide-react'

interface ReferralData {
  referralCode:      string
  referralLink:      string
  totalReferrals:    number
  creditedReferrals: number
  pendingReferrals:  number
  creditsEarned:     number
}

export default function ReferralWidget() {
  const [data,   setData]   = useState<ReferralData | null>(null)
  const [copied, setCopied] = useState(false)
  const [error,  setError]  = useState(false)

  useEffect(() => {
    fetch('/api/referral')
      .then((r) => r.json())
      .then((d: ReferralData) => setData(d))
      .catch(() => setError(true))
  }, [])

  async function copyLink() {
    if (!data || copied) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.referralLink)
      } else {
        const ta = document.createElement('textarea')
        ta.value = data.referralLink
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // silent
    }
  }

  if (error) return null

  return (
    <div className="bg-white border border-border rounded-xl p-6 space-y-5 shadow-card">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent-light flex items-center justify-center flex-shrink-0">
          <UsersIcon className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h3 className="text-base font-medium text-text-primary">Refer a seller</h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Earn 20 credits for every seller who subscribes using your link
          </p>
        </div>
      </div>

      {data && data.totalReferrals > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: data.totalReferrals,    label: 'Referred',      color: 'text-text-primary' },
            { value: data.creditedReferrals, label: 'Subscribed',    color: 'text-success' },
            { value: data.creditsEarned,     label: 'Credits earned', color: 'text-accent' },
          ].map(({ value, label, color }) => (
            <div key={label} className="bg-surface-2 rounded-lg p-3 text-center">
              <div className={`text-xl font-medium ${color}`}>{value}</div>
              <div className="text-xs text-text-secondary mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {data ? (
        <div className="flex items-center gap-2">
          <div
            className="flex-1 min-w-0 bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-secondary truncate select-all"
            title={data.referralLink}
          >
            {data.referralLink}
          </div>
          <button
            onClick={copyLink}
            className={`
              flex-shrink-0 flex items-center gap-1.5
              px-3 py-2 rounded-lg text-sm font-medium
              border transition-colors duration-150
              ${copied
                ? 'border-success text-success bg-success-muted'
                : 'border-border hover:border-border-2 text-text-secondary hover:text-text-primary bg-white'}
            `}
          >
            {copied
              ? <><ClipboardCheckIcon className="w-3.5 h-3.5" /> Copied!</>
              : <><ClipboardIcon      className="w-3.5 h-3.5" /> Copy</>
            }
          </button>
        </div>
      ) : (
        <div className="h-9 rounded-lg bg-surface-2 animate-pulse" />
      )}

      {data && data.pendingReferrals > 0 && (
        <p className="text-xs text-text-secondary">
          {data.pendingReferrals} referral{data.pendingReferrals !== 1 ? 's' : ''} pending — credits
          are awarded when the referred user subscribes.
        </p>
      )}
    </div>
  )
}
