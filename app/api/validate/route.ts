import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { getMiniClient, MODEL_MINI, buildImageMessages, parseJsonResponse } from '@/lib/openai'

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Simple in-memory store: userId → { count, windowStart }
// Good enough for a single-instance deployment; swap for Redis/Upstash in multi-region.

const rateLimitStore = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT_MAX    = 20   // requests
const RATE_LIMIT_WINDOW = 60_000 // 1 minute in ms

function checkRateLimit(userId: string): boolean {
  const now    = Date.now()
  const entry  = rateLimitStore.get(userId)

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(userId, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an image validation assistant for an e-commerce listing tool. \
Determine whether the uploaded image is suitable for generating a product listing.`

const USER_PROMPT = `Does this image contain a single, clearly identifiable physical product \
suitable for an e-commerce listing? Return ONLY valid JSON with no commentary:
{
  "is_valid_product": boolean,
  "reason": "string — one sentence. If invalid, explain clearly."
}`

// ─── Response shape ───────────────────────────────────────────────────────────

interface ValidationResult {
  is_valid_product: boolean
  reason:           string
}

const ResponseSchema = z.object({
  is_valid_product: z.boolean(),
  reason:           z.string().min(1),
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

  const { imageUrl } = parsed.data

  // ── GPT-4o-mini vision call ─────────────────────────────────────────────────
  let result: ValidationResult | null = null

  try {
    const completion = await getMiniClient().chat.completions.create({
      model:       MODEL_MINI,
      max_tokens:  150,
      temperature: 0,     // deterministic — we need a reliable yes/no
      messages:    buildImageMessages(SYSTEM_PROMPT, USER_PROMPT, imageUrl),
    })

    const content = completion.choices[0]?.message?.content ?? null
    const raw     = parseJsonResponse<ValidationResult>(content)

    if (raw) {
      const validated = ResponseSchema.safeParse(raw)
      if (validated.success) result = validated.data
    }
  } catch (err) {
    console.error('[api/validate] OpenAI error:', err)
    return Response.json(
      { error: 'Image analysis failed. Please try again.' },
      { status: 502 }
    )
  }

  // ── Malformed model response ─────────────────────────────────────────────────
  if (!result) {
    console.error('[api/validate] Could not parse model response')
    return Response.json(
      { error: 'Image analysis returned an unexpected response. Please try again.' },
      { status: 502 }
    )
  }

  // ── Return result ────────────────────────────────────────────────────────────
  // Never deduct credits here — this route is purely a gate check.
  return Response.json({
    is_valid_product: result.is_valid_product,
    reason:           result.reason,
  })
}
