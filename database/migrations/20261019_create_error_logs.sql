CREATE TABLE IF NOT EXISTS audit.error_logs (
    error_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    status_code integer NOT NULL,
    method character varying(10),
    path text,
    message text NOT NULL,
    stack text,
    error_name character varying(120),
    request_id character varying(64),
    user_id uuid,
    company_id uuid,
    ip_address character varying(64),
    user_agent text,
    request_body jsonb
);

CREATE INDEX IF NOT EXISTS idx_error_logs_occurred_at
    ON audit.error_logs (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_status_code
    ON audit.error_logs (status_code);
