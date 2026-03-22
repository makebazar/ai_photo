import { allocateCommissionsForOrder, unlockCommissions } from "./mlm.mjs";
import { createPrompt, createTuneFromImages, isAstriaEnabled, waitForPrompt } from "./astria.mjs";
import { readConfig } from "./config.mjs";
import fs from "node:fs";
import path from "node:path";

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
    } else if (job.kind === "mlm.unlock_commissions") {
      await handleUnlockCommissions(db, job);
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
  const cfg = await readConfig(db);
  const astriaCfg = cfg?.astria ?? {};

  const { rows: userRows } = await db.query(`select username from users where id = $1`, [userId]);
  const username = userRows?.[0]?.username ? String(userRows[0].username).replace(/^@/, "") : "person";
  const token = astriaCfg.tokenPrefix || process.env.ASTRIA_TOKEN || "ohwx";
  const tuneTitle = `${username}-${String(userId).slice(0, 8)}-${Date.now()}`;

  const { rows: dsRows } = await db.query(
    `select d.id
     from datasets d
     where d.user_id = $1
     order by d.created_at desc
     limit 1`,
    [userId],
  );
  const datasetId = dsRows?.[0]?.id;
  if (!datasetId) throw new Error("avatar.train: dataset not found");

  const { rows: imageRows } = await db.query(
    `select url
     from dataset_images
     where dataset_id = $1
     order by created_at asc`,
    [datasetId],
  );
  const images = imageRows.map((r) => String(r.url)).filter(Boolean);
  if (images.length < 4) throw new Error("avatar.train: at least 4 images required");

  let astriaModelId = `astria_model_${String(job.id).slice(0, 8)}`;
  if (isAstriaEnabled()) {
    const tune = await createTuneFromImages({
      title: tuneTitle,
      name: astriaCfg.className || process.env.ASTRIA_CLASS_NAME || "person",
      token,
      images: images.slice(0, 30),
      callback: astriaCfg.tuneCallbackUrl || process.env.ASTRIA_TUNE_CALLBACK_URL || undefined,
      tuneBaseId: astriaCfg.tuneBaseId,
      modelType: astriaCfg.modelType,
      trainPreset: astriaCfg.trainPreset,
    });
    if (!tune?.id) throw new Error("Astria create tune returned no id");
    astriaModelId = String(tune.id);
  }

  await db.query(
    `insert into avatars (user_id, status, astria_model_id, last_trained_at)
     values ($1, $2, $3, $4)
     on conflict (user_id) do update
       set status = excluded.status,
           astria_model_id = excluded.astria_model_id,
           last_trained_at = excluded.last_trained_at,
           updated_at = now(),
           deleted_at = null`,
    [
      userId,
      isAstriaEnabled() ? "training" : "ready",
      astriaModelId,
      isAstriaEnabled() ? null : new Date().toISOString(),
    ],
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
  const cfg = await readConfig(db);
  const astriaCfg = cfg?.astria ?? {};

  await db.query(`update photo_sessions set status = 'generating', updated_at = now() where id = $1`, [sessionId]);

  const { rows: sessionRows } = await db.query(
    `select s.id, s.mode, s.title, s.prompt, s.negative, s.settings, s.user_id, p.title as pack_title, a.astria_model_id
     from photo_sessions s
     left join style_packs p on p.id = s.pack_id
     left join avatars a on a.user_id = s.user_id
     where s.id = $1`,
    [sessionId],
  );
  const session = sessionRows?.[0];
  if (!session) throw new Error("session.generate: session not found");

  if (!isAstriaEnabled()) {
    for (let i = 0; i < count; i += 1) {
      await db.query(
        `insert into generated_photos (session_id, url, label) values ($1, $2, $3)`,
        [sessionId, pick(UNSPLASH, i), `Result ${i + 1}`],
      );
    }
    await db.query(`update photo_sessions set status = 'done', updated_at = now() where id = $1`, [sessionId]);
  } else {
    const tuneId = session.astria_model_id ? Number(session.astria_model_id) : null;
    if (!Number.isFinite(tuneId)) {
      for (let i = 0; i < count; i += 1) {
        await db.query(
          `insert into generated_photos (session_id, url, label) values ($1, $2, $3)`,
          [sessionId, pick(UNSPLASH, i), `Result ${i + 1}`],
        );
      }
      await db.query(`update photo_sessions set status = 'done', updated_at = now() where id = $1`, [sessionId]);
      return;
    }
    const settings = session.settings && typeof session.settings === "object" ? session.settings : {};
    const promptText =
      session.mode === "custom" && session.prompt
        ? String(session.prompt)
        : `portrait photo of ${astriaCfg.tokenPrefix || process.env.ASTRIA_TOKEN || "ohwx"} ${session.pack_title || session.title || "person"}, studio quality, photorealistic`;

    const prompt = await createPrompt({
      tuneId,
      text: promptText,
      negativePrompt: session.negative || undefined,
      numImages: count,
      callback: astriaCfg.promptCallbackUrl || process.env.ASTRIA_PROMPT_CALLBACK_URL || undefined,
      cfgScale: settings.cfgScale,
      steps: settings.steps,
      aspectRatio: settings.aspectRatio,
      superResolution: settings.enhance,
      faceCorrect: settings.faceFix,
    });
    if (!prompt?.id) throw new Error("Astria create prompt returned no id");

    const mergedSettings = { ...settings, astriaPromptId: String(prompt.id) };
    await db.query(
      `update photo_sessions
       set settings = $2::jsonb,
           updated_at = now()
       where id = $1`,
      [sessionId, JSON.stringify(mergedSettings)],
    );

    const ready = await waitForPrompt(prompt.id, {
      timeoutMs: Number(astriaCfg.promptTimeoutMs || process.env.ASTRIA_PROMPT_TIMEOUT_MS || 8 * 60 * 1000),
      pollMs: Number(astriaCfg.promptPollMs || process.env.ASTRIA_PROMPT_POLL_MS || 5000),
    });
    if (ready.status !== "ready" || !ready.images.length) {
      await db.query(`update photo_sessions set status = 'failed', updated_at = now() where id = $1`, [sessionId]);
      throw new Error(`Astria prompt ${prompt.id} failed with status ${ready.status}`);
    }

    await db.query(`delete from generated_photos where session_id = $1`, [sessionId]);
    const storageDir = path.join(process.cwd(), "storage");
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

    let i = 0;
    for (const url of ready.images.slice(0, count)) {
      let finalUrl = url;

      // Download to local storage to persist beyond Astria's 30-day retention
      try {
        const res = await fetch(url);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          const filename = `session_${sessionId}_${i}_${Date.now()}.jpg`;
          fs.writeFileSync(path.join(storageDir, filename), buffer);
          finalUrl = `/storage/${filename}`;
        }
      } catch (err) {
        console.error("[Storage] Failed to download image from Astria:", err);
        // Fallback to original S3 URL if download fails
      }

      await db.query(`insert into generated_photos (session_id, url, label) values ($1, $2, $3)`, [
        sessionId,
        finalUrl,
        `Result ${i + 1}`,
      ]);
      i += 1;
    }
    await db.query(`update photo_sessions set status = 'done', updated_at = now() where id = $1`, [sessionId]);
  }

  // If session is tied to a paid order, ensure commissions exist (idempotent).
  const { rows } = await db.query(`select order_id from photo_sessions where id = $1`, [sessionId]);
  const orderId = rows?.[0]?.order_id ?? null;
  if (orderId) await allocateCommissionsForOrder(db, orderId);
}

export async function handleUnlockCommissions(db, job) {
  const count = await unlockCommissions(db);
  if (count > 0) console.log(`[MLM] Unlocked ${count} commissions`);
}
