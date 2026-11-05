-- Five-level chart of accounts:
-- Account Type -> Account Subtype -> Balance Sheet Classification ->
-- Main Account -> Chart of Accounts (ledger account).
BEGIN;

-- 1. Account types carry the numeric prefix used by every generated code.
ALTER TABLE accounting.account_types
    ADD COLUMN IF NOT EXISTS code_prefix char(1),
    ADD COLUMN IF NOT EXISTS description text;

UPDATE accounting.account_types t
SET code_prefix = v.prefix,
    name = v.name,
    description = COALESCE(t.description, v.description)
FROM (VALUES
    ('ASSET', '1', 'Assets', 'Resources controlled by the company.'),
    ('LIABILITY', '2', 'Liabilities', 'Obligations owed to third parties.'),
    ('EQUITY', '3', 'Capital and Reserve', 'Owners'' capital and reserves.'),
    ('REVENUE', '4', 'Income', 'Income earned from operations.'),
    ('EXPENSE', '5', 'Expenses', 'Costs incurred in operations.')
) AS v(code, prefix, name, description)
WHERE t.code = v.code;

ALTER TABLE accounting.account_types ALTER COLUMN code_prefix SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_account_types_code_prefix') THEN
        ALTER TABLE accounting.account_types
            ADD CONSTRAINT chk_account_types_code_prefix CHECK (code_prefix IN ('1', '2', '3', '4', '5'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_account_types_code_prefix
    ON accounting.account_types (code_prefix);

-- 2. Account subtypes (predefined reference data).
CREATE TABLE IF NOT EXISTS accounting.account_subtypes (
    account_subtype_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(30) NOT NULL,
    name varchar(100) NOT NULL,
    description text,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE accounting.account_subtypes ADD COLUMN IF NOT EXISTS created_by uuid;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_subtype_created_by_fkey') THEN
        ALTER TABLE accounting.account_subtypes
            ADD CONSTRAINT account_subtype_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES core.users (user_id);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_account_subtypes_code
    ON accounting.account_subtypes (code);

INSERT INTO accounting.account_subtypes (code, name, description) VALUES
    ('GL_ACCOUNT', 'GL Account', 'General Ledger Accounts'),
    ('CUSTOMERS', 'Customers', 'Customer-related accounts'),
    ('BROKERS', 'Brokers', 'Broker-related accounts'),
    ('BANK', 'Bank', 'Bank accounts'),
    ('INSURANCE_COYS', 'Insurance Coys', 'Insurance companies'),
    ('MGT_EXPENSES', 'Mgt Expenses', 'Management expenses'),
    ('TECH_EXPENSES', 'Tech Expenses', 'Technology expenses'),
    ('FIXED_ASSETS', 'Fixed Assets', 'Fixed asset accounts'),
    ('INCOME', 'Income', 'Income-related accounts')
ON CONFLICT (code) DO NOTHING;

-- 3. Balance sheet classifications, sequenced under each account type.
CREATE TABLE IF NOT EXISTS accounting.balance_sheet_classifications (
    balance_sheet_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    account_type_id uuid NOT NULL,
    code varchar(10) NOT NULL,
    description varchar(150) NOT NULL,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT balance_sheet_company_fkey FOREIGN KEY (company_id) REFERENCES core.companies (company_id),
    CONSTRAINT balance_sheet_type_fkey FOREIGN KEY (account_type_id) REFERENCES accounting.account_types (account_type_id),
    CONSTRAINT balance_sheet_created_by_fkey FOREIGN KEY (created_by) REFERENCES core.users (user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_balance_sheets_company_code
    ON accounting.balance_sheet_classifications (company_id, code);

CREATE INDEX IF NOT EXISTS ix_balance_sheets_company_type
    ON accounting.balance_sheet_classifications (company_id, account_type_id);

-- 4. Main accounts under a balance sheet classification.
CREATE TABLE IF NOT EXISTS accounting.main_accounts (
    main_account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    account_type_id uuid NOT NULL,
    balance_sheet_id uuid NOT NULL,
    account_subtype_id uuid NOT NULL,
    main_code varchar(20) NOT NULL,
    description varchar(150) NOT NULL,
    short_name varchar(50),
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT main_account_company_fkey FOREIGN KEY (company_id) REFERENCES core.companies (company_id),
    CONSTRAINT main_account_type_fkey FOREIGN KEY (account_type_id) REFERENCES accounting.account_types (account_type_id),
    CONSTRAINT main_account_balance_sheet_fkey FOREIGN KEY (balance_sheet_id) REFERENCES accounting.balance_sheet_classifications (balance_sheet_id),
    CONSTRAINT main_account_subtype_fkey FOREIGN KEY (account_subtype_id) REFERENCES accounting.account_subtypes (account_subtype_id),
    CONSTRAINT main_account_created_by_fkey FOREIGN KEY (created_by) REFERENCES core.users (user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_main_accounts_company_code
    ON accounting.main_accounts (company_id, main_code);

CREATE INDEX IF NOT EXISTS ix_main_accounts_company_type
    ON accounting.main_accounts (company_id, account_type_id);

CREATE INDEX IF NOT EXISTS ix_main_accounts_balance_sheet
    ON accounting.main_accounts (balance_sheet_id);

CREATE INDEX IF NOT EXISTS ix_main_accounts_subtype
    ON accounting.main_accounts (account_subtype_id);

-- 5. Chart accounts point at a main account; subtype/type/classification are inherited.
ALTER TABLE accounting.accounts
    ADD COLUMN IF NOT EXISTS main_account_id uuid,
    ADD COLUMN IF NOT EXISTS email varchar(150),
    ADD COLUMN IF NOT EXISTS created_by uuid;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_created_by_fkey') THEN
        ALTER TABLE accounting.accounts
            ADD CONSTRAINT accounts_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES core.users (user_id);
    END IF;
END $$;

-- One classification per company and type so every existing account can be linked.
INSERT INTO accounting.balance_sheet_classifications (company_id, account_type_id, code, description)
SELECT c.company_id, t.account_type_id, t.code_prefix || '01', t.name
FROM core.companies c
CROSS JOIN accounting.account_types t
ON CONFLICT (company_id, code) DO NOTHING;

-- Legacy accounts already use <main>-<sequence>; recover the mains from those prefixes.
INSERT INTO accounting.main_accounts (
    company_id, account_type_id, balance_sheet_id, account_subtype_id, main_code, description, short_name
)
SELECT DISTINCT
    a.company_id,
    a.account_type_id,
    bs.balance_sheet_id,
    st.account_subtype_id,
    split_part(a.account_code, '-', 1),
    COALESCE(h.account_name, a.account_name),
    left(COALESCE(h.account_name, a.account_name), 50)
FROM accounting.accounts a
JOIN accounting.account_subtypes st ON st.code = 'GL_ACCOUNT'
CROSS JOIN LATERAL (
    SELECT balance_sheet_id
    FROM accounting.balance_sheet_classifications b
    WHERE b.company_id = a.company_id AND b.account_type_id = a.account_type_id
    ORDER BY b.code
    LIMIT 1
) bs
LEFT JOIN accounting.accounts h
    ON h.company_id = a.company_id
   AND h.account_code = split_part(a.account_code, '-', 1) || '-00000'
WHERE a.account_code ~ '^[0-9]{4,}-[0-9]+$'
ON CONFLICT (company_id, main_code) DO NOTHING;

UPDATE accounting.accounts a
SET main_account_id = m.main_account_id
FROM accounting.main_accounts m
WHERE a.main_account_id IS NULL
  AND a.account_code ~ '^[0-9]{4,}-[0-9]+$'
  AND m.company_id = a.company_id
  AND m.main_code = split_part(a.account_code, '-', 1);

-- Accounts with plain legacy codes (for example 1010) each get a generated main.
DO $$
DECLARE
    r RECORD;
    bs uuid;
    st uuid;
    seq integer;
    new_code varchar(20);
    mid uuid;
BEGIN
    SELECT account_subtype_id INTO st
    FROM accounting.account_subtypes WHERE code = 'GL_ACCOUNT';

    FOR r IN
        SELECT a.account_id, a.company_id, a.account_type_id, a.account_name, a.account_code, t.code_prefix, t.name AS type_name
        FROM accounting.accounts a
        JOIN accounting.account_types t USING (account_type_id)
        WHERE a.main_account_id IS NULL
        ORDER BY a.company_id, a.account_type_id, a.account_code
    LOOP
        SELECT balance_sheet_id INTO bs
        FROM accounting.balance_sheet_classifications
        WHERE company_id = r.company_id AND account_type_id = r.account_type_id
        ORDER BY code
        LIMIT 1;

        IF bs IS NULL THEN
            INSERT INTO accounting.balance_sheet_classifications (company_id, account_type_id, code, description)
            VALUES (r.company_id, r.account_type_id, r.code_prefix || '01', r.type_name)
            RETURNING balance_sheet_id INTO bs;
        END IF;

        SELECT COALESCE(MAX(main_code::int), (r.code_prefix || '0000')::int - 1) INTO seq
        FROM accounting.main_accounts
        WHERE company_id = r.company_id
          AND account_type_id = r.account_type_id
          AND main_code ~ ('^' || r.code_prefix || '[0-9]{4}$');

        new_code := (seq + 1)::text;

        INSERT INTO accounting.main_accounts (
            company_id, account_type_id, balance_sheet_id, account_subtype_id, main_code, description, short_name
        ) VALUES (
            r.company_id, r.account_type_id, bs, st, new_code, r.account_name, left(r.account_name, 50)
        ) RETURNING main_account_id INTO mid;

        UPDATE accounting.accounts SET main_account_id = mid WHERE account_id = r.account_id;
    END LOOP;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM accounting.accounts WHERE main_account_id IS NULL) THEN
        RAISE EXCEPTION 'Chart backfill left accounts without a main account';
    END IF;
END $$;

ALTER TABLE accounting.accounts ALTER COLUMN main_account_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_main_account_id_fkey') THEN
        ALTER TABLE accounting.accounts
            ADD CONSTRAINT accounts_main_account_id_fkey
            FOREIGN KEY (main_account_id) REFERENCES accounting.main_accounts (main_account_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_accounts_main_account
    ON accounting.accounts (main_account_id);

-- 6. Management screens.
UPDATE core.menus SET display_order = 10 WHERE menu_code = 'CHART_OF_ACCOUNTS';

INSERT INTO core.menus (menu_code, menu_name, menu_url, icon, display_order) VALUES
    ('ACCOUNT_TYPES', 'Account Types', '/account-types', 'layers', 6),
    ('ACCOUNT_SUBTYPES', 'Account Subtypes', '/account-subtypes', 'layers', 7),
    ('BALANCE_SHEETS', 'Balance Sheet', '/balance-sheets', 'layers', 8),
    ('MAIN_ACCOUNTS', 'Main Accounts', '/main-accounts', 'layers', 9)
ON CONFLICT (menu_code) DO NOTHING;

INSERT INTO core.role_menus (role_id, menu_id, can_view, can_create, can_edit, can_delete, can_approve)
SELECT r.role_id, m.menu_id,
    TRUE,
    r.role_code NOT LIKE '%:VIEWER',
    r.role_code NOT LIKE '%:VIEWER',
    r.is_company_admin,
    r.role_code NOT LIKE '%:VIEWER'
FROM core.roles r
CROSS JOIN core.menus m
WHERE m.menu_code IN ('ACCOUNT_TYPES', 'ACCOUNT_SUBTYPES', 'BALANCE_SHEETS', 'MAIN_ACCOUNTS')
  AND r.company_id IS NOT NULL
  AND r.role_code IN (
      r.company_id::text || ':ADMIN',
      r.company_id::text || ':ACCOUNTANT',
      r.company_id::text || ':VIEWER'
  )
ON CONFLICT (role_id, menu_id) DO NOTHING;

COMMIT;
