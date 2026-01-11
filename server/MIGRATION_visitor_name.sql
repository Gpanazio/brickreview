-- MIGRATION: Add visitor_name column to support guest comments
-- Run this on your Railway database

BEGIN;

-- Add visitor_name column
ALTER TABLE brickreview_comments
ADD COLUMN IF NOT EXISTS visitor_name VARCHAR(255);

-- Make user_id nullable to support guests
ALTER TABLE brickreview_comments
ALTER COLUMN user_id DROP NOT NULL;

-- Add constraint: must have either user_id or visitor_name
ALTER TABLE brickreview_comments
DROP CONSTRAINT IF EXISTS user_or_visitor;

ALTER TABLE brickreview_comments
ADD CONSTRAINT user_or_visitor CHECK (user_id IS NOT NULL OR visitor_name IS NOT NULL);

COMMIT;

-- Verify the changes
\d brickreview_comments
