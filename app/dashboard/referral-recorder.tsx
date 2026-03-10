'use client'

/**
 * ReferralRecorder — zero-UI component that fires once after sign-up.
 *
 * Lifecycle:
 *   1. Server component (dashboard page) reads the `referral_code` cookie
 *      and passes it here as a prop.
 *   2. On mount, calls POST /api/referral/record with the code.
 *   3. Clears the cookie regardless of outcome so the call is never repeated.
 *
 * The cookie was set by middleware when the user arrived via a ?ref= link.
 * It survives through Clerk's sign-up flow because it is set on the domain,
 * not tied to a particular page session.
 *
 * This component renders nothing visible. It is mounted inside the dashboard
 * layout so it fires on first page load after sign-up.
 */

import { useEffect } from 'react'

interface Props {
  referralCode: string
}

export default function ReferralRecorder({ referralCode }: Props) {
  useEffect(() => {
    if (!referralCode) return

    // Fire and forget — we don't block the UI on the result
    fetch('/api/referral/record', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ referralCode }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.recorded) {
          console.log('[ReferralRecorder] Referral recorded successfully')
        }
      })
      .catch(() => {
        // Silent — the referral is best-effort; we don't want to surface
        // errors to the user for something they didn't explicitly trigger
      })
      .finally(() => {
        // Clear the cookie so this component never fires again for this user
        document.cookie = 'referral_code=; Max-Age=0; Path=/'
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run exactly once on mount

  return null
}
