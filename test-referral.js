const API_BASE = process.env.API_BASE || "http://localhost:3000";

async function api(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Auth": "1",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`${endpoint} -> ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

function expectEqual(name, got, expected) {
  if (got !== expected) {
    throw new Error(`${name}: expected ${expected}, got ${got}`);
  }
}

async function paidOrderAndReadCommissions(orderId) {
  await api(`/api/orders/${orderId}/mark-paid`, { method: "POST", body: JSON.stringify({}) });
  const orders = await api("/api/admin/orders");
  const row = (orders.orders || []).find((o) => o.id === orderId);
  if (!row) throw new Error(`Order ${orderId} not found in admin orders`);
  const chain = (row.commission_chain || []).slice().sort((a, b) => a.level - b.level);
  return chain;
}

function amountByLevel(chain, level) {
  const row = chain.find((x) => x.level === level);
  return row ? Number(row.amount) : 0;
}

function hasLevel(chain, level) {
  return chain.some((x) => x.level === level);
}

async function createUser(tgId, username) {
  const res = await api("/api/debug/create-user", {
    method: "POST",
    body: JSON.stringify({ tgId, username }),
  });
  return res.user;
}

async function createPartner(tgId, username, teamCode = null) {
  const res = await api("/api/debug/create-partner", {
    method: "POST",
    body: JSON.stringify({ tgId, username, teamCode }),
  });
  return res;
}

async function createOrder(tgId, username, planId, clientCode) {
  const body = { tgId, username, planId };
  if (clientCode) body.clientCode = clientCode;
  const res = await api("/api/client/order", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.order;
}

async function run() {
  console.log(`API_BASE=${API_BASE}`);
  try {
    await api("/api/debug/reset-all", { method: "POST", body: JSON.stringify({}) });
  } catch {
  }

  const rootUser = await createUser(900001001, "root_owner");
  const root = await createPartner(rootUser.tg_id, rootUser.username);
  const rootPartner = root.partner;

  const cfgRes = await api("/api/admin/config");
  const cfg = cfgRes.config;
  cfg.mlm = cfg.mlm || {};
  cfg.mlm.ownerPartnerId = rootPartner.id;
  await api("/api/admin/config", {
    method: "PUT",
    body: JSON.stringify({ patch: { mlm: cfg.mlm } }),
  });

  const partnerUser = await createUser(900001002, "partner_a");
  const partner = await createPartner(partnerUser.tg_id, partnerUser.username, rootPartner.team_code);

  const scenarioResults = [];

  {
    const buyer = await createUser(900001101, "buyer_direct_code");
    const order = await createOrder(buyer.tg_id, buyer.username, "standard", rootPartner.client_code);
    const chain = await paidOrderAndReadCommissions(order.id);
    expectEqual("S1 level0 20%", amountByLevel(chain, 0), 100);
    expectEqual("S1 level1 10%", amountByLevel(chain, 1), 50);
    scenarioResults.push({ scenario: "S1 owner direct by clientCode", chain });
  }

  {
    const buyer = await createUser(900001102, "buyer_click_then_order");
    await api("/api/ref/click", {
      method: "POST",
      body: JSON.stringify({ code: rootPartner.client_code, tgId: buyer.tg_id, username: buyer.username }),
    });
    const order = await createOrder(buyer.tg_id, buyer.username, "standard");
    const chain = await paidOrderAndReadCommissions(order.id);
    expectEqual("S2 level0 20%", amountByLevel(chain, 0), 100);
    expectEqual("S2 level1 10%", amountByLevel(chain, 1), 50);
    scenarioResults.push({ scenario: "S2 click then order without clientCode", chain });
  }

  {
    const clientOfPartner = await createUser(900001103, "client_of_partner");
    await createOrder(clientOfPartner.tg_id, clientOfPartner.username, "standard", partner.partner.client_code);
    const friend = await createUser(900001104, "friend_from_client");
    await api("/api/ref/click", {
      method: "POST",
      body: JSON.stringify({ code: clientOfPartner.personal_ref_code, tgId: friend.tg_id, username: friend.username }),
    });
    const order = await createOrder(friend.tg_id, friend.username, "standard");
    const chain = await paidOrderAndReadCommissions(order.id);
    expectEqual("S3 level0 pass-up to partner 20%", amountByLevel(chain, 0), 100);
    expectEqual("S3 level1 pass-up to partner 10%", amountByLevel(chain, 1), 50);
    scenarioResults.push({ scenario: "S3 client(non-partner) refers friend (pass-up)", chain });
  }

  {
    const buyer = await createUser(900001105, "buyer_partner_direct");
    const order = await createOrder(buyer.tg_id, buyer.username, "standard", partner.partner.client_code);
    const chain = await paidOrderAndReadCommissions(order.id);
    expectEqual("S4 level0 partner 20%", amountByLevel(chain, 0), 100);
    expectEqual("S4 level1 upline 10%", amountByLevel(chain, 1), 50);
    scenarioResults.push({ scenario: "S4 regular partner direct referral", chain });
  }

  {
    const buyer = await createUser(900001106, "buyer_no_ref");
    const order = await createOrder(buyer.tg_id, buyer.username, "standard");
    const chain = await paidOrderAndReadCommissions(order.id);
    if (hasLevel(chain, 0)) throw new Error("S5 no-ref should not have level 0");
    expectEqual("S5 only owner level1", amountByLevel(chain, 1), 50);
    scenarioResults.push({ scenario: "S5 no referral", chain });
  }

  console.log("\nSCENARIO RESULTS");
  for (const r of scenarioResults) {
    console.log(`- ${r.scenario}`);
    for (const c of r.chain) {
      console.log(`  L${c.level}: ${c.amount}₽ (${c.percent}%) @${c.username}`);
    }
  }
  console.log("\nALL SCENARIOS PASSED");
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
