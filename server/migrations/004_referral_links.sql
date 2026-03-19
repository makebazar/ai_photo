-- Enhanced referral system with custom links and tracking
-- Migration 004: Referral links with UTM tracking, statistics, and MLM hierarchy

-- ============================================
-- 1. Enhanced Partners Table
-- ============================================

-- Add additional fields to partners table for better tracking
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS referral_links_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS custom_client_link text,
ADD COLUMN IF NOT EXISTS custom_team_link text,
ADD COLUMN IF NOT EXISTS total_clients int NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_partners int NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earnings_rub int NOT NULL DEFAULT 0;

-- Add index for partner hierarchy queries
CREATE INDEX IF NOT EXISTS partners_parent_idx ON partners (parent_partner_id);
CREATE INDEX IF NOT EXISTS partners_client_code_idx ON partners (client_code);
CREATE INDEX IF NOT EXISTS partners_team_code_idx ON partners (team_code);

-- ============================================
-- 2. Custom Referral Links Table
-- ============================================

-- Store custom referral links with UTM parameters
CREATE TABLE IF NOT EXISTS referral_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  
  -- Link type: 'client' for clients, 'team' for partners
  kind text NOT NULL DEFAULT 'client',
  constraint referral_links_kind_chk CHECK (kind IN ('client', 'team')),
  
  -- Custom code (if empty, uses partner's default code)
  code text,
  
  -- UTM parameters for tracking
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  
  -- Custom name/description for the link
  name text,
  description text,
  
  -- Link status
  status text NOT NULL DEFAULT 'active',
  constraint referral_links_status_chk CHECK (status IN ('active', 'inactive', 'expired')),
  
  -- Expiration (optional)
  expires_at timestamptz,
  
  -- Usage limits (optional)
  max_uses int,
  current_uses int NOT NULL DEFAULT 0,
  
  -- Statistics
  clicks int NOT NULL DEFAULT 0,
  conversions int NOT NULL DEFAULT 0,
  total_revenue_rub int NOT NULL DEFAULT 0,
  total_earnings_rub int NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure unique code per partner
  UNIQUE (partner_id, code)
);

CREATE INDEX IF NOT EXISTS referral_links_partner_idx ON referral_links (partner_id, kind, status);
CREATE INDEX IF NOT EXISTS referral_links_code_idx ON referral_links (code);
CREATE INDEX IF NOT EXISTS referral_links_created_idx ON referral_links (created_at DESC);

-- ============================================
-- 3. Enhanced Click Tracking
-- ============================================

