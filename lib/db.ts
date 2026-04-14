import { createClient } from '@supabase/supabase-js'
import type {
  User,
  Listing,
  TopupPurchase,
  Referral,
  EmailLog,
} from '@/types'

// ─── Supabase client (server-side, service role) ──────────────────────────────
// Use the service role key in API routes and server actions only.
// Never expose this client to the browser.

function getSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    )
  }

  // Supabase service role keys are JWTs — they always start with "eyJ".
  // If this warning appears, go to Supabase Dashboard → Settings → API
  // and copy the "service_role" key (not the anon key, not a personal token).
  if (!key.startsWith('eyJ')) {
    console.warn(
      '[db] SUPABASE_SERVICE_ROLE_KEY does not look like a JWT (expected it to start with "eyJ"). ' +
      'All database queries will fail with 401 until you copy the correct service_role key ' +
      'from Supabase Dashboard → Project Settings → API → service_role.'
    )
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

export const db = getSupabaseServiceClient()

// ─── Query timeout helper ──────────────────────────────────────────────────────
// Races a promise against a timeout. Returns null (not an exception) if the
// timeout fires first, so callers can handle the degraded state gracefully.
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T | null> {
  return Promise.race([
    promise.catch((err: unknown) => {
      console.error(
        `[db] ${label} failed:`,
        err instanceof Error ? err.message : err
      )
      return null
    }),
    new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn(`[db] ${label} timed out after ${ms}ms`)
        resolve(null)
      }, ms)
    ),
  ])
}

/** Server-side cap for paginated listing fetches (dashboard, etc.). */
export const GET_LISTINGS_BY_USER_TIMEOUT_MS = 15_000

// ─── Type-safe database helpers ───────────────────────────────────────────────

// Users

export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data as User
}

export async function upsertUser(
  userId: string,
  email: string
): Promise<User> {
  // Compute the referral code from the userId — deterministic, same algorithm
  // as buildReferralCode() in lib/referral.ts. Stored in the DB so we can
  // look up a referrer by their code in O(1) via the unique index.
  const referralCode = userId.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()

  const { data, error } = await db
    .from('users')
    .upsert(
      {
        id:               userId,
        email,
        referral_code:    referralCode,
        trial_started_at: new Date().toISOString(),
      },
      { onConflict: 'id', ignoreDuplicates: true }
    )
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to upsert user: ${error?.message}`)
  }
  return data as User
}

export async function updateUser(
  userId: string,
  updates: Partial<
    Pick<
      User,
      | 'stripe_customer_id'
      | 'subscription_status'
      | 'billing_interval'
      | 'subscription_credits'
      | 'topup_credits'
      | 'preferred_platforms'
      | 'brand_voice'
      | 'credits_reset_at'
      | 'onboarding_email_sent'
    >
  >
): Promise<void> {
  const { error } = await db.from('users').update(updates).eq('id', userId)
  if (error) throw new Error(`Failed to update user: ${error.message}`)
}

// Listings

export async function createListing(
  listing: Omit<Listing, 'id' | 'created_at'>
): Promise<Listing> {
  const { data, error } = await db
    .from('listings')
    .insert(listing)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to create listing: ${error?.message}`)
  }
  return data as Listing
}

export async function updateListing(
  listingId: string,
  updates: Partial<
    Pick<
      Listing,
      | 'extracted_data'
      | 'generated_listings'
      | 'status'
      | 'credits_used'
      | 'platforms'
    >
  >,
  // When ownerId is supplied the UPDATE is scoped to user_id = ownerId.
  // If the listingId doesn't belong to that user the update affects 0 rows
  // (silently, same as not found) — defense-in-depth against IDOR.
  ownerId?: string
): Promise<void> {
  let query = db.from('listings').update(updates).eq('id', listingId)
  if (ownerId) query = query.eq('user_id', ownerId)
  const { error } = await query
  if (error) throw new Error(`Failed to update listing: ${error.message}`)
}

export async function getListingsByUser(
  userId: string,
  page = 0,
  pageSize = 10
): Promise<Listing[]> {
  let settled = false
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      if (settled) return
      settled = true
      console.warn(
        `[db] getListingsByUser timed out after ${GET_LISTINGS_BY_USER_TIMEOUT_MS}ms`
      )
      resolve([])
    }, GET_LISTINGS_BY_USER_TIMEOUT_MS)

    void (async () => {
      try {
        const { data, error } = await db
          .from('listings')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(page * pageSize, page * pageSize + pageSize - 1)

        if (error) throw new Error(`Failed to fetch listings: ${error.message}`)
        if (settled) return
        settled = true
        clearTimeout(t)
        resolve((data ?? []) as Listing[])
      } catch (err) {
        if (settled) return
        settled = true
        clearTimeout(t)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })()
  })
}

export async function getListingById(listingId: string): Promise<Listing | null> {
  const { data, error } = await db
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single()

  if (error || !data) return null
  return data as Listing
}

