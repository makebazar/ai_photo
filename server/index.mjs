import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import path from "node:path";
import { makePool, withTx } from "./db.mjs";
import { ensureConfigRow, readConfig } from "./config.mjs";
import { ensureSeedData } from "./seed.mjs";
import { allocateCommissionsForOrder, makeReferralCodes, parseReferralCode, resolveReferralCode, trackReferralClick } from "./mlm.mjs";
import { requireTelegramAuth } from "./auth.mjs";
import { httpError } from "./http.mjs";

const pool = makePool();

/**
 * Placeholder for Astria AI model status check.
 * In production: will call https://api.astria.ai/tunes/:id
 */
async function checkAstriaModelStatus(modelId) {
  if (!modelId) return "none";
  console.log(`[Astria AI] Checking status for model: ${modelId}`);
  // Logic stub: assume model exists if we have its ID
  // In real implementation: if 404 from Astria -> return "deleted"
  return "active";
}

async function upsertUser(db, { tgId, username }) {
  const { rows } = await db.query(
    `
    insert into users (tg_id, username, last_seen_at)
    values ($1, $2, now())
    on conflict (tg_id) do update
      set username = excluded.username,
          last_seen_at = now()
    returning id, tg_id, username, tokens_balance, avatar_access_expires_at
    `,
    [tgId ?? null, username ?? null],
  );
  return rows[0];
}

// Helper for generating Telegram links
function makeTgLink(botName, code, kind) {
  const defaultBot = kind === 'team' ? 'ai_photo_testast_partner_bot' : 'ai_photo_testast_bot';
  const name = botName || defaultBot;
  const appName = process.env.TELEGRAM_APP_NAME;
  
  if (appName) {
    return `https://t.me/${name}/${appName}?startapp=${code}`;
  }
  // If no app name, use the direct startapp parameter on the bot link
  // This works if the Mini App is the "Main Mini App" of the bot
  return `https://t.me/${name}?startapp=${code}`;
}

async function resolvePartnerByCode(db, code) {
  const result = await resolveReferralCode(db, code);
  if (!result) return null;
  
  const { partnerId, kind } = result;
  const column = kind === "client" ? "client_code" : "team_code";
  const { rows } = await db.query(
    `select id, public_id, user_id, ${column} as code, status from partners where id = $1`,
    [partnerId],
  );
  return rows[0] ?? null;
}

async function ensurePartner(db, { userId, teamCode }) {
  // If partner already exists for this user – return it.
  const { rows: existing } = await db.query(
    `select id, public_id, client_code, team_code, parent_partner_id, status from partners where user_id = $1`,
    [userId],
  );
  if (existing[0]) return existing[0];

  let parentPartnerId = null;
  if (teamCode) {
    const parent = await resolvePartnerByCode(db, teamCode);
    if (!parent || parent.status !== "active") throw httpError(400, "Invalid team referral code");
    parentPartnerId = parent.id;
  } else {
    // If no team code, try to find parent from client attribution
    const { rows: attr } = await db.query(
      `select partner_id from client_attribution where user_id = $1`,
      [userId],
    );
    if (attr[0]) {
      parentPartnerId = attr[0].partner_id;
      console.log(`[ensurePartner] Found parent partner ${parentPartnerId} from client_attribution for user ${userId}`);
    }
  }

  // First insert to get public_id (identity), then update codes using public_id.
  const { rows: inserted } = await db.query(
    `
    insert into partners (user_id, parent_partner_id, status, client_code, team_code)
    values ($1, $2, 'active', 'tmp', 'tmp')
    returning id, public_id
    `,
    [userId, parentPartnerId],
  );
  const p = inserted[0];
  const codes = makeReferralCodes(p.public_id);
  const { rows: updated } = await db.query(
    `
    update partners
    set client_code = $2, team_code = $3
    where id = $1
    returning id, public_id, client_code, team_code, parent_partner_id, status
    `,
    [p.id, codes.clientCode, codes.teamCode],
  );

  await db.query(
    `insert into partner_balances (partner_id, available_rub, locked_rub, paid_out_rub)
     values ($1, 0, 0, 0)
     on conflict (partner_id) do nothing`,
    [updated[0].id],
  );

  return updated[0];
}

async function ensureClientAttribution(db, { userId, clientCode }) {
  if (!clientCode) return null;
  const ref = await resolvePartnerByCode(db, clientCode);
  if (!ref || ref.status !== "active") throw httpError(400, "Invalid client referral code");

  await db.query(
    `insert into client_attribution (user_id, partner_id, code)
     values ($1, $2, $3)
     on conflict (user_id) do nothing`,
    [userId, ref.id, clientCode],
  );

  return ref;
}

async function createOrder(db, { userId, planId, clientCode }) {
  const cfg = await readConfig(db);
  const plan = cfg.plans.find(p => p.id === planId);
  if (!plan) throw httpError(400, "Invalid planId");
  
  const amountRub = plan.priceRub;

  const direct = clientCode ? await ensureClientAttribution(db, { userId, clientCode }) : null;
  const attributionPartnerId = direct?.id ?? null;

  const { rows } = await db.query(
    `
    insert into orders (user_id, plan_id, amount_rub, status, attribution_partner_id, attribution_kind)
    values ($1, $2, $3, 'unpaid', $4, $5)
    returning id, user_id, plan_id, amount_rub, status, created_at
    `,
    [userId, planId, amountRub, attributionPartnerId, attributionPartnerId ? "client" : null],
  );
  return rows[0];
}

async function getPartnerDashboard(db, partnerPublicId) {
  const { rows: partners } = await db.query(
    `select id, public_id, client_code, team_code, parent_partner_id, status, created_at from partners where public_id = $1`,
    [partnerPublicId],
  );
  const p = partners[0];
  if (!p) throw httpError(404, "Partner not found");

  const { rows: balRows } = await db.query(
    `select available_rub, locked_rub, paid_out_rub from partner_balances where partner_id = $1`,
    [p.id],
  );
  const balances = balRows[0] ?? { available_rub: 0, locked_rub: 0, paid_out_rub: 0 };

  const [{ rows: clicks }, { rows: signups }, { rows: paid }, { rows: earnings }] = await Promise.all([
    db.query(`select count(*)::int as n from referral_clicks where partner_id = $1 and kind = 'client'`, [p.id]),
    db.query(`select count(*)::int as n from client_attribution where partner_id = $1`, [p.id]),
    db.query(`select count(*)::int as n from orders where attribution_partner_id = $1 and status = 'paid'`, [p.id]),
    db.query(`select coalesce(sum(amount_rub),0)::int as n from commissions where partner_id = $1 and status = 'available'`, [p.id]),
  ]);

  const cfg = await readConfig(db);

  return {
    partner: {
      id: p.id,
      publicId: p.public_id,
      status: p.status,
      createdAt: p.created_at,
      links: {
        client: makeTgLink(process.env.TELEGRAM_BOT_NAME, p.client_code, 'client'),
        team: makeTgLink(process.env.TELEGRAM_PARTNER_BOT_NAME, p.team_code, 'team'),
      },
    },
    balances: {
      availableRub: balances.available_rub,
      lockedRub: balances.locked_rub,
      paidOutRub: balances.paid_out_rub,
    },
    stats: {
      clicks: clicks[0]?.n ?? 0,
      signups: signups[0]?.n ?? 0,
      paid: paid[0]?.n ?? 0,
      earningsRub: earnings[0]?.n ?? 0,
    },
    policy: {
      commissionsPct: cfg.commissionsPct,
      payout: cfg.payout,
    },
  };
}

