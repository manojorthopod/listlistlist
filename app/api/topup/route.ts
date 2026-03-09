import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { createTopupCheckout } from '@/lib/stripe'
import { getUserById } from '@/lib/db'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://listlistlist.co'

const BodySchema = z.object({
  packId: z.enum(['starter_pack', 'growth_pack', 'scale_pack']),
})

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const user = await getUserById(userId)
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    const url = await createTopupCheckout({
      userId,
      userEmail:        user.email,
      stripeCustomerId: user.stripe_customer_id,
      packId:           parsed.data.packId,
      appUrl:           APP_URL,
    })
    return Response.json({ url })
  } catch (err) {
    console.error('[api/topup] Stripe error:', err)
    return Response.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
