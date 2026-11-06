const envFile =
  process.env.DB_ENV_FILE || '.env';

require('dotenv').config({
  path: envFile,
  quiet: true,
});

const { Client } = require('pg');
const fs = require('node:fs');

const VERSIONS = [
  '20261105_chart_hierarchy',
  '20261105_transaction_account_columns',
];

(async () => {
  const db = new Client({
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl:
      process.env.DB_SSL?.toLowerCase() === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  });
  await db.connect();
  try {
    await db.query('SELECT pg_advisory_lock(20261105)');
    await db.query(
      'CREATE TABLE IF NOT EXISTS core.schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );

    let applied = 0;
    for (const version of VERSIONS) {
      const done = await db.query(
        'SELECT 1 FROM core.schema_migrations WHERE version=$1',
        [version],
      );
      if (done.rowCount) {
        console.log(`= ${version} already applied`);
        continue;
      }
      // The SQL files manage their own transaction.
      await db.query(
        fs.readFileSync('database/migrations/' + version + '.sql', 'utf8'),
      );
      await db.query(
        'INSERT INTO core.schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING',
        [version],
      );
      console.log(`+ ${version}`);
      applied += 1;
    }

    console.log(
      applied
        ? `Chart of accounts migration applied (${applied} version${applied === 1 ? '' : 's'}).`
        : 'Chart of accounts migrations already applied.',
    );
  } finally {
    await db.query('SELECT pg_advisory_unlock(20261105)').catch(() => { });
    await db.end();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
