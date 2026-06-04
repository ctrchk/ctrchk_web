-- db/email_system_schema.sql

-- Table for storing email accounts
CREATE TABLE IF NOT EXISTS email_accounts (
    id SERIAL PRIMARY KEY,
    email_address VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table for storing incoming and outgoing email messages
CREATE TABLE IF NOT EXISTS email_messages (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES email_accounts(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('INBOX', 'SENT')),
    sender VARCHAR(255) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    body_text TEXT,
    body_html TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_messages_account_id ON email_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_email_address ON email_accounts(email_address);
