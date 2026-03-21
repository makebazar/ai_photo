CREATE OR REPLACE FUNCTION recalculate_partner_balance(p_partner_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO partner_balances (partner_id, available_rub, locked_rub, paid_out_rub)
  VALUES (p_partner_id, 0, 0, 0)
  ON CONFLICT (partner_id) DO NOTHING;

  UPDATE partner_balances
  SET 
    locked_rub = (
      SELECT COALESCE(SUM(amount_rub), 0)
      FROM commissions
      WHERE partner_id = p_partner_id AND status = 'locked'
    ),
    available_rub = (
      SELECT COALESCE(SUM(amount_rub), 0)
      FROM commissions
      WHERE partner_id = p_partner_id AND status = 'available'
    ) - (
      SELECT COALESCE(SUM(amount_rub), 0)
      FROM withdrawal_requests
      WHERE partner_id = p_partner_id AND status IN ('pending', 'approved', 'paid')
    ),
    paid_out_rub = (
      SELECT COALESCE(SUM(amount_rub), 0)
      FROM withdrawal_requests
      WHERE partner_id = p_partner_id AND status = 'paid'
    ),
    updated_at = now()
  WHERE partner_id = p_partner_id;
END;
$$ LANGUAGE plpgsql;
