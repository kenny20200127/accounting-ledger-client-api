require('dotenv').config();
const { Client } = require('pg');

async function seedDemoData() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  await client.connect();

  try {
    await client.query('BEGIN');

    // 1. Get or create company
    let compRes = await client.query("SELECT company_id, base_currency FROM core.companies LIMIT 1");
    let companyId;
    if (compRes.rowCount === 0) {
      const ins = await client.query(
        "INSERT INTO core.companies (company_code, company_name, email, base_currency, is_active) VALUES ('NORTHSTAR', 'Northstar Enterprises', 'finance@northstar.ledger', 'USD', TRUE) RETURNING company_id"
      );
      companyId = ins.rows[0].company_id;
    } else {
      companyId = compRes.rows[0].company_id;
    }

    // 2. Branches
    const branchRes = await client.query(
      "INSERT INTO core.branches (company_id, branch_code, branch_name, city, state, is_head_office) VALUES ($1, 'HQ', 'Headquarters', 'Lagos', 'Lagos', TRUE) ON CONFLICT (company_id, branch_code) DO UPDATE SET branch_name = EXCLUDED.branch_name RETURNING branch_id",
      [companyId]
    );
    const branchId = branchRes.rows[0]?.branch_id;

    // 3. Fiscal Year & Accounting Period
    const fyRes = await client.query(
      "INSERT INTO accounting.fiscal_years (company_id, year_name, start_date, end_date, is_closed) VALUES ($1, 'FY 2026', '2026-01-01', '2026-12-31', FALSE) ON CONFLICT (company_id, year_name) DO UPDATE SET is_closed = FALSE RETURNING fiscal_year_id",
      [companyId]
    );
    const fiscalYearId = fyRes.rows[0].fiscal_year_id;

    await client.query(
      "INSERT INTO accounting.accounting_periods (fiscal_year_id, period_number, period_name, start_date, end_date, is_open, is_closed) VALUES ($1, 10, 'October 2026', '2026-10-01', '2026-10-31', TRUE, FALSE) ON CONFLICT (fiscal_year_id, period_number) DO NOTHING",
      [fiscalYearId]
    );

    // 4. Accounts
    const types = await client.query("SELECT account_type_id, code, code_prefix FROM accounting.account_types");
    const typeMap = {};
    const prefixMap = {};
    types.rows.forEach(t => { typeMap[t.code] = t.account_type_id; prefixMap[t.code] = t.code_prefix; });
    const subtype = await client.query("SELECT account_subtype_id FROM accounting.account_subtypes WHERE code = 'GL_ACCOUNT'");
    const subtypeId = subtype.rows[0]?.account_subtype_id;

    const accountsToSeed = [
      { code: '1010', name: 'Main Operating Bank Account', type: 'ASSET' },
      { code: '1020', name: 'Accounts Receivable (Trade)', type: 'ASSET' },
      { code: '2010', name: 'Accounts Payable (Trade)', type: 'LIABILITY' },
      { code: '3010', name: 'Retained Earnings', type: 'EQUITY' },
      { code: '4010', name: 'Software & Consulting Revenue', type: 'REVENUE' },
      { code: '5010', name: 'Cloud Infrastructure & Hosting', type: 'EXPENSE' },
      { code: '5020', name: 'General & Administrative Expenses', type: 'EXPENSE' },
    ];

    const bsCache = {};
    const typeSeq = {};
    const accMap = {};
    for (const a of accountsToSeed) {
      if (!typeMap[a.type] || !subtypeId) continue;
      const prefix = prefixMap[a.type];
      if (!bsCache[a.type]) {
        const bs = await client.query(
          "INSERT INTO accounting.balance_sheet_classifications (company_id, account_type_id, code, description) VALUES ($1, $2, $3, $4) ON CONFLICT (company_id, code) DO UPDATE SET description = EXCLUDED.description RETURNING balance_sheet_id",
          [companyId, typeMap[a.type], prefix + '01', a.type + ' classification']
        );
        bsCache[a.type] = bs.rows[0].balance_sheet_id;
      }
      const index = typeSeq[a.type] = (typeSeq[a.type] ?? -1) + 1;
      const mainCode = String(Number(prefix) * 10000 + index);
      const main = await client.query(
        "INSERT INTO accounting.main_accounts (company_id, account_type_id, balance_sheet_id, account_subtype_id, main_code, description) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (company_id, main_code) DO UPDATE SET description = EXCLUDED.description RETURNING main_account_id",
        [companyId, typeMap[a.type], bsCache[a.type], subtypeId, mainCode, a.name]
      );
      const accountCode = `${mainCode}-00001`;
      const res = await client.query(
        "INSERT INTO accounting.accounts (company_id, main_account_id, account_code, account_name, account_type_id, allow_posting, is_active) VALUES ($1, $2, $3, $4, $5, TRUE, TRUE) ON CONFLICT (company_id, account_code) DO UPDATE SET account_name = EXCLUDED.account_name, main_account_id = EXCLUDED.main_account_id RETURNING account_id",
        [companyId, main.rows[0].main_account_id, accountCode, a.name, typeMap[a.type]]
      );
      accMap[a.code] = res.rows[0].account_id;
    }

    // 5. Customers
    const cust1 = await client.query(
      "INSERT INTO sales.customers (company_id, customer_code, customer_name, email, phone, credit_limit, receivable_account_id) VALUES ($1, 'CUST-001', 'Acme Global Corp', 'billing@acmeglobal.com', '+1-555-0192', 50000, $2) ON CONFLICT (company_id, customer_code) DO UPDATE SET customer_name = EXCLUDED.customer_name RETURNING customer_id",
      [companyId, accMap['1020']]
    );
    const cust2 = await client.query(
      "INSERT INTO sales.customers (company_id, customer_code, customer_name, email, phone, credit_limit, receivable_account_id) VALUES ($1, 'CUST-002', 'Vertex Digital Ltd', 'finance@vertexdigital.io', '+1-555-0288', 25000, $2) ON CONFLICT (company_id, customer_code) DO UPDATE SET customer_name = EXCLUDED.customer_name RETURNING customer_id",
      [companyId, accMap['1020']]
    );
    const cust3 = await client.query(
      "INSERT INTO sales.customers (company_id, customer_code, customer_name, email, phone, credit_limit, receivable_account_id) VALUES ($1, 'CUST-003', 'Apex Logix Systems', 'ops@apexlogix.net', '+1-555-0377', 30000, $2) ON CONFLICT (company_id, customer_code) DO UPDATE SET customer_name = EXCLUDED.customer_name RETURNING customer_id",
      [companyId, accMap['1020']]
    );

    // 6. Suppliers
    await client.query(
      "INSERT INTO purchasing.suppliers (company_id, supplier_code, supplier_name, email, phone, payable_account_id) VALUES ($1, 'SUP-001', 'AWS Cloud Solutions', 'invoicing@awscloud.com', '+1-800-001', $2) ON CONFLICT (company_id, supplier_code) DO UPDATE SET supplier_name = EXCLUDED.supplier_name RETURNING supplier_id",
      [companyId, accMap['2010']]
    );
    await client.query(
      "INSERT INTO purchasing.suppliers (company_id, supplier_code, supplier_name, email, phone, payable_account_id) VALUES ($1, 'SUP-002', 'Metropolis Coworking Spaces', 'desk@metropolis.com', '+1-800-002', $2) ON CONFLICT (company_id, supplier_code) DO UPDATE SET supplier_name = EXCLUDED.supplier_name RETURNING supplier_id",
      [companyId, accMap['2010']]
    );

    // 7. Bank Account
    if (accMap['1010']) {
      const bankCheck = await client.query("SELECT bank_account_id FROM banking.bank_accounts WHERE company_id = $1", [companyId]);
      if (bankCheck.rowCount === 0) {
        await client.query(
          "INSERT INTO banking.bank_accounts (company_id, account_id, bank_name, account_name, account_number, currency, opening_balance, current_balance, is_active) VALUES ($1, $2, 'Northstar Treasury Bank', 'Operating Clearing Account', '0129481023', 'USD', 25000.00, 48250.00, TRUE)",
          [companyId, accMap['1010']]
        );
      }
    }

    // 8. Invoices
    const invCheck = await client.query("SELECT count(*) FROM sales.invoices WHERE company_id = $1", [companyId]);
    if (Number(invCheck.rows[0].count) === 0) {
      const c1Id = cust1.rows[0].customer_id;
      const c2Id = cust2.rows[0].customer_id;
      const c3Id = cust3.rows[0].customer_id;

      await client.query(
        "INSERT INTO sales.invoices (company_id, branch_id, customer_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, amount_paid, status) VALUES " +
        "($1, $2, $3, 'INV-2026-001', '2026-10-01', '2026-10-15', 12000.00, 500.00, 12500.00, 12500.00, 'PAID'), " +
        "($1, $2, $4, 'INV-2026-002', '2026-10-04', '2026-10-25', 8000.00, 400.00, 8400.00, 4000.00, 'PARTIALLY_PAID'), " +
        "($1, $2, $5, 'INV-2026-003', '2026-10-08', '2026-10-28', 14500.00, 700.00, 15200.00, 0.00, 'SENT'), " +
        "($1, $2, $3, 'INV-2026-004', '2026-10-11', '2026-11-01', 6000.00, 300.00, 6300.00, 0.00, 'DRAFT')",
        [companyId, branchId, c1Id, c2Id, c3Id]
      );
    }

    // 9. Expenses
    const expCheck = await client.query("SELECT count(*) FROM purchasing.expenses WHERE company_id = $1", [companyId]);
    if (Number(expCheck.rows[0].count) === 0 && accMap['5010'] && accMap['1010']) {
      await client.query(
        "INSERT INTO purchasing.expenses (company_id, branch_id, expense_number, expense_date, description, expense_account_id, payment_account_id, amount, tax_amount, total_amount, status) VALUES " +
        "($1, $2, 'EXP-2026-001', '2026-10-02', 'Cloud Virtual Servers & Cluster Bandwidth', $3, $4, 1850.00, 0.00, 1850.00, 'APPROVED'), " +
        "($1, $2, 'EXP-2026-002', '2026-10-05', 'Metropolis Executive Workspace Monthly Rent', $5, $4, 2100.00, 100.00, 2200.00, 'APPROVED'), " +
        "($1, $2, 'EXP-2026-003', '2026-10-09', 'Team Collaboration Tools & Software Licences', $5, $4, 640.00, 0.00, 640.00, 'APPROVED')",
        [companyId, branchId, accMap['5010'], accMap['1010'], accMap['5020']]
      );
    }

    await client.query('COMMIT');
    console.log('Demo seed data successfully populated for company:', companyId);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Demo seed error:', err.message);
  } finally {
    await client.end();
  }
}

seedDemoData();
