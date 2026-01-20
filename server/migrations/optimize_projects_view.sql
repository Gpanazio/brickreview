-- Optimization for brickreview_projects_with_stats view
-- Replaces LEFT JOINs with Subqueries to avoid Cartesian product and expensive GROUP BY

DROP VIEW IF EXISTS brickreview_projects_with_stats;

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
  COALESCE((SELECT COUNT(*) FROM brickreview_videos v WHERE v.project_id = p.id AND v.deleted_at IS NULL), 0) as videos_count,
  COALESCE((SELECT COUNT(*) FROM brickreview_videos v WHERE v.project_id = p.id AND v.deleted_at IS NULL AND v.version_number = 1), 0) as unique_videos_count,
  COALESCE((SELECT COUNT(*) FROM brickreview_project_members m WHERE m.project_id = p.id), 0) as members_count,
  (SELECT username FROM master_users WHERE id = p.created_by) as created_by_username
FROM brickreview_projects p;
