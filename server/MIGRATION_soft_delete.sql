-- Adiciona coluna deleted_at para Soft Delete
ALTER TABLE brickreview_projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE brickreview_folders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE brickreview_videos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE brickreview_files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Atualizar Views para ignorar itens deletados por padrão

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
  p.deleted_at,
  COUNT(DISTINCT v.id) as videos_count,
  COUNT(DISTINCT CASE WHEN v.version_number = 1 AND v.deleted_at IS NULL THEN v.id END) as unique_videos_count,
  COUNT(DISTINCT m.user_id) as members_count,
  (SELECT username FROM master_users WHERE id = p.created_by) as created_by_username
FROM brickreview_projects p
LEFT JOIN brickreview_videos v ON v.project_id = p.id AND v.deleted_at IS NULL
LEFT JOIN brickreview_project_members m ON m.project_id = p.id
-- Removido WHERE p.deleted_at IS NULL para permitir que a view liste tudo, 
-- o filtro será feito nas queries das rotas
GROUP BY p.id, p.name, p.description, p.client_name, p.status, p.cover_image_r2_key, p.cover_image_url, p.created_by, p.created_at, p.updated_at, p.deleted_at;

DROP VIEW IF EXISTS brickreview_videos_with_stats CASCADE;
CREATE VIEW brickreview_videos_with_stats AS
SELECT
  v.*,
  COUNT(DISTINCT c.id) as comments_count,
  COUNT(DISTINCT CASE WHEN c.status = 'open' THEN c.id END) as open_comments_count,
  (SELECT status FROM brickreview_approvals WHERE video_id = v.id ORDER BY created_at DESC LIMIT 1) as latest_approval_status,
  (SELECT username FROM master_users WHERE id = v.uploaded_by) as uploaded_by_username
FROM brickreview_videos v
LEFT JOIN brickreview_comments c ON c.video_id = v.id
GROUP BY v.id;

DROP VIEW IF EXISTS brickreview_folders_with_stats CASCADE;
CREATE VIEW brickreview_folders_with_stats AS
SELECT
  f.id,
  f.project_id,
  f.parent_folder_id,
  f.name,
  f.created_at,
  f.deleted_at,
  COUNT(DISTINCT v.id) as videos_count,
  COUNT(DISTINCT sf.id) as subfolders_count
FROM brickreview_folders f
LEFT JOIN brickreview_videos v ON v.folder_id = f.id AND v.deleted_at IS NULL
LEFT JOIN brickreview_folders sf ON sf.parent_folder_id = f.id AND sf.deleted_at IS NULL
GROUP BY f.id, f.project_id, f.parent_folder_id, f.name, f.created_at, f.deleted_at;
