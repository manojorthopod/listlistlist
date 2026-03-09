import { createClient } from '@supabase/supabase-js'
import type {
  User,
  Listing,
  TopupPurchase,
  Referral,
  EmailLog,
  Platform,
  SubscriptionStatus,
  BillingInterval,
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

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

export const db = getSupabaseServiceClient()

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
  const { data, error } = await db
    .from('users')
    .upsert(
      { id: userId, email, trial_started_at: new Date().toISOString() },
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
  >
): Promise<void> {
  const { error } = await db
    .from('listings')
    .update(updates)
    .eq('id', listingId)

  if (error) throw new Error(`Failed to update listing: ${error.message}`)
}

export async function getListingsByUser(
  userId: string,
  page = 0,
  pageSize = 10
): Promise<Listing[]> {
  const { data, error } = await db
    .from('listings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (error) throw new Error(`Failed to fetch listings: ${error.message}`)
  return (data ?? []) as Listing[]
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

// Demo runs

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
