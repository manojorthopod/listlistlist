import { auth } from '@clerk/nextjs/server'
import { getUserById } from '@/lib/db'
import { PLAN_ROLLOVER_CAP } from '@/types'
import type { CreditBalance } from '@/types'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const user = await getUserById(userId)
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

  const response: CreditBalance = {
    subscriptionCredits: user.subscription_credits,
    topupCredits:        user.topup_credits,
    totalCredits:        user.subscription_credits + user.topup_credits,
    plan:                user.subscription_status,
    billingInterval:     user.billing_interval,
    creditsResetAt:      user.credits_reset_at,
    rolloverCap:         PLAN_ROLLOVER_CAP[user.subscription_status],
  }

  return Response.json(response)
}
