-- BrickReview Database Schema
-- Sistema de revisão de vídeos estilo Frame.io
-- Railway PostgreSQL

-- ============================================
-- 1. PROJECTS
-- ============================================

CREATE TABLE IF NOT EXISTS brickreview_projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  client_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active', -- active, archived, completed
  cover_image_r2_key VARCHAR(500),
  cover_image_url TEXT,
  created_by UUID REFERENCES master_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Soft delete: adiciona coluna para bancos existentes
ALTER TABLE brickreview_projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_brickreview_projects_updated_at ON brickreview_projects;
CREATE TRIGGER update_brickreview_projects_updated_at
  BEFORE UPDATE ON brickreview_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. FOLDERS (organização hierárquica)
-- ============================================

CREATE TABLE IF NOT EXISTS brickreview_folders (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES brickreview_projects(id) ON DELETE CASCADE,
  parent_folder_id INTEGER REFERENCES brickreview_folders(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Soft delete: adiciona coluna para bancos existentes
ALTER TABLE brickreview_folders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================
-- 3. VIDEOS (armazenados no Cloudflare R2)
-- ============================================

CREATE TABLE IF NOT EXISTS brickreview_videos (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES brickreview_projects(id) ON DELETE CASCADE,
  folder_id INTEGER REFERENCES brickreview_folders(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  r2_key VARCHAR(500) NOT NULL, -- Chave do objeto no R2
  r2_url TEXT NOT NULL, -- URL pública do vídeo
  streaming_high_r2_key VARCHAR(500), -- Versão de alta qualidade (15-35Mbps)
  streaming_high_url TEXT,
  proxy_r2_key VARCHAR(500), -- Chave do proxy 720p no R2
  proxy_url TEXT, -- URL pública do proxy
  thumbnail_r2_key VARCHAR(500),
  thumbnail_url TEXT,
  sprite_r2_key VARCHAR(500),
  sprite_url TEXT,
  sprite_vtt_url TEXT,
  duration DECIMAL(10, 2), -- Duração em segundos
  fps INTEGER DEFAULT 30,
  width INTEGER,
  height INTEGER,
  file_size BIGINT, -- Tamanho em bytes
  mime_type VARCHAR(100),
  version_number INTEGER DEFAULT 1,
  parent_video_id INTEGER REFERENCES brickreview_videos(id) ON DELETE SET NULL, -- Para versionamento
  uploaded_by UUID REFERENCES master_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Soft delete: adiciona coluna para bancos existentes
ALTER TABLE brickreview_videos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Adiciona colunas de proxy se não existirem (para migração de bancos existentes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brickreview_videos' AND column_name = 'proxy_r2_key'
  ) THEN
    ALTER TABLE brickreview_videos ADD COLUMN proxy_r2_key VARCHAR(500);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brickreview_videos' AND column_name = 'proxy_url'
  ) THEN
    ALTER TABLE brickreview_videos ADD COLUMN proxy_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brickreview_videos' AND column_name = 'sprite_r2_key'
  ) THEN
    ALTER TABLE brickreview_videos ADD COLUMN sprite_r2_key VARCHAR(500);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brickreview_videos' AND column_name = 'sprite_url'
  ) THEN
    ALTER TABLE brickreview_videos ADD COLUMN sprite_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brickreview_videos' AND column_name = 'sprite_vtt_url'
  ) THEN
    ALTER TABLE brickreview_videos ADD COLUMN sprite_vtt_url TEXT;
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_brickreview_videos_updated_at ON brickreview_videos;
CREATE TRIGGER update_brickreview_videos_updated_at
  BEFORE UPDATE ON brickreview_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3.1 FILES (arquivos genéricos - imagens, PDFs, etc)
-- ============================================

