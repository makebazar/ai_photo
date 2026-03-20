-- Fix track_referral_click to return bigint (id is bigserial)
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
RETURNS bigint AS $$
DECLARE
  v_partner_id uuid;
  v_kind text;
  v_code text;
  v_click_id bigint;
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

-- Fix mark_referral_converted to accept bigint for p_click_id
CREATE OR REPLACE FUNCTION mark_referral_converted(
  p_click_id bigint,
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
