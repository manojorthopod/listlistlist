import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { REFERRAL_CODE_REGEX } from '@/lib/referral'

const isPublicRoute = createRouteMatcher([
  '/',
  '/pricing',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/clerk',
  '/api/webhooks/stripe',
  '/api/demo',
])

// Cookie lifetime for referral attribution — 7 days (seconds)
const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

export default clerkMiddleware(async (auth, req) => {
  // ── Referral code capture ──────────────────────────────────────────────────
  // When any page is visited with ?ref=CODE, persist the code in a cookie so
  // it survives through the Clerk sign-up flow. The cookie is read server-side
  // by the dashboard page and acted on by the ReferralRecorder client component.
  //
  // We only set the cookie — we never redirect — so we don't interfere with
  // Clerk's own redirects or cause redirect loops on the sign-up pages.
  const refCode = req.nextUrl.searchParams.get('ref')

  let response: NextResponse | undefined

  if (refCode && REFERRAL_CODE_REGEX.test(refCode)) {
    response = NextResponse.next()
    // Not httpOnly: the dashboard ReferralRecorder client component reads it
    // to clear it after recording, avoiding a server round-trip.
    response.cookies.set('referral_code', refCode.toLowerCase(), {
      maxAge:   REFERRAL_COOKIE_MAX_AGE,
      path:     '/',
      sameSite: 'lax',
      httpOnly: false,
    })
  }

  // ── Clerk route protection ─────────────────────────────────────────────────
  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  return response ?? NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
