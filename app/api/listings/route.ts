import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { getListingsByUser } from '@/lib/db'

const QuerySchema = z.object({
  page:     z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
})

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const url    = new URL(req.url)
  const parsed = QuerySchema.safeParse({
    page:     url.searchParams.get('page'),
    pageSize: url.searchParams.get('pageSize'),
  })

  if (!parsed.success) {
    return Response.json({ error: 'Invalid query params' }, { status: 400 })
  }

  const { page, pageSize } = parsed.data

  try {
    const listings = await getListingsByUser(userId, page, pageSize)
    return Response.json({ listings, page, pageSize })
  } catch (err) {
    console.error('[api/listings] Fetch error:', err)
    return Response.json({ error: 'Failed to fetch listings' }, { status: 500 })
  }
}
