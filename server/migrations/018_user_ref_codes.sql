-- Migration 018: Add personal referral codes to all users

-- 1. Add personal_ref_code column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_ref_code text UNIQUE;

-- 2. Populate existing users with unique codes
DO $$
DECLARE
    r RECORD;
    v_code text;
BEGIN
    FOR r IN SELECT id FROM users WHERE personal_ref_code IS NULL LOOP
        LOOP
            -- Generate a random 6-char alphanumeric code
            v_code := lower(substring(md5(random()::text) from 1 for 6));
            -- Check if it exists
            IF NOT EXISTS (SELECT 1 FROM users WHERE personal_ref_code = v_code) 
               AND NOT EXISTS (SELECT 1 FROM partners WHERE client_code = 'client_' || v_code OR team_code = 'team_' || v_code)
            THEN
                UPDATE users SET personal_ref_code = v_code WHERE id = r.id;
                EXIT;
            END IF;
        END LOOP;
    END LOOP;
END$$;
