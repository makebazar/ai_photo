-- Migration 019: Fix referral attribution for non-partner referrers
ALTER TABLE referral_clicks ADD COLUMN IF NOT EXISTS referrer_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS referral_clicks_referrer_idx ON referral_clicks (referrer_user_id);
