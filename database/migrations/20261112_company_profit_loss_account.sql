BEGIN;

SELECT pg_advisory_xact_lock(20261112);

ALTER TABLE core.companies
    ADD COLUMN IF NOT EXISTS profit_and_loss_account_code VARCHAR(30);

CREATE TABLE IF NOT EXISTS core.schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO core.schema_migrations(version)
VALUES ('20261112_company_profit_loss_account')
ON CONFLICT DO NOTHING;

COMMIT;