-- Add more fields to referral_clicks for better analytics
ALTER TABLE referral_clicks
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS link_id uuid REFERENCES referral_links(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS utm_source text,
ADD COLUMN IF NOT EXISTS utm_medium text,
ADD COLUMN IF NOT EXISTS utm_campaign text,
ADD COLUMN IF NOT EXISTS utm_content text,
ADD COLUMN IF NOT EXISTS utm_term text,
ADD COLUMN IF NOT EXISTS converted_at timestamptz,
ADD COLUMN IF NOT EXISTS converted_order_id uuid REFERENCES orders(id) ON DELETE SET NULL;

-- Add indexes for analytics
CREATE INDEX IF NOT EXISTS referral_clicks_user_idx ON referral_clicks (user_id);
CREATE INDEX IF NOT EXISTS referral_clicks_partner_idx ON referral_clicks (partner_id);
CREATE INDEX IF NOT EXISTS referral_clicks_link_idx ON referral_clicks (link_id);
CREATE INDEX IF NOT EXISTS referral_clicks_clicked_idx ON referral_clicks (clicked_at DESC);

-- ============================================
-- 4. Partner Hierarchy Cache (for fast MLM queries)
-- ============================================

-- Materialized view for quick partner hierarchy access
CREATE MATERIALIZED VIEW IF NOT EXISTS partner_hierarchy AS
WITH RECURSIVE partner_tree AS (
  -- Base case: top-level partners (no parent)
  SELECT
    p.id,
    p.public_id,
    p.user_id,
    p.parent_partner_id,
    p.client_code,
    p.team_code,
    p.status,
    p.created_at,
    0 AS level,
    ARRAY[p.id] AS path
  FROM partners p
  WHERE p.parent_partner_id IS NULL

  UNION ALL

  -- Recursive case: partners with parent
  SELECT
    p.id,
    p.public_id,
    p.user_id,
    p.parent_partner_id,
    p.client_code,
    p.team_code,
    p.status,
    p.created_at,
    pt.level + 1,
    pt.path || p.id
  FROM partners p
  INNER JOIN partner_tree pt ON p.parent_partner_id = pt.id
)
SELECT * FROM partner_tree;

-- Create indexes first (required for CONCURRENTLY refresh)
CREATE UNIQUE INDEX IF NOT EXISTS partner_hierarchy_id_idx ON partner_hierarchy (id);
CREATE INDEX IF NOT EXISTS partner_hierarchy_parent_idx ON partner_hierarchy (parent_partner_id);
CREATE INDEX IF NOT EXISTS partner_hierarchy_level_idx ON partner_hierarchy (level);

-- Function to refresh partner hierarchy (simple refresh, not CONCURRENTLY)
CREATE OR REPLACE FUNCTION refresh_partner_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW partner_hierarchy;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh hierarchy on partner changes
DROP TRIGGER IF EXISTS refresh_hierarchy_on_partner_change ON partners;
CREATE TRIGGER refresh_hierarchy_on_partner_change
  AFTER INSERT OR UPDATE OR DELETE ON partners
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_partner_hierarchy();

-- ============================================
-- 5. Partner Statistics View
-- ============================================

CREATE OR REPLACE VIEW partner_stats AS
SELECT 
  p.id AS partner_id,
  p.public_id,
  p.user_id,
  p.parent_partner_id,
  p.status,
  
  -- Direct clients count
  (SELECT COUNT(*) FROM client_attribution ca WHERE ca.partner_id = p.id) AS direct_clients,
  
  -- Team partners count (L1)
  (SELECT COUNT(*) FROM partners p2 WHERE p2.parent_partner_id = p.id) AS direct_partners,
  
  -- Team partners count (L2)
  (SELECT COUNT(*) FROM partners p2 
   INNER JOIN partners p3 ON p2.parent_partner_id = p3.id 
   WHERE p3.parent_partner_id = p.id) AS level2_partners,
  
  -- Total orders from direct clients
  (SELECT COUNT(*) 
   FROM orders o 
   INNER JOIN client_attribution ca ON o.user_id = ca.user_id 
   WHERE ca.partner_id = p.id AND o.status = 'paid') AS direct_paid_orders,
  
  -- Total revenue from direct clients
  (SELECT COALESCE(SUM(o.amount_rub), 0) 
   FROM orders o 
   INNER JOIN client_attribution ca ON o.user_id = ca.user_id 
   WHERE ca.partner_id = p.id AND o.status = 'paid') AS direct_revenue_rub,
  
  -- Total earnings (all levels)
  (SELECT COALESCE(SUM(c.amount_rub), 0) 
   FROM commissions c 
   WHERE c.partner_id = p.id AND c.status IN ('available', 'locked')) AS total_earnings_rub,
  
  -- Pending earnings
  (SELECT COALESCE(SUM(c.amount_rub), 0) 
   FROM commissions c 
   WHERE c.partner_id = p.id AND c.status = 'locked') AS pending_earnings_rub,
  
  -- Available balance
  COALESCE(pb.available_rub, 0) AS available_balance_rub,
  
  -- Last activity
  (SELECT MAX(o.created_at) 
   FROM orders o 
   INNER JOIN client_attribution ca ON o.user_id = ca.user_id 
   WHERE ca.partner_id = p.id) AS last_client_order_at,
  
  p.created_at AS partner_since
  
FROM partners p
LEFT JOIN partner_balances pb ON pb.partner_id = p.id;

-- ============================================
-- 6. Referral Link Functions
-- ============================================

-- Function to generate a new referral link
CREATE OR REPLACE FUNCTION create_referral_link(
  p_partner_id uuid,
  p_kind text,
  p_name text DEFAULT NULL,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_utm_content text DEFAULT NULL,
  p_utm_term text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_max_uses int DEFAULT NULL
)
RETURNS referral_links AS $$
DECLARE
  new_link referral_links;
  partner_record RECORD;
BEGIN
  -- Get partner's default code
  SELECT client_code, team_code INTO partner_record
  FROM partners
  WHERE id = p_partner_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner not found';
  END IF;
  
  -- Create new link
  INSERT INTO referral_links (
    partner_id,
    kind,
    code,
    name,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    expires_at,
    max_uses
  ) VALUES (
    p_partner_id,
    p_kind,
    CASE WHEN p_kind = 'client' THEN partner_record.client_code ELSE partner_record.team_code END,
    p_name,
    p_utm_source,
    p_utm_medium,
    p_utm_campaign,
    p_utm_content,
    p_utm_term,
    p_expires_at,
    p_max_uses
  ) RETURNING * INTO new_link;
  
  RETURN new_link;
END;
$$ LANGUAGE plpgsql;

-- Function to increment click counter
CREATE OR REPLACE FUNCTION track_referral_click(
  p_link_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_ip inet DEFAULT NULL,
  p_ua text DEFAULT NULL,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_utm_content text DEFAULT NULL,
  p_utm_term text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_partner_id uuid;
  v_kind text;
  v_code text;
  v_click_id uuid;
BEGIN
  -- Get link info
  SELECT partner_id, kind, code INTO v_partner_id, v_kind, v_code
  FROM referral_links
  WHERE id = p_link_id AND status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active referral link not found';
  END IF;
  
  -- Increment link clicks
  UPDATE referral_links
  SET clicks = clicks + 1, updated_at = now()
  WHERE id = p_link_id;
  
  -- Record click
  INSERT INTO referral_clicks (
    kind,
    code,
    partner_id,
    link_id,
    user_id,
    ip,
    ua,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term
  ) VALUES (
    v_kind,
    v_code,
    v_partner_id,
    p_link_id,
    p_user_id,
    p_ip,
    p_ua,
    p_utm_source,
    p_utm_medium,
    p_utm_campaign,
    p_utm_content,
    p_utm_term
  ) RETURNING id INTO v_click_id;
  
  RETURN v_click_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark click as converted
CREATE OR REPLACE FUNCTION mark_referral_converted(
  p_click_id uuid,
  p_order_id uuid
)
RETURNS void AS $$
BEGIN
  UPDATE referral_clicks
  SET 
    converted_at = now(),
    converted_order_id = p_order_id
  WHERE id = p_click_id;
  
  -- Increment conversion counter on link
  UPDATE referral_links
  SET 
    conversions = conversions + 1,
    updated_at = now()
  WHERE id = (SELECT link_id FROM referral_clicks WHERE id = p_click_id);
END;
$$ LANGUAGE plpgsql;

-- Function to update link revenue after order payment
CREATE OR REPLACE FUNCTION update_link_revenue(
  p_link_id uuid,
  p_order_id uuid,
  p_amount_rub int,
  p_earnings_rub int
)
RETURNS void AS $$
BEGIN
  UPDATE referral_links
  SET 
    total_revenue_rub = total_revenue_rub + p_amount_rub,
    total_earnings_rub = total_earnings_rub + p_earnings_rub,
    updated_at = now()
  WHERE id = p_link_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Comments for documentation
-- ============================================

COMMENT ON TABLE referral_links IS 'Custom referral links with UTM tracking for partners';
COMMENT ON COLUMN referral_links.kind IS 'client=для клиентов, team=для партнёров';
COMMENT ON COLUMN referral_links.code IS 'Реферальный код (клиентский или командный)';
COMMENT ON COLUMN referral_links.utm_source IS 'UTM: источник (telegram, vk, instagram)';
COMMENT ON COLUMN referral_links.utm_medium IS 'UTM: тип трафика (cpc, cpm, organic)';
COMMENT ON COLUMN referral_links.utm_campaign IS 'UTM: название кампании';
COMMENT ON COLUMN referral_links.utm_content IS 'UTM: содержание объявления';
COMMENT ON COLUMN referral_links.utm_term IS 'UTM: ключевое слово';
COMMENT ON TABLE partner_hierarchy IS 'Материализованное представление иерархии партнёров (MLM дерево)';
COMMENT ON VIEW partner_stats IS 'Статистика партнёра: клиенты, команда, доходы';
