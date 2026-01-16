-- Add storage location tracking fields to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS storage_location VARCHAR(20) DEFAULT 'r2';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(255);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS drive_backup_date TIMESTAMP;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS r2_bucket_id VARCHAR(50) DEFAULT 'primary';

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_videos_storage_location ON videos(storage_location);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);

-- Comments for documentation
COMMENT ON COLUMN videos.storage_location IS 'Current primary storage: r2, drive, or both';
COMMENT ON COLUMN videos.drive_file_id IS 'Google Drive file ID for backup';
COMMENT ON COLUMN videos.drive_backup_date IS 'When the file was backed up to Drive';
COMMENT ON COLUMN videos.r2_bucket_id IS 'Which R2 bucket (primary/secondary) stores this video';
