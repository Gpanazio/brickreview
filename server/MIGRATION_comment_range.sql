-- Migration: Add timestamp_end to brickreview_comments
-- Description: Adds support for comment ranges (start to end time)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brickreview_comments' AND column_name = 'timestamp_end'
  ) THEN
    ALTER TABLE brickreview_comments ADD COLUMN timestamp_end DECIMAL(10, 3);
  END IF;
END $$;
