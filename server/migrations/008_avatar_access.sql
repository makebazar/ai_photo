-- Migration 008: Avatar access and generation costs
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_access_expires_at TIMESTAMP WITH TIME ZONE;
