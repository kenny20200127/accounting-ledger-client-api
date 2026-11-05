-- Chart-of-accounts legs recorded on each payment and expense.
--   sales.customer_payments -> debit_account_id / credit_account_id (+ FKs)
--   purchasing.expenses     -> payment_account_id becomes NOT NULL when filled
-- Additive and idempotent; existing ledger rows are never rewritten. The credit
-- leg backfill is a separate step once the contra accounts are confirmed.
BEGIN;

ALTER TABLE sales.customer_payments
    ADD COLUMN IF NOT EXISTS debit_account_id uuid,
    ADD COLUMN IF NOT EXISTS credit_account_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'customer_payments_debit_account_id_fkey'
          AND connamespace = 'sales'::regnamespace
    ) THEN
        ALTER TABLE sales.customer_payments
            ADD CONSTRAINT customer_payments_debit_account_id_fkey
            FOREIGN KEY (debit_account_id) REFERENCES accounting.accounts (account_id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'customer_payments_credit_account_id_fkey'
          AND connamespace = 'sales'::regnamespace
    ) THEN
        ALTER TABLE sales.customer_payments
            ADD CONSTRAINT customer_payments_credit_account_id_fkey
            FOREIGN KEY (credit_account_id) REFERENCES accounting.accounts (account_id) ON DELETE RESTRICT;
    END IF;
END $$;

-- The debit leg is the bank account each payment was already posted against.
UPDATE sales.customer_payments p
   SET debit_account_id = ba.account_id
  FROM banking.bank_accounts ba
 WHERE ba.bank_account_id = p.bank_account_id
   AND p.debit_account_id IS NULL
   AND p.bank_account_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM purchasing.expenses WHERE payment_account_id IS NULL
    ) THEN
        ALTER TABLE purchasing.expenses
            ALTER COLUMN payment_account_id SET NOT NULL;
    END IF;
END $$;

COMMIT;
