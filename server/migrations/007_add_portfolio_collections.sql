-- Migration 007: Add Portfolio Collections and Sharing System
-- Creates a folder-like organization system for portfolio videos

-- 1. Portfolio Collections (like folders)
CREATE TABLE IF NOT EXISTS portfolio_collections (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_collection_id INTEGER REFERENCES portfolio_collections(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,

  -- Metadata
  is_public BOOLEAN DEFAULT false,
  cover_image_url TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_portfolio_collections_parent ON portfolio_collections(parent_collection_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_collections_deleted ON portfolio_collections(deleted_at);

-- 2. Add collection_id to portfolio_videos
ALTER TABLE portfolio_videos ADD COLUMN IF NOT EXISTS collection_id INTEGER REFERENCES portfolio_collections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_portfolio_videos_collection ON portfolio_videos(collection_id);

-- 3. Portfolio Shares (token-based sharing system)
CREATE TABLE IF NOT EXISTS portfolio_shares (
  id SERIAL PRIMARY KEY,
  token VARCHAR(50) UNIQUE NOT NULL,

  -- What is being shared (exactly one must be set)
  collection_id INTEGER REFERENCES portfolio_collections(id) ON DELETE CASCADE,
  video_id INTEGER REFERENCES portfolio_videos(id) ON DELETE CASCADE,

  -- Access control
  password_hash VARCHAR(255),
  expires_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  view_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP,

  -- Ensure exactly one entity is shared
  CONSTRAINT portfolio_share_one_entity_check CHECK (
    (collection_id IS NOT NULL AND video_id IS NULL) OR
    (collection_id IS NULL AND video_id IS NOT NULL)
  )
);

-- Indexes for shares
CREATE INDEX IF NOT EXISTS idx_portfolio_shares_token ON portfolio_shares(token);
CREATE INDEX IF NOT EXISTS idx_portfolio_shares_collection ON portfolio_shares(collection_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_shares_video ON portfolio_shares(video_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_shares_expires ON portfolio_shares(expires_at);

-- 4. View for collections with stats
CREATE OR REPLACE VIEW portfolio_collections_with_stats AS
WITH RECURSIVE all_subcollections AS (
  -- Root collections
  SELECT c.id as root_id, c.id as collection_id
  FROM portfolio_collections c
  WHERE c.deleted_at IS NULL

  UNION ALL

  -- Recursive subcollections
  SELECT t.root_id, c.id
  FROM portfolio_collections c
  JOIN all_subcollections t ON t.collection_id = c.parent_collection_id
  WHERE c.deleted_at IS NULL
)
SELECT
  c.*,
  -- Direct videos count
  (SELECT COUNT(*)
   FROM portfolio_videos v
   WHERE v.collection_id = c.id
   AND v.deleted_at IS NULL) as videos_count,

  -- Direct subcollections count
  (SELECT COUNT(*)
   FROM portfolio_collections sc
   WHERE sc.parent_collection_id = c.id
   AND sc.deleted_at IS NULL) as subcollections_count,

  -- Total videos in this collection and all subcollections
  (SELECT COUNT(*)
   FROM portfolio_videos v
   WHERE v.collection_id IN (
     SELECT collection_id FROM all_subcollections WHERE root_id = c.id
   )
   AND v.deleted_at IS NULL) as total_videos_count,

  -- Total size of videos in collection
  (SELECT COALESCE(SUM(v.file_size), 0)
   FROM portfolio_videos v
   WHERE v.collection_id = c.id
   AND v.deleted_at IS NULL) as total_size

FROM portfolio_collections c
WHERE c.deleted_at IS NULL;

-- 5. Function to generate unique share token
CREATE OR REPLACE FUNCTION generate_portfolio_share_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
  token_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 10-character alphanumeric token
    token := substring(md5(random()::text || clock_timestamp()::text) from 1 for 10);

    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM portfolio_shares WHERE portfolio_shares.token = token) INTO token_exists;

    -- Exit loop if token is unique
    IF NOT token_exists THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN token;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger to update updated_at on collections
CREATE OR REPLACE FUNCTION update_portfolio_collection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_portfolio_collections_updated_at
  BEFORE UPDATE ON portfolio_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_portfolio_collection_timestamp();
