// Port KB01 legacy data from the SQL Server dump (OldDatascript.sql) into the
// live Postgres schema:
//   acchistory  -> ledger.histories (+ legacy_migration_records)
//   accledger   -> ledger.ledgers + ledger.monthly_balances
//   accbalsheet -> accounting.statement_groups
//   accchart    -> accounting.accounts (name refresh only; codes all exist)
// JV/PCV/RCT headers+details were imported earlier as journal entries; the
// accbank/accbudget tables have no rows in the dump (masters created empty).
// Re-runnable: deletes its own previously imported rows (legacy_ref tags) and
// recomputes ledger.ledgers absolutely (legacy value + live UI postings).
'use strict';
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const { rows } = require('./legacy-sql-parser.cjs');

const DUMP = process.argv[2] || 'tmp/OldDatascript-utf8.sql';
const COMPANY_CODE = 'KB01';
const LEGACY_BRANCH_CODE = '4';
const CURRENT_YEAR = 2025; // accledger monthNN buckets; history periods are all 2025.

const DOC_TYPE_MAP = { JV: 'JV', PC: 'PV', RC: 'RV' };

function ymd(d) {
  // 'YYYYMMDD' -> 'YYYY-MM-DD'
  return d && d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : null;
}
function normUnit(u) {
  const t = (u || '').trim();
  return !t || /^0+$/.test(t) ? null : t;
}
function num(v) {
  return v == null || v === '' ? '0' : String(v);
}
function round2(v) {
  return (Math.round(Number(v) * 100) / 100).toFixed(2);
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

  const company = await db.query('SELECT company_id FROM core.companies WHERE company_code=$1', [COMPANY_CODE]);
  if (!company.rowCount) throw new Error(`company ${COMPANY_CODE} not found`);
  const companyId = company.rows[0].company_id;
  const branch = await db.query('SELECT branch_id FROM core.branches WHERE company_id=$1 AND branch_code=$2', [companyId, LEGACY_BRANCH_CODE]);
  const branchId = branch.rowCount ? branch.rows[0].branch_id : null;

  const accountRows = await db.query('SELECT account_id, account_code FROM accounting.accounts WHERE company_id=$1', [companyId]);
  const accountByCode = new Map(accountRows.rows.map((a) => [a.account_code, a.account_id]));
  const codeByAccount = new Map(accountRows.rows.map((a) => [a.account_id, a.account_code]));

  // ---- Parse the dump -----------------------------------------------------
  const histories = [];
  const skipRecords = [];
  const histCountByAcct = new Map();
  const ledgerAgg = new Map(); // acct -> {opening,debit,credit,budget,prv1,prv2,months:{m:amount}}
  const statementGroups = [];
  const chartNames = [];
  let skippedHistoryNoAcct = 0;
  let skippedLedgerNoAcct = 0;

  for (const { table, row } of rows(DUMP)) {
    if (table === 'acchistory') {
      const acct = row.his_accnumber;
      if (!acct) { skippedHistoryNoAcct++; continue; }
      const accountId = accountByCode.get(acct);
      if (!accountId) { skippedHistoryNoAcct++; continue; }
      const docDate = ymd(row.his_trandate) || ymd((row.his_period || '') + '01');
      if (!docDate) { skippedHistoryNoAcct++; continue; }
      const period = (row.his_period && row.his_period.length === 6 && row.his_period !== '0')
        ? row.his_period
        : docDate.slice(0, 7).replace('-', '');
      const debit = num(row.his_dbamount);
      const credit = num(row.his_cramount);
      const net = row.his_net != null ? num(row.his_net) : round2(Number(debit) - Number(credit));
      const legacyRef = `OLD::acchistory::${acct}::${row.his_docnumber}::${row.his_type}::${(row.unitcode || '').trim()}::${(row.his_source || '').trim()}`;
      if (Number(debit) === 0 && Number(credit) === 0 && Number(net) === 0) {
        // Legacy month-end carry-forward rows with no movement: their balance
        // lives in accledger/ledger.ledgers, so keep them out of the posting
        // history but leave a migration record for traceability.
        skipRecords.push([legacyRef, row]);
        continue;
      }
      histories.push({
        accountId,
        docNo: row.his_docnumber,
        docType: DOC_TYPE_MAP[row.his_type] || row.his_type,
        refNo: (row.his_refnumber || '').trim() || null,
        docDate,
        period,
        debit,
        credit,
        net,
        remarks: (row.his_rem || '').trim() || null,
        unitCode: normUnit(row.unitcode),
        createdAt: row.datecreated || null,
        legacyRef,
        source: row,
      });
      histCountByAcct.set(acct, (histCountByAcct.get(acct) || 0) + 1);
    } else if (table === 'accledger') {
      const acct = row.acctnumber;
      if (!acct || !accountByCode.has(acct)) { skippedLedgerNoAcct++; continue; }
      const agg = ledgerAgg.get(acct) || { opening: 0, debit: 0, credit: 0, budget: 0, prv1: 0, prv2: 0, months: {} };
      agg.opening += Number(row.openbalance || 0);
      agg.debit += Number(row.debitbalance || 0);
      agg.credit += Number(row.creditbalance || 0);
      agg.budget += Number(row.budgetfigure || 0);
      agg.prv1 += Number(row.prvyearfig || 0);
      agg.prv2 += Number(row.prvyearfig2 || 0);
      for (let m = 1; m <= 12; m++) {
        const v = Number(row['month' + String(m).padStart(2, '0')] || 0);
        if (v !== 0) agg.months[m] = round2(Number(agg.months[m] || 0) + v);
      }
      ledgerAgg.set(acct, agg);
    } else if (table === 'accbalsheet') {
      statementGroups.push({
        groupCode: row.balcode,
        accountCode: row.acctnumber,
        groupName: (row.baldesc || '').trim() || null,
        accountRange: (row.balrange || '').trim() || null,
      });
    } else if (table === 'accchart') {
      chartNames.push({ code: row.acctnumber, name: (row.description || '').trim() });
    }
  }

  // ---- Load in one transaction ---------------------------------------------
  await db.query('BEGIN');
  try {
    await db.query(
      `DELETE FROM ledger.histories WHERE company_id=$1 AND legacy_ref LIKE 'OLD::acchistory::%'`,
      [companyId],
    );
    await db.query(
      `DELETE FROM ledger.monthly_balances WHERE company_id=$1 AND legacy_ref LIKE 'OLD::accledger::%'`,
      [companyId],
    );
    await db.query('DELETE FROM accounting.statement_groups WHERE company_id=$1', [companyId]);
    await db.query(
      `DELETE FROM accounting.legacy_migration_records WHERE company_id=$1 AND source_table='acchistory'`,
      [companyId],
    );

    const CHUNK = 1000;
    let insertedHistories = 0;
    for (let i = 0; i < histories.length; i += CHUNK) {
      const chunk = histories.slice(i, i + CHUNK);
      const paramsH = [];
      const histValues = chunk.map((h, j) => {
        paramsH.push(companyId, h.accountId, branchId, h.docNo, h.docType, h.refNo, h.docDate, h.period,
          h.debit, h.credit, h.net, h.remarks, h.unitCode, h.createdAt, h.legacyRef);
        const b = j * 15;
        const o = (n) => `$${b + n}`;
        return `(${o(1)}, ${o(2)}, ${o(3)}, ${o(4)}, ${o(5)}, ${o(6)}, ${o(7)}::date, ${o(8)},
                ${o(9)}::numeric, ${o(10)}::numeric, ${o(11)}::numeric, ${o(12)}, ${o(13)},
                COALESCE(${o(14)}::timestamptz, now()), ${o(15)})`;
      });
      await db.query(
        `INSERT INTO ledger.histories
           (company_id, account_id, branch_id, doc_no, doc_type, ref_no, doc_date, period,
            debit_amount, credit_amount, net_amount, remarks, unit_code, created_at, legacy_ref)
         VALUES ${histValues.join(', ')}`,
        paramsH,
      );
      const paramsM = [companyId];
      const migValues = chunk.map((h, j) => {
        paramsM.push(h.legacyRef, JSON.stringify(h.source));
        const b = j * 2 + 2;
        return `($1, 'acchistory', $${b}, 'IMPORTED', $${b + 1}::jsonb)`;
      });
      await db.query(
        `INSERT INTO accounting.legacy_migration_records (company_id, source_table, source_key, status, source_data)
         VALUES ${migValues.join(', ')}`,
        paramsM,
      );
      insertedHistories += chunk.length;
    }
    for (let i = 0; i < skipRecords.length; i += CHUNK) {
      const slice = skipRecords.slice(i, i + CHUNK);
      const params = [companyId];
      const tuples = slice.map((r, j) => {
        params.push(r[0], JSON.stringify(r[1]));
        const b = j * 2 + 2;
        return `($1, 'acchistory', $${b}, 'REVIEW', $${b + 1}::jsonb)`;
      });
      await db.query(
        `INSERT INTO accounting.legacy_migration_records (company_id, source_table, source_key, status, source_data)
         VALUES ${tuples.join(', ')}`,
        params,
      );
    }

    // Monthly balances: months of CURRENT_YEAR, plus month_number 0 rows for
    // the two prior-year figures (prvyearfig = year-1, prvyearfig2 = year-2).
    const monthly = [];
    for (const [acct, agg] of ledgerAgg) {
      const accountId = accountByCode.get(acct);
      for (const [m, amount] of Object.entries(agg.months)) {
        monthly.push([accountId, CURRENT_YEAR, Number(m), amount, `OLD::accledger::${acct}::${CURRENT_YEAR}::${m}`]);
      }
      if (agg.prv1 !== 0) monthly.push([accountId, CURRENT_YEAR - 1, 0, round2(agg.prv1), `OLD::accledger::${acct}::${CURRENT_YEAR - 1}::0`]);
      if (agg.prv2 !== 0) monthly.push([accountId, CURRENT_YEAR - 2, 0, round2(agg.prv2), `OLD::accledger::${acct}::${CURRENT_YEAR - 2}::0`]);
    }
    for (let i = 0; i < monthly.length; i += CHUNK) {
      const slice = monthly.slice(i, i + CHUNK);
      const params = [];
      const tuples = slice.map((r, j) => {
        params.push(companyId, r[0], r[1], r[2], r[3], r[4]);
        const b = j * 6;
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}::numeric, $${b + 6})`;
      });
      await db.query(
        `INSERT INTO ledger.monthly_balances (company_id, account_id, budget_year, month_number, net_amount, legacy_ref)
         VALUES ${tuples.join(', ')}
         ON CONFLICT (company_id, account_id, budget_year, month_number) DO UPDATE SET net_amount = EXCLUDED.net_amount`,
        params,
      );
    }

    // Statement groups.
    for (let i = 0; i < statementGroups.length; i += CHUNK) {
      const slice = statementGroups.slice(i, i + CHUNK);
      const params = [];
      const tuples = slice.map((g, j) => {
        params.push(companyId, g.groupCode, g.accountCode, g.groupName, g.accountRange, i + j + 1);
        const b = j * 6;
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`;
      });
      await db.query(
        `INSERT INTO accounting.statement_groups (company_id, group_code, account_code, group_name, account_range, display_order)
         VALUES ${tuples.join(', ')}
         ON CONFLICT (company_id, group_code, account_code) DO UPDATE
           SET group_name = EXCLUDED.group_name, account_range = EXCLUDED.account_range, display_order = EXCLUDED.display_order`,
        params,
      );
    }

    // Refresh account names from accchart where they differ.
    let renamed = 0;
    for (let i = 0; i < chartNames.length; i += CHUNK) {
      const slice = chartNames.slice(i, i + CHUNK);
      const params = [companyId];
      const codes = slice.map((c, j) => {
        params.push(c.code, c.name);
        return `($${j * 2 + 2}, $${j * 2 + 3})`;
      });
      const r = await db.query(
        `UPDATE accounting.accounts a
            SET account_name = c.name, updated_at = now()
           FROM (VALUES ${codes.join(', ')}) AS c(code, name)
          WHERE a.company_id = $1 AND a.account_code = c.code AND a.account_name <> c.name`,
        params,
      );
      renamed += r.rowCount;
    }

    // Recompute ledger.ledgers absolutely: legacy accledger value + live
    // (non-legacy) history postings. Covers every account on either side.
    const live = await db.query(
      `SELECT account_id, SUM(debit_amount) AS d, SUM(credit_amount) AS c, COUNT(*)::int AS n
         FROM ledger.histories WHERE company_id=$1 AND legacy_ref IS NULL GROUP BY account_id`,
      [companyId],
    );
    const liveByAccount = new Map(live.rows.map((r) => [r.account_id, r]));
    const targetAccounts = new Set([...[...ledgerAgg.keys()].map((a) => accountByCode.get(a)), ...liveByAccount.keys()]);
    let ledgerUpserts = 0;
    for (const accountId of targetAccounts) {
      const acct = codeByAccount.get(accountId);
      const agg = ledgerAgg.get(acct) || { opening: 0, debit: 0, credit: 0, budget: 0 };
      const l = liveByAccount.get(accountId) || { d: '0', c: '0', n: 0 };
      await db.query(
        `INSERT INTO ledger.ledgers
           (company_id, account_id, branch_id, opening_balance, debit_balance, credit_balance, budget_amount, transaction_count)
         VALUES ($1, $2, $3, $4::numeric, $5::numeric, $6::numeric, $7::numeric, $8)
         ON CONFLICT (company_id, account_id) DO UPDATE SET
           opening_balance = EXCLUDED.opening_balance,
           debit_balance = EXCLUDED.debit_balance,
           credit_balance = EXCLUDED.credit_balance,
           budget_amount = EXCLUDED.budget_amount,
           transaction_count = EXCLUDED.transaction_count,
           updated_at = now()`,
        [companyId, accountId, branchId,
          round2(agg.opening), round2(agg.debit + Number(l.d)), round2(agg.credit + Number(l.c)),
          round2(agg.budget), (histCountByAcct.get(acct) || 0) + Number(l.n)],
      );
      ledgerUpserts++;
    }

    // Reconciliation.
    const dbHist = await db.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(debit_amount),0) AS d, COALESCE(SUM(credit_amount),0) AS c
         FROM ledger.histories WHERE company_id=$1 AND legacy_ref LIKE 'OLD::acchistory::%'`,
      [companyId],
    );
    const dbMonth = await db.query('SELECT COUNT(*)::int AS n FROM ledger.monthly_balances WHERE company_id=$1', [companyId]);
    const dbGroup = await db.query('SELECT COUNT(*)::int AS n FROM accounting.statement_groups WHERE company_id=$1', [companyId]);
    const dbLedger = await db.query('SELECT COUNT(*)::int AS n FROM ledger.ledgers WHERE company_id=$1', [companyId]);
    const dumpTotals = histories.reduce((t, h) => [t[0] + Number(h.debit), t[1] + Number(h.credit)], [0, 0]);

    await db.query('COMMIT');
    console.log(JSON.stringify({
      companyId,
      branchId,
      histories: {
        loaded: insertedHistories,
        skipped: skippedHistoryNoAcct,
        zeroAmountCarryForwards: skipRecords.length,
        inDb: dbHist.rows[0].n,
        dumpDebit: round2(dumpTotals[0]),
        dumpCredit: round2(dumpTotals[1]),
        dbDebit: dbHist.rows[0].d,
        dbCredit: dbHist.rows[0].c,
      },
      monthlyBalances: dbMonth.rows[0].n,
      statementGroups: dbGroup.rows[0].n,
      accountsRenamed: renamed,
      ledgersUpserted: ledgerUpserts,
      ledgerRowsInDb: dbLedger.rows[0].n,
      accledgerSkipped: skippedLedgerNoAcct,
    }, null, 1));
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
