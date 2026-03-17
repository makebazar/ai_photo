import { makePool, withTx } from "./db.mjs";
import { ensureConfigRow } from "./config.mjs";
import { ensureSeedData } from "./seed.mjs";
import { runOneJob } from "./jobs.mjs";

const pool = makePool();
const workerId = process.env.WORKER_ID || `worker_${Math.random().toString(16).slice(2)}`;

async function bootstrap() {
  await withTx(pool, async (db) => {
    await ensureConfigRow(db);
    await ensureSeedData(db);
  });
}

async function loop() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
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

