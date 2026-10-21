require('dotenv').config({ quiet: true });
const { spawnSync } = require('node:child_process');
const result = spawnSync('python', ['scripts/migrate_old_account.py', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
