require('dotenv').config();
const { Client } = require('pg');

async function inspect() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'passme',
    database: process.env.DB_DATABASE || 'accountingdb',
  });

  await client.connect();
  const res = await client.query(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog') 
    ORDER BY table_schema, table_name
  `);
  
  console.log(`Found ${res.rows.length} tables in PostgreSQL:`);
  for (const r of res.rows) {
    const cnt = await client.query(`SELECT count(*) FROM "${r.table_schema}"."${r.table_name}"`);
    console.log(`${r.table_schema}.${r.table_name}: ${cnt.rows[0].count}`);
  }
  await client.end();
}

inspect().catch(console.error);
