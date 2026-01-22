-- Migration: Add missing columns to brickreview_videos
-- Description: Adds drive_file_id, drive_backup_date, storage_location, and r2_bucket_id to support backup logic.

DO $$
BEGIN
    -- Add drive_file_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brickreview_videos' AND column_name = 'drive_file_id') THEN
        ALTER TABLE brickreview_videos ADD COLUMN drive_file_id VARCHAR(255);
    END IF;

    -- Add drive_backup_date if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brickreview_videos' AND column_name = 'drive_backup_date') THEN
        ALTER TABLE brickreview_videos ADD COLUMN drive_backup_date TIMESTAMP;
    END IF;

    -- Add storage_location if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brickreview_videos' AND column_name = 'storage_location') THEN
        ALTER TABLE brickreview_videos ADD COLUMN storage_location VARCHAR(50) DEFAULT 'r2'; 
    END IF;

    -- Add r2_bucket_id if it doesn't exist (assuming string identifier for bucket config)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brickreview_videos' AND column_name = 'r2_bucket_id') THEN
        ALTER TABLE brickreview_videos ADD COLUMN r2_bucket_id VARCHAR(100) DEFAULT 'primary';
    END IF;
    
    -- Ensure file_path exists if it was referenced (though typically r2_key is used, some legacy code might look for this)
    -- Checking the code, it seems 'file_path' might be used in 'portfolio_videos' but not clearly in 'brickreview_videos'.
    -- The report mentioned 'file_path' as an orphan. We will add it only if strictly necessary or map it to r2_key in code.
    -- For now, skipping file_path adding to brickreview_videos as r2_key is the standard there, preventing further confusion.
    
END $$;
