ALTER TABLE core.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS users_company_not_deleted_idx ON core.users(company_id) WHERE deleted_at IS NULL;
