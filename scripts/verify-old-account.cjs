require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const assert = require('node:assert/strict');
async function verify() {
  const client = new Client({ host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USERNAME,password:process.env.DB_PASSWORD,database:process.env.DB_DATABASE });
  await client.connect();
  try {
    const { rows:[company] } = await client.query("SELECT company_id FROM core.companies WHERE company_code='KB01'");
    assert.ok(company, 'Source company must exist');
    const cid=company.company_id;
    const { rows:invalid } = await client.query(`
      SELECT j.journal_entry_id FROM accounting.journal_entries j
      JOIN accounting.legacy_migration_records r ON r.journal_entry_id=j.journal_entry_id
      LEFT JOIN accounting.journal_entry_lines l ON l.journal_entry_id=j.journal_entry_id
      WHERE r.company_id=$1 AND j.status='POSTED'
      GROUP BY j.journal_entry_id HAVING COUNT(l.journal_line_id)<2
      OR SUM(l.debit_amount)<>SUM(l.credit_amount)
      OR SUM(l.debit_amount)<>j.total_debit OR SUM(l.credit_amount)<>j.total_credit
    `,[cid]);
    assert.equal(invalid.length,0,'Posted source journals must balance and match their lines');
    const { rows:[scope] } = await client.query(`
      SELECT COUNT(*)::int AS invalid FROM accounting.legacy_migration_records r
      JOIN accounting.journal_entries j ON j.journal_entry_id=r.journal_entry_id
      JOIN accounting.accounting_periods p ON p.period_id=j.period_id
      JOIN accounting.fiscal_years fy ON fy.fiscal_year_id=p.fiscal_year_id
      LEFT JOIN accounting.journal_entry_lines l ON l.journal_entry_id=j.journal_entry_id
      LEFT JOIN accounting.accounts a ON a.account_id=l.account_id
      WHERE r.company_id=$1 AND (j.company_id<>r.company_id OR fy.company_id<>j.company_id
        OR a.company_id<>j.company_id OR j.transaction_date<p.start_date OR j.transaction_date>p.end_date)
    `,[cid]);
    assert.equal(scope.invalid,0,'Source journals, lines and periods must belong to the correct company/date');
    const { rows:[counts] } = await client.query(`
      SELECT COUNT(*)::int AS headers,COUNT(*) FILTER(WHERE status='IMPORTED')::int AS imported,
        COUNT(*) FILTER(WHERE status='REVIEW')::int AS review
      FROM accounting.legacy_migration_records WHERE company_id=$1 AND source_table IN('ac_jvheader','ac_rctheader','ac_pcvheader')
    `,[cid]);
    const { rows:[lines] } = await client.query(`
      SELECT COUNT(*)::int AS lines FROM accounting.journal_entry_lines l
      JOIN accounting.journal_entries j USING(journal_entry_id) WHERE j.company_id=$1
    `,[cid]);
    console.log(JSON.stringify({ companyCode:'KB01',...counts,...lines,postedIntegrity:'passed',companyAndPeriodIntegrity:'passed' }));
  } finally { await client.end(); }
}
verify().catch(error=>{ console.error(error.message); process.exitCode=1; });
