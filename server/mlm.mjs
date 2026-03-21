import crypto from "node:crypto";
import { readConfig } from "./config.mjs";

/**
 * Send notification to partner via Telegram bot
 */
async function sendPartnerNotification(db, partnerId, text) {
  try {
    const { rows } = await db.query(
      `select u.tg_id from partners p join users u on u.id = p.user_id where p.id = $1`,
      [partnerId]
    );
    const tgId = rows[0]?.tg_id;
    if (!tgId) return;

    const botToken = process.env.TELEGRAM_PARTNER_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.warn("[MLM] No bot token for notification");
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: String(tgId),
        text: text,
        parse_mode: "HTML",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[MLM] Telegram notify error:", err);
    }
  } catch (err) {
    console.error("[MLM] Failed to notify partner:", err);
  }
}

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
  
  // New format: client_CODE or team_CODE (without publicId and token)
  const simpleMatch = /^(client|team)_(.+)$/.exec(raw);
  if (simpleMatch) {
    return { kind: simpleMatch[1], code: simpleMatch[2], fullCode: raw };
  }
  
  // Legacy format: client_publicId_token
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

/**
 * Resolve referral code to partner, supporting both link_id and raw codes
 */
export async function resolveReferralCode(db, code, opts = {}) {
  const { linkId } = opts;
  
  // If link_id provided, get partner from link
  if (linkId) {
    const { rows } = await db.query(
      `select rl.partner_id, rl.kind, rl.code, rl.id as link_id, p.status as partner_status
       from referral_links rl
       join partners p on p.id = rl.partner_id
       where rl.id = $1 and rl.status = 'active'`,
      [linkId]
    );
    if (rows[0] && rows[0].partner_status === 'active') {
      return {
        partnerId: rows[0].partner_id,
        kind: rows[0].kind,
        code: rows[0].code,
        linkId: rows[0].link_id,
      };
    }
  }
  
  // Parse and resolve code
  const parsed = parseReferralCode(code);
  if (!parsed) return null;
  
  // Try to find by code in partners table
  const { rows: pRows } = await db.query(
    `select id as partner_id, client_code, team_code, status
     from partners
     where (client_code = $1 or team_code = $1) and status = 'active'`,
    [parsed.fullCode || code]
  );
  
  if (pRows[0]) {
    return {
      partnerId: pRows[0].partner_id,
      kind: parsed.kind,
      code: parsed.fullCode || code,
      linkId: null,
    };
  }

  // Try to find by code in referral_links table
  const { rows: rlRows } = await db.query(
    `select rl.partner_id, rl.kind, rl.code, rl.id as link_id, p.status as partner_status
     from referral_links rl
     join partners p on p.id = rl.partner_id
     where rl.code = $1 and rl.status = 'active' and p.status = 'active'`,
    [parsed.fullCode || code]
  );

  if (rlRows[0]) {
    return {
      partnerId: rlRows[0].partner_id,
      kind: rlRows[0].kind,
      code: rlRows[0].code,
      linkId: rlRows[0].link_id,
    };
  }

  // Try to find by user code (e.g. client_u123456 or just u123456)
  const userMatch = /u(\d+)$/.exec(parsed.fullCode || code);
  if (userMatch) {
    const tgId = Number(userMatch[1]);
    const { rows: uRows } = await db.query(
      `select p.id as partner_id, u.id as user_id 
       from users u 
       left join partners p on p.user_id = u.id 
       where u.tg_id = $1`,
      [tgId]
    );
    
    if (uRows[0]) {
      // If the user IS a partner, return their partnerId
      // If NOT, we return the user_id as "shadow" attribution
      return {
        partnerId: uRows[0].partner_id || null,
        userId: uRows[0].user_id,
        kind: parsed.kind || 'client',
        code: parsed.fullCode || code,
        linkId: null,
      };
    }
  }

  return null;
}


/**
 * Track click on referral link
 */
export async function trackReferralClick(db, params) {
  const { linkId, userId, ip, ua, utm } = params;
  
  if (linkId) {
    // Use stored procedure for link-based tracking
    const { rows } = await db.query(
      `select track_referral_click($1, $2, $3, $4, $5, $6, $7, $8, $9) as id`,
      [linkId, userId || null, ip || null, ua || null, 
       utm?.source || null, utm?.medium || null, utm?.campaign || null, 
       utm?.content || null, utm?.term || null]
    );
    return { clickId: rows[0]?.id };
  }
  
  // Fallback: simple click tracking
  const { rows } = await db.query(
    `insert into referral_clicks (kind, code, partner_id, user_id, ip, ua, utm_source, utm_medium, utm_campaign)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id`,
    [params.kind, params.code, params.partnerId, userId || null, ip || null, ua || null,
     utm?.source || null, utm?.medium || null, utm?.campaign || null]
  );
  
  return { clickId: rows[0]?.id };
}

