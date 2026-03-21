-- Migration 010: Advanced MLM features (Hold period, ranks, reversal)

-- 1. Update commissions table with unlock_at and better status
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS unlock_at timestamptz;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS reversed_at timestamptz;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS reversal_reason text;

-- 2. Update partners table with rank and total sales
ALTER TABLE partners ADD COLUMN IF NOT EXISTS rank text NOT NULL DEFAULT 'bronze';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS total_sales_rub bigint NOT NULL DEFAULT 0;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS total_referrals_count int NOT NULL DEFAULT 0;

-- 3. Add index for faster commission unlocking
CREATE INDEX IF NOT EXISTS commissions_status_unlock_idx ON commissions (status, unlock_at) WHERE status = 'locked';

-- 4. Function to recalculate partner stats (can be called periodically or on events)
CREATE OR REPLACE FUNCTION update_partner_stats(p_partner_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE partners
  SET 
    total_sales_rub = (
      SELECT COALESCE(SUM(o.amount_rub), 0)
      FROM orders o
      JOIN client_attribution ca ON o.user_id = ca.user_id
      WHERE ca.partner_id = p_partner_id AND o.status = 'paid'
    ),
    total_referrals_count = (
      SELECT COUNT(*)
      FROM client_attribution
      WHERE partner_id = p_partner_id
    ),
    total_earnings_rub = (
      SELECT COALESCE(SUM(amount_rub), 0)
      FROM commissions
      WHERE partner_id = p_partner_id AND status = 'available'
    )
  WHERE id = p_partner_id;
  
  -- Simple rank progression logic (example)
  UPDATE partners
  SET rank = CASE 
    WHEN total_sales_rub >= 100000 THEN 'gold'
    WHEN total_sales_rub >= 25000 THEN 'silver'
    ELSE 'bronze'
  END
  WHERE id = p_partner_id;
END;
$$ LANGUAGE plpgsql;
