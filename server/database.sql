-- BrickReview Database Schema
-- Sistema de revisão de vídeos estilo Frame.io
-- Railway PostgreSQL

-- ============================================
-- 1. PROJECTS
-- ============================================

CREATE TABLE IF NOT EXISTS review_projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  client_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active', -- active, archived, completed
  created_by INTEGER REFERENCES master_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_review_projects_updated_at
  BEFORE UPDATE ON review_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. FOLDERS (organização hierárquica)
-- ============================================

CREATE TABLE IF NOT EXISTS review_folders (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES review_projects(id) ON DELETE CASCADE,
  parent_folder_id INTEGER REFERENCES review_folders(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. VIDEOS (armazenados no Cloudflare R2)
-- ============================================

CREATE TABLE IF NOT EXISTS review_videos (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES review_projects(id) ON DELETE CASCADE,
  folder_id INTEGER REFERENCES review_folders(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  r2_key VARCHAR(500) NOT NULL, -- Chave do objeto no R2
  r2_url TEXT NOT NULL, -- URL pública do vídeo
  thumbnail_r2_key VARCHAR(500),
  thumbnail_url TEXT,
  duration DECIMAL(10, 2), -- Duração em segundos
  fps INTEGER DEFAULT 30,
  width INTEGER,
  height INTEGER,
  file_size BIGINT, -- Tamanho em bytes
  mime_type VARCHAR(100),
  version_number INTEGER DEFAULT 1,
  parent_video_id INTEGER REFERENCES review_videos(id) ON DELETE SET NULL, -- Para versionamento
  uploaded_by INTEGER REFERENCES master_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_review_videos_updated_at
  BEFORE UPDATE ON review_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. COMMENTS (com timestamp e threads)
-- ============================================

CREATE TABLE IF NOT EXISTS review_comments (
  id SERIAL PRIMARY KEY,
  video_id INTEGER NOT NULL REFERENCES review_videos(id) ON DELETE CASCADE,
  parent_comment_id INTEGER REFERENCES review_comments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES master_users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  timestamp DECIMAL(10, 3), -- Timestamp do vídeo em segundos com milissegundos
  status VARCHAR(50) DEFAULT 'open', -- open, in_progress, resolved
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_review_comments_updated_at
  BEFORE UPDATE ON review_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. APPROVALS (aprovação de clientes)
-- ============================================

CREATE TABLE IF NOT EXISTS review_approvals (
  id SERIAL PRIMARY KEY,
  video_id INTEGER NOT NULL REFERENCES review_videos(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES master_users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL, -- pending, approved, changes_requested
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. PROJECT MEMBERS (controle de acesso)
-- ============================================

CREATE TABLE IF NOT EXISTS review_project_members (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES review_projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES master_users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'viewer', -- admin, client
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id)
);

-- ============================================
-- 7. NOTIFICATIONS (in-app + email)
-- ============================================

CREATE TABLE IF NOT EXISTS review_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES master_users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- comment, reply, approval, mention
  related_video_id INTEGER REFERENCES review_videos(id) ON DELETE CASCADE,
  related_comment_id INTEGER REFERENCES review_comments(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES (para performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_videos_project ON review_videos(project_id);
CREATE INDEX IF NOT EXISTS idx_videos_folder ON review_videos(folder_id);
CREATE INDEX IF NOT EXISTS idx_videos_parent ON review_videos(parent_video_id);

CREATE INDEX IF NOT EXISTS idx_comments_video ON review_comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_timestamp ON review_comments(timestamp);
CREATE INDEX IF NOT EXISTS idx_comments_status ON review_comments(status);

CREATE INDEX IF NOT EXISTS idx_approvals_video ON review_approvals(video_id);
CREATE INDEX IF NOT EXISTS idx_approvals_user ON review_approvals(user_id);

CREATE INDEX IF NOT EXISTS idx_members_project ON review_project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON review_project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON review_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON review_notifications(read);

CREATE INDEX IF NOT EXISTS idx_folders_project ON review_folders(project_id);

-- ============================================
-- VIEWS (queries úteis)
-- ============================================

-- View: Vídeos com contagem de comentários e status de aprovação
CREATE OR REPLACE VIEW review_videos_with_stats AS
SELECT
  v.*,
  COUNT(DISTINCT c.id) as comments_count,
  COUNT(DISTINCT CASE WHEN c.status = 'open' THEN c.id END) as open_comments_count,
  (SELECT status FROM review_approvals WHERE video_id = v.id ORDER BY created_at DESC LIMIT 1) as latest_approval_status,
  (SELECT username FROM master_users WHERE id = v.uploaded_by) as uploaded_by_username
FROM review_videos v
LEFT JOIN review_comments c ON c.video_id = v.id
GROUP BY v.id;

-- View: Comentários com informações do usuário
CREATE OR REPLACE VIEW review_comments_with_user AS
SELECT
  c.*,
  u.username,
  u.email,
  (SELECT COUNT(*) FROM review_comments WHERE parent_comment_id = c.id) as replies_count
FROM review_comments c
JOIN master_users u ON c.user_id = u.id;

-- View: Projetos com estatísticas
CREATE OR REPLACE VIEW review_projects_with_stats AS
SELECT
  p.*,
  COUNT(DISTINCT v.id) as videos_count,
  COUNT(DISTINCT CASE WHEN v.version_number = 1 THEN v.id END) as unique_videos_count,
  COUNT(DISTINCT m.user_id) as members_count,
  (SELECT username FROM master_users WHERE id = p.created_by) as created_by_username
FROM review_projects p
LEFT JOIN review_videos v ON v.project_id = p.id
LEFT JOIN review_project_members m ON m.project_id = p.id
GROUP BY p.id;

-- ============================================
-- SAMPLE DATA (opcional para desenvolvimento)
-- ============================================

-- Descomentar para criar dados de exemplo:

-- INSERT INTO review_projects (name, description, client_name, created_by)
-- VALUES ('Demo Project', 'Projeto de demonstração', 'Cliente Teste', 1);

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

-- 1. Este schema assume que a tabela master_users já existe
--    (compartilhada com brickprojects e BrickAI)

-- 2. Os vídeos são armazenados no Cloudflare R2, não no banco
--    O banco armazena apenas as URLs e metadados

-- 3. O Railway PostgreSQL deve ter suporte a DECIMAL e BIGINT

-- 4. As triggers garantem que updated_at seja sempre atualizado

-- 5. Os índices são essenciais para performance com muitos vídeos/comentários

-- 6. As views facilitam queries complexas no frontend

-- 7. ON DELETE CASCADE garante integridade referencial

-- 8. Para backups, use: pg_dump -d brickreview -F c -f backup.dump
