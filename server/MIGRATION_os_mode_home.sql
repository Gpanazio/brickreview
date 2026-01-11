-- Migration to support OS Mode on Home (Root Folders and Project organization)

-- 1. Make project_id nullable in folders table to allow root folders
ALTER TABLE brickreview_folders ALTER COLUMN project_id DROP NOT NULL;

-- 2. Add folder_id to projects table to allow organizing projects into folders
ALTER TABLE brickreview_projects ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES brickreview_folders(id) ON DELETE SET NULL;

-- 3. Index for performance
CREATE INDEX IF NOT EXISTS idx_projects_folder ON brickreview_projects(folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_root ON brickreview_folders(parent_folder_id) WHERE project_id IS NULL;

-- Update the view to include folder_id
DROP VIEW IF EXISTS brickreview_projects_with_stats CASCADE;
CREATE VIEW brickreview_projects_with_stats AS
SELECT
  p.id,
  p.name,
  p.description,
  p.client_name,
  p.status,
  p.cover_image_r2_key,
  p.cover_image_url,
  p.created_by,
  p.created_at,
  p.updated_at,
  p.folder_id,
  COUNT(DISTINCT v.id) as videos_count,
  COUNT(DISTINCT CASE WHEN v.version_number = 1 THEN v.id END) as unique_videos_count,
  COUNT(DISTINCT m.user_id) as members_count,
  (SELECT username FROM master_users WHERE id = p.created_by) as created_by_username
FROM brickreview_projects p
LEFT JOIN brickreview_videos v ON v.project_id = p.id
LEFT JOIN brickreview_project_members m ON m.project_id = p.id
GROUP BY p.id, p.name, p.description, p.client_name, p.status, p.cover_image_r2_key, p.cover_image_url, p.created_by, p.created_at, p.updated_at, p.folder_id;
