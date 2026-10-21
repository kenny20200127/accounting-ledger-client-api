-- Supporting tables for the legacy OldDatascript data port (KB01).
-- acchistory/accledger/accbalsheet rows land in ledger.*; accbank/accbudget
-- have no rows in the dump but their master tables are needed by the system.
BEGIN;

-- Legacy dimension carried through from acchistory.unitcode (cost unit)
-- and a traceability key for rows imported from the SQL Server dump.
ALTER TABLE ledger.histories ADD COLUMN IF NOT EXISTS unit_code varchar(10);
ALTER TABLE ledger.histories ADD COLUMN IF NOT EXISTS legacy_ref varchar(120);
CREATE UNIQUE INDEX IF NOT EXISTS uq_histories_legacy_ref
    ON ledger.histories (legacy_ref) WHERE legacy_ref IS NOT NULL;

-- Monthly net movements per account, from accledger month01..month12
-- plus the two prior-year figures (month_number = 0, budget_year = the year).
CREATE TABLE IF NOT EXISTS ledger.monthly_balances (
    monthly_balance_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES core.companies (company_id),
    account_id uuid NOT NULL REFERENCES accounting.accounts (account_id),
    budget_year smallint NOT NULL,
    month_number smallint NOT NULL CHECK (month_number BETWEEN 0 AND 12),
    net_amount numeric(18, 2) NOT NULL DEFAULT 0,
    legacy_ref varchar(120),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_monthly_balances_account_period
        UNIQUE (company_id, account_id, budget_year, month_number)
);

-- Budget master (port of accbudget; the legacy system keyed budgets by
-- company/branch/year/account/unit).
CREATE TABLE IF NOT EXISTS accounting.budgets (
    budget_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES core.companies (company_id),
    branch_id uuid REFERENCES core.branches (branch_id),
    budget_year smallint NOT NULL,
    account_id uuid NOT NULL REFERENCES accounting.accounts (account_id),
    unit_code varchar(10),
    description varchar(70),
    debit_amount numeric(18, 2) NOT NULL DEFAULT 0,
    credit_amount numeric(18, 2) NOT NULL DEFAULT 0,
    remarks varchar(50),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_budgets_account_year_unit
    ON accounting.budgets (company_id, budget_year, account_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(unit_code, ''));

-- Bank master list (port of accbank) referenced by payments/receipts.
CREATE TABLE IF NOT EXISTS banking.banks (
    bank_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES core.companies (company_id),
    bank_code varchar(15) NOT NULL,
    branch_code varchar(6) NOT NULL DEFAULT '',
    bank_name varchar(30),
    branch_name varchar(30),
    address varchar(50),
    po_box varchar(50),
    phone varchar(15),
    email varchar(50),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_banks_company_code UNIQUE (company_id, bank_code, branch_code)
);

-- Statement layout groupings (port of accbalsheet: balance-sheet line
-- definitions mapping a group code to an account-number range).
CREATE TABLE IF NOT EXISTS accounting.statement_groups (
    group_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES core.companies (company_id),
    group_code varchar(3) NOT NULL,
    account_code varchar(15) NOT NULL,
    group_name varchar(50),
    account_range varchar(100),
    display_order integer NOT NULL DEFAULT 0,
    CONSTRAINT uq_statement_groups UNIQUE (company_id, group_code, account_code)
);

COMMIT;
