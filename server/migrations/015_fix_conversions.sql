-- Migration 015: Fix existing referral conversions and link stats

-- 1. Mark referral clicks as converted for all paid orders that were attributed to a partner
UPDATE referral_clicks rc
SET 
  converted_at = o.paid_at,
  converted_order_id = o.id
FROM orders o
WHERE o.user_id = rc.user_id 
  AND o.status = 'paid'
  AND rc.kind = 'client'
  AND rc.converted_at IS NULL;

-- 2. Recalculate conversion counts for all referral links
UPDATE referral_links rl
SET conversions = (
  SELECT COUNT(*)
  FROM referral_clicks rc
  WHERE rc.link_id = rl.id 
    AND rc.converted_at IS NOT NULL
);

-- 3. Ensure total_earnings_rub is also updated (just in case)
UPDATE referral_links rl
SET total_earnings_rub = (
  SELECT COALESCE(SUM(c.amount_rub), 0)
  FROM commissions c
  JOIN orders o ON o.id = c.order_id
  JOIN referral_clicks rc ON rc.converted_order_id = o.id
  WHERE rc.link_id = rl.id 
    AND c.partner_id = rl.partner_id
    AND c.level = 0
    AND c.status <> 'reversed'
);
