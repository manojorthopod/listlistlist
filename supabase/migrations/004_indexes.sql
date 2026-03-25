-- Speed up dashboard and API listing queries (filter by user, sort by created_at, paginate).
-- idx_listings_user_id / idx_listings_created_at may already exist from 001; IF NOT EXISTS is safe.
-- Composite index supports: WHERE user_id = ? ORDER BY created_at DESC LIMIT/OFFSET.

CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_user_created ON listings(user_id, created_at DESC);
