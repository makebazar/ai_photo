-- Migration 013: Missed profit tracking and simplified Pass-up logic

-- 1. Track missed profit for users who are not partners but bring clients
CREATE TABLE IF NOT EXISTS missed_profits (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount_rub int NOT NULL,
  potential_commission_rub int NOT NULL,
  beneficiary_partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS missed_profits_user_idx ON missed_profits (user_id);
CREATE INDEX IF NOT EXISTS missed_profits_beneficiary_idx ON missed_profits (beneficiary_partner_id);

-- 2. Update client_attribution to support recursive lookup
-- No schema change needed, but we'll use this table for Pass-up logic.

-- 3. Update partner_stats view to include missed profit (optional, for admin)
-- We'll do this in a separate migration if needed.
