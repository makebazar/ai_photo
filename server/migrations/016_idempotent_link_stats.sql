-- Migration 016: Make link revenue update idempotent and fix double counting

-- 1. Make update_link_revenue idempotent
CREATE OR REPLACE FUNCTION update_link_revenue(p_link_id uuid, p_order_id uuid, p_amount_rub int, p_earnings_rub int)
RETURNS void AS $$
BEGIN
  -- Re-calculate link stats entirely from source tables to ensure correctness.
  UPDATE referral_links rl
  SET 
    total_revenue_rub = (
      SELECT COALESCE(SUM(o.amount_rub), 0)
      FROM orders o
      JOIN (
        -- For each order, find the LATEST click before it
        SELECT DISTINCT ON (converted_order_id) link_id, converted_order_id
        FROM referral_clicks
        WHERE link_id = rl.id AND converted_order_id IS NOT NULL
        ORDER BY converted_order_id, clicked_at DESC
      ) rc ON rc.converted_order_id = o.id
      WHERE o.status = 'paid'
    ),
    total_earnings_rub = (
      SELECT COALESCE(SUM(c.amount_rub), 0)
      FROM commissions c
      JOIN (
        -- For each order, find the LATEST click before it
        SELECT DISTINCT ON (converted_order_id) link_id, converted_order_id
        FROM referral_clicks
        WHERE link_id = rl.id AND converted_order_id IS NOT NULL
        ORDER BY converted_order_id, clicked_at DESC
      ) rc ON rc.converted_order_id = c.order_id
      WHERE c.partner_id = rl.partner_id AND c.level = 0 AND c.status <> 'reversed'
    ),
    conversions = (
      SELECT COUNT(DISTINCT converted_order_id)
      FROM referral_clicks
      WHERE link_id = rl.id AND converted_order_id IS NOT NULL
    ),
    updated_at = now()
  WHERE id = p_link_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Cleanup referral_clicks: only keep ONE click per order
WITH latest_clicks AS (
  SELECT DISTINCT ON (converted_order_id) id
  FROM referral_clicks
  WHERE converted_order_id IS NOT NULL
  ORDER BY converted_order_id, clicked_at DESC
)
UPDATE referral_clicks
SET 
  converted_at = NULL,
  converted_order_id = NULL
WHERE converted_order_id IS NOT NULL
  AND id NOT IN (SELECT id FROM latest_clicks);

-- 3. Trigger recalculation for all links
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM referral_links LOOP
        PERFORM update_link_revenue(r.id, NULL, 0, 0);
    END LOOP;
END$$;
