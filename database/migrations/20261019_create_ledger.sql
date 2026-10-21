-- Port of the legacy nac_ledgers / nac_histories tables and the
-- npf_Update_Ledger_Batch procedure to the Postgres schema layout.
BEGIN;

CREATE SCHEMA IF NOT EXISTS ledger;

CREATE TABLE IF NOT EXISTS ledger.ledgers (
    ledger_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    account_id uuid NOT NULL,
    branch_id uuid,
    opening_balance numeric(18, 2) NOT NULL DEFAULT 0,
    debit_balance numeric(18, 2) NOT NULL DEFAULT 0,
    credit_balance numeric(18, 2) NOT NULL DEFAULT 0,
    budget_amount numeric(18, 2) NOT NULL DEFAULT 0,
    pl_balance numeric(18, 2) NOT NULL DEFAULT 0,
    transaction_count bigint NOT NULL DEFAULT 0,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid,
    updated_at timestamptz,
    CONSTRAINT ledgers_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies (company_id),
    CONSTRAINT ledgers_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounting.accounts (account_id),
    CONSTRAINT ledgers_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES core.branches (branch_id),
    CONSTRAINT uq_ledgers_company_account UNIQUE (company_id, account_id)
);

CREATE TABLE IF NOT EXISTS ledger.histories (
    history_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id uuid NOT NULL,
    account_id uuid NOT NULL,
    branch_id uuid,
    doc_no varchar(30) NOT NULL,
    doc_type varchar(10) NOT NULL,
    ref_no varchar(20),
    doc_date date NOT NULL,
    period varchar(6) NOT NULL,
    debit_amount numeric(18, 2) NOT NULL DEFAULT 0,
    credit_amount numeric(18, 2) NOT NULL DEFAULT 0,
    net_amount numeric(18, 2) NOT NULL DEFAULT 0,
    remarks text,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT histories_company_id_fkey FOREIGN KEY (company_id) REFERENCES core.companies (company_id),
    CONSTRAINT histories_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounting.accounts (account_id),
    CONSTRAINT histories_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES core.branches (branch_id)
);

CREATE INDEX IF NOT EXISTS ix_histories_company_account_date
    ON ledger.histories (company_id, account_id, doc_date DESC);

CREATE INDEX IF NOT EXISTS ix_histories_company_doc
    ON ledger.histories (company_id, doc_no);

-- Generated numbers are DOC_TYPE-YYYYMMDD-#### (up to 24 chars for a 10-char
-- type); widen doc_no on installs that created it as varchar(20).
ALTER TABLE ledger.histories ALTER COLUMN doc_no TYPE varchar(30);

INSERT INTO core.menus (menu_code, menu_name, menu_url, icon, display_order)
VALUES ('LEDGER', 'Capture Ledger', '/ledger-batches', 'layers', 18)
ON CONFLICT (menu_code) DO NOTHING;

-- Grant the new menu to existing company roles: admins full access,
-- accountants post and view, viewers read-only.
INSERT INTO core.role_menus
    (role_id, menu_id, can_view, can_create, can_edit, can_delete, can_approve)
SELECT r.role_id, m.menu_id,
    TRUE,
    r.role_code NOT LIKE '%:VIEWER',
    r.role_code NOT LIKE '%:VIEWER',
    r.is_company_admin,
    r.role_code NOT LIKE '%:VIEWER'
FROM core.roles r
CROSS JOIN core.menus m
WHERE m.menu_code = 'LEDGER'
    AND r.company_id IS NOT NULL
    AND r.role_code IN (
        r.company_id::text || ':ADMIN',
        r.company_id::text || ':ACCOUNTANT',
        r.company_id::text || ':VIEWER'
    )
ON CONFLICT (role_id, menu_id) DO NOTHING;

COMMIT;
