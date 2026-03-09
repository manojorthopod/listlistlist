import OpenAI from 'openai'

/**
 * Two separate OpenAI client instances per the project spec:
 *
 *  miniClient — gpt-4o-mini  Used for: image validation (Step 0), extraction (Step 1),
 *                             and the demo route. Cheaper; sufficient for JSON tasks.
 *
 *  proClient  — gpt-4o       Used for: listing generation (Step 4) only.
 *                             Quality matters here — better structured output and copy.
 *
 * Both are lazily instantiated singletons so they're not re-created on every request
 * in the Edge runtime.
 */

function createClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('Missing OPENAI_API_KEY environment variable')
  return new OpenAI({ apiKey: key })
}

// Single underlying client — models are selected per-call
let _client: OpenAI | null = null
function getClient(): OpenAI {
  if (!_client) _client = createClient()
  return _client
}

export const MODEL_MINI = 'gpt-4o-mini' as const
export const MODEL_PRO  = 'gpt-4o'      as const

/** Use for validation and extraction (cheaper) */
export function getMiniClient(): OpenAI {
  return getClient()
}

/** Use for listing generation (higher quality) */
export function getProClient(): OpenAI {
  return getClient()
}

// ─── Shared image message builder ─────────────────────────────────────────────

/**
 * Builds the messages array for a vision call — handles both
 * public HTTPS URLs (production) and base64-encoded data URIs (testing).
 */
export function buildImageMessages(
  systemPrompt: string,
  userPrompt:   string,
  imageUrl:     string
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url:    imageUrl,
            detail: 'high',
          },
        },
        { type: 'text', text: userPrompt },
      ],
    },
  ]
}

// ─── JSON parse helper ────────────────────────────────────────────────────────

/**
 * Safely parses the model's response as JSON.
 * Strips markdown code fences (```json … ```) that models occasionally add.
 * Returns null on any parse failure — callers must handle null.
 */
export function parseJsonResponse<T>(content: string | null): T | null {
  if (!content) return null
  try {
    // Strip optional markdown fences
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}
