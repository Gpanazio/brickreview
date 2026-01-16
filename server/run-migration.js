import fs from 'fs';
import path from 'path';
import pool from './db.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration(migrationFile) {
  try {
    console.log(`\n🔄 Running migration: ${migrationFile}`);

    const migrationPath = path.join(__dirname, 'migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(sql);

    console.log(`✅ Migration ${migrationFile} completed successfully\n`);
  } catch (error) {
    console.error(`❌ Migration failed:`, error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node run-migration.js <migration-file>');
  process.exit(1);
}

runMigration(migrationFile);
