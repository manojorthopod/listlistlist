'use client'

import { AlertCircleIcon } from 'lucide-react'
import { PLATFORM_META } from '@/components/platform-toggle-card'
import type { Platform } from '@/types'

interface PlatformErrorStateProps {
  platform:     Platform
  onRetry:      () => void
  isRetrying?:  boolean
}

export default function PlatformErrorState({
  platform,
  onRetry,
  isRetrying = false,
}: PlatformErrorStateProps) {
  const meta = PLATFORM_META[platform]

  return (
    <div className="rounded-xl border border-error bg-error-muted p-6 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <AlertCircleIcon className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
        <p className="text-sm text-error">
          Something went wrong generating your {meta.label} listing — your credit has been
          refunded. Try regenerating this platform.
        </p>
      </div>

      <button
        onClick={onRetry}
        disabled={isRetrying}
        className="
          self-start inline-flex items-center gap-2
          border border-error text-error
          hover:bg-error hover:text-white
          px-4 py-2 rounded-lg text-sm font-medium
          transition-colors duration-150
          disabled:opacity-40 disabled:cursor-not-allowed
        "
      >
        {isRetrying ? (
          <>
            <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            Retrying…
          </>
        ) : (
          'Retry — 1 credit'
        )}
      </button>
    </div>
  )
}
