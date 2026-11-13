-- Ledger reversal: link a reversing document to the document it cancels.
-- reversal_of_doc_no is set on the reversing rows; reversed_by_doc_no,
-- reversed_by and reversed_at are set on the original rows.
BEGIN;

SELECT pg_advisory_xact_lock(20261113);

ALTER TABLE ledger.histories
    ADD COLUMN IF NOT EXISTS reversal_of_doc_no VARCHAR(30),
    ADD COLUMN IF NOT EXISTS reversed_by_doc_no VARCHAR(30),
    ADD COLUMN IF NOT EXISTS reversed_by UUID,
    ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_histories_company_reversal
    ON ledger.histories (company_id, reversed_by_doc_no);

CREATE TABLE IF NOT EXISTS core.schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO core.schema_migrations(version)
VALUES ('20261113_ledger_history_reversal')
ON CONFLICT DO NOTHING;

COMMIT;
