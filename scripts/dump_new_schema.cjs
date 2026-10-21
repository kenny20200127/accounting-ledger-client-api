require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

async function dumpNewSchema() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'passme',
    database: process.env.DB_DATABASE || 'accountingdb',
  });

  await client.connect();

  const colsRes = await client.query(`
    SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    ORDER BY table_schema, table_name, ordinal_position
  `);

  const tables = {};
  for (const row of colsRes.rows) {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!tables[key]) tables[key] = [];
    tables[key].push(row);
  }

  let out = 'CURRENT POSTGRESQL SCHEMA (accountingdb):\n\n';
  for (const [t, cols] of Object.entries(tables)) {
    out += `TABLE ${t}:\n`;
    for (const c of cols) {
      out += `  - ${c.column_name} (${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}${c.column_default ? ' DEFAULT ' + c.column_default : ''})\n`;
    }
    out += '\n';
  }

  fs.writeFileSync('new_schema_details.txt', out);
  console.log('Saved new_schema_details.txt');
  await client.end();
}

dumpNewSchema().catch(console.error);