CREATE TABLE IF NOT EXISTS brickreview_files (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES brickreview_projects(id) ON DELETE CASCADE,
  folder_id INTEGER REFERENCES brickreview_folders(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  r2_key VARCHAR(500) NOT NULL,
  r2_url TEXT NOT NULL,
  thumbnail_r2_key VARCHAR(500),
  thumbnail_url TEXT,
  file_type VARCHAR(50) NOT NULL, -- image, document, audio, other
  mime_type VARCHAR(100),
  file_size BIGINT,
  width INTEGER, -- Para imagens
  height INTEGER, -- Para imagens
  uploaded_by UUID REFERENCES master_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Soft delete: adiciona coluna para bancos existentes
ALTER TABLE brickreview_files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

DROP TRIGGER IF EXISTS update_brickreview_files_updated_at ON brickreview_files;
CREATE TRIGGER update_brickreview_files_updated_at
  BEFORE UPDATE ON brickreview_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. COMMENTS (com timestamp e threads)
-- ============================================

CREATE TABLE IF NOT EXISTS brickreview_comments (
  id SERIAL PRIMARY KEY,
  video_id INTEGER NOT NULL REFERENCES brickreview_videos(id) ON DELETE CASCADE,
  parent_comment_id INTEGER REFERENCES brickreview_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES master_users(id) ON DELETE CASCADE, -- Permite NULL para guests
  visitor_name VARCHAR(255), -- Nome do visitante quando user_id é NULL
  content TEXT NOT NULL,
  timestamp DECIMAL(10, 3), -- Timestamp do vídeo em segundos com milissegundos
  timestamp_end DECIMAL(10, 3), -- Fim do range em segundos com milissegundos
  status VARCHAR(50) DEFAULT 'open', -- open, in_progress, resolved
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_or_visitor CHECK (user_id IS NOT NULL OR visitor_name IS NOT NULL)
);

DROP TRIGGER IF EXISTS update_brickreview_comments_updated_at ON brickreview_comments;
CREATE TRIGGER update_brickreview_comments_updated_at
  BEFORE UPDATE ON brickreview_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. APPROVALS (aprovação de clientes)
-- ============================================

CREATE TABLE IF NOT EXISTS brickreview_approvals (
  id SERIAL PRIMARY KEY,
  video_id INTEGER NOT NULL REFERENCES brickreview_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES master_users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL, -- pending, approved, changes_requested
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. PROJECT MEMBERS (controle de acesso)
-- ============================================

CREATE TABLE IF NOT EXISTS brickreview_project_members (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES brickreview_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES master_users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'viewer', -- admin, client
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id)
);

-- ============================================
-- 7. NOTIFICATIONS (in-app + email)
-- ============================================

CREATE TABLE IF NOT EXISTS brickreview_notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES master_users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- comment, reply, approval, mention
  related_video_id INTEGER REFERENCES brickreview_videos(id) ON DELETE CASCADE,
  related_comment_id INTEGER REFERENCES brickreview_comments(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES (para performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_videos_project ON brickreview_videos(project_id);
CREATE INDEX IF NOT EXISTS idx_videos_folder_on_videos ON brickreview_videos(folder_id);
CREATE INDEX IF NOT EXISTS idx_videos_parent ON brickreview_videos(parent_video_id);

CREATE INDEX IF NOT EXISTS idx_comments_video ON brickreview_comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_timestamp ON brickreview_comments(timestamp);
CREATE INDEX IF NOT EXISTS idx_comments_status ON brickreview_comments(status);

CREATE INDEX IF NOT EXISTS idx_approvals_video ON brickreview_approvals(video_id);
CREATE INDEX IF NOT EXISTS idx_approvals_user ON brickreview_approvals(user_id);

CREATE INDEX IF NOT EXISTS idx_members_project ON brickreview_project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON brickreview_project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON brickreview_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON brickreview_notifications(read);

CREATE INDEX IF NOT EXISTS idx_folders_project ON brickreview_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON brickreview_folders(parent_folder_id);

-- ============================================
-- 8. SHARES (links de compartilhamento)
-- ============================================

CREATE TABLE IF NOT EXISTS brickreview_shares (
  id SERIAL PRIMARY KEY,
  token VARCHAR(50) UNIQUE NOT NULL, -- Token curto (nanoid)
  project_id INTEGER REFERENCES brickreview_projects(id) ON DELETE CASCADE,
  folder_id INTEGER REFERENCES brickreview_folders(id) ON DELETE CASCADE,
  video_id INTEGER REFERENCES brickreview_videos(id) ON DELETE CASCADE,
  access_type VARCHAR(50) DEFAULT 'view', -- view, comment
  password_hash VARCHAR(255), -- Senha opcional para o link
  expires_at TIMESTAMP, -- Data de expiração opcional
  created_by UUID REFERENCES master_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Garante que o link aponte para exatamente uma entidade
  CONSTRAINT one_entity_check CHECK (
    (project_id IS NOT NULL AND folder_id IS NULL AND video_id IS NULL) OR
    (project_id IS NULL AND folder_id IS NOT NULL AND video_id IS NULL) OR
    (project_id IS NULL AND folder_id IS NULL AND video_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_shares_token ON brickreview_shares(token);

-- ============================================
-- VIEWS (queries úteis)
-- ============================================

-- Drop existing views first to avoid column rename conflicts
-- Must drop in reverse dependency order
DROP VIEW IF EXISTS brickreview_projects_with_stats CASCADE;
DROP VIEW IF EXISTS brickreview_videos_with_stats CASCADE;
DROP VIEW IF EXISTS brickreview_comments_with_user CASCADE;
DROP VIEW IF EXISTS brickreview_folders_with_stats CASCADE;

-- View: Vídeos com contagem de comentários e status de aprovação
CREATE VIEW brickreview_videos_with_stats AS
SELECT
  v.*,
  COUNT(DISTINCT c.id) as comments_count,
  COUNT(DISTINCT CASE WHEN c.status = 'open' THEN c.id END) as open_comments_count,
  (SELECT status FROM brickreview_approvals WHERE video_id = v.id ORDER BY created_at DESC LIMIT 1) as latest_approval_status,
  (SELECT username FROM master_users WHERE id = v.uploaded_by) as uploaded_by_username
FROM brickreview_videos v
LEFT JOIN brickreview_comments c ON c.video_id = v.id
WHERE v.deleted_at IS NULL
GROUP BY v.id;

-- View: Comentários com informações do usuário
CREATE VIEW brickreview_comments_with_user AS
SELECT
  c.*,
  COALESCE(u.username, c.visitor_name) as username,
  u.email,
  (SELECT COUNT(*) FROM brickreview_comments WHERE parent_comment_id = c.id) as replies_count
FROM brickreview_comments c
LEFT JOIN master_users u ON c.user_id = u.id;

-- View: Folders com estatísticas
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

-- View: Projetos com estatísticas
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
GROUP BY p.id, p.name, p.description, p.client_name, p.status, p.cover_image_r2_key, p.cover_image_url, p.created_by, p.created_at, p.updated_at, p.deleted_at;

-- ============================================
-- 9. DRAWINGS (Desenhos sobre frames - Frame.io style)
-- ============================================

CREATE TABLE IF NOT EXISTS brickreview_drawings (
  id SERIAL PRIMARY KEY,
  video_id INTEGER NOT NULL REFERENCES brickreview_videos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES master_users(id) ON DELETE SET NULL,
  timestamp DECIMAL(10, 3) NOT NULL, -- Timestamp do frame em segundos
  drawing_data JSONB NOT NULL, -- Array de pontos {x, y} normalizados (0-1)
  color VARCHAR(7) DEFAULT '#FF0000', -- Cor do desenho (hex)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para buscar desenhos por vídeo e timestamp
CREATE INDEX IF NOT EXISTS idx_drawings_video_timestamp ON brickreview_drawings(video_id, timestamp);

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
