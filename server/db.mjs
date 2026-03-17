import pg from "pg";

const { Pool } = pg;

export function makePool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }
  return new Pool({ connectionString });
}

export async function withTx(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const res = await fn(client);
    await client.query("commit");
    return res;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      // ignore
    }
    throw err;
  } finally {
    client.release();
  }
}

