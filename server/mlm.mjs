import crypto from "node:crypto";
import { readConfig } from "./config.mjs";

function randomToken(len = 10) {
  return crypto.randomBytes(Math.ceil(len)).toString("base64url").slice(0, len);
}

export function makeReferralCodes(publicId) {
  const t = randomToken(12);
  return {
    clientCode: `client_${publicId}_${t}`,
    teamCode: `team_${publicId}_${t}`,
  };
}

export function parseReferralCode(code) {
  const raw = String(code ?? "").trim();
  const m = /^(client|team)_(\d+)_([A-Za-z0-9_-]+)$/.exec(raw);
  if (!m) return null;
  return { kind: m[1], publicId: Number(m[2]), token: m[3] };
}

export function computeCommissionAmount(amountRub, percent) {
  const a = Number(amountRub ?? 0);
  const p = Number(percent ?? 0);
  if (!Number.isFinite(a) || !Number.isFinite(p)) return 0;
  return Math.max(0, Math.round((a * p) / 100));
}

export async function assertNoPartnerCycle(db, partnerId, newParentPartnerId) {
  if (!newParentPartnerId) return;
  if (partnerId === newParentPartnerId) throw new Error("partner cycle: parent == self");
  const { rows } = await db.query(
    `
    with recursive chain as (
      select id, parent_partner_id
      from partners
      where id = $1
      union all
      select p.id, p.parent_partner_id
      from partners p
      join chain c on c.parent_partner_id = p.id
      where c.parent_partner_id is not null
    )
    select 1 as hit from chain where id = $2 limit 1
  `,
    [newParentPartnerId, partnerId],
  );
  if (rows.length) throw new Error("partner cycle detected");
}

export async function allocateCommissionsForOrder(db, orderId) {
  // Idempotent: commissions have a unique constraint (order_id, partner_id, level).
  const { rows: orderRows } = await db.query(
    `select id, user_id, amount_rub, status, attribution_partner_id from orders where id = $1 for update`,
    [orderId],
  );
  const order = orderRows[0];
  if (!order) throw new Error("order not found");
  if (order.status !== "paid") return { ok: false, reason: "order_not_paid" };

  const cfg = await readConfig(db);

  // Determine the "direct" partner (who invited the paying client).
  let directPartnerId = order.attribution_partner_id;
  if (!directPartnerId) {
    const { rows: attrRows } = await db.query(`select partner_id from client_attribution where user_id = $1`, [
      order.user_id,
    ]);
    directPartnerId = attrRows?.[0]?.partner_id ?? null;
  }
  if (!directPartnerId) return { ok: true, commissions: 0 };

  // Resolve uplines.
  const { rows: directRows } = await db.query(`select id, parent_partner_id from partners where id = $1`, [
    directPartnerId,
  ]);
  const direct = directRows[0];
  if (!direct) return { ok: true, commissions: 0 };

  const l1PartnerId = direct.parent_partner_id ?? null;
  let l2PartnerId = null;
  if (l1PartnerId) {
    const { rows: l1Rows } = await db.query(`select parent_partner_id from partners where id = $1`, [l1PartnerId]);
    l2PartnerId = l1Rows?.[0]?.parent_partner_id ?? null;
  }

  const payouts = [
    {
      partnerId: directPartnerId,
      level: 0,
      percent: cfg.commissionsPct.directClient,
    },
    l1PartnerId
      ? {
          partnerId: l1PartnerId,
          level: 1,
          percent: cfg.commissionsPct.teamL1,
        }
      : null,
    l2PartnerId
      ? {
          partnerId: l2PartnerId,
          level: 2,
          percent: cfg.commissionsPct.teamL2,
        }
      : null,
  ].filter(Boolean);

  let created = 0;

  for (const p of payouts) {
    const amountRub = computeCommissionAmount(order.amount_rub, p.percent);
    if (amountRub <= 0) continue;

    const { rows: insertRows } = await db.query(
      `
      insert into commissions (order_id, partner_id, level, percent, amount_rub, status)
      values ($1, $2, $3, $4, $5, 'available')
      on conflict (order_id, partner_id, level) do nothing
      returning id
      `,
      [order.id, p.partnerId, p.level, p.percent, amountRub],
    );

    if (!insertRows.length) continue;
    created += 1;

    await db.query(
      `insert into partner_ledger (partner_id, entry_type, amount_rub, order_id, meta)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [p.partnerId, p.level === 0 ? "commission.direct" : p.level === 1 ? "commission.team_l1" : "commission.team_l2", amountRub, order.id, JSON.stringify({ percent: p.percent, level: p.level })],
    );

    await db.query(
      `insert into partner_balances (partner_id, available_rub, locked_rub, paid_out_rub)
       values ($1, 0, 0, 0)
       on conflict (partner_id) do nothing`,
      [p.partnerId],
    );
    await db.query(
      `update partner_balances set available_rub = available_rub + $2, updated_at = now() where partner_id = $1`,
      [p.partnerId, amountRub],
    );
  }

  return { ok: true, commissions: created };
}

