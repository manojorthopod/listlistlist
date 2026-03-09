'use client'

import { useState, useTransition } from 'react'
import { CheckIcon } from 'lucide-react'

interface Props {
  initialValue: string | null
}

export function BrandVoiceEditor({ initialValue }: Props) {
  const [value,     setValue]     = useState(initialValue ?? '')
  const [saved,     setSaved]     = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Track whether value has changed from what was last saved
  const [lastSaved, setLastSaved] = useState(initialValue ?? '')
  const isDirty = value !== lastSaved

  function handleSave() {
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/user/brand-voice', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ brand_voice: value.trim() || null }),
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error ?? 'Failed to save')
          return
        }

        setLastSaved(value)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch {
        setError('Failed to save. Try again.')
      }
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <textarea
          value={value}
          onChange={(e) => { setValue(e.target.value); setSaved(false) }}
          placeholder='e.g. "friendly and minimal" or "bold and premium"'
          rows={3}
          maxLength={300}
          className="
            w-full bg-surface-2 border border-border focus:border-accent focus:ring-1 focus:ring-accent/30
            rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-disabled
            text-sm outline-none transition-colors duration-150 resize-none
          "
        />
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-text-disabled">
            Applied to all your generated listings.
          </p>
          <span className="text-xs text-text-secondary font-mono">{value.length}/300</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!isDirty || isPending}
          className="
            bg-accent hover:bg-accent-hover text-white font-semibold
            rounded-lg px-4 py-2 text-sm
            transition-colors duration-150
            disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          {isPending ? 'Saving…' : 'Save brand voice'}
        </button>

        {saved && !isPending && (
          <span className="flex items-center gap-1 text-xs text-success font-medium">
            <CheckIcon className="w-3.5 h-3.5" />
            Saved
          </span>
        )}
      </div>

      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}