export async function findListingByImageHash(
  userId: string,
  imageHash: string
): Promise<Listing | null> {
  const { data, error } = await db
    .from('listings')
    .select('*')
    .eq('user_id', userId)
    .eq('image_hash', imageHash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  return (data as Listing) ?? null
}

// Credits (via RPC for atomic operations)

export async function deductCredits(
  userId: string,
  amount: number
): Promise<{ subscription_credits: number; topup_credits: number }> {
  const { data, error } = await db.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount:  amount,
  })

  if (error) throw new Error(`Failed to deduct credits: ${error.message}`)
  return data as { subscription_credits: number; topup_credits: number }
}

export async function refundCredits(
  userId: string,
  amount: number
): Promise<{ subscription_credits: number; topup_credits: number }> {
  const { data, error } = await db.rpc('refund_credits', {
    p_user_id: userId,
    p_amount:  amount,
  })

  if (error) throw new Error(`Failed to refund credits: ${error.message}`)
  return data as { subscription_credits: number; topup_credits: number }
}

export async function applyMonthlyRollover(
  userId: string,
  monthlyAllowance: number,
  rolloverCap: number
): Promise<{ subscription_credits: number }> {
  const { data, error } = await db.rpc('apply_monthly_rollover', {
    p_user_id:          userId,
    p_monthly_allowance: monthlyAllowance,
    p_rollover_cap:      rolloverCap,
  })

  if (error) throw new Error(`Failed to apply rollover: ${error.message}`)
  return data as { subscription_credits: number }
}

// Topup purchases

export async function createTopupPurchase(
  purchase: Omit<TopupPurchase, 'id' | 'created_at'>
): Promise<TopupPurchase> {
  const { data, error } = await db
    .from('topup_purchases')
    .insert(purchase)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to create topup purchase: ${error?.message}`)
  }
  return data as TopupPurchase
}

export async function getTopupPurchasesByUser(userId: string): Promise<TopupPurchase[]> {
  const { data, error } = await db
    .from('topup_purchases')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch topup purchases: ${error.message}`)
  return (data ?? []) as TopupPurchase[]
}

// Referrals

export async function createReferral(
  referrerId: string,
  referredId: string
): Promise<Referral> {
  const { data, error } = await db
    .from('referrals')
    .insert({ referrer_user_id: referrerId, referred_user_id: referredId })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to create referral: ${error?.message}`)
  }
  return data as Referral
}

export async function markReferralAwarded(referralId: string): Promise<void> {
  const { error } = await db
    .from('referrals')
    .update({ credits_awarded: true })
    .eq('id', referralId)

  if (error) throw new Error(`Failed to mark referral awarded: ${error.message}`)
}

export async function getReferralsByReferrer(referrerId: string): Promise<Referral[]> {
  const { data, error } = await db
    .from('referrals')
    .select('*')
    .eq('referrer_user_id', referrerId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch referrals: ${error.message}`)
  return (data ?? []) as Referral[]
}

/**
 * Find a user by their stored referral_code (the short alphanumeric slug
 * that appears in referral links as ?ref=CODE).
 * Uses the unique index on users.referral_code for O(1) lookup.
 */
export async function getUserByReferralCode(code: string): Promise<User | null> {
  const { data } = await db
    .from('users')
    .select('*')
    .eq('referral_code', code.toLowerCase())
    .maybeSingle()
  return (data as User) ?? null
}

/**
 * Get the referral row where this user was the referred party.
 * Used when a user subscribes to check whether a referrer should be credited.
 */
export async function getReferralForReferredUser(referredId: string): Promise<Referral | null> {
  const { data } = await db
    .from('referrals')
    .select('*')
    .eq('referred_user_id', referredId)
    .maybeSingle()
  return (data as Referral) ?? null
}

/**
 * Atomically award 20 referral credits to the referrer, but only if the
 * referral row has not already been credited.
 *
 * The `.eq('credits_awarded', false)` condition acts as a compare-and-swap:
 * only one concurrent caller will succeed in updating the row from false→true.
 * The second caller gets back 0 rows and skips the credit grant — preventing
 * any double-award even under parallel Stripe webhook retries.
 *
 * Returns true when credits were awarded, false when already awarded.
 */
export async function awardReferralIfNotAwarded(
  referralId: string,
  referrerId: string,
): Promise<boolean> {
  // Step 1 — mark as awarded (atomic guard)
  const { data: updated } = await db
    .from('referrals')
    .update({ credits_awarded: true })
    .eq('id', referralId)
    .eq('credits_awarded', false)   // only fires if NOT already awarded
    .select('id')
    .maybeSingle()

  if (!updated) {
    // Row was already marked awarded (concurrent request beat us, or already done)
    return false
  }

  // Step 2 — add bonus credits to the referrer's topup balance
  const { data: referrer } = await db
    .from('users')
    .select('topup_credits')
    .eq('id', referrerId)
    .single()

  if (referrer) {
    await db
      .from('users')
      .update({ topup_credits: referrer.topup_credits + REFERRAL_BONUS_CREDITS })
      .eq('id', referrerId)
  }

  return true
}

