-- Migration 012: Simplify partner_stats view for 2-level MLM

DROP VIEW IF EXISTS partner_stats;

CREATE OR REPLACE VIEW partner_stats AS
SELECT 
  p.id AS partner_id,
  p.public_id,
  p.user_id,
  p.parent_partner_id,
  p.status,
  
  -- Total clicks on all partner links
  (SELECT COUNT(*) FROM referral_clicks WHERE partner_id = p.id) AS total_clicks,
  
  -- Direct clients count (Registrations)
  (SELECT COUNT(*) FROM client_attribution ca WHERE ca.partner_id = p.id) AS direct_clients,
  
  -- Team partners count (L1)
  (SELECT COUNT(*) FROM partners p2 WHERE p2.parent_partner_id = p.id) AS direct_partners,
  
  -- Total orders from direct clients
  (SELECT COUNT(*) 
   FROM orders o 
   INNER JOIN client_attribution ca ON o.user_id = ca.user_id 
   WHERE ca.partner_id = p.id AND o.status = 'paid') AS direct_paid_orders,

  -- Total paid clients in team (direct clients of L1 partners)
  (SELECT COUNT(DISTINCT o.user_id)
   FROM orders o
   JOIN client_attribution ca ON o.user_id = ca.user_id
   JOIN partners p2 ON ca.partner_id = p2.id
   WHERE p2.parent_partner_id = p.id
   AND o.status = 'paid') AS total_team_paid_clients,
  
  -- Total revenue from direct clients
  (SELECT COALESCE(SUM(o.amount_rub), 0) 
   FROM orders o 
   INNER JOIN client_attribution ca ON o.user_id = ca.user_id 
   WHERE ca.partner_id = p.id AND o.status = 'paid') AS direct_revenue_rub,
  
  -- Total earnings (all levels)
  (SELECT COALESCE(SUM(c.amount_rub), 0) 
   FROM commissions c 
   WHERE c.partner_id = p.id AND c.status IN ('available', 'locked')) AS total_earnings_rub,

  -- Earnings specifically from team (L1 partners' clients)
  (SELECT COALESCE(SUM(c.amount_rub), 0) 
   FROM commissions c 
   WHERE c.partner_id = p.id AND c.status IN ('available', 'locked') AND c.level > 0) AS team_earnings_rub,
  
  -- Pending earnings
  (SELECT COALESCE(SUM(c.amount_rub), 0) 
   FROM commissions c 
   WHERE c.partner_id = p.id AND c.status = 'locked') AS pending_earnings_rub,
  
  -- Balances
  COALESCE(pb.available_rub, 0) AS available_balance_rub,
  COALESCE(pb.locked_rub, 0) AS locked_balance_rub,
  
  -- Last activity
  (SELECT MAX(o.created_at) 
   FROM orders o 
   INNER JOIN client_attribution ca ON o.user_id = ca.user_id 
   WHERE ca.partner_id = p.id) AS last_client_order_at,
  
  p.created_at AS partner_since
  
FROM partners p
LEFT JOIN partner_balances pb ON pb.partner_id = p.id;
