BEGIN;

SELECT pg_advisory_xact_lock(20261111);

ALTER TABLE core.companies
    ADD COLUMN IF NOT EXISTS profit_and_loss_amount NUMERIC(20,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS core.schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO core.schema_migrations(version)
VALUES ('20261111_company_profit_loss')
ON CONFLICT DO NOTHING;

COMMIT;
