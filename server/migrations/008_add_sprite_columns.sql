-- Migration: Add sprite columns
-- Description: Adds columns for sprite sheet and VTT to support video hover previews.

DO $$
BEGIN
    -- Add sprite_sheet_url if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brickreview_videos' AND column_name = 'sprite_sheet_url') THEN
        ALTER TABLE brickreview_videos ADD COLUMN sprite_sheet_url TEXT;
    END IF;

    -- Add sprite_sheet_r2_key if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brickreview_videos' AND column_name = 'sprite_sheet_r2_key') THEN
        ALTER TABLE brickreview_videos ADD COLUMN sprite_sheet_r2_key VARCHAR(500);
    END IF;

    -- Add sprite_vtt_url if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brickreview_videos' AND column_name = 'sprite_vtt_url') THEN
        ALTER TABLE brickreview_videos ADD COLUMN sprite_vtt_url TEXT;
    END IF;

    -- Add sprite_vtt_r2_key if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brickreview_videos' AND column_name = 'sprite_vtt_r2_key') THEN
        ALTER TABLE brickreview_videos ADD COLUMN sprite_vtt_r2_key VARCHAR(500);
    END IF;

END $$;