/**
 * Mark referral click as converted (user made a purchase)
 */
export async function markReferralConversion(db, params) {
  const { clickId, orderId, linkId, amountRub, earningsRub } = params;
  
  if (clickId) {
    await db.query(`select * from mark_referral_converted($1, $2)`, [clickId, orderId]);
  }
  
  if (linkId && amountRub != null && earningsRub != null) {
    await db.query(`select * from update_link_revenue($1, $2, $3, $4)`, [linkId, orderId, amountRub, earningsRub]);
  }
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
  const holdDays = cfg.mlm?.holdDays ?? 14;
  const unlockAt = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000);

  // Determine the "direct" partner (who invited the paying client).
  let directPartnerId = order.attribution_partner_id;
  let directLinkId = null;
  let referrerUserId = null;
  
  if (!directPartnerId) {
    // Check for link-based attribution
    const { rows: clickRows } = await db.query(
      `select partner_id, link_id, user_id as referrer_user_id from referral_clicks 
       where user_id = $1 and kind = 'client' 
       order by clicked_at desc limit 1`,
      [order.user_id]
    );
    if (clickRows[0]) {
      directPartnerId = clickRows[0].partner_id;
      directLinkId = clickRows[0].link_id;
      referrerUserId = clickRows[0].referrer_user_id;
    }
  }
  
  if (!directPartnerId) {
    const { rows: attrRows } = await db.query(`select partner_id from client_attribution where user_id = $1`, [
      order.user_id,
    ]);
    directPartnerId = attrRows?.[0]?.partner_id ?? null;
  }
  
  if (!directPartnerId) return { ok: true, commissions: 0 };

  // Resolve direct partner status.
  const { rows: partnerRows } = await db.query(
    `select p.id, p.parent_partner_id, p.status, p.user_id as partner_user_id 
     from partners p where p.id = $1`, 
    [directPartnerId]
  );
  const directPartner = partnerRows[0];
  if (!directPartner) return { ok: true, commissions: 0 };

  // LOGIC: PASS-UP
  // If the referrer (the one who gave the link) is NOT a partner yet, 
  // they "miss" the commission, and it goes to the directPartnerId (who invited the referrer).
  let actualPartnerId = directPartnerId;
  let uplinePartnerId = directPartner.parent_partner_id ?? cfg.mlm?.ownerPartnerId ?? null;

  // If order.user_id was invited by someone who is NOT yet a partner, 
  // we could track missed profit here if we knew who that someone was.
  // In our system, every referral link belongs to a PARTNER.
  // If a non-partner user shares a link, it's actually their partner's link.
  
  // To implement "User misses profit", we need to know if the click was via a user's personal (non-partner) link.
  // But wait, only partners have links in our current schema. 
  // Let's assume non-partners can also have "shadow" referral codes or we use their userId.

  const partnerPct = cfg.commissionsPct.partner || 20;
  const parentPct = cfg.commissionsPct.parent || 10;

  const payouts = [
    {
      partnerId: actualPartnerId,
      level: 0,
      percent: partnerPct,
      linkId: directLinkId,
    },
    uplinePartnerId && uplinePartnerId !== actualPartnerId
      ? {
          partnerId: uplinePartnerId,
          level: 1,
          percent: parentPct,
          linkId: null,
        }
      : null,
  ].filter(Boolean);





  let created = 0;
  let totalEarnings = 0;

  for (const p of payouts) {
    const amountRub = computeCommissionAmount(order.amount_rub, p.percent);
    if (amountRub <= 0) continue;

    const { rows: insertRows } = await db.query(
      `
      insert into commissions (order_id, partner_id, level, percent, amount_rub, status, unlock_at)
      values ($1, $2, $3, $4, $5, 'locked', $6)
      on conflict (order_id, partner_id, level) do nothing
      returning id
      `,
      [order.id, p.partnerId, p.level, p.percent, amountRub, unlockAt],
    );

    if (!insertRows.length) continue;
    created += 1;
    totalEarnings += amountRub;

    await db.query(
      `insert into partner_ledger (partner_id, entry_type, amount_rub, order_id, meta)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [p.partnerId, p.level === 0 ? "commission.direct" : p.level === 1 ? "commission.team_l1" : "commission.team_l2", amountRub, order.id, JSON.stringify({ percent: p.percent, level: p.level, status: 'locked', unlock_at: unlockAt })],
    );

    await db.query(
      `insert into partner_balances (partner_id, available_rub, locked_rub, paid_out_rub)
       values ($1, 0, 0, 0)
       on conflict (partner_id) do nothing`,
      [p.partnerId],
    );
    
    // Add to locked_rub (instead of available_rub)
    await db.query(
      `update partner_balances set locked_rub = locked_rub + $2, updated_at = now() where partner_id = $1`,
      [p.partnerId, amountRub],
    );
    
    // Update partner stats (rank, total earnings, etc)
    await db.query(`select update_partner_stats($1)`, [p.partnerId]);

    // Send notification
    const emoji = p.level === 0 ? "💰" : "🤝";
    const levelText = p.level === 0 ? "Прямая продажа" : `Командная продажа (L${p.level})`;
    
    // Check if this was a Pass-up (referrer was not a partner)
    let extraNote = "";
    if (p.level === 0 && referrerUserId) {
      const referralAmount = computeCommissionAmount(order.amount_rub, partnerPct);
      await db.query(
        `insert into missed_profits (user_id, order_id, amount_rub, potential_commission_rub, beneficiary_partner_id)
         values ($1, $2, $3, $4, $5)`,
        [referrerUserId, order.id, order.amount_rub, referralAmount, p.partnerId]
      );
      extraNote = "\n<i>(Pass-up от не-партнера)</i>";
    }

    await sendPartnerNotification(
      db,
      p.partnerId,
      `${emoji} <b>Новое начисление!</b>\n\n` +
      `Тип: ${levelText}\n` +
      `Сумма: <b>${amountRub}₽</b>\n` +
      `Статус: Холд ${holdDays} дней${extraNote}`
    );
  }



  // Track conversion on referral link
  if (directLinkId) {
    await markReferralConversion(db, {
      linkId: directLinkId,
      orderId,
      amountRub: order.amount_rub,
      earningsRub: totalEarnings,
    });
  }

  return { ok: true, commissions: created };
}

/**
 * Process commissions that reached their unlock_at time.
 */
export async function unlockCommissions(db) {
  const { rows } = await db.query(
    `
    select id, partner_id, amount_rub
    from commissions
    where status = 'locked' and unlock_at <= now()
    for update skip locked
    `,
  );

  let unlockedCount = 0;
  for (const c of rows) {
    await db.query(
      `update commissions set status = 'available', updated_at = now() where id = $1`,
      [c.id],
    );
    await db.query(
      `update partner_balances 
       set locked_rub = greatest(0, locked_rub - $2),
           available_rub = available_rub + $2,
           updated_at = now()
       where partner_id = $1`,
      [c.partner_id, c.amount_rub],
    );
    await db.query(
      `insert into partner_ledger (partner_id, entry_type, amount_rub, meta)
       values ($1, 'commission.unlocked', $2, $3::jsonb)`,
      [c.partner_id, 0, JSON.stringify({ commissionId: c.id, amount: c.amount_rub })],
    );
    unlockedCount++;
  }
  return unlockedCount;
}

/**
 * Reverse commissions for a refunded or chargebacked order.
 */
export async function reverseCommissionsForOrder(db, orderId, reason = 'refund') {
  const { rows: commissions } = await db.query(
    `select id, partner_id, amount_rub, status from commissions where order_id = $1 and status <> 'reversed'`,
    [orderId],
  );

  let reversedCount = 0;
  for (const c of commissions) {
    await db.query(
      `update commissions set status = 'reversed', reversal_reason = $2, reversed_at = now() where id = $1`,
      [c.id, reason],
    );

    if (c.status === 'available') {
      await db.query(
        `update partner_balances 
         set available_rub = greatest(0, available_rub - $2),
             updated_at = now()
         where partner_id = $1`,
        [c.partner_id, c.amount_rub],
      );
    } else if (c.status === 'locked') {
      await db.query(
        `update partner_balances 
         set locked_rub = greatest(0, locked_rub - $2),
             updated_at = now()
         where partner_id = $1`,
        [c.partner_id, c.amount_rub],
      );
    }

    await db.query(
      `insert into partner_ledger (partner_id, entry_type, amount_rub, order_id, meta)
       values ($1, 'commission.reversed', $2, $3, $4::jsonb)`,
      [c.partner_id, -c.amount_rub, orderId, JSON.stringify({ reason, commissionId: c.id })],
    );
    
    await db.query(`select update_partner_stats($1)`, [c.partner_id]);

     // Send reversal notification
     await sendPartnerNotification(
       db,
       c.partner_id,
       `⚠️ <b>Корректировка начисления</b>\n\n` +
       `Сумма: -${c.amount_rub}₽\n` +
       `Причина: ${reason === 'refund' ? 'Возврат средств клиенту' : 'Chargeback'}`
     );

     reversedCount++;
  }
  return reversedCount;
}


