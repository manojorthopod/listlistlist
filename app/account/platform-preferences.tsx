'use client'

import { useState, useTransition } from 'react'
import { CheckIcon } from 'lucide-react'
import PlatformToggleCard from '@/components/platform-toggle-card'
import { ALL_PLATFORMS, type Platform } from '@/types'

interface Props {
  initialPlatforms: Platform[]
}

export function PlatformPreferences({ initialPlatforms }: Props) {
  const [selected,    setSelected]    = useState<Platform[]>(initialPlatforms)
  const [savedFlash,  setSavedFlash]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [isPending,   startTransition] = useTransition()

  function toggle(platform: Platform) {
    const next = selected.includes(platform)
      ? selected.filter((p) => p !== platform)
      : [...selected, platform]

    // Always keep at least one platform selected
    if (next.length === 0) return

    setSelected(next)
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/user/preferred-platforms', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ platforms: next }),
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error ?? 'Failed to save preferences')
          return
        }

        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 2000)
      } catch {
        setError('Failed to save preferences. Try again.')
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 min-h-[20px]">
        <p className="text-xs text-text-secondary">
          Tap a platform to toggle. Changes save automatically.
        </p>
        {savedFlash && !isPending && (
          <span className="flex items-center gap-1 text-xs text-success font-medium">
            <CheckIcon className="w-3.5 h-3.5" />
            Saved
          </span>
        )}
        {isPending && (
          <span className="text-xs text-text-disabled">Saving…</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {ALL_PLATFORMS.map((platform) => (
          <PlatformToggleCard
            key={platform}
            platform={platform}
            selected={selected.includes(platform)}
            onToggle={toggle}
          />
        ))}
      </div>

      {error && (
        <p className="text-xs text-error">{error}</p>
      )}
    </div>
  )
}
