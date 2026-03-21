-- Migration 007: User tokens and plans config
ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_balance INT NOT NULL DEFAULT 0;

-- Ensure config has plans info
-- Note: app_config is a singleton with a 'config' jsonb column.
-- We'll update the config via code in seed or a manual update.
