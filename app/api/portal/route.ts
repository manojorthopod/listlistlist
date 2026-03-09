import { auth } from '@clerk/nextjs/server'
import { getUserById } from '@/lib/db'
import { createPortalSession } from '@/lib/stripe'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://listlistlist.co'

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const user = await getUserById(userId)
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 })
  }

  if (!user.stripe_customer_id) {
    return Response.json(
      { error: 'No billing account found. Subscribe to a plan first.' },
      { status: 400 }
    )
  }

  try {
    const url = await createPortalSession({
      stripeCustomerId: user.stripe_customer_id,
      appUrl:           APP_URL,
    })
    return Response.json({ url })
  } catch (err) {
    console.error('[api/portal] Stripe error:', err)
    return Response.json({ error: 'Failed to create portal session' }, { status: 500 })
  }
}
