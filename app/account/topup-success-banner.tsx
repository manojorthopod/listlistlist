'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircleIcon, XIcon } from 'lucide-react'

export function TopupSuccessBanner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (searchParams.get('topup') === 'success') {
      setShow(true)
      // Remove the query param from the URL so a page refresh doesn't re-show it
      const url = new URL(window.location.href)
      url.searchParams.delete('topup')
      router.replace(url.pathname + (url.search || ''), { scroll: false })
    }
  }, [searchParams, router])

  if (!show) return null

  return (
    <div className="flex items-start gap-3 rounded-xl border border-success bg-success-muted px-5 py-4">
      <CheckCircleIcon className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-success">Credits added to your account</p>
        <p className="text-xs text-success/80 mt-0.5">
          Your top-up credits are ready to use. They never expire and are consumed after your monthly credits.
        </p>
      </div>
      <button
        onClick={() => setShow(false)}
        aria-label="Dismiss"
        className="flex-shrink-0 text-success/60 hover:text-success transition-colors duration-150"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  )
}
