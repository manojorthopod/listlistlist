import { auth } from '@clerk/nextjs/server'
import { getReferralsByReferrer } from '@/lib/db'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  // Referral code: deterministic slug derived from the Clerk user ID
  // Strips non-alphanumeric chars and takes the first 12 characters.
  const referralCode = userId.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()
  const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://listlistlist.co'
  const referralLink = `${appUrl}/?ref=${referralCode}`

  try {
    const referrals = await getReferralsByReferrer(userId)
    const credited  = referrals.filter((r) => r.credits_awarded).length
    const pending   = referrals.filter((r) => !r.credits_awarded).length
    const creditsEarned = credited * 10

    return Response.json({
      referralCode,
      referralLink,
      totalReferrals: referrals.length,
      creditedReferrals: credited,
      pendingReferrals: pending,
      creditsEarned,
    })
  } catch (err) {
    console.error('[api/referral] Error:', err)
    return Response.json({ error: 'Failed to load referral data' }, { status: 500 })
  }
}