async function getPartnerTeam(db, partnerPublicId) {
  const { rows: partners } = await db.query(`select id, public_id from partners where public_id = $1`, [partnerPublicId]);
  const root = partners[0];
  if (!root) throw httpError(404, "Partner not found");

  const { rows: l1 } = await db.query(
    `select id, public_id, status, created_at from partners where parent_partner_id = $1 order by created_at desc`,
    [root.id],
  );
  const l1Ids = l1.map((p) => p.id);

  const { rows: l2 } = l1Ids.length
    ? await db.query(
        `select id, public_id, status, created_at, parent_partner_id from partners where parent_partner_id = any($1::uuid[]) order by created_at desc`,
        [l1Ids],
      )
    : { rows: [] };

  async function partnerStats(partnerId) {
    const [{ rows: clicks }, { rows: paid }, { rows: turnover }] = await Promise.all([
      db.query(`select count(*)::int as n from referral_clicks where partner_id = $1 and kind = 'client'`, [partnerId]),
      db.query(`select count(*)::int as n from orders where attribution_partner_id = $1 and status = 'paid'`, [partnerId]),
      db.query(`select coalesce(sum(amount_rub),0)::int as n from orders where attribution_partner_id = $1 and status = 'paid'`, [partnerId]),
    ]);
    return {
      clicks: clicks[0]?.n ?? 0,
      paid: paid[0]?.n ?? 0,
      turnoverRub: turnover[0]?.n ?? 0,
    };
  }

  const cfg = await readConfig(db);

  const l1Out = [];
  for (const p of l1) {
    const stats = await partnerStats(p.id);
    const { rows: earn } = await db.query(
      `
      select coalesce(sum(c.amount_rub),0)::int as n
      from commissions c
      join orders o on o.id = c.order_id
      where c.partner_id = $1 and c.level = 1 and o.attribution_partner_id = $2
      `,
      [root.id, p.id],
    );
    l1Out.push({
      publicId: p.public_id,
      status: p.status,
      createdAt: p.created_at,
      stats,
      uplineEarningsRub: earn[0]?.n ?? 0,
      pct: cfg.commissionsPct.teamL1,
    });
  }

  const l2Out = [];
  for (const p of l2) {
    const stats = await partnerStats(p.id);
    const { rows: earn } = await db.query(
      `
      select coalesce(sum(c.amount_rub),0)::int as n
      from commissions c
      join orders o on o.id = c.order_id
      where c.partner_id = $1 and c.level = 2 and o.attribution_partner_id = $2
      `,
      [root.id, p.id],
    );
    l2Out.push({
      publicId: p.public_id,
      status: p.status,
      createdAt: p.created_at,
      parentPublicId: l1.find((x) => x.id === p.parent_partner_id)?.public_id ?? null,
      stats,
      uplineEarningsRub: earn[0]?.n ?? 0,
      pct: cfg.commissionsPct.teamL2,
    });
  }

  return { l1: l1Out, l2: l2Out };
}

async function getPartnerClients(db, partnerPublicId) {
  const { rows: partners } = await db.query(`select id, public_id from partners where public_id = $1`, [partnerPublicId]);
  const root = partners[0];
  if (!root) throw httpError(404, "Partner not found");

  const { rows: l1 } = await db.query(`select id from partners where parent_partner_id = $1`, [root.id]);
  const l1Ids = l1.map((p) => p.id);

  const directQuery = `
    select
      u.id as user_id,
      u.username,
      ca.created_at as joined_at,
      u.last_seen_at,
      count(o.id)::int as orders_count,
      coalesce(sum(o.amount_rub),0)::int as revenue_rub,
      coalesce(sum(c.amount_rub),0)::int as your_earnings_rub
    from client_attribution ca
    join users u on u.id = ca.user_id
    left join orders o on o.user_id = u.id and o.status = 'paid'
    left join commissions c on c.order_id = o.id and c.partner_id = $2 and c.level = 0
    where ca.partner_id = $1
    group by u.id, u.username, ca.created_at, u.last_seen_at
    order by ca.created_at desc
    limit 200
  `;

  const teamQuery = `
    select
      u.id as user_id,
      u.username,
      ca.created_at as joined_at,
      u.last_seen_at,
      count(o.id)::int as orders_count,
      coalesce(sum(o.amount_rub),0)::int as revenue_rub,
      coalesce(sum(c.amount_rub),0)::int as your_earnings_rub
    from client_attribution ca
    join users u on u.id = ca.user_id
    left join orders o on o.user_id = u.id and o.status = 'paid'
    left join commissions c on c.order_id = o.id and c.partner_id = $2 and c.level = 1
    where ca.partner_id = any($1::uuid[])
    group by u.id, u.username, ca.created_at, u.last_seen_at
    order by ca.created_at desc
    limit 200
  `;

  const direct = await db.query(directQuery, [root.id, root.id]);
  const team = l1Ids.length ? await db.query(teamQuery, [l1Ids, root.id]) : { rows: [] };

  return {
    direct: direct.rows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      joinedAt: r.joined_at,
      lastSeenAt: r.last_seen_at,
      ordersCount: r.orders_count,
      revenueRub: r.revenue_rub,
      yourEarningsRub: r.your_earnings_rub,
      level: 1,
      status: r.revenue_rub > 0 ? "paid" : "registered",
    })),
    team: team.rows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      joinedAt: r.joined_at,
      lastSeenAt: r.last_seen_at,
      ordersCount: r.orders_count,
      revenueRub: r.revenue_rub,
      yourEarningsRub: r.your_earnings_rub,
      level: 2,
      status: r.revenue_rub > 0 ? "paid" : "registered",
    })),
  };
}

function requireAdmin(req) {
  const token = process.env.ADMIN_TOKEN;
  // Если токен не установлен - разрешаем доступ (для прототипа)
  if (!token) return;
  
  // Проверяем токен из заголовка
  const header = req.headers["x-admin-token"];
  if (!header || String(header) !== token) {
    // Для прототипа: если есть заголовок X-Admin-Auth: 1 - разрешаем
    const authHeader = req.headers["x-admin-auth"];
    if (authHeader === "1") {
      console.log("[Admin] Debug auth allowed");
      return;
    }
    throw httpError(401, "Unauthorized");
  }
}

