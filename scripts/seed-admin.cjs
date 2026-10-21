require('dotenv').config();

const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const username = process.env.SEED_ADMIN_USERNAME?.trim();
const email = process.env.SEED_ADMIN_EMAIL?.trim();
const password = process.env.SEED_ADMIN_PASSWORD;
const companyId = process.env.SEED_ADMIN_COMPANY_ID?.trim() || null;
const firstName = process.env.SEED_ADMIN_FIRST_NAME?.trim() || null;
const lastName = process.env.SEED_ADMIN_LAST_NAME?.trim() || null;

if (!username || !email || !password) {
  console.error(
    'Set SEED_ADMIN_USERNAME, SEED_ADMIN_EMAIL, and SEED_ADMIN_PASSWORD before running this command.',
  );
  process.exit(1);
}
if (password.length < 12) {
  console.error('SEED_ADMIN_PASSWORD must be at least 12 characters.');
  process.exit(1);
}
if (username.length > 255 || email.length > 255) {
  console.error('Username and email must each be 255 characters or fewer.');
  process.exit(1);
}
if (companyId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(companyId)) {
  console.error('SEED_ADMIN_COMPANY_ID must be a valid UUID when provided.');
  process.exit(1);
}

async function seedAdmin() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  try {
    await client.query('BEGIN');

    const requiredTables = await client.query(
      "SELECT to_regclass('core.users') AS users, to_regclass('core.roles') AS roles, to_regclass('core.user_roles') AS user_roles, to_regclass('core.menus') AS menus, to_regclass('core.role_menus') AS role_menus",
    );
    const tables = requiredTables.rows[0];
    const missing = Object.entries(tables)
      .filter(([, relation]) => relation === null)
      .map(([name]) => name);
    if (missing.length) {
      throw new Error(
        `Required tables are missing: ${missing.join(', ')}. Apply the menu access migration first.`,
      );
    }

    if (companyId) {
      const company = await client.query(
        'SELECT 1 FROM core.companies WHERE company_id = $1',
        [companyId],
      );
      if (company.rowCount !== 1) {
        throw new Error('SEED_ADMIN_COMPANY_ID does not match an existing company.');
      }
    }

    await client.query(
      `INSERT INTO core.roles (role_code, role_name, description)
       VALUES ('ADMIN', 'Administrator', 'Full access to all application menus')
       ON CONFLICT (role_code) DO NOTHING`,
    );

    const roleResult = await client.query(
      "SELECT role_id FROM core.roles WHERE role_code = 'ADMIN' FOR UPDATE",
    );
    if (roleResult.rowCount !== 1) {
      throw new Error('Could not find or create the ADMIN role.');
    }
    const roleId = roleResult.rows[0].role_id;

    const existingUsers = await client.query(
      `SELECT user_id, username, email
       FROM core.users
       WHERE lower(username) = lower($1) OR lower(email) = lower($2)
       FOR UPDATE`,
      [username, email],
    );

    let userId;
    if (existingUsers.rows.length > 1) {
      throw new Error('Username and email match different existing users; resolve the conflict manually.');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    if (existingUsers.rows.length === 1) {
      const existing = existingUsers.rows[0];
      if (
        existing.username.toLowerCase() !== username.toLowerCase() ||
        existing.email.toLowerCase() !== email.toLowerCase()
      ) {
        throw new Error('Username or email conflicts with an existing user; resolve the conflict manually.');
      }
      userId = existing.user_id;
      await client.query(
        `UPDATE core.users
         SET password_hash = $2,
             is_active = TRUE,
             company_id = COALESCE($3::uuid, company_id),
             first_name = COALESCE($4, first_name),
             last_name = COALESCE($5, last_name),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [userId, passwordHash, companyId, firstName, lastName],
      );
    } else {
      const inserted = await client.query(
        `INSERT INTO core.users
           (company_id, username, email, password_hash, first_name, last_name, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING user_id`,
        [companyId, username, email, passwordHash, firstName, lastName],
      );
      userId = inserted.rows[0].user_id;
    }

    await client.query(
      `INSERT INTO core.user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, roleId],
    );

    await client.query(
      `INSERT INTO core.role_menus
         (role_id, menu_id, can_view, can_create, can_edit, can_delete, can_approve)
       SELECT $1, menu_id, TRUE, TRUE, TRUE, TRUE, TRUE
       FROM core.menus
       ON CONFLICT (role_id, menu_id) DO NOTHING`,
      [roleId],
    );

    await client.query('UPDATE core.users SET is_platform_admin=true, auth_version=auth_version+1 WHERE user_id=$1', [userId]);
    await client.query('COMMIT');
    console.log(`Administrator seed complete for username: ${username}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

seedAdmin().catch(error => {
  console.error(`Administrator seed failed: ${error.message}`);
  process.exitCode = 1;
});
