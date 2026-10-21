BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS core.menus (
    menu_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_menu_id UUID NULL,
    menu_code VARCHAR(100) NOT NULL UNIQUE,
    menu_name VARCHAR(100) NOT NULL,
    menu_url VARCHAR(255),
    icon VARCHAR(100),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_menus_parent
        FOREIGN KEY (parent_menu_id)
        REFERENCES core.menus(menu_id)
        ON UPDATE NO ACTION
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS core.role_menus (
    role_id UUID NOT NULL,
    menu_id UUID NOT NULL,
    can_view BOOLEAN NOT NULL DEFAULT TRUE,
    can_create BOOLEAN NOT NULL DEFAULT FALSE,
    can_edit BOOLEAN NOT NULL DEFAULT FALSE,
    can_delete BOOLEAN NOT NULL DEFAULT FALSE,
    can_approve BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT role_menus_pkey PRIMARY KEY (role_id, menu_id),
    CONSTRAINT role_menus_role_id_fkey
        FOREIGN KEY (role_id)
        REFERENCES core.roles(role_id)
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT role_menus_menu_id_fkey
        FOREIGN KEY (menu_id)
        REFERENCES core.menus(menu_id)
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_menus_parent ON core.menus(parent_menu_id);
CREATE INDEX IF NOT EXISTS ix_menus_display_order ON core.menus(display_order);
CREATE INDEX IF NOT EXISTS ix_role_menus_menu ON core.role_menus(menu_id);

INSERT INTO core.menus (menu_code, menu_name, menu_url, icon, display_order)
VALUES
    ('DASHBOARD', 'Dashboard', '/dashboard', 'dashboard', 1),
    ('COMPANIES', 'Companies', '/companies', 'building-2', 2),
    ('BRANCHES', 'Branches', '/branches', 'git-branch', 3),
    ('FISCAL_YEARS', 'Fiscal Years', '/fiscal-years', 'calendar', 4),
    ('ACCOUNTING_PERIODS', 'Accounting Periods', '/accounting-periods', 'calendar-days', 5),
    ('CHART_OF_ACCOUNTS', 'Chart of Accounts', '/accounts', 'book-open', 6),
    ('JOURNAL_ENTRIES', 'Journal Entries', '/journal-entries', 'book-text', 7),
    ('CUSTOMERS', 'Customers', '/customers', 'users', 8),
    ('SUPPLIERS', 'Suppliers', '/suppliers', 'truck', 9),
    ('INVOICES', 'Invoices', '/invoices', 'file-text', 10),
    ('PAYMENTS', 'Payments', '/payments', 'wallet', 11),
    ('BANKING', 'Banking', '/bank-accounts', 'landmark', 12),
    ('BANK_RECONCILIATION', 'Bank Reconciliation', '/bank-reconciliations', 'check-check', 13),
    ('FIXED_ASSETS', 'Fixed Assets', '/fixed-assets', 'building', 14),
    ('EXPENSES', 'Expenses', '/expenses', 'receipt', 15),
    ('USERS', 'Users', '/users', 'user-round', 16),
    ('ROLES', 'Roles & Access', '/roles', 'shield-check', 17),
    ('AUDIT_LOGS', 'Audit Logs', '/audit-logs', 'clipboard-list', 18),
    ('REPORTS', 'Reports', '/reports', 'chart-no-axes-combined', 19)
ON CONFLICT (menu_code) DO NOTHING;

INSERT INTO core.roles (role_code, role_name, description)
VALUES ('ADMIN', 'Administrator', 'Full access to all application menus')
ON CONFLICT (role_code) DO NOTHING;

INSERT INTO core.role_menus
    (role_id, menu_id, can_view, can_create, can_edit, can_delete, can_approve)
SELECT r.role_id, m.menu_id, TRUE, TRUE, TRUE, TRUE, TRUE
FROM core.roles r
CROSS JOIN core.menus m
WHERE r.role_code = 'ADMIN'
ON CONFLICT (role_id, menu_id) DO NOTHING;

COMMIT;
