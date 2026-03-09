import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { updateUser } from '@/lib/db'

const BodySchema = z.object({
  brand_voice: z.string().max(300),
})

/**
 * PATCH /api/user/brand-voice
 * Persists the user's brand voice string to their profile row.
 * Called inline from the ExtractionConfirmForm "Save" button.
 */
export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    await updateUser(userId, { brand_voice: parsed.data.brand_voice.trim() || null })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[api/user/brand-voice] DB error:', err)
    return Response.json({ error: 'Failed to save brand voice' }, { status: 500 })
  }
}
