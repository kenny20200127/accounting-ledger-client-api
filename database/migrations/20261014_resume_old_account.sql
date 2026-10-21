-- Historical source records remain separate from live ledger postings.
CREATE TABLE IF NOT EXISTS accounting.legacy_migration_records (
  company_id uuid NOT NULL REFERENCES core.companies(company_id),
  source_table varchar(60) NOT NULL,
  source_key varchar(200) NOT NULL,
  journal_entry_id uuid REFERENCES accounting.journal_entries(journal_entry_id),
  status varchar(20) NOT NULL CHECK (status IN ('IMPORTED', 'REVIEW', 'SNAPSHOT', 'DELETED')),
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, source_table, source_key)
);
CREATE INDEX IF NOT EXISTS idx_legacy_review ON accounting.legacy_migration_records(company_id, status, source_table);
-- Only posted entries (including originals offset by a posted reversal) affect balances.
CREATE OR REPLACE VIEW accounting.trial_balance AS
SELECT a.company_id, a.account_id, a.account_code, a.account_name, at.code AS account_type,
  COALESCE(SUM(l.debit_amount) FILTER (WHERE j.journal_entry_id IS NOT NULL),0) AS total_debit,
  COALESCE(SUM(l.credit_amount) FILTER (WHERE j.journal_entry_id IS NOT NULL),0) AS total_credit,
  COALESCE(SUM(l.debit_amount-l.credit_amount) FILTER (WHERE j.journal_entry_id IS NOT NULL),0) AS balance
FROM accounting.accounts a
JOIN accounting.account_types at ON at.account_type_id=a.account_type_id
LEFT JOIN accounting.journal_entry_lines l ON l.account_id=a.account_id
LEFT JOIN accounting.journal_entries j ON j.journal_entry_id=l.journal_entry_id
 AND j.company_id=a.company_id AND j.status IN ('POSTED','REVERSED')
GROUP BY a.company_id,a.account_id,a.account_code,a.account_name,at.code;