// ─── Referral bonus constant ──────────────────────────────────────────────────
// Exported so API routes and the Stripe webhook share the same value.
export const REFERRAL_BONUS_CREDITS = 20

// Email log

export async function logEmail(userId: string, emailType: EmailLog['email_type']): Promise<void> {
  const { error } = await db
    .from('email_log')
    .insert({ user_id: userId, email_type: emailType })

  // Unique constraint violation (email_type, user_id) means already sent — ignore
  if (error && !error.message.includes('duplicate')) {
    throw new Error(`Failed to log email: ${error.message}`)
  }
}

export async function hasEmailBeenSent(
  userId: string,
  emailType: EmailLog['email_type']
): Promise<boolean> {
  const { data } = await db
    .from('email_log')
    .select('id')
    .eq('user_id', userId)
    .eq('email_type', emailType)
    .maybeSingle()

  return data !== null
}

// ─── Email sequence query helpers ────────────────────────────────────────────
// Used by /api/cron/email-sequence to find users due for each automated email.
// All helpers do two queries (email_log + users) and filter in application code
// to avoid complex SQL and to stay compatible with the Supabase JS client.

/** Returns the set of user IDs already sent a given email type. */
async function getSentUserIds(
  emailType: EmailLog['email_type']
): Promise<Set<string>> {
  const { data } = await db
    .from('email_log')
    .select('user_id')
    .eq('email_type', emailType)
  return new Set(((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id))
}

/**
 * Returns the set of user IDs who have at least one completed listing.
 * Used by the Day 2 tip query to skip users who have already generated a listing.
 */
async function getUserIdsWithCompletedListing(): Promise<Set<string>> {
  const { data } = await db
    .from('listings')
    .select('user_id')
    .eq('status', 'completed')
  return new Set(((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id))
}

/**
 * Day 2 — Feature tip
 * Eligibility: still in trial, signed up 48+ hours ago, no completed listing yet,
 * email not already sent.
 */
export async function getUsersNeedingDay2Email(): Promise<User[]> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const [sentIds, listingUserIds] = await Promise.all([
    getSentUserIds('day2_tip'),
    getUserIdsWithCompletedListing(),
  ])

  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('subscription_status', 'trial')
    .lte('created_at', cutoff)

  if (error) throw new Error(`getUsersNeedingDay2Email: ${error.message}`)

  return ((data ?? []) as User[]).filter(
    (u) => !sentIds.has(u.id) && !listingUserIds.has(u.id)
  )
}

/**
 * Day 5 — Trial nudge
 * Eligibility: still in trial (not subscribed), signed up 5+ days ago,
 * email not already sent.
 */
export async function getUsersNeedingDay5Email(): Promise<User[]> {
  const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  const sentIds = await getSentUserIds('day5_trial_nudge')

  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('subscription_status', 'trial')
    .lte('created_at', cutoff)

  if (error) throw new Error(`getUsersNeedingDay5Email: ${error.message}`)

  return ((data ?? []) as User[]).filter((u) => !sentIds.has(u.id))
}

/**
 * Day 7 — Trial expiry
 * Eligibility: still in trial (not subscribed), signed up 7+ days ago,
 * email not already sent.
 */
export async function getUsersNeedingDay7Email(): Promise<User[]> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const sentIds = await getSentUserIds('day7_trial_expiry')

  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('subscription_status', 'trial')
    .lte('created_at', cutoff)

  if (error) throw new Error(`getUsersNeedingDay7Email: ${error.message}`)

  return ((data ?? []) as User[]).filter((u) => !sentIds.has(u.id))
}

/**
 * Low credits alert
 * Eligibility: active paying subscriber, total credits (subscription + top-up) ≤ 5,
 * email not already sent.
 *
 * Per spec: max one low-credits alert per user lifetime (enforced by UNIQUE
 * constraint on email_log). If they top up and run low again, no second alert.
 */
export async function getUsersNeedingLowCreditsEmail(): Promise<User[]> {
  const sentIds = await getSentUserIds('credits_low')

  const { data, error } = await db
    .from('users')
    .select('*')
    .in('subscription_status', ['starter', 'pro'])

  if (error) throw new Error(`getUsersNeedingLowCreditsEmail: ${error.message}`)

  return ((data ?? []) as User[]).filter(
    (u) =>
      !sentIds.has(u.id) &&
      u.subscription_credits + u.topup_credits <= 5
  )
}

// ─── Demo runs ────────────────────────────────────────────────────────────────

export async function getDemoRunCounts(
  ipHash: string
): Promise<{ ip_count: number; total_count: number }> {
  const { data, error } = await db.rpc('get_demo_run_counts', {
    p_ip_hash: ipHash,
  })

  if (error) throw new Error(`Failed to get demo run counts: ${error.message}`)
  return data as { ip_count: number; total_count: number }
}

export async function logDemoRun(ipHash: string): Promise<void> {
  const { error } = await db.from('demo_runs').insert({ ip_hash: ipHash })
  if (error) throw new Error(`Failed to log demo run: ${error.message}`)
}
