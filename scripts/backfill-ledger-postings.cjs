// One-off backfill: post the existing customer payments and expenses to the
// ledger exactly the way PaymentsService/ExpensesService now do at create time
// (AUTO::<sourceKey>::<n> history rows, auto doc numbers, running balances).
// Idempotent: skips any transaction whose AUTO:: marker already exists.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');

function toCents(value) {
  const raw = String(value);
  const negative = raw.startsWith('-');
  const [whole, fraction = ''] = raw.replace(/^[+-]/, '').split('.');
  const cents = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  return negative ? -cents : cents;
}

function centsToAmount(cents) {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

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
    const expenses = await db.query(`
      SELECT expense_id, company_id, branch_id, created_by,
             to_char(expense_date, 'YYYY-MM-DD') AS doc_date,
             expense_number, total_amount, expense_account_id, payment_account_id, description
      FROM purchasing.expenses ORDER BY expense_date, created_at
    `);
    const payments = await db.query(`
      SELECT cp.payment_id, cp.company_id, cp.created_by, cp.bank_account_id,
             to_char(cp.payment_date, 'YYYY-MM-DD') AS doc_date,
             cp.payment_number, cp.amount, cp.notes,
             ba.account_id AS bank_gl_account_id, cu.receivable_account_id
      FROM sales.customer_payments cp
      LEFT JOIN banking.bank_accounts ba ON ba.bank_account_id = cp.bank_account_id
      LEFT JOIN sales.customers cu ON cu.customer_id = cp.customer_id
      ORDER BY cp.payment_date, cp.created_at
    `);
    let posted = 0, skipped = 0;
    for (const row of expenses.rows) {
      const lines = [];
      if (toCents(row.total_amount) !== 0n) {
        lines.push({ accountId: row.expense_account_id, debit: row.total_amount, credit: '0.00', remarks: row.description });
        if (row.payment_account_id) {
          lines.push({ accountId: row.payment_account_id, debit: '0.00', credit: row.total_amount, remarks: row.description });
        }
      }
      if (await post(db, 'expense', row, 'PV', lines)) posted++;
      else skipped++;
    }
    for (const row of payments.rows) {
      const lines = [];
      if (toCents(row.amount) !== 0n) {
        if (row.bank_gl_account_id) {
          lines.push({ accountId: row.bank_gl_account_id, debit: row.amount, credit: '0.00', remarks: row.notes });
        }
        if (row.receivable_account_id) {
          lines.push({ accountId: row.receivable_account_id, debit: '0.00', credit: row.amount, remarks: row.notes });
        }
      }
      if (await post(db, 'payment', row, 'RV', lines)) posted++;
      else skipped++;
    }
    await db.query('COMMIT');
    console.log(`Ledger backfill complete: ${posted} posted, ${skipped} already-posted/empty.`);
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Backfill failed, rolled back:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();

async function post(db, kind, row, docType, lines) {
  const sourceKey = `${kind}:${row.expense_id ?? row.payment_id}`;
  const source = 'AUTO::' + sourceKey + '::0';
  if ((await db.query('SELECT 1 FROM ledger.histories WHERE legacy_ref=$1', [source])).rowCount) {
    return false;
  }
  if (lines.length === 0) return false;
  const companyId = row.company_id;
  const refNo = (row.expense_number ?? row.payment_number ?? '').slice(0, 20) || null;
  const docNo = await nextDocNo(db, companyId, docType, row.doc_date);
  const period = row.doc_date.slice(0, 7).replace('-', '');
  const deltas = new Map();
  for (const line of lines) {
    const d = deltas.get(line.accountId) ?? { debit: 0n, credit: 0n, count: 0 };
    d.debit += toCents(line.debit);
    d.credit += toCents(line.credit);
    d.count++;
    deltas.set(line.accountId, d);
  }
  for (const [accountId, d] of deltas) {
    await db.query(
      `INSERT INTO ledger.ledgers
         (company_id, account_id, branch_id, debit_balance, credit_balance, transaction_count, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (company_id, account_id) DO UPDATE SET
         debit_balance = ledger.ledgers.debit_balance + EXCLUDED.debit_balance,
         credit_balance = ledger.ledgers.credit_balance + EXCLUDED.credit_balance,
         transaction_count = ledger.ledgers.transaction_count + EXCLUDED.transaction_count,
         updated_by = EXCLUDED.created_by, updated_at = now()`,
      [companyId, accountId, row.branch_id ?? null, centsToAmount(d.debit), centsToAmount(d.credit), d.count, row.created_by ?? null],
    );
  }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const debit = toCents(line.debit), credit = toCents(line.credit);
    await db.query(
      `INSERT INTO ledger.histories
         (company_id, account_id, branch_id, doc_no, doc_type, ref_no, doc_date, period,
          debit_amount, credit_amount, net_amount, remarks, created_by, legacy_ref)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [companyId, line.accountId, row.branch_id ?? null, docNo, docType, refNo, row.doc_date, period,
       centsToAmount(debit), centsToAmount(credit), centsToAmount(debit - credit), line.remarks ?? null,
       row.created_by ?? null, `AUTO::${sourceKey}::${index}`],
    );
  }
  console.log(`posted ${sourceKey} -> ${docNo} (${lines.length} lines)`);
  return true;
}

async function nextDocNo(db, companyId, docType, docDate) {
  const prefix = `${docType}-${docDate.replaceAll('-', '')}-`;
  const { rows } = await db.query(
    'SELECT doc_no FROM ledger.histories WHERE company_id=$1 AND doc_no LIKE $2',
    [companyId, prefix + '%'],
  );
  let max = 0;
  for (const { doc_no } of rows) {
    const sequence = Number(doc_no.slice(prefix.length));
    if (Number.isInteger(sequence) && sequence > max) max = sequence;
  }
  return prefix + String(max + 1).padStart(4, '0');
}
