import { auth } from '@clerk/nextjs/server'
import { getListingById, updateListing } from '@/lib/db'
import { z } from 'zod'
import type { GeneratedListings } from '@/types'

// ─── GET /api/listings/[id] ───────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params
  const listing = await getListingById(id)

  if (!listing)              return Response.json({ error: 'Not found' },    { status: 404 })
  if (listing.user_id !== userId) return Response.json({ error: 'Forbidden' }, { status: 403 })

  return Response.json({ listing })
}

// ─── PATCH /api/listings/[id] — update generated_listings for one platform ───
// Used by "Regenerate this platform" on the detail page after a successful retry.

const PatchSchema = z.object({
  platform:        z.enum(['amazon', 'etsy', 'ebay', 'shopify', 'woocommerce', 'tiktok']),
  generatedData:   z.record(z.string(), z.unknown()),   // the new platform listing object
  creditsUsedDelta: z.number().int().min(0).max(1),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params
  const listing = await getListingById(id)

  if (!listing)              return Response.json({ error: 'Not found' },    { status: 404 })
  if (listing.user_id !== userId) return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 })
  }

  const { platform, generatedData } = parsed.data

  // Merge the new platform data into the existing generated_listings object
  const merged: GeneratedListings = {
    ...(listing.generated_listings ?? {}),
    [platform]: generatedData,
  }

  try {
    await updateListing(id, {
      generated_listings: merged,
      status:             'completed',
    })
    return Response.json({ ok: true, generated_listings: merged })
  } catch (err) {
    console.error('[api/listings/[id]] PATCH error:', err)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }
}
