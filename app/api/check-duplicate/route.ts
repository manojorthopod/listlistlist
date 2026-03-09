import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { findListingByImageHash } from '@/lib/db'

const BodySchema = z.object({
  imageHash: z.string().length(64), // SHA-256 produces a 64-char hex string
})

/**
 * POST /api/check-duplicate
 *
 * Receives a SHA-256 hash computed client-side before upload.
 * Returns whether the authenticated user has a previous listing
 * for this image, and if so, the listing ID so the UI can link to it.
 *
 * Called before the "Analyse Image" button is pressed — zero credits
 * are ever involved in this check.
 */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const existing = await findListingByImageHash(userId, parsed.data.imageHash)

  if (!existing) {
    return Response.json({ isDuplicate: false })
  }

  return Response.json({
    isDuplicate:       true,
    existingListingId: existing.id,
    existingCreatedAt: existing.created_at,
    existingPlatforms: existing.platforms,
    existingStatus:    existing.status,
  })
}
