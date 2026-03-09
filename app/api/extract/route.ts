import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { getMiniClient, MODEL_MINI, buildImageMessages, parseJsonResponse } from '@/lib/openai'
import { getUserById } from '@/lib/db'
import type { ExtractedProduct } from '@/types'

// ─── Rate limiting ────────────────────────────────────────────────────────────

const rateLimitStore = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT_MAX    = 20
const RATE_LIMIT_WINDOW = 60_000 // 1 minute

function checkRateLimit(userId: string): boolean {
  const now   = Date.now()
  const entry = rateLimitStore.get(userId)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(userId, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a product data extraction assistant. Analyse product images \
and return structured JSON only. Never guess or fabricate. If a field cannot be determined \
from the image, return null for that field.`

const USER_PROMPT = `Analyse this product image and extract the following fields. \
Return ONLY valid JSON with no commentary.
{
  "product_type": "string — what the product is (e.g. ceramic mug, leather wallet)",
  "material": "string or null",
  "color": "string or null",
  "dimensions": "string or null — ONLY if clearly visible or printed on the product. Do NOT estimate from photos.",
  "style": "string or null — e.g. modern, vintage, minimalist, rustic",
  "key_features": ["array of 3-5 strings — only clearly observable features"],
  "condition": "string — New / Used / Handmade / Vintage",
  "suggested_category": "string or null"
}

CRITICAL: Never estimate dimensions from photos. Return null for dimensions unless they are \
printed on the product or packaging in the image.`

// ─── Zod schema for model output ──────────────────────────────────────────────

const ExtractionSchema = z.object({
  product_type:       z.string().min(1),
  material:           z.string().nullable(),
  color:              z.string().nullable(),
  dimensions:         z.string().nullable(),
  style:              z.string().nullable(),
  key_features:       z.array(z.string()).min(1).max(10),
  condition:          z.enum(['New', 'Used', 'Handmade', 'Vintage']).default('New'),
  suggested_category: z.string().nullable(),
})

// ─── Route handler ────────────────────────────────────────────────────────────

const BodySchema = z.object({
  imageUrl: z.string().url(),
})

export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // ── Rate limit ──────────────────────────────────────────────────────────────
  if (!checkRateLimit(userId)) {
    return Response.json(
      { error: 'Too many requests. Wait a moment and try again.' },
      { status: 429 }
    )
  }

  // ── Input validation ────────────────────────────────────────────────────────
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

  // ── Load user's saved brand voice to pre-populate the form ─────────────────
  const user = await getUserById(userId)

  // ── GPT-4o-mini vision call ─────────────────────────────────────────────────
  let extracted: ExtractedProduct | null = null

  try {
    const completion = await getMiniClient().chat.completions.create({
      model:       MODEL_MINI,
      max_tokens:  500,
      temperature: 0,
      messages:    buildImageMessages(SYSTEM_PROMPT, USER_PROMPT, parsed.data.imageUrl),
    })

    const content = completion.choices[0]?.message?.content ?? null
    const raw     = parseJsonResponse<unknown>(content)

    if (raw) {
      const validated = ExtractionSchema.safeParse(raw)
      if (validated.success) {
        // Merge with user's persisted brand voice and empty user-added fields
        extracted = {
          ...validated.data,
          target_audience: null,
          brand_voice:     user?.brand_voice ?? null,
        }
      } else {
        console.error('[api/extract] Schema validation failed:', validated.error.flatten())
      }
    } else {
      console.error('[api/extract] Could not parse JSON from model response:', content)
    }
  } catch (err) {
    console.error('[api/extract] OpenAI error:', err)
    return Response.json(
      { error: 'Image analysis failed. Please try again.' },
      { status: 502 }
    )
  }

  if (!extracted) {
    return Response.json(
      { error: 'Could not extract product details from this image. Try a clearer photo.' },
      { status: 422 }
    )
  }

  return Response.json({ extracted_data: extracted })
}
