BEGIN;

-- Add storage location tracking fields to brickreview_videos table
ALTER TABLE brickreview_videos ADD COLUMN IF NOT EXISTS storage_location VARCHAR(20) DEFAULT 'r2';
ALTER TABLE brickreview_videos ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(255);
ALTER TABLE brickreview_videos ADD COLUMN IF NOT EXISTS drive_backup_date TIMESTAMP;
ALTER TABLE brickreview_videos ADD COLUMN IF NOT EXISTS r2_bucket_id VARCHAR(50) DEFAULT 'primary';

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_brickreview_videos_storage_location ON brickreview_videos(storage_location);
CREATE INDEX IF NOT EXISTS idx_brickreview_videos_created_at ON brickreview_videos(created_at);

-- Comments for documentation
COMMENT ON COLUMN brickreview_videos.storage_location IS 'Current primary storage: r2, drive, or both';
COMMENT ON COLUMN brickreview_videos.drive_file_id IS 'Google Drive file ID for backup';
COMMENT ON COLUMN brickreview_videos.drive_backup_date IS 'When the file was backed up to Drive';
COMMENT ON COLUMN brickreview_videos.r2_bucket_id IS 'Which R2 bucket (primary/secondary) stores this video';

COMMIT;
