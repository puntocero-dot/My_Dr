-- Migration: Create revoked_tokens table for JWT blocklist

CREATE TABLE IF NOT EXISTS revoked_tokens (
    token TEXT PRIMARY KEY,
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at);

-- Add a function to clean up expired tokens periodically
CREATE OR REPLACE FUNCTION cleanup_revoked_tokens() RETURNS void AS $$
BEGIN
    DELETE FROM revoked_tokens WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;
