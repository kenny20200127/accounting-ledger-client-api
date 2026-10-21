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
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(20261019)');
    await db.query(
      'CREATE TABLE IF NOT EXISTS core.schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const version = '20261019_create_error_logs';
    if (
      (
        await db.query('SELECT 1 FROM core.schema_migrations WHERE version=$1', [
          version,
        ])
      ).rowCount
    ) {
      await db.query('COMMIT');
      console.log('Error log migration already applied.');
      return;
    }
    await db.query(
      fs.readFileSync('database/migrations/' + version + '.sql', 'utf8'),
    );
    await db.query('INSERT INTO core.schema_migrations(version) VALUES($1)', [
      version,
    ]);
    await db.query('COMMIT');
    console.log('Error log migration applied.');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    await db.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
