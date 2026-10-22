// Adds the explicit chart-of-accounts legs that every payment and expense posts with.
//   sales.customer_payments  -> debit_account_id / credit_account_id (+ FKs)
//   purchasing.expenses      -> payment_account_id becomes NOT NULL
// Additive and idempotent; it never rewrites ledger rows. Run the credit backfill
// separately after the contra accounts have been confirmed.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');

const PAYMENTS = 'sales.customer_payments';
const EXPENSES = 'purchasing.expenses';

async function addColumn(db, table, column) {
  const exists = await db.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3`,
    [table.split('.')[0], table.split('.')[1], column],
  );
  if (exists.rowCount) return console.log(`= ${table}.${column} already present`);
  await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} uuid`);
  console.log(`+ ${table}.${column}`);
}

async function addFk(db, table, column, name) {
  const exists = await db.query(
    `SELECT 1 FROM pg_constraint WHERE conname=$1 AND connamespace=(SELECT oid FROM pg_namespace WHERE nspname='sales')`,
    [name],
  );
  if (exists.rowCount) return console.log(`= ${name} already present`);
  await db.query(
    `ALTER TABLE ${table} ADD CONSTRAINT ${name} FOREIGN KEY (${column}) REFERENCES accounting.accounts (account_id) ON DELETE RESTRICT`,
  );
  console.log(`+ ${name}`);
}

(async () => {
  const db = new Client({
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  await db.connect();

  try {
    await db.query('BEGIN');

    await addColumn(db, PAYMENTS, 'debit_account_id');
    await addColumn(db, PAYMENTS, 'credit_account_id');
    await addFk(db, PAYMENTS, 'debit_account_id', 'customer_payments_debit_account_id_fkey');
    await addFk(db, PAYMENTS, 'credit_account_id', 'customer_payments_credit_account_id_fkey');

    // Filling the debit leg from the bank account the payment was already posted against.
    const debit = await db.query(
      `UPDATE sales.customer_payments p
          SET debit_account_id = ba.account_id
         FROM banking.bank_accounts ba
        WHERE ba.bank_account_id = p.bank_account_id
          AND p.debit_account_id IS NULL
          AND p.bank_account_id IS NOT NULL
        RETURNING p.payment_id`,
    );
    console.log(`~ debit_account_id filled from bank mapping: ${debit.rowCount}`);

    const nullCredits = await db.query(
      `SELECT count(*)::int AS n FROM sales.customer_payments WHERE credit_account_id IS NULL`,
    );
    const nullExpenseCredits = await db.query(
      `SELECT count(*)::int AS n FROM ${EXPENSES} WHERE payment_account_id IS NULL`,
    );
    console.log(
      `? payments still missing credit_account_id: ${nullCredits.rows[0].n}`,
    );

    if (nullExpenseCredits.rows[0].n === 0) {
      await db.query(
        `ALTER TABLE ${EXPENSES} ALTER COLUMN payment_account_id SET NOT NULL`,
      );
      console.log(`+ ${EXPENSES}.payment_account_id SET NOT NULL`);
    } else {
      console.log(
        `! skipped NOT NULL on ${EXPENSES}.payment_account_id (${nullExpenseCredits.rows[0].n} rows are NULL)`,
      );
    }

    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('rolled back:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
