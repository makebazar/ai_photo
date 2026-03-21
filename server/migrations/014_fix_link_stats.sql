-- Migration 014: Fix referral link stats to show only partner's own earnings

-- Recalculate total_earnings_rub for all referral links based on level 0 commissions
UPDATE referral_links rl
SET total_earnings_rub = (
  SELECT COALESCE(SUM(c.amount_rub), 0)
  FROM commissions c
  JOIN referral_clicks rc ON rc.converted_order_id = c.order_id
  WHERE rc.link_id = rl.id 
    AND c.partner_id = rl.partner_id
    AND c.level = 0
    AND c.status <> 'reversed'
);