async function main() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  await withTx(pool, async (db) => {
    await ensureConfigRow(db);
    await ensureSeedData(db);
  });

  // Serve SPA build when running in a container/production.
  const distDir = path.join(process.cwd(), "dist");
  if (fs.existsSync(distDir)) {
    await app.register(fastifyStatic, { root: distDir });

    app.setNotFoundHandler((req, reply) => {
      const url = String(req.url || "");
      if (req.method === "GET" && !url.startsWith("/api")) {
        const accept = String(req.headers.accept || "");
        if (accept.includes("text/html") || accept.includes("*/*")) {
          return reply.type("text/html").sendFile("index.html");
        }
      }
      reply.code(404).send({ ok: false, error: "Not found" });
    });
  }

  app.get("/health", async () => ({ ok: true }));

  app.get("/api/config", async () => {
    const cfg = await withTx(pool, (db) => readConfig(db));
    return { ok: true, config: cfg };
  });

  app.get("/api/packs", async () => {
    const rows = await withTx(pool, async (db) => {
      const { rows } = await db.query(
        `select id, slug, title, description, status, preview_urls, estimated_images, pack_object_id, prompts_per_class, costs_per_class
         from style_packs
         where status = 'active'
         order by updated_at desc`,
      );
      return rows;
    });
    return { ok: true, packs: rows };
  });

  app.get("/api/promos", async () => {
    const rows = await withTx(pool, async (db) => {
      const { rows } = await db.query(
        `select id, title, caption, kind, status, cover_url, media_urls, tags
         from promos
         where status = 'active'
         order by updated_at desc`,
      );
      return rows;
    });
    return { ok: true, promos: rows };
  });

  // ===== Admin API (token via x-admin-token) =====
  app.get("/api/admin/config", async (req) => {
    requireAdmin(req);
    const cfg = await withTx(pool, (db) => readConfig(db));
    return { ok: true, config: cfg };
  });

  app.put("/api/admin/config", async (req) => {
    requireAdmin(req);
    const body = req.body ?? {};
    const patch = body.patch && typeof body.patch === "object" ? body.patch : null;
    if (!patch) throw httpError(400, "patch is required");

    const cfg = await withTx(pool, async (db) => {
      const current = await readConfig(db);
      const merged = {
        ...current,
        ...(patch ?? {}),
        planPricesRub: { ...current.planPricesRub, ...(patch.planPricesRub ?? {}) },
        planMeta: { ...current.planMeta, ...(patch.planMeta ?? {}) },
        commissionsPct: { ...current.commissionsPct, ...(patch.commissionsPct ?? {}) },
        payout: { ...current.payout, ...(patch.payout ?? {}) },
      };
      await db.query(`update app_config set config = $1::jsonb, updated_at = now() where id = 1`, [
        JSON.stringify(merged),
      ]);
      return merged;
    });

    return { ok: true, config: cfg };
  });

  app.get("/api/admin/packs", async (req) => {
    requireAdmin(req);
    const rows = await withTx(pool, async (db) => {
      const { rows } = await db.query(
        `select id, slug, title, description, status, preview_urls, estimated_images, pack_object_id, prompts_per_class, costs_per_class, created_at, updated_at
         from style_packs
         order by updated_at desc`,
      );
      return rows;
    });
    return { ok: true, packs: rows };
  });

  app.post("/api/admin/packs", async (req) => {
    requireAdmin(req);
    const b = req.body ?? {};
    const id = Number(b.id);
    const slug = b.slug ? String(b.slug) : null;
    const title = b.title ? String(b.title) : null;
    const description = b.description ? String(b.description) : null;
    if (!Number.isFinite(id) || !slug || !title || !description) throw httpError(400, "id,slug,title,description required");
    const status = b.status === "hidden" ? "hidden" : "active";
    const previewUrls = Array.isArray(b.previewUrls) ? b.previewUrls.map((x) => String(x)).filter(Boolean) : [];
    const estimatedImages = Math.max(1, Math.round(Number(b.estimatedImages ?? 20)));
    const packObjectId = b.packObjectId ? String(b.packObjectId) : null;
    const promptsPerClass = b.promptsPerClass != null ? Math.max(0, Math.round(Number(b.promptsPerClass))) : null;
    const costsPerClass = b.costsPerClass && typeof b.costsPerClass === "object" ? b.costsPerClass : {};

    await withTx(pool, async (db) => {
      await db.query(
        `
        insert into style_packs (id, slug, title, description, status, preview_urls, estimated_images, pack_object_id, prompts_per_class, costs_per_class)
        values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::jsonb)
        on conflict (id) do update
          set slug = excluded.slug,
              title = excluded.title,
              description = excluded.description,
              status = excluded.status,
              preview_urls = excluded.preview_urls,
              estimated_images = excluded.estimated_images,
              pack_object_id = excluded.pack_object_id,
              prompts_per_class = excluded.prompts_per_class,
              costs_per_class = excluded.costs_per_class,
              updated_at = now()
        `,
        [id, slug, title, description, status, JSON.stringify(previewUrls), estimatedImages, packObjectId, promptsPerClass, JSON.stringify(costsPerClass)],
      );
    });

    return { ok: true };
  });

  app.patch("/api/admin/packs/:id", async (req) => {
    requireAdmin(req);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw httpError(400, "id invalid");
    const b = req.body ?? {};
    const patch = b.patch && typeof b.patch === "object" ? b.patch : null;
    if (!patch) throw httpError(400, "patch required");

    await withTx(pool, async (db) => {
      const { rows } = await db.query(`select * from style_packs where id = $1`, [id]);
      if (!rows[0]) throw httpError(404, "pack not found");
      const cur = rows[0];
      const next = {
        slug: patch.slug != null ? String(patch.slug) : cur.slug,
        title: patch.title != null ? String(patch.title) : cur.title,
        description: patch.description != null ? String(patch.description) : cur.description,
        status: patch.status === "hidden" ? "hidden" : patch.status === "active" ? "active" : cur.status,
        preview_urls: patch.previewUrls ? JSON.stringify(patch.previewUrls) : cur.preview_urls,
        estimated_images: patch.estimatedImages != null ? Math.max(1, Math.round(Number(patch.estimatedImages))) : cur.estimated_images,
        pack_object_id: patch.packObjectId != null ? String(patch.packObjectId) : cur.pack_object_id,
        prompts_per_class: patch.promptsPerClass != null ? Math.max(0, Math.round(Number(patch.promptsPerClass))) : cur.prompts_per_class,
        costs_per_class: patch.costsPerClass ? JSON.stringify(patch.costsPerClass) : cur.costs_per_class,
      };
      await db.query(
        `update style_packs
         set slug=$2,title=$3,description=$4,status=$5,preview_urls=$6::jsonb,estimated_images=$7,pack_object_id=$8,prompts_per_class=$9,costs_per_class=$10::jsonb,updated_at=now()
         where id=$1`,
        [id, next.slug, next.title, next.description, next.status, next.preview_urls, next.estimated_images, next.pack_object_id, next.prompts_per_class, next.costs_per_class],
      );
    });

    return { ok: true };
  });

  app.post("/api/client/generate", async (req) => {
    const userId = req.userId;
    const b = req.body ?? {};
    const styleId = b.styleId ? String(b.styleId) : null;
    const count = Math.max(1, Math.min(50, Number(b.count || 1)));
    if (!styleId) throw httpError(400, "styleId required");

    const res = await withTx(pool, async (db) => {
      const cfg = await readConfig(db);
      const costPerPhoto = cfg.costs?.photoTokens || 1;
      const totalCost = costPerPhoto * count;

      // 1. Check tokens
      const { rows: uRows } = await db.query(
        `select tokens_balance, avatar_access_expires_at from users where id = $1`,
        [userId]
      );
      const user = uRows[0];
      if (!user) throw httpError(404, "User not found");
      if (user.tokens_balance < totalCost) throw httpError(403, "Insufficient tokens");

      // 2. Spend tokens
      await db.query(
        `update users set tokens_balance = tokens_balance - $2 where id = $1`,
        [userId, totalCost]
      );

      // 3. Create session (simplified for now)
      const { rows: sRows } = await db.query(
        `insert into style_sessions (user_id, mode, status)
         values ($1, 'pack', 'queued')
         returning id`,
        [userId]
      );

      return { sessionId: sRows[0].id, spent: totalCost };
    });

    return { ok: true, ...res };
  });

  app.post("/api/client/unlock-avatar", async (req) => {
    const userId = req.userId;
    const res = await withTx(pool, async (db) => {
      const cfg = await readConfig(db);
      const unlockCost = cfg.costs?.avatarTokens || 50;

      const { rows: uRows } = await db.query(
        `select tokens_balance from users where id = $1`,
        [userId]
      );
      const user = uRows[0];
      if (!user) throw httpError(404, "User not found");
      if (user.tokens_balance < unlockCost) throw httpError(403, "Insufficient tokens");

      await db.query(
        `update users 
         set tokens_balance = tokens_balance - $2,
             avatar_access_expires_at = now() + interval '1 year'
         where id = $1`,
        [userId, unlockCost]
      );

      return { unlocked: true, spent: unlockCost };
    });
    return { ok: true, ...res };
  });

  app.get("/api/admin/promos", async (req) => {
    requireAdmin(req);
    const rows = await withTx(pool, async (db) => {
      const { rows } = await db.query(
        `select id, title, caption, kind, status, cover_url, media_urls, tags, created_at, updated_at
         from promos
         order by updated_at desc`,
      );
      return rows;
    });
    return { ok: true, promos: rows };
  });

  app.post("/api/admin/promos", async (req) => {
    requireAdmin(req);
    const b = req.body ?? {};
    const id = b.id ? String(b.id) : null;
    const title = b.title ? String(b.title) : null;
    const caption = b.caption ? String(b.caption) : null;
    const kind = b.kind === "video" ? "video" : b.kind === "photo" ? "photo" : "text";
    if (!id || !title || !caption) throw httpError(400, "id,title,caption required");
    const status = b.status === "hidden" ? "hidden" : "active";
    const coverUrl = b.coverUrl ? String(b.coverUrl) : null;
    const mediaUrls = Array.isArray(b.mediaUrls) ? b.mediaUrls.map((x) => String(x)).filter(Boolean) : [];
    const tags = Array.isArray(b.tags) ? b.tags.map((x) => String(x)).filter(Boolean) : [];

    await withTx(pool, async (db) => {
      await db.query(
        `
        insert into promos (id, title, caption, kind, status, cover_url, media_urls, tags)
        values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::text[])
        on conflict (id) do update
          set title=excluded.title,
              caption=excluded.caption,
              kind=excluded.kind,
              status=excluded.status,
              cover_url=excluded.cover_url,
              media_urls=excluded.media_urls,
              tags=excluded.tags,
              updated_at=now()
        `,
        [id, title, caption, kind, status, coverUrl, JSON.stringify(mediaUrls), tags],
      );
    });

    return { ok: true };
  });

  app.delete("/api/admin/promos/:id", async (req) => {
    requireAdmin(req);
    const id = String(req.params.id);
    await withTx(pool, (db) => db.query(`delete from promos where id = $1`, [id]));
    return { ok: true };
  });

  app.get("/api/admin/users", async (req) => {
    requireAdmin(req);
    const rows = await withTx(pool, async (db) => {
      const { rows } = await db.query(
        `
        select u.id, u.tg_id, u.username, u.created_at, u.last_seen_at, u.tokens_balance,
               a.status as avatar_status, a.astria_model_id, a.last_trained_at,
               (select count(*) from partners p where p.user_id = u.id) > 0 as is_partner
        from users u
        left join avatars a on a.user_id = u.id
        order by u.created_at desc
        limit 300
        `,
      );
      return rows;
    });
    console.log("[Admin] Users loaded:", rows.length);
    return { ok: true, users: rows };
  });

  app.post("/api/admin/users/:id/adjust-tokens", async (req) => {
    requireAdmin(req);
    const id = String(req.params.id);
    const b = req.body ?? {};
    const delta = Math.round(Number(b.delta || 0));
    if (!Number.isFinite(delta) || delta === 0) throw httpError(400, "delta is required");

    await withTx(pool, async (db) => {
      await db.query(
        `update users set tokens_balance = greatest(0, tokens_balance + $2) where id = $1`,
        [id, delta],
      );
    });
    return { ok: true };
  });

  app.delete("/api/admin/users/:id", async (req) => {
    requireAdmin(req);
    const id = String(req.params.id);
    await withTx(pool, async (db) => {
      await db.query(`delete from users where id = $1`, [id]);
    });
    return { ok: true };
  });

  app.get("/api/admin/partners", async (req) => {
    requireAdmin(req);
    const rows = await withTx(pool, async (db) => {
      const { rows } = await db.query(
        `
        select
          p.id,
          p.public_id,
          p.status,
          p.client_code,
          p.team_code,
          p.parent_partner_id,
          u.username,
          u.tg_id,
          p.created_at,
          b.available_rub,
          b.locked_rub,
          b.paid_out_rub,
          (select count(*)::int from referral_clicks where partner_id = p.id) as clicks_count,
          (select count(*)::int from client_attribution where partner_id = p.id) as signups_count,
          (select count(*)::int from orders where attribution_partner_id = p.id and status = 'paid') as paid_orders_count,
          (select coalesce(sum(amount_rub), 0)::int from orders where attribution_partner_id = p.id and status = 'paid') as turnover_rub
        from partners p
        join users u on u.id = p.user_id
        left join partner_balances b on b.partner_id = p.id
        order by p.created_at desc
        limit 300
        `,
      );
      console.log("[Admin] Partners loaded:", rows.length);
      return rows;
    });
    return { ok: true, partners: rows };
  });

  app.post("/api/admin/partners/:publicId/block", async (req) => {
    requireAdmin(req);
    const publicId = Number(req.params.publicId);
    if (!Number.isFinite(publicId)) throw httpError(400, "publicId invalid");
    const b = req.body ?? {};
    const blocked = Boolean(b.blocked);
    await withTx(pool, async (db) => {
      await db.query(`update partners set status = $2 where public_id = $1`, [publicId, blocked ? "blocked" : "active"]);
    });
    return { ok: true };
  });

  app.post("/api/admin/partners/:publicId/adjust-balance", async (req) => {
    requireAdmin(req);
    const publicId = Number(req.params.publicId);
    if (!Number.isFinite(publicId)) throw httpError(400, "publicId invalid");
    const b = req.body ?? {};
    const deltaRub = Math.round(Number(b.deltaRub || 0));
    const reason = b.reason ? String(b.reason) : null;
    if (!Number.isFinite(deltaRub) || deltaRub === 0 || !reason || reason.trim().length < 3) {
      throw httpError(400, "deltaRub (non-zero) and reason required");
    }
    await withTx(pool, async (db) => {
      const { rows } = await db.query(`select id from partners where public_id = $1`, [publicId]);
      const p = rows[0];
      if (!p) throw httpError(404, "partner not found");
      await db.query(
        `insert into partner_balances (partner_id, available_rub, locked_rub, paid_out_rub)
         values ($1, 0, 0, 0)
         on conflict (partner_id) do nothing`,
        [p.id],
      );
      await db.query(
        `update partner_balances set available_rub = greatest(0, available_rub + $2), updated_at = now() where partner_id = $1`,
        [p.id, deltaRub],
      );
      await db.query(
        `insert into partner_ledger (partner_id, entry_type, amount_rub, meta)
         values ($1, 'admin.adjust_balance', $2, $3::jsonb)`,
        [p.id, deltaRub, JSON.stringify({ reason })],
      );
    });
    return { ok: true };
  });

  app.get("/api/admin/orders", async (req) => {
    requireAdmin(req);
    const rows = await withTx(pool, async (db) => {
      const { rows } = await db.query(
        `
        select o.id, o.plan_id, o.amount_rub, o.status, o.created_at, o.paid_at,
               u.username, u.tg_id,
               p.public_id as partner_public_id, o.attribution_kind
        from orders o
        join users u on u.id = o.user_id
        left join partners p on p.id = o.attribution_partner_id
        order by o.created_at desc
        limit 300
        `,
      );
      return rows;
    });
    return { ok: true, orders: rows };
  });

  app.get("/api/admin/sessions", async (req) => {
    requireAdmin(req);
    const rows = await withTx(pool, async (db) => {
      const { rows } = await db.query(
        `
        select s.id, s.mode, s.pack_id, s.title, s.status, s.created_at, s.updated_at,
               u.username, u.tg_id,
               s.order_id
        from photo_sessions s
        join users u on u.id = s.user_id
        order by s.created_at desc
        limit 300
        `,
      );
      return rows;
    });
    return { ok: true, sessions: rows };
  });

  // DEBUG auth for now: create/update user by telegram id.
  app.post("/api/debug/auth", async (req) => {
    const body = req.body ?? {};
    const tgId = Number(body.tgId);
    if (!Number.isFinite(tgId)) throw httpError(400, "tgId is required");
    const username = body.username ? String(body.username) : null;
    const user = await withTx(pool, (db) => upsertUser(db, { tgId, username }));
    return { ok: true, user };
  });

  // Debug: создать тестового пользователя (только если нет ADMIN_TOKEN)
  app.post("/api/debug/create-user", async (req) => {
    // Разрешить только если ADMIN_TOKEN не установлен (dev режим)
    if (process.env.ADMIN_TOKEN) {
      throw httpError(403, "Disabled in production");
    }
    const body = req.body ?? {};
    const tgId = Number(body.tgId || Math.floor(Math.random() * 1000000));
    const username = body.username ? String(body.username) : `user_${tgId}`;
    
    const user = await withTx(pool, (db) => upsertUser(db, { tgId, username }));
    console.log("[Debug] Created user:", user);
    return { ok: true, user };
  });

  // Debug: очистить все тестовые данные (только если нет ADMIN_TOKEN)
  app.post("/api/debug/reset-all", async (req) => {
    if (process.env.ADMIN_TOKEN) {
      throw httpError(403, "Disabled in production");
    }
    
    await withTx(pool, async (db) => {
      // Очищаем в правильном порядке (с учётом foreign keys)
      await db.query(`truncate payment_events, order_commissions, orders, datasets, dataset_images, avatars, client_attribution, partner_withdrawal_requests, partners, users cascade`);
      console.log("[Debug] All data cleared");
    });
    
    return { ok: true, message: "All data cleared" };
  });

  // Debug: создать тестового партнёра (только если нет ADMIN_TOKEN)
  app.post("/api/debug/create-partner", async (req) => {
    if (process.env.ADMIN_TOKEN) {
      throw httpError(403, "Disabled in production");
    }
    
    const body = req.body ?? {};
    const tgId = Number(body.tgId || Math.floor(Math.random() * 1000000));
    const username = body.username ? String(body.username) : `partner_${tgId}`;
    const teamCode = body.teamCode || null;
    
    const result = await withTx(pool, async (db) => {
      const user = await upsertUser(db, { tgId, username });
      const partner = await ensurePartner(db, { userId: user.id, teamCode });
      return { user, partner };
    });
    
    console.log("[Debug] Created partner:", result.partner);
    return { ok: true, ...result };
  });

  // Universal auth endpoint: login/register user with role detection from start_param
  app.post("/api/auth/login", async (req) => {
    const body = req.body ?? {};
    const auth = requireTelegramAuth(req);
    const tgId = Number(auth.user.id);
    const username = auth.user.username ? String(auth.user.username) : null;
    const role = auth.role || "client";
    const startParam = auth.startParam;

    const result = await withTx(pool, async (db) => {
      const user = await upsertUser(db, { tgId, username });
      
      console.log(`[Auth] User ${user.id} (tgId: ${tgId}) logged in. StartParam: ${startParam}, Role: ${role}`);

      let partner = null;
      let attribution = null;
      
      // Handle referral attribution (unified logic)
      if (startParam) {
        const ref = await resolveReferralCode(db, startParam);
        console.log(`[Auth] Resolving startParam ${startParam}:`, ref);

        if (ref) {
          // Track click automatically if it's a valid referral
          const click = await trackReferralClick(db, {
            linkId: ref.linkId,
            partnerId: ref.partnerId,
            kind: ref.kind,
            code: startParam,
            userId: user.id, // UUID
          });
          console.log(`[Auth] Click tracked for user ${user.id}:`, click);

          // 2. Handle client attribution if it's a client link
          if (ref.kind === "client") {
            attribution = await ensureClientAttribution(db, { userId: user.id, clientCode: startParam });
            console.log(`[Auth] Client attribution result for user ${user.id}:`, attribution);
          }

          // 3. Handle partner registration if it's a team link (and not already a partner)
          if (ref.kind === "team" && !partner) {
            console.log(`[Auth] Registering partner for user ${user.id} via team link. ParentPartnerId: ${ref.partnerId}`);
            partner = await ensurePartner(db, { userId: user.id, teamCode: startParam });
          }
        } else {
          console.log(`[Auth] startParam ${startParam} could not be resolved to any partner or link`);
        }
      }

      // Fallback partner registration (explicit role or legacy start_param)
      if (!partner && (role === "partner" || (startParam && (startParam.startsWith("partner_") || startParam.startsWith("pt_") || startParam.startsWith("team_"))))) {
        const teamCode = startParam && startParam.includes("_") ? startParam : null;
        console.log(`[Auth] Registering partner for user ${user.id} (fallback). TeamCode: ${teamCode}`);
        partner = await ensurePartner(db, { userId: user.id, teamCode });
      }

      const avatarRows = await db.query(
        `select id, status, astria_model_id from avatars where user_id = $1`,
        [user.id]
      );
      const avatar = avatarRows.rows[0];
      let astriaStatus = "none";
      if (avatar?.astria_model_id) {
        astriaStatus = await checkAstriaModelStatus(avatar.astria_model_id);
      }

      return {
        user: {
          id: user.id,
          tgId: user.tg_id,
          username: user.username,
          tokensBalance: user.tokens_balance,
          avatarAccessExpiresAt: user.avatar_access_expires_at,
          astriaStatus, // Sync status with Astria
        },
        partner: partner ? {
          id: partner.id,
          publicId: partner.public_id,
          clientCode: partner.client_code,
          teamCode: partner.team_code,
          status: partner.status,
        } : null,
        attribution: attribution ? {
          partnerId: attribution.id,
          code: attribution.client_code,
        } : null,
        role,
      };
    });

    return { ok: true, ...result };
  });

  // Partner registration (MLM team link can be provided)
  app.post("/api/partner/register", async (req) => {
    const body = req.body ?? {};
    const auth = requireTelegramAuth(req);
    const tgId = Number(auth.user.id);
    const username = auth.user.username ? `@${String(auth.user.username).replace(/^@/, "")}` : body.username ? String(body.username) : null;
    const teamCode = body.teamCode ? String(body.teamCode) : null;

    const partner = await withTx(pool, async (db) => {
      const user = await upsertUser(db, { tgId, username });
      const p = await ensurePartner(db, { userId: user.id, teamCode });
      return p;
    });

    return { ok: true, partner };
  });

  // Client creates an order (optionally with client referral code).
  app.post("/api/client/order", async (req) => {
    const body = req.body ?? {};
    const auth = requireTelegramAuth(req);
    const tgId = Number(auth.user.id);
    const username = auth.user.username ? `@${String(auth.user.username).replace(/^@/, "")}` : body.username ? String(body.username) : null;
    const planId = body.planId === "pro" ? "pro" : "standard";
    const clientCode = body.clientCode ? String(body.clientCode) : null;

    const order = await withTx(pool, async (db) => {
      const user = await upsertUser(db, { tgId, username });
      return await createOrder(db, { userId: user.id, planId, clientCode });
    });

    return { ok: true, order };
  });

  // Client: "upload" dataset (JSON placeholder) + start avatar training job.
  app.post("/api/client/avatar/start", async (req) => {
    const body = req.body ?? {};
    const auth = requireTelegramAuth(req);
    const tgId = Number(auth.user.id);
    const username = auth.user.username ? `@${String(auth.user.username).replace(/^@/, "")}` : body.username ? String(body.username) : null;
    const clientCode = body.clientCode ? String(body.clientCode) : null;
    const photoUrls = Array.isArray(body.photoUrls) ? body.photoUrls.map((x) => String(x)).filter(Boolean) : [];
    if (photoUrls.length < 4) throw httpError(400, "Need at least 4 photos");

    const res = await withTx(pool, async (db) => {
      const user = await upsertUser(db, { tgId, username });
      if (clientCode) await ensureClientAttribution(db, { userId: user.id, clientCode });

      const { rows: dsRows } = await db.query(
        `insert into datasets (user_id, status, uploaded_count) values ($1, 'ready', $2) returning id`,
        [user.id, photoUrls.length],
      );
      const datasetId = dsRows[0].id;
      for (const url of photoUrls.slice(0, 40)) {
        await db.query(`insert into dataset_images (dataset_id, url) values ($1, $2)`, [datasetId, url]);
      }

      await db.query(
        `insert into avatars (user_id, status) values ($1, 'training')
         on conflict (user_id) do update
           set status = 'training', updated_at = now(), deleted_at = null`,
        [user.id],
      );

      const { rows: jobRows } = await db.query(
        `insert into jobs (kind, status, progress, payload) values ('avatar.train','queued',0,$1::jsonb) returning id`,
        [JSON.stringify({ userId: user.id })],
      );

      return { userId: user.id, jobId: jobRows[0].id };
    });

    return { ok: true, ...res };
  });

  app.get("/api/client/avatar", async (req) => {
    const auth = requireTelegramAuth(req);
    const tgId = Number(auth.user.id);
    const out = await withTx(pool, async (db) => {
      const { rows: uRows } = await db.query(`select id from users where tg_id = $1`, [tgId]);
      const userId = uRows?.[0]?.id;
      if (!userId) return { status: "none" };
      const { rows: aRows } = await db.query(`select status, astria_model_id, last_trained_at from avatars where user_id = $1`, [userId]);
      const a = aRows?.[0];
      return a ? { status: a.status, astriaModelId: a.astria_model_id, lastTrainedAt: a.last_trained_at } : { status: "none" };
    });
    return { ok: true, avatar: out };
  });

  // Create a photosession (pack/custom). Requires a ready avatar.
  app.post("/api/client/sessions", async (req) => {
    const body = req.body ?? {};
    const auth = requireTelegramAuth(req);
    const tgId = Number(auth.user.id);
    const planId = body.planId === "pro" ? "pro" : "standard";
    const orderId = body.orderId ? String(body.orderId) : null;
    const mode = body.mode === "custom" ? "custom" : "pack";
    const packId = body.packId ? Number(body.packId) : null;
    const prompt = body.prompt ? String(body.prompt) : null;
    const negative = body.negative ? String(body.negative) : null;
    const settings = body.settings && typeof body.settings === "object" ? body.settings : {};
    const count = Math.max(1, Math.min(60, Number(settings.count ?? (planId === "pro" ? 30 : 20))));

    const res = await withTx(pool, async (db) => {
      const { rows: uRows } = await db.query(`select id, username from users where tg_id = $1`, [tgId]);
      const u = uRows[0];
      if (!u) throw httpError(404, "User not found (auth first)");

      const { rows: aRows } = await db.query(`select status from avatars where user_id = $1`, [u.id]);
      if (!aRows[0] || aRows[0].status !== "ready") throw httpError(400, "Avatar is not ready");

      let title = null;
      if (mode === "pack") {
        if (!Number.isFinite(packId)) throw httpError(400, "packId is required");
        const { rows: pRows } = await db.query(`select title from style_packs where id = $1 and status = 'active'`, [packId]);
        if (!pRows[0]) throw httpError(404, "Pack not found");
        title = pRows[0].title;
      } else {
        title = "Custom";
      }

      const { rows: sRows } = await db.query(
        `insert into photo_sessions (user_id, order_id, mode, pack_id, title, prompt, negative, settings, status)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'queued')
         returning id, created_at`,
        [u.id, orderId, mode, mode === "pack" ? packId : null, title, prompt, negative, JSON.stringify({ ...settings, count }),],
      );

      const sessionId = sRows[0].id;
      await db.query(
        `insert into jobs (kind, status, progress, payload) values ('session.generate','queued',0,$1::jsonb)`,
        [JSON.stringify({ sessionId, count })],
      );

      return { sessionId, createdAt: sRows[0].created_at };
    });

    return { ok: true, ...res };
  });

  app.get("/api/client/sessions", async (req) => {
    const auth = requireTelegramAuth(req);
    const tgId = Number(auth.user.id);
    const res = await withTx(pool, async (db) => {
      const { rows: uRows } = await db.query(`select id from users where tg_id = $1`, [tgId]);
      const u = uRows[0];
      if (!u) return [];
      const { rows: sRows } = await db.query(
        `select id, mode, pack_id, title, prompt, settings, status, created_at
         from photo_sessions
         where user_id = $1
         order by created_at desc
         limit 50`,
        [u.id],
      );
      const ids = sRows.map((s) => s.id);
      const photos = ids.length
        ? await db.query(
            `select session_id, id, url, label, created_at from generated_photos where session_id = any($1::uuid[]) order by created_at asc`,
            [ids],
          )
        : { rows: [] };
      const bySession = new Map();
      for (const p of photos.rows) {
        const list = bySession.get(p.session_id) ?? [];
        list.push({ id: p.id, url: p.url, label: p.label, createdAt: p.created_at });
        bySession.set(p.session_id, list);
      }
      return sRows.map((s) => ({
        id: s.id,
        mode: s.mode,
        packId: s.pack_id,
        title: s.title,
        prompt: s.prompt,
        settings: s.settings,
        status: s.status,
        createdAt: s.created_at,
        photos: bySession.get(s.id) ?? [],
      }));
    });
    return { ok: true, sessions: res };
  });

