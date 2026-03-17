import { allocateCommissionsForOrder } from "./mlm.mjs";

// Minimal job runner for prototype: simulates training/generation.
// For production: move this into a separate worker process + queue (BullMQ, etc.).

const UNSPLASH = [
  "https://images.unsplash.com/photo-1520975890222-44e8c7c7f8ad?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1520975682033-99c39b983d67?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1520976070912-2d95f7b4b3c6?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1520975867597-0b2a283b9c1d?auto=format&fit=crop&w=1200&q=80",
];

function pick(list, i) {
  if (!list.length) return null;
  return list[i % list.length];
}

export async function claimJob(db, workerId) {
  const { rows } = await db.query(
    `
    select id, kind, payload, attempts
    from jobs
    where status = 'queued'
    order by created_at asc
    for update skip locked
    limit 1
    `,
  );
  const job = rows[0];
  if (!job) return null;

  await db.query(
    `update jobs
     set status = 'running', locked_at = now(), locked_by = $2, attempts = attempts + 1, updated_at = now()
     where id = $1`,
    [job.id, workerId],
  );
  return job;
}

export async function runOneJob(db, workerId) {
  const job = await claimJob(db, workerId);
  if (!job) return { ok: true, ran: false };

  try {
    if (job.kind === "avatar.train") {
      await handleAvatarTrain(db, job);
    } else if (job.kind === "session.generate") {
      await handleSessionGenerate(db, job);
    } else {
      throw new Error(`unknown job kind: ${job.kind}`);
    }

    await db.query(`update jobs set status = 'done', progress = 100, updated_at = now() where id = $1`, [job.id]);
    return { ok: true, ran: true };
  } catch (err) {
    await db.query(
      `update jobs set status = 'failed', last_error = $2, updated_at = now() where id = $1`,
      [job.id, String(err?.message ?? err)],
    );
    return { ok: false, ran: true, error: String(err?.message ?? err) };
  }
}

async function handleAvatarTrain(db, job) {
  const userId = job.payload?.userId;
  if (!userId) throw new Error("avatar.train: payload.userId required");

  const astriaModelId = `astria_model_${String(job.id).slice(0, 8)}`;

  await db.query(
    `insert into avatars (user_id, status, astria_model_id, last_trained_at)
     values ($1, 'ready', $2, now())
     on conflict (user_id) do update
       set status = 'ready',
           astria_model_id = excluded.astria_model_id,
           last_trained_at = now(),
           updated_at = now(),
           deleted_at = null`,
    [userId, astriaModelId],
  );

  await db.query(
    `update datasets set status = 'ready', updated_at = now()
     where user_id = $1 and status <> 'ready'`,
    [userId],
  );
}

async function handleSessionGenerate(db, job) {
  const sessionId = job.payload?.sessionId;
  const count = Math.max(1, Math.min(60, Number(job.payload?.count ?? 20)));
  if (!sessionId) throw new Error("session.generate: payload.sessionId required");

  await db.query(`update photo_sessions set status = 'generating', updated_at = now() where id = $1`, [sessionId]);

  // Simulated results
  for (let i = 0; i < count; i += 1) {
    await db.query(
      `insert into generated_photos (session_id, url, label) values ($1, $2, $3)`,
      [sessionId, pick(UNSPLASH, i), `Result ${i + 1}`],
    );
  }

  await db.query(`update photo_sessions set status = 'done', updated_at = now() where id = $1`, [sessionId]);

  // If session is tied to a paid order, ensure commissions exist (idempotent).
  const { rows } = await db.query(`select order_id from photo_sessions where id = $1`, [sessionId]);
  const orderId = rows?.[0]?.order_id ?? null;
  if (orderId) await allocateCommissionsForOrder(db, orderId);
}

