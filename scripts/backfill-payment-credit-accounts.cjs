// Repairs customer payments that were auto-posted with only the debit leg
// (the old code derived the credit from customers.receivable_account_id, which
// is empty for some KB01 customers). For each such payment it:
//   1. resolves the chart-of-accounts credit leg (customer receivable, else the
//      same-named postable debtor account in that company),
//   2. stores it on sales.customer_payments.credit_account_id,
//   3. inserts the missing AUTO::payment:<id>::1 history row under the ORIGINAL
//      doc_no/doc_date and adds the credit to ledger.ledgers.
// Dry run by default; pass --apply to write. Idempotent: a payment that already
// has the ::1 history row is skipped.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');

function cents(v) {
  const [whole, fraction = ''] = String(v).split('.');
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
}

function fromCents(c) {
  const sign = c < 0n ? '-' : '';
  const abs = c < 0n ? -c : c;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
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
  console.log(APPLY ? 'APPLYING changes' : 'DRY RUN (pass --apply to write)');

  const rows = (
    await db.query(
      `SELECT p.payment_id, p.payment_number, p.company_id, p.amount,
              p.created_by, to_char(h.doc_date,'YYYY-MM-DD') AS doc_date,
              h.doc_no, h.period, h.branch_id, h.remarks, h.debit_amount,
              c.customer_name, c.receivable_account_id
         FROM sales.customer_payments p
         JOIN ledger.histories h
           ON h.legacy_ref = 'AUTO::payment:' || p.payment_id || '::0'
         JOIN sales.customers c ON c.customer_id = p.customer_id
        WHERE p.credit_account_id IS NULL
        ORDER BY p.payment_number`,
    )
  ).rows;

  for (const row of rows) {
    const already = (
      await db.query(
        `SELECT 1 FROM ledger.histories WHERE legacy_ref=$1`,
        [`AUTO::payment:${row.payment_id}::1`],
      )
    ).rowCount;
    if (already) {
      console.log(`= ${row.payment_number}: credit history already present, linking column only`);
    }

    const candidates = (
      await db.query(
        `SELECT account_id, account_code, account_name, is_header, allow_posting, is_active
           FROM accounting.accounts
          WHERE company_id = $1
            AND (account_id = $2 OR upper(btrim(account_name)) = upper(btrim($3)))
            AND is_header = false AND allow_posting = true AND is_active = true
          ORDER BY (account_id = $2) DESC NULLS LAST, account_code`,
        [row.company_id, row.receivable_account_id, row.customer_name],
      )
    ).rows;

    if (candidates.length !== 1) {
      console.log(
        `! ${row.payment_number} (${row.customer_name}): ${candidates.length} candidate debtor accounts — SKIPPED, pick one manually`,
      );
      if (candidates.length > 1) {
        candidates.forEach((a) => console.log(`   ${a.account_code} ${a.account_name}`));
      }
      continue;
    }

    const acct = candidates[0];
    const debit = cents(row.debit_amount);
    console.log(
      `~ ${row.payment_number}: credit ${acct.account_code} ${acct.account_name} ${fromCents(debit)} under ${row.doc_no} (${row.doc_date})`,
    );

    if (!APPLY) continue;

    await db.query('BEGIN');
    try {
      await db.query(
        `UPDATE sales.customer_payments SET credit_account_id = $1 WHERE payment_id = $2`,
        [acct.account_id, row.payment_id],
      );
      if (!already) {
        await db.query(
          `INSERT INTO ledger.histories
             (company_id, account_id, branch_id, doc_no, doc_type, ref_no, doc_date, period,
              debit_amount, credit_amount, net_amount, remarks, created_by, legacy_ref)
           SELECT $1, $2, $3, $4, doc_type, ref_no, $5, $6, 0, $7, -$7, $8, $9, $10
             FROM ledger.histories WHERE legacy_ref = $11`,
          [
            row.company_id,
            acct.account_id,
            row.branch_id,
            row.doc_no,
            row.doc_date,
            row.period,
            fromCents(debit),
            row.remarks,
            row.created_by,
            `AUTO::payment:${row.payment_id}::1`,
            `AUTO::payment:${row.payment_id}::0`,
          ],
        );
        await db.query(
          `INSERT INTO ledger.ledgers
             (company_id, account_id, branch_id, debit_balance, credit_balance, transaction_count, created_by)
           VALUES ($1, $2, $3, 0, $4, 1, $5)
           ON CONFLICT (company_id, account_id) DO UPDATE SET
             credit_balance = ledger.ledgers.credit_balance + EXCLUDED.credit_balance,
             transaction_count = ledger.ledgers.transaction_count + 1,
             updated_at = now()`,
          [row.company_id, acct.account_id, row.branch_id, fromCents(debit), row.created_by],
        );
      }
      await db.query('COMMIT');
      console.log(`   applied`);
    } catch (error) {
      await db.query('ROLLBACK');
      console.error(`   failed, rolled back: ${error.message}`);
    }
  }

  if (APPLY) {
    const check = (
      await db.query(
        `SELECT to_char(sum(debit_amount),'FM9999999990.00') dr,
                to_char(sum(credit_amount),'FM9999999990.00') cr
           FROM ledger.histories WHERE legacy_ref LIKE 'AUTO::%'`,
      )
    ).rows[0];
    console.log(`AUTO postings now: debit ${check.dr} / credit ${check.cr}`);
  }

  await db.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
