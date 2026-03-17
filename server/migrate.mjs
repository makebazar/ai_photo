import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

const MIGRATIONS_DIR = path.join(process.cwd(), "server", "migrations");

async function ensureTable(db) {
  await db.query(`
    create table if not exists schema_migrations (
      id bigserial primary key,
      name text not null unique,
      applied_at timestamptz not null default now()
    )
  `);
}

async function listMigrations() {
  const items = await fs.readdir(MIGRATIONS_DIR);
  return items.filter((x) => x.endsWith(".sql")).sort();
}

async function applyMigration(db, name) {
  const sql = await fs.readFile(path.join(MIGRATIONS_DIR, name), "utf8");
  await db.query("begin");
  try {
    await db.query(sql);
    await db.query("insert into schema_migrations (name) values ($1) on conflict (name) do nothing", [name]);
    await db.query("commit");
  } catch (err) {
    await db.query("rollback");
    throw err;
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const db = new Client({ connectionString });
  await db.connect();
  try {
    await ensureTable(db);
    const { rows } = await db.query("select name from schema_migrations");
    const applied = new Set(rows.map((r) => r.name));
    const all = await listMigrations();

    for (const name of all) {
      if (applied.has(name)) continue;
      console.log(`Applying ${name}...`);
      await applyMigration(db, name);
    }

    console.log("Migrations complete.");
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