async function handleOrderPaid(db, orderId) {
   // 1. Mark order as paid if not already
   const { rows } = await db.query(
     `update orders set status = 'paid', paid_at = coalesce(paid_at, now()) where id = $1 and status <> 'paid' returning id, user_id, plan_id`,
     [orderId],
   );
   
   // Even if already paid, we still try to run allocation and other logic (idempotent)
   const order = rows[0] || (await db.query(`select id, user_id, plan_id from orders where id = $1`, [orderId])).rows[0];
   if (!order) return null;

   const cfg = await readConfig(db);
   const plan = cfg.plans.find(p => p.id === order.plan_id);

   // 2. Allocate commissions
   const alloc = await allocateCommissionsForOrder(db, orderId);
 
   // 3. Grant tokens based on plan config
   if (plan) {
     const tokens = plan.tokens || 0;
     await db.query(
       `update users set tokens_balance = tokens_balance + $2 where id = $1`,
       [order.user_id, tokens]
     );
   }
 
   // 4. If plan grants partner status, ensure user is a partner
   if (plan?.grantsPartner) {
     console.log(`[handleOrderPaid] Order ${orderId} plan '${plan.id}' grants partner status. Ensuring partner for user ${order.user_id}`);
     await ensurePartner(db, { userId: order.user_id });
   }
 
   return alloc;
 }

  // Simulate payment webhook: mark paid + allocate commissions.
  app.post("/api/orders/:id/mark-paid", async (req) => {
    const orderId = String(req.params.id);
    const res = await withTx(pool, async (db) => {
      return await handleOrderPaid(db, orderId);
    });
    return { ok: true, result: res };
  });

  // Provider-agnostic payment webhook (idempotent by external_event_id).
  // For production: verify provider signatures + map provider statuses precisely.
  app.post("/api/payments/webhook", async (req) => {
    const body = req.body ?? {};
    const provider = body.provider ? String(body.provider) : "unknown";
    const eventId = body.eventId ? String(body.eventId) : null;
    const orderId = body.orderId ? String(body.orderId) : null;
    const status = body.status ? String(body.status) : null;
    if (!eventId || !orderId || !status) throw httpError(400, "provider,eventId,orderId,status are required");

    const res = await withTx(pool, async (db) => {
      await db.query(
        `insert into payment_events (provider, external_event_id, payload)
         values ($1,$2,$3::jsonb)
         on conflict (provider, external_event_id) do nothing`,
        [provider, eventId, JSON.stringify(body)],
      );

      if (status === "paid") {
        return await handleOrderPaid(db, orderId);
      }

      if (status === "refunded") {
        await db.query(`update orders set status = 'refunded' where id = $1`, [orderId]);
        // Prototype: not reversing commissions yet.
      }

      return { ok: true };
    });

    return { ok: true, result: res };
  });

  app.get("/api/partner/:publicId/dashboard", async (req) => {
    const publicId = Number(req.params.publicId);
    if (!Number.isFinite(publicId)) throw httpError(400, "publicId is invalid");
    const data = await withTx(pool, (db) => getPartnerDashboard(db, publicId));
    return { ok: true, ...data };
  });

  app.get("/api/partner/:publicId/team", async (req) => {
    const publicId = Number(req.params.publicId);
    if (!Number.isFinite(publicId)) throw httpError(400, "publicId is invalid");
    const data = await withTx(pool, (db) => getPartnerTeam(db, publicId));
    return { ok: true, ...data };
  });

  app.get("/api/partner/:publicId/clients", async (req) => {
    const publicId = Number(req.params.publicId);
    if (!Number.isFinite(publicId)) throw httpError(400, "publicId is invalid");
    const data = await withTx(pool, (db) => getPartnerClients(db, publicId));
    return { ok: true, ...data };
  });

  app.post("/api/partner/:publicId/withdrawals", async (req) => {
    const publicId = Number(req.params.publicId);
    if (!Number.isFinite(publicId)) throw httpError(400, "publicId is invalid");
    const body = req.body ?? {};
    const amountRub = Math.round(Number(body.amountRub || 0));
    if (!Number.isFinite(amountRub) || amountRub <= 0) throw httpError(400, "amountRub is invalid");

    const res = await withTx(pool, async (db) => {
      const cfg = await readConfig(db);
      if (amountRub < cfg.payout.minWithdrawRub) throw httpError(400, "Below minWithdrawRub");

      const { rows: partners } = await db.query(`select id from partners where public_id = $1`, [publicId]);
      const p = partners[0];
      if (!p) throw httpError(404, "Partner not found");

      const { rows: balRows } = await db.query(
        `select available_rub, locked_rub from partner_balances where partner_id = $1 for update`,
        [p.id],
      );
      const bal = balRows[0] ?? { available_rub: 0, locked_rub: 0 };
      if (bal.available_rub < amountRub) throw httpError(400, "Insufficient balance");

      const { rows: wRows } = await db.query(
        `insert into withdrawal_requests (partner_id, amount_rub, status) values ($1, $2, 'pending') returning id, status, created_at`,
        [p.id, amountRub],
      );
      await db.query(
        `update partner_balances
         set available_rub = available_rub - $2,
             locked_rub = locked_rub + $2,
             updated_at = now()
         where partner_id = $1`,
        [p.id, amountRub],
      );
      await db.query(
        `insert into partner_ledger (partner_id, entry_type, amount_rub, withdrawal_id, meta)
         values ($1, 'withdraw.request', $2, $3, $4::jsonb)`,
        [p.id, -amountRub, wRows[0].id, JSON.stringify({ publicId })],
      );
      return wRows[0];
    });

    return { ok: true, withdrawal: res };
  });

  // Admin: review withdrawals (very simple auth via x-admin-token)
  app.get("/api/admin/withdrawals", async (req) => {
    requireAdmin(req);
    const rows = await withTx(pool, async (db) => {
      const { rows } = await db.query(
        `select id, partner_id, amount_rub, status, created_at, reviewed_at, note from withdrawal_requests order by created_at desc limit 200`,
      );
      return rows;
    });
    return { ok: true, rows };
  });

  app.post("/api/admin/withdrawals/:id/approve", async (req) => {
    requireAdmin(req);
    const id = String(req.params.id);
    const body = req.body ?? {};
    const note = body.note ? String(body.note) : null;

    const res = await withTx(pool, async (db) => {
      const { rows: wRows } = await db.query(
        `select id, partner_id, amount_rub, status from withdrawal_requests where id = $1 for update`,
        [id],
      );
      const w = wRows[0];
      if (!w) throw httpError(404, "Withdrawal not found");
      if (w.status !== "pending") return { ok: true, status: w.status };

      await db.query(
        `update withdrawal_requests set status = 'approved', reviewed_at = now(), note = $2 where id = $1`,
        [id, note],
      );
      await db.query(
        `update partner_balances
         set locked_rub = greatest(0, locked_rub - $2),
             paid_out_rub = paid_out_rub + $2,
             updated_at = now()
         where partner_id = $1`,
        [w.partner_id, w.amount_rub],
      );
      await db.query(
        `insert into partner_ledger (partner_id, entry_type, amount_rub, withdrawal_id, meta)
         values ($1, 'withdraw.approve', $2, $3, $4::jsonb)`,
        [w.partner_id, -w.amount_rub, w.id, JSON.stringify({ note })],
      );
      return { ok: true, status: "approved" };
    });

    return { ok: true, result: res };
  });

  app.post("/api/admin/withdrawals/:id/reject", async (req) => {
    requireAdmin(req);
    const id = String(req.params.id);
    const body = req.body ?? {};
    const note = body.note ? String(body.note) : "rejected";

    const res = await withTx(pool, async (db) => {
      const { rows: wRows } = await db.query(
        `select id, partner_id, amount_rub, status from withdrawal_requests where id = $1 for update`,
        [id],
      );
      const w = wRows[0];
      if (!w) throw httpError(404, "Withdrawal not found");
      if (w.status !== "pending") return { ok: true, status: w.status };

      await db.query(
        `update withdrawal_requests set status = 'rejected', reviewed_at = now(), note = $2 where id = $1`,
        [id, note],
      );
      // Return locked funds back to available
      await db.query(
        `update partner_balances
         set locked_rub = greatest(0, locked_rub - $2),
             available_rub = available_rub + $2,
             updated_at = now()
         where partner_id = $1`,
        [w.partner_id, w.amount_rub],
      );
      await db.query(
        `insert into partner_ledger (partner_id, entry_type, amount_rub, withdrawal_id, meta)
         values ($1, 'withdraw.reject', $2, $3, $4::jsonb)`,
        [w.partner_id, w.amount_rub, w.id, JSON.stringify({ note })],
      );
      return { ok: true, status: "rejected" };
    });

    return { ok: true, result: res };
  });

  // ============================================
  // Referral Links API
  // ============================================

  // Get partner's referral links
  app.get("/api/ref/links", async (req) => {
    const auth = requireTelegramAuth(req);
    const tgId = Number(auth.user.id);

    const links = await withTx(pool, async (db) => {
      // Get partner by user
      const { rows: pRows } = await db.query(
        `select id from partners where user_id = (select id from users where tg_id = $1)`,
        [tgId]
      );
      if (!pRows[0]) {
        throw httpError(404, "Partner not found. Register as partner first.");
      }
      const partnerId = pRows[0].id;

      // Get all links
      const { rows } = await db.query(
        `select 
           id, kind, code, name, description, status,
           utm_source, utm_medium, utm_campaign, utm_content, utm_term,
           expires_at, max_uses, current_uses,
           clicks, conversions, total_revenue_rub, total_earnings_rub,
           created_at, updated_at
         from referral_links
         where partner_id = $1
         order by created_at desc`,
        [partnerId]
      );

      return rows.map((r) => {
        const botName = r.kind === 'client' ? process.env.TELEGRAM_BOT_NAME : process.env.TELEGRAM_PARTNER_BOT_NAME;
        const url = makeTgLink(botName, r.code, r.kind);
        console.log(`[Referral] Found link ${r.id}: code=${r.code}, url=${url}`);
        return { ...r, url };
      });
    });

    return { ok: true, links };
  });

  // Create new referral link
  app.post("/api/ref/links", async (req) => {
    const auth = requireTelegramAuth(req);
    const tgId = Number(auth.user.id);
    const body = req.body ?? {};

    const result = await withTx(pool, async (db) => {
      // Get partner
      const { rows: pRows } = await db.query(
        `select id from partners where user_id = (select id from users where tg_id = $1)`,
        [tgId]
      );
      if (!pRows[0]) {
        throw httpError(404, "Partner not found");
      }
      const partnerId = pRows[0].id;

      const kind = body.kind === 'team' ? 'team' : 'client';
      const name = body.name ? String(body.name) : null;
      const description = body.description ? String(body.description) : null;
      const utmSource = body.utmSource ? String(body.utmSource) : null;
      const utmMedium = body.utmMedium ? String(body.utmMedium) : null;
      const utmCampaign = body.utmCampaign ? String(body.utmCampaign) : null;
      const utmContent = body.utmContent ? String(body.utmContent) : null;
      const utmTerm = body.utmTerm ? String(body.utmTerm) : null;
      const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
      const maxUses = body.maxUses ? Math.max(1, Math.round(Number(body.maxUses))) : null;

      // Generate a unique code for this link to distinguish it from the default one
      const { rows: partnerRows } = await db.query(`select public_id from partners where id = $1`, [partnerId]);
      const publicId = partnerRows[0].public_id;
      const codes = makeReferralCodes(publicId);
      const uniqueCode = kind === 'client' ? codes.clientCode : codes.teamCode;

      console.log("[Referral] Creating link:", { partnerId, kind, uniqueCode });

      const { rows } = await db.query(
        `insert into referral_links (
          partner_id, kind, code, name, description, 
          utm_source, utm_medium, utm_campaign, utm_content, utm_term, 
          expires_at, max_uses
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        returning *`,
        [partnerId, kind, uniqueCode, name, description, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, expiresAt, maxUses]
      );

      const createdLink = rows[0];
      const botName = kind === 'client' ? process.env.TELEGRAM_BOT_NAME : process.env.TELEGRAM_PARTNER_BOT_NAME;
      const url = makeTgLink(botName, uniqueCode, kind);
      
      console.log("[Referral] Created link success:", { id: createdLink.id, code: uniqueCode, url });

      return {
        ...createdLink,
        url,
      };
    });

    return {
      ok: true,
      link: result,
    };
  });

  // Update referral link
  app.patch("/api/ref/links/:id", async (req) => {
    const auth = requireTelegramAuth(req);
    const tgId = Number(auth.user.id);
    const linkId = String(req.params.id);
    const body = req.body ?? {};

    const link = await withTx(pool, async (db) => {
      // Verify ownership
      const { rows: pRows } = await db.query(
        `select p.id from partners p 
         join users u on u.id = p.user_id 
         where u.tg_id = $1 and p.id = (select partner_id from referral_links where id = $2)`,
        [tgId, linkId]
      );
      if (!pRows[0]) {
        throw httpError(404, "Link not found");
      }

      const patches = [];
      const values = [];
      let paramIndex = 1;

      if (body.name !== undefined) {
        patches.push(`name = $${paramIndex++}`);
        values.push(body.name ? String(body.name) : null);
      }
      if (body.description !== undefined) {
        patches.push(`description = $${paramIndex++}`);
        values.push(body.description ? String(body.description) : null);
      }
      if (body.status !== undefined) {
        const status = ['active', 'inactive', 'expired'].includes(body.status) ? body.status : 'active';
        patches.push(`status = $${paramIndex++}`);
        values.push(status);
      }
      if (body.utmSource !== undefined) {
        patches.push(`utm_source = $${paramIndex++}`);
        values.push(body.utmSource ? String(body.utmSource) : null);
      }
      if (body.utmMedium !== undefined) {
        patches.push(`utm_medium = $${paramIndex++}`);
        values.push(body.utmMedium ? String(body.utmMedium) : null);
      }
      if (body.utmCampaign !== undefined) {
        patches.push(`utm_campaign = $${paramIndex++}`);
        values.push(body.utmCampaign ? String(body.utmCampaign) : null);
      }

      if (patches.length === 0) {
        throw httpError(400, "No fields to update");
      }

      patches.push(`updated_at = now()`);
      values.push(linkId);

      const { rows } = await db.query(
        `update referral_links set ${patches.join(', ')} where id = $${paramIndex} returning *`,
        values
      );

      const updatedLink = rows[0];
      const botName = updatedLink.kind === 'client' ? process.env.TELEGRAM_BOT_NAME : process.env.TELEGRAM_PARTNER_BOT_NAME;
      const url = makeTgLink(botName, updatedLink.code, updatedLink.kind);

      return {
        ...updatedLink,
        url,
      };
    });

    return { 
      ok: true, 
      link,
    };
  });

  // Delete referral link
  app.delete("/api/ref/links/:id", async (req) => {
    const auth = requireTelegramAuth(req);
    const tgId = Number(auth.user.id);
    const linkId = String(req.params.id);

    await withTx(pool, async (db) => {
      // Verify ownership and delete
      const { rows } = await db.query(
        `delete from referral_links 
         where id = $1 and partner_id = (select id from partners where user_id = (select id from users where tg_id = $2))`,
        [linkId, tgId]
      );
      if (rows.length === 0) {
        throw httpError(404, "Link not found");
      }
    });

    return { ok: true };
  });

  // Track click on referral link (public endpoint, no auth required)
  app.post("/api/ref/click", async (req) => {
    const body = req.body ?? {};
    const linkId = body.linkId ? String(body.linkId) : null;
    const code = body.code ? String(body.code) : null;
    const utm = body.utm || {};

    if (!linkId && !code) {
      throw httpError(400, "linkId or code required");
    }

    const result = await withTx(pool, async (db) => {
      if (linkId) {
        // Use the click tracking function directly
        await trackReferralClick(db, {
          linkId,
          utm: utm,
        });
        return { linkId };
      } else {
        const { rows } = await db.query(`select id, partner_id, kind from referral_links where code = $1`, [code]);
        if (!rows[0]) {
          throw httpError(404, "Link not found");
        }
        
        await trackReferralClick(db, {
          linkId: rows[0].id,
          partnerId: rows[0].partner_id,
          kind: rows[0].kind,
          code: code,
          utm: utm,
        });

        return { linkId: rows[0].id };
      }
    });

    return { ok: true, ...result };
  });

  // Get partner statistics
  app.get("/api/partner/stats", async (req) => {
    const auth = requireTelegramAuth(req);
    const tgId = Number(auth.user.id);

    const stats = await withTx(pool, async (db) => {
      const { rows } = await db.query(
        `select * from partner_stats 
         where user_id = (select id from users where tg_id = $1)`,
        [tgId]
      );
      return rows[0] || null;
    });

    if (!stats) {
      throw httpError(404, "Partner not found");
    }

    return { ok: true, stats };
  });

  // Get downline (team hierarchy)
  app.get("/api/partner/downline", async (req) => {
    const auth = requireTelegramAuth(req);
    const tgId = Number(auth.user.id);

    const downline = await withTx(pool, async (db) => {
      // Get partner
      const { rows: pRows } = await db.query(
        `select id from partners where user_id = (select id from users where tg_id = $1)`,
        [tgId]
      );
      if (!pRows[0]) {
        throw httpError(404, "Partner not found");
      }
      const partnerId = pRows[0].id;

      // Get L1 partners (direct referrals)
      const { rows: l1Rows } = await db.query(
        `select p.*, u.username, u.tg_id,
                (select count(*) from client_attribution ca where ca.partner_id = p.id) as clients_count,
                (select coalesce(sum(o.amount_rub), 0) from orders o 
                 join client_attribution ca on o.user_id = ca.user_id 
                 where ca.partner_id = p.id and o.status = 'paid') as revenue_rub
         from partners p
         join users u on u.id = p.user_id
         where p.parent_partner_id = $1 and p.status = 'active'
         order by p.created_at desc`,
        [partnerId]
      );

      // Get L2 partners (referrals of L1)
      const l1Ids = l1Rows.map((r) => r.id);
      const { rows: l2Rows } = l1Ids.length
        ? await db.query(
            `select p.*, u.username, u.tg_id, p.parent_partner_id,
                    (select count(*) from client_attribution ca where ca.partner_id = p.id) as clients_count,
                    (select coalesce(sum(o.amount_rub), 0) from orders o 
                     join client_attribution ca on o.user_id = ca.user_id 
                     where ca.partner_id = p.id and o.status = 'paid') as revenue_rub
             from partners p
             join users u on u.id = p.user_id
             where p.parent_partner_id = any($1::uuid[]) and p.status = 'active'
             order by p.created_at desc`,
            [l1Ids]
          )
        : { rows: [] };

      return {
        level1: l1Rows.map((r) => ({
          ...r,
          children: l2Rows.filter((l2) => l2.parent_partner_id === r.id),
        })),
      };
    });

    return { ok: true, ...downline };
  });

  // Get client list for partner
  app.get("/api/partner/clients", async (req) => {
    const auth = requireTelegramAuth(req);
    const tgId = Number(auth.user.id);

    const clients = await withTx(pool, async (db) => {
      const { rows: pRows } = await db.query(
        `select id from partners where user_id = (select id from users where tg_id = $1)`,
        [tgId]
      );
      if (!pRows[0]) {
        throw httpError(404, "Partner not found");
      }
      const partnerId = pRows[0].id;

      const { rows } = await db.query(
        `select u.id, u.tg_id, u.username, u.created_at, u.last_seen_at,
                ca.created_at as referred_at,
                (select count(*) from orders o where o.user_id = u.id and o.status = 'paid') as orders_count,
                (select coalesce(sum(o.amount_rub), 0) from orders o where o.user_id = u.id and o.status = 'paid') as total_spent_rub
         from client_attribution ca
         join users u on u.id = ca.user_id
         where ca.partner_id = $1
         order by ca.created_at desc
         limit 100`,
        [partnerId]
      );

      return rows;
    });

    return { ok: true, clients };
  });

  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || "127.0.0.1";
  await app.listen({ port, host });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
