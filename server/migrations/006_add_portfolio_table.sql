-- Migration: Add portfolio_videos table for embeddable videos
-- This table stores videos specifically for portfolio/embed purposes
-- All videos are stored in R2 (not Google Drive)
-- Videos can be password-protected

CREATE TABLE IF NOT EXISTS portfolio_videos (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT,
  duration DECIMAL(10, 2),
  thumbnail_path VARCHAR(500),
  r2_bucket_id VARCHAR(100) DEFAULT 'primary',

  -- Password protection
  is_password_protected BOOLEAN DEFAULT FALSE,
  password_hash VARCHAR(255),

  -- Embed settings
  allow_embedding BOOLEAN DEFAULT TRUE,
  direct_url TEXT,
  embed_code TEXT,

  -- Metadata
  width INTEGER,
  height INTEGER,
  codec VARCHAR(100),
  bitrate INTEGER,

  -- Tracking
  view_count INTEGER DEFAULT 0,
  embed_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_portfolio_videos_created_at ON portfolio_videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_videos_deleted_at ON portfolio_videos(deleted_at);

-- View with stats
CREATE OR REPLACE VIEW portfolio_videos_with_stats AS
SELECT
  pv.*,
  CASE
    WHEN pv.file_size IS NOT NULL THEN
      pg_size_pretty(pv.file_size)
    ELSE NULL
  END as file_size_formatted
FROM portfolio_videos pv
WHERE pv.deleted_at IS NULL;

-- Trigger to update updated_at automatically
DROP TRIGGER IF EXISTS update_portfolio_videos_updated_at ON portfolio_videos;
CREATE TRIGGER update_portfolio_videos_updated_at
  BEFORE UPDATE ON portfolio_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
