require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
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
    await db.query('SELECT pg_advisory_xact_lock(20261014)');
    await db.query(
      'CREATE TABLE IF NOT EXISTS core.schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const migrations = [
      '20261014_company_tenancy',
      '20261014_existing_company_roles',
      '20261014_user_deletion',
    ];
    const pending = [];
    for (const version of migrations)
      if (
        !(
          await db.query(
            'SELECT 1 FROM core.schema_migrations WHERE version=$1',
            [version],
          )
        ).rowCount
      )
        pending.push(version);
    if (!pending.length) {
      await db.query('COMMIT');
      console.log('Company administration migrations already applied.');
      return;
    }
    const backup = {};
    for (const table of [
      'companies',
      'users',
      'roles',
      'user_roles',
      'menus',
      'role_menus',
    ])
      backup[table] = (await db.query('SELECT * FROM core.' + table)).rows;
    fs.mkdirSync('database/backups', { recursive: true });
    fs.writeFileSync(
      path.join('database/backups', 'tenancy-' + Date.now() + '.json'),
      JSON.stringify(backup),
    );
    for (const version of pending) {
      await db.query(
        fs.readFileSync('database/migrations/' + version + '.sql', 'utf8'),
      );
      await db.query('INSERT INTO core.schema_migrations(version) VALUES($1)', [
        version,
      ]);
    }
    await db.query('COMMIT');
    console.log(
      'Company tenancy migration applied; existing core records backed up.',
    );
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
