import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'server', 'migrations', '004_referral_links.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Applying 004_referral_links.sql...');
    
    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      try {
        await client.query(statement);
      } catch (err) {
        // Ignore "already exists" errors
        if (err.code === '42P07' || err.code === '42710') {
          console.log('  (already exists, skipping)');
        } else {
          console.error('Error executing statement:', err.message);
          throw err;
        }
      }
    }
    
    // Record migration
    await client.query(`
      INSERT INTO schema_migrations (name) 
      VALUES ('004_referral_links.sql')
      ON CONFLICT (name) DO NOTHING
    `);
    
    console.log('Migration 004 applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

applyMigration().catch(() => process.exit(1));
