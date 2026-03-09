import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { updateUser } from '@/lib/db'
import type { Platform } from '@/types'

const BodySchema = z.object({
  platforms: z.array(
    z.enum(['amazon', 'etsy', 'ebay', 'shopify', 'woocommerce', 'tiktok'])
  ).min(1).max(6),
})

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid platforms' }, { status: 400 })
  }

  try {
    await updateUser(userId, { preferred_platforms: parsed.data.platforms as Platform[] })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[user/preferred-platforms] Update error:', err)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }
}
