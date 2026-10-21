require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const fs = require('node:fs');
(async () => {
  const db = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  await db.connect();
  try {
    const version = '20261020_legacy_data_tables';
    await db.query(
      'CREATE TABLE IF NOT EXISTS core.schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    if (
      (await db.query('SELECT 1 FROM core.schema_migrations WHERE version=$1', [version])).rowCount
    ) {
      console.log('Legacy data-table migration already applied.');
      return;
    }
    // The SQL file manages its own BEGIN/COMMIT.
    await db.query(fs.readFileSync('database/migrations/' + version + '.sql', 'utf8'));
    await db.query('INSERT INTO core.schema_migrations(version) VALUES($1)', [version]);
    console.log('Legacy data-table migration applied.');
  } finally {
    await db.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
