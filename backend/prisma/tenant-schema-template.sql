-- Tenant schema template — executed once per new tenant during onboarding.
-- Replace :schema_name with the actual schema slug before running.
-- All table names are fully qualified to avoid search_path side effects.

CREATE SCHEMA IF NOT EXISTS ":schema_name";

-- ── Clients ──────────────────────────────────────────────────────────────────
CREATE TABLE ":schema_name".clients (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name              TEXT        NOT NULL,
    last_name               TEXT        NOT NULL,
    date_of_birth           DATE        NOT NULL,
    gender                  TEXT        NOT NULL CHECK (gender IN ('MALE','FEMALE','OTHER')),
    phone                   TEXT        NOT NULL,
    email                   TEXT,
    address                 TEXT        NOT NULL,
    ward                    TEXT        NOT NULL,
    district                TEXT        NOT NULL,
    region                  TEXT        NOT NULL,
    national_id             TEXT,
    occupation              TEXT,
    employer                TEXT,
    next_of_kin_name        TEXT,
    next_of_kin_phone       TEXT,
    next_of_kin_relationship TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

-- ── KYC Documents ────────────────────────────────────────────────────────────
CREATE TABLE ":schema_name".kyc_documents (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID        NOT NULL REFERENCES ":schema_name".clients(id),
    document_type   TEXT        NOT NULL,
    document_number TEXT        NOT NULL,
    file_key        TEXT        NOT NULL,
    verified_at     TIMESTAMPTZ,
    verified_by     UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Loan Products ─────────────────────────────────────────────────────────────
CREATE TABLE ":schema_name".loan_products (
    id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT          NOT NULL,
    min_amount              BIGINT        NOT NULL,
    max_amount              BIGINT        NOT NULL,
    min_term_months         INT           NOT NULL,
    max_term_months         INT           NOT NULL,
    interest_method         TEXT          NOT NULL,
    interest_rate           NUMERIC(10,4) NOT NULL,
    repayment_frequency     TEXT          NOT NULL,
    processing_fee_percent  NUMERIC(10,4) NOT NULL DEFAULT 0,
    penalty_rate_percent    NUMERIC(10,4) NOT NULL DEFAULT 0,
    is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

-- ── Loan Accounts ─────────────────────────────────────────────────────────────
CREATE TABLE ":schema_name".loan_accounts (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_ref            TEXT          NOT NULL UNIQUE,
    client_id           UUID          NOT NULL REFERENCES ":schema_name".clients(id),
    product_id          UUID          NOT NULL REFERENCES ":schema_name".loan_products(id),
    officer_id          UUID          NOT NULL,
    term_months         INT           NOT NULL,
    repayment_frequency TEXT          NOT NULL,
    interest_method     TEXT          NOT NULL,
    interest_rate       NUMERIC(10,4) NOT NULL,
    principal_amount    BIGINT        NOT NULL,
    processing_fee      BIGINT        NOT NULL DEFAULT 0,
    disbursed_amount    BIGINT        NOT NULL DEFAULT 0,
    outstanding_balance BIGINT        NOT NULL DEFAULT 0,
    status              TEXT          NOT NULL DEFAULT 'DRAFT',
    notes               TEXT,
    applied_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    approved_at         TIMESTAMPTZ,
    approved_by         UUID,
    disbursed_at        TIMESTAMPTZ,
    maturity_date       DATE,
    closed_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

-- ── Repayment Schedule ────────────────────────────────────────────────────────
CREATE TABLE ":schema_name".repayment_schedule (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id         UUID        NOT NULL REFERENCES ":schema_name".loan_accounts(id),
    installment_no  INT         NOT NULL,
    due_date        DATE        NOT NULL,
    principal_due   BIGINT      NOT NULL,
    interest_due    BIGINT      NOT NULL,
    fees_due        BIGINT      NOT NULL DEFAULT 0,
    penalties_due   BIGINT      NOT NULL DEFAULT 0,
    total_due       BIGINT      NOT NULL,
    paid_amount     BIGINT      NOT NULL DEFAULT 0,
    status          TEXT        NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (loan_id, installment_no)
);

-- ── Ledger ────────────────────────────────────────────────────────────────────
CREATE TABLE ":schema_name".ledger_entries (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id          UUID        NOT NULL REFERENCES ":schema_name".loan_accounts(id),
    transaction_type TEXT        NOT NULL,
    debit_account    TEXT        NOT NULL,
    credit_account   TEXT        NOT NULL,
    amount           BIGINT      NOT NULL,
    channel          TEXT        NOT NULL,
    reference        TEXT        NOT NULL,
    idempotency_key  TEXT        NOT NULL UNIQUE,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Savings Products ──────────────────────────────────────────────────────────
CREATE TABLE ":schema_name".savings_products (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT          NOT NULL,
    min_balance         BIGINT        NOT NULL DEFAULT 0,
    interest_rate       NUMERIC(10,4) NOT NULL DEFAULT 0,
    interest_frequency  TEXT          NOT NULL DEFAULT 'MONTHLY',
    description         TEXT,
    is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

-- ── Savings Accounts ──────────────────────────────────────────────────────────
CREATE TABLE ":schema_name".savings_accounts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_ref     TEXT        NOT NULL UNIQUE,
    client_id       UUID        NOT NULL REFERENCES ":schema_name".clients(id),
    product_id      UUID        NOT NULL REFERENCES ":schema_name".savings_products(id),
    balance         BIGINT      NOT NULL DEFAULT 0,
    status          TEXT        NOT NULL DEFAULT 'ACTIVE',
    notes           TEXT,
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- ── Savings Transactions ──────────────────────────────────────────────────────
CREATE TABLE ":schema_name".savings_transactions (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id       UUID        NOT NULL REFERENCES ":schema_name".savings_accounts(id),
    transaction_type TEXT        NOT NULL,
    amount           BIGINT      NOT NULL,
    balance_after    BIGINT      NOT NULL,
    channel          TEXT        NOT NULL DEFAULT 'CASH',
    reference        TEXT        NOT NULL,
    idempotency_key  TEXT        NOT NULL UNIQUE,
    notes            TEXT,
    created_by       UUID,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Payment Requests (Selcom / Mobile Money) ─────────────────────────────────
CREATE TABLE ":schema_name".payment_requests (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id          UUID        NOT NULL REFERENCES ":schema_name".loan_accounts(id),
    payment_ref      TEXT        NOT NULL UNIQUE,
    selcom_ref       TEXT,
    amount           BIGINT      NOT NULL,
    phone            TEXT        NOT NULL,
    channel          TEXT,
    status           TEXT        NOT NULL DEFAULT 'PENDING',
    failure_reason   TEXT,
    callback_payload JSONB,
    expires_at       TIMESTAMPTZ NOT NULL,
    created_by       UUID,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Chart of Accounts ────────────────────────────────────────────────────────
CREATE TABLE ":schema_name".accounts (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT        NOT NULL UNIQUE,
    name        TEXT        NOT NULL,
    type        TEXT        NOT NULL,
    parent_id   UUID        REFERENCES ":schema_name".accounts(id),
    description TEXT,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    is_system   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Journal Entries ───────────────────────────────────────────────────────────
CREATE TABLE ":schema_name".journal_entries (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_ref   TEXT        NOT NULL UNIQUE,
    entry_date  DATE        NOT NULL,
    description TEXT        NOT NULL,
    reference   TEXT,
    status      TEXT        NOT NULL DEFAULT 'POSTED',
    is_system   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_by  UUID,
    posted_at   TIMESTAMPTZ,
    voided_at   TIMESTAMPTZ,
    voided_by   UUID,
    void_reason TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ":schema_name".journal_entry_lines (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id  UUID        NOT NULL REFERENCES ":schema_name".journal_entries(id),
    account_id        UUID        NOT NULL REFERENCES ":schema_name".accounts(id),
    debit_amount      BIGINT      NOT NULL DEFAULT 0,
    credit_amount     BIGINT      NOT NULL DEFAULT 0,
    description       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Seed: Standard MFI Chart of Accounts ─────────────────────────────────────
INSERT INTO ":schema_name".accounts (code, name, type, is_system) VALUES
  ('1000', 'Cash and Bank',          'ASSET',     TRUE),
  ('1001', 'Cash on Hand',           'ASSET',     TRUE),
  ('1002', 'Bank Account',           'ASSET',     TRUE),
  ('1003', 'Mobile Money Wallet',    'ASSET',     TRUE),
  ('1100', 'Loan Portfolio',         'ASSET',     TRUE),
  ('1101', 'Performing Loans',       'ASSET',     TRUE),
  ('1102', 'Non-Performing Loans',   'ASSET',     TRUE),
  ('1103', 'Loan Loss Provision',    'ASSET',     TRUE),
  ('1200', 'Receivables',            'ASSET',     TRUE),
  ('1201', 'Interest Receivable',    'ASSET',     TRUE),
  ('1202', 'Fees Receivable',        'ASSET',     TRUE),
  ('2000', 'Liabilities',            'LIABILITY', TRUE),
  ('2001', 'Member Savings',         'LIABILITY', TRUE),
  ('2002', 'Borrowings',             'LIABILITY', TRUE),
  ('3000', 'Equity',                 'EQUITY',    TRUE),
  ('3001', 'Share Capital',          'EQUITY',    TRUE),
  ('3002', 'Retained Earnings',      'EQUITY',    TRUE),
  ('4000', 'Income',                 'INCOME',    TRUE),
  ('4001', 'Interest Income',        'INCOME',    TRUE),
  ('4002', 'Processing Fee Income',  'INCOME',    TRUE),
  ('4003', 'Penalty Income',         'INCOME',    TRUE),
  ('4004', 'Savings Interest Income','INCOME',    TRUE),
  ('5000', 'Expenses',               'EXPENSE',   TRUE),
  ('5001', 'Provision Expense',      'EXPENSE',   TRUE),
  ('5002', 'Operating Expenses',     'EXPENSE',   TRUE),
  ('5003', 'Interest on Borrowings', 'EXPENSE',   TRUE);

-- Set parent_id for sub-accounts
UPDATE ":schema_name".accounts SET parent_id = (SELECT id FROM ":schema_name".accounts WHERE code = '1000') WHERE code IN ('1001','1002','1003');
UPDATE ":schema_name".accounts SET parent_id = (SELECT id FROM ":schema_name".accounts WHERE code = '1100') WHERE code IN ('1101','1102','1103');
UPDATE ":schema_name".accounts SET parent_id = (SELECT id FROM ":schema_name".accounts WHERE code = '1200') WHERE code IN ('1201','1202');
UPDATE ":schema_name".accounts SET parent_id = (SELECT id FROM ":schema_name".accounts WHERE code = '2000') WHERE code IN ('2001','2002');
UPDATE ":schema_name".accounts SET parent_id = (SELECT id FROM ":schema_name".accounts WHERE code = '3000') WHERE code IN ('3001','3002');
UPDATE ":schema_name".accounts SET parent_id = (SELECT id FROM ":schema_name".accounts WHERE code = '4000') WHERE code IN ('4001','4002','4003','4004');
UPDATE ":schema_name".accounts SET parent_id = (SELECT id FROM ":schema_name".accounts WHERE code = '5000') WHERE code IN ('5001','5002','5003');

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_clients_phone        ON ":schema_name".clients(phone);
CREATE INDEX idx_clients_national_id  ON ":schema_name".clients(national_id);
CREATE INDEX idx_kyc_client           ON ":schema_name".kyc_documents(client_id);
CREATE INDEX idx_loan_accounts_client ON ":schema_name".loan_accounts(client_id);
CREATE INDEX idx_loan_accounts_status ON ":schema_name".loan_accounts(status);
CREATE INDEX idx_repayment_due_date   ON ":schema_name".repayment_schedule(due_date) WHERE status != 'PAID';
CREATE INDEX idx_ledger_loan          ON ":schema_name".ledger_entries(loan_id);
CREATE INDEX idx_ledger_created       ON ":schema_name".ledger_entries(created_at);
-- ── Groups ────────────────────────────────────────────────────────────────────
CREATE TABLE ":schema_name".groups (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_ref           TEXT        NOT NULL UNIQUE,
    name                TEXT        NOT NULL,
    type                TEXT        NOT NULL,
    description         TEXT,
    meeting_day         TEXT,
    meeting_frequency   TEXT,
    status              TEXT        NOT NULL DEFAULT 'ACTIVE',
    formed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dissolved_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE TABLE ":schema_name".group_members (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID        NOT NULL REFERENCES ":schema_name".groups(id),
    client_id   UUID        NOT NULL REFERENCES ":schema_name".clients(id),
    role        TEXT        NOT NULL DEFAULT 'MEMBER',
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at     TIMESTAMPTZ,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ":schema_name".group_contributions (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id      UUID        NOT NULL REFERENCES ":schema_name".groups(id),
    meeting_date  DATE        NOT NULL,
    total_amount  BIGINT      NOT NULL,
    notes         TEXT,
    created_by    UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_savings_accounts_client ON ":schema_name".savings_accounts(client_id);
CREATE INDEX idx_savings_accounts_status ON ":schema_name".savings_accounts(status);
CREATE INDEX idx_savings_tx_account   ON ":schema_name".savings_transactions(account_id);
CREATE INDEX idx_savings_tx_created   ON ":schema_name".savings_transactions(created_at);
CREATE INDEX idx_groups_status        ON ":schema_name".groups(status);
CREATE INDEX idx_group_members_group  ON ":schema_name".group_members(group_id);
CREATE INDEX idx_group_members_client ON ":schema_name".group_members(client_id);
CREATE INDEX idx_group_contribs_group ON ":schema_name".group_contributions(group_id);
CREATE INDEX idx_payment_req_loan     ON ":schema_name".payment_requests(loan_id);
CREATE INDEX idx_payment_req_status   ON ":schema_name".payment_requests(status);
CREATE INDEX idx_accounts_type        ON ":schema_name".accounts(type);
CREATE INDEX idx_accounts_parent      ON ":schema_name".accounts(parent_id);
CREATE INDEX idx_je_entry_date        ON ":schema_name".journal_entries(entry_date);
CREATE INDEX idx_je_status            ON ":schema_name".journal_entries(status);
CREATE INDEX idx_jel_entry            ON ":schema_name".journal_entry_lines(journal_entry_id);
CREATE INDEX idx_jel_account          ON ":schema_name".journal_entry_lines(account_id);

-- ── Client Portal Users ───────────────────────────────────────────────────────
CREATE TABLE ":schema_name".portal_users (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id    UUID        NOT NULL UNIQUE REFERENCES ":schema_name".clients(id),
    phone        TEXT        NOT NULL,
    pin_hash     TEXT        NOT NULL,
    is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
    last_login   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_portal_users_phone ON ":schema_name".portal_users(phone);
