BEGIN;

SELECT pg_advisory_xact_lock(20261110);

CREATE TABLE IF NOT EXISTS core.company_menu_settings (
    company_id UUID NOT NULL REFERENCES core.companies(company_id) ON DELETE CASCADE,
    menu_id UUID NOT NULL REFERENCES core.menus(menu_id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (company_id, menu_id)
);

CREATE TABLE IF NOT EXISTS core.schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO core.schema_migrations(version)
VALUES ('20261110_company_menu_settings')
ON CONFLICT DO NOTHING;

COMMIT;
