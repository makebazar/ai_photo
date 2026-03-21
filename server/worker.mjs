import { makePool, withTx } from "./db.mjs";
import { ensureConfigRow } from "./config.mjs";
import { ensureSeedData } from "./seed.mjs";
import { runOneJob, handleUnlockCommissions } from "./jobs.mjs";

const pool = makePool();
const workerId = process.env.WORKER_ID || `worker_${Math.random().toString(16).slice(2)}`;

async function bootstrap() {
  await withTx(pool, async (db) => {
    await ensureConfigRow(db);
    await ensureSeedData(db);
  });
}

async function loop() {
  // periodic tasks
  let lastUnlockAt = 0;
  const UNLOCK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const now = Date.now();
    if (now - lastUnlockAt > UNLOCK_INTERVAL_MS) {
      console.log("[Worker] Running periodic unlock...");
      try {
        await withTx(pool, (db) => handleUnlockCommissions(db, {}));
        lastUnlockAt = now;
      } catch (err) {
        console.error("[Worker] Unlock error:", err);
      }
    }

    const res = await withTx(pool, (db) => runOneJob(db, workerId));
    if (!res.ran) {
      await new Promise((r) => setTimeout(r, 750));
    }
  }
}

bootstrap()
  .then(loop)
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

