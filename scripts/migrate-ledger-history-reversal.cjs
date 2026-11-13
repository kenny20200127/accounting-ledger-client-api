require('dotenv').config({
  path: process.env.DB_ENV_FILE || '.env',
  quiet: true,
});

const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const db = new Client({
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: process.env.DB_SSL?.toLowerCase() === 'true'
      ? { rejectUnauthorized: false }
      : undefined,
  });
  await db.connect();
  try {
    await db.query(fs.readFileSync(path.join(
      __dirname, '../database/migrations/20261113_ledger_history_reversal.sql',
    ), 'utf8'));
    console.log('Ledger history reversal migration applied.');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
