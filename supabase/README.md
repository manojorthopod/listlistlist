# Supabase Setup

## Running migrations

### Option A — Supabase CLI (recommended for local dev)

```bash
# Install CLI
brew install supabase/tap/supabase

# Start local Supabase stack
supabase start

# Apply migrations
supabase db push
```

### Option B — SQL Editor (Supabase dashboard)

1. Open your project in [app.supabase.com](https://app.supabase.com)
2. Navigate to **SQL Editor**
3. Run `migrations/001_initial_schema.sql` first
4. Run `migrations/002_rpc_functions.sql` second

## Environment variables

Copy `.env.local.example` → `.env.local` and fill in:

- `SUPABASE_URL` — found in **Project Settings → API → Project URL**
- `SUPABASE_SERVICE_ROLE_KEY` — found in **Project Settings → API → service_role** (secret, never expose client-side)

## Notes

- All mutations happen via the **service role key** from Next.js API routes — RLS policies only affect direct client access.
- The three RPC functions (`deduct_credits`, `refund_credits`, `apply_monthly_rollover`) use `FOR UPDATE` row locking to prevent race conditions on concurrent credit operations.
- `email_log` has a unique constraint on `(user_id, email_type)` — duplicate sends are silently ignored.
- `demo_runs` stores hashed IPs only — raw IPs are never persisted.
