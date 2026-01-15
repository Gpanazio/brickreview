import express from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  requireProjectAccess,
  requireProjectAccessFromFolder,
  requireProjectAccessFromVideo,
} from "../utils/permissions.js";
import { v4 as uuidv4 } from "uuid";
import { buildDownloadFilename, getOriginalFilename } from "../utils/filename.js";
import { attachmentUpload } from "../utils/attachmentStorage.js";

const router = express.Router();

function getSharePassword(req) {
  const headerPassword = req.headers["x-share-password"];
  if (typeof headerPassword === "string" && headerPassword.trim()) return headerPassword;

  const bodyPassword = req.body?.password;
  if (typeof bodyPassword === "string" && bodyPassword.trim()) return bodyPassword;

  return null;
}

async function enforceSharePassword(req, res, share) {
  if (!share.password_hash) return true;

  const password = getSharePassword(req);
  if (!password) {
    res.status(401).json({ requires_password: true });
    return false;
  }

  const ok = await bcrypt.compare(password, share.password_hash);
  if (!ok) {
    res.status(401).json({ requires_password: true });
    return false;
  }

  return true;
}

async function loadShare(req, res, token) {
  const shareResult = await query("SELECT * FROM brickreview_shares WHERE token = $1", [token]);

  if (shareResult.rows.length === 0) {
    res.status(404).json({ error: "Link de compartilhamento não encontrado" });
    return null;
  }

  const share = shareResult.rows[0];

  if (share.expires_at && new Date() > new Date(share.expires_at)) {
    res.status(410).json({ error: "Este link expirou" });
    return null;
  }

  const allowed = await enforceSharePassword(req, res, share);
  return allowed ? share : null;
}

// Helper para verificar se o share permite acesso a um vídeo específico (incluindo versões)
async function checkShareAccess(share, videoId) {
  const videoIdInt = Number(videoId);
  if (!Number.isInteger(videoIdInt)) return false;

  const videoResult = await query(
    "SELECT id, parent_video_id, project_id, folder_id FROM brickreview_videos WHERE id = $1",
    [videoIdInt]
  );
  if (videoResult.rows.length === 0) return false;

  const video = videoResult.rows[0];

  if (share.video_id) {
    if (video.id === share.video_id) return true;
    if (video.parent_video_id === share.video_id) return true;

    const sharedVideoResult = await query(
      "SELECT id, parent_video_id FROM brickreview_videos WHERE id = $1",
      [share.video_id]
    );

    if (sharedVideoResult.rows.length === 0) return false;

    const sharedVideo = sharedVideoResult.rows[0];

    // Se o vídeo alvo é o pai do compartilhado
    if (sharedVideo.parent_video_id === video.id) return true;

    // Se ambos têm o mesmo pai (irmãos/versões)
    if (
      video.parent_video_id &&
      sharedVideo.parent_video_id &&
      video.parent_video_id === sharedVideo.parent_video_id
    ) {
      return true;
    }

    return false;
  }

  if (share.folder_id) {
    return video.folder_id === share.folder_id;
  }

  if (share.project_id) {
    return video.project_id === share.project_id;
  }

  return false;
}

// POST /api/shares - Gera um novo share link
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { project_id, folder_id, video_id, access_type, expires_in_days, password } = req.body;

    // Validação básica: pelo menos um ID deve ser fornecido
    if (!project_id && !folder_id && !video_id) {
      return res
        .status(400)
        .json({ error: "É necessário fornecer um projeto, pasta ou vídeo para compartilhar" });
    }

    // Verifica se usuário tem acesso ao recurso compartilhado
    if (project_id) {
      const projectId = Number(project_id);
      if (!Number.isInteger(projectId)) {
        return res.status(400).json({ error: "project_id inválido" });
      }
      if (!(await requireProjectAccess(req, res, projectId))) return;
    } else if (folder_id) {
      const folderId = Number(folder_id);
      if (!Number.isInteger(folderId)) {
        return res.status(400).json({ error: "folder_id inválido" });
      }
      if (!(await requireProjectAccessFromFolder(req, res, folderId))) return;
    } else if (video_id) {
      const videoId = Number(video_id);
      if (!Number.isInteger(videoId)) {
        return res.status(400).json({ error: "video_id inválido" });
      }
      if (!(await requireProjectAccessFromVideo(req, res, videoId))) return;
    }

    // Gera um token curto usando a primeira parte de um UUID
    const token = uuidv4().split("-")[0];
    let expires_at = null;
    if (expires_in_days) {
      expires_at = new Date();
      expires_at.setDate(expires_at.getDate() + parseInt(expires_in_days));
    }

    const password_hash = password ? await bcrypt.hash(password, 10) : null;

    const result = await query(
      `INSERT INTO brickreview_shares 
       (token, project_id, folder_id, video_id, access_type, password_hash, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        token,
        project_id,
        folder_id,
        video_id,
        access_type || "view",
        password_hash,
        expires_at,
        req.user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao gerar share link:", err);
    res.status(500).json({ error: "Erro interno ao gerar link de compartilhamento" });
  }
});

// POST /api/shares/:token/comments - Adiciona comentário como convidado (PÚBLICO)
router.post("/:token/comments", attachmentUpload.single('file'), async (req, res) => {
  try {
    const { token } = req.params;
    const { video_id, parent_comment_id, content, timestamp, visitor_name, timestamp_end } =
      req.body;

    if (!video_id || !content || !visitor_name) {
      return res
        .status(400)
        .json({ error: "Vídeo ID, conteúdo e nome do visitante são obrigatórios" });
    }

    const share = await loadShare(req, res, token);
    if (!share) return;

    // Comentários são permitidos para qualquer link compartilhado (BRICK review mode)

    // Verifica que o vídeo pertence ao recurso compartilhado (incluindo versões)
    if (!(await checkShareAccess(share, video_id))) {
      return res.status(403).json({ error: "Vídeo não pertence a este compartilhamento" });
    }

    const visitorName = visitor_name.trim();
    const attachment_name = req.file ? req.file.originalname : null;
    const attachment_url = req.file ? `/anexos/${req.file.filename}` : null;

    const vId = Number(video_id);
    const pId = parent_comment_id ? Number(parent_comment_id) : null;

    // Insere comentário como convidado (user_id = NULL)
    const commentResult = await query(
      `INSERT INTO brickreview_comments (video_id, parent_comment_id, user_id, visitor_name, content, timestamp, timestamp_end, attachment_url, attachment_name)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        vId,
        pId,
        visitorName,
        content,
        timestamp ? parseFloat(timestamp) : null,
        timestamp_end ? parseFloat(timestamp_end) : null,
        attachment_url,
        attachment_name
      ]
    );

    // Busca detalhes do comentário com dados do usuário
    const fullComment = await query("SELECT * FROM brickreview_comments_with_user WHERE id = $1", [
      commentResult.rows[0].id,
    ]);

    res.status(201).json(fullComment.rows[0]);
  } catch (err) {
    console.error("Erro ao adicionar comentário de convidado:", err);
    res.status(500).json({ error: "Erro ao adicionar comentário" });
  }
});

// GET /api/shares/:token/comments/video/:videoId - Busca comentários de um vídeo (PÚBLICO)
router.get("/:token/comments/video/:videoId", async (req, res) => {
  try {
    const { token, videoId } = req.params;

    const share = await loadShare(req, res, token);
    if (!share) return;

    const videoIdInt = Number(videoId);
    if (!Number.isInteger(videoIdInt)) {
      return res.status(400).json({ error: "videoId inválido" });
    }

    if (!(await checkShareAccess(share, videoIdInt))) {
      return res.status(403).json({ error: "Vídeo não pertence a este compartilhamento" });
    }

    // Busca comentários do vídeo
    const comments = await query(
      `SELECT
        c.*,
        COALESCE(u.username, c.visitor_name) as username,
        u.email,
        (SELECT COUNT(*) FROM brickreview_comments WHERE parent_comment_id = c.id) as replies_count
       FROM brickreview_comments c
       LEFT JOIN master_users u ON c.user_id = u.id
       WHERE c.video_id = $1
       ORDER BY c.timestamp ASC, c.created_at ASC`,
      [videoIdInt]
    );

    res.json(comments.rows);
  } catch (err) {
    console.error("Erro ao buscar comentários de vídeo compartilhado:", err);
    res.status(500).json({ error: "Erro ao buscar comentários" });
  }
});

// GET /api/shares/:token/drawings/video/:videoId - Busca desenhos de um vídeo (PÚBLICO)
router.get("/:token/drawings/video/:videoId", async (req, res) => {
  try {
    const { token, videoId } = req.params;

    const share = await loadShare(req, res, token);
    if (!share) return;

    const videoIdInt = Number(videoId);
    if (!Number.isInteger(videoIdInt)) {
      return res.status(400).json({ error: "videoId inválido" });
    }

    if (!(await checkShareAccess(share, videoIdInt))) {
      return res.status(403).json({ error: "Acesso negado ao vídeo" });
    }

    // Busca desenhos do vídeo
    const drawings = await query(
      `SELECT * FROM brickreview_drawings
       WHERE video_id = $1
       ORDER BY timestamp ASC`,
      [videoIdInt]
    );

    res.json(drawings.rows);
  } catch (err) {
    console.error("Erro ao buscar desenhos de vídeo compartilhado:", err);
    res.status(500).json({ error: "Erro ao buscar desenhos" });
  }
});

// GET /api/shares/:token/video/:videoId/stream - Busca URL de streaming de um vídeo (PÚBLICO)
router.get("/:token/video/:videoId/stream", async (req, res) => {
  try {
    const { token, videoId } = req.params;
    const { quality } = req.query; // 'original' or 'proxy'

    const share = await loadShare(req, res, token);
    if (!share) return;

    const videoIdInt = Number(videoId);
    if (!Number.isInteger(videoIdInt)) {
      return res.status(400).json({ error: "videoId inválido" });
    }

    if (!(await checkShareAccess(share, videoIdInt))) {
      return res.status(403).json({ error: "Vídeo não pertence a este compartilhamento" });
    }

    const resStream = await query(
      "SELECT r2_url, proxy_url, streaming_high_url, mime_type FROM brickreview_videos WHERE id = $1",
      [videoIdInt]
    );

    if (resStream.rows.length === 0) {
      return res.status(404).json({ error: "Vídeo não encontrado" });
    }

    const videoData = resStream.rows[0];

    let url, isOriginal;
    if (quality === "original") {
      url = videoData.streaming_high_url || videoData.r2_url;
      isOriginal = true;
    } else {
      url = videoData.proxy_url || videoData.streaming_high_url || videoData.r2_url;
      isOriginal = !videoData.proxy_url;
    }

    res.json({
      url,
      isProxy: !isOriginal,
      mime: isOriginal ? videoData.mime_type || "video/mp4" : "video/mp4",
    });
  } catch (err) {
    console.error("Erro ao buscar stream de vídeo compartilhado:", err);
    res.status(500).json({ error: "Erro ao buscar stream" });
  }
});

// GET /api/shares/:token/project-videos - Busca vídeos de um projeto compartilhado (PÚBLICO)
router.get("/:token/project-videos", async (req, res) => {
  try {
    const { token } = req.params;

    const share = await loadShare(req, res, token);
    if (!share) return;

    if (!share.project_id) {
      return res.status(400).json({ error: "Este compartilhamento não é de um projeto" });
    }

    const videosResult = await query(
      `SELECT v.*,
              f.name as folder_name,
              COALESCE(c.comments_count, 0) as comments_count,
              COALESCE(c.open_comments_count, 0) as open_comments_count
       FROM brickreview_videos v
       LEFT JOIN brickreview_folders f ON f.id = v.folder_id
       LEFT JOIN (
         SELECT video_id,
         COUNT(*) as comments_count,
         COUNT(CASE WHEN status = 'open' THEN 1 END) as open_comments_count
         FROM brickreview_comments
         GROUP BY video_id
       ) c ON c.video_id = v.id
       WHERE v.project_id = $1
         AND v.parent_video_id IS NULL
         AND v.deleted_at IS NULL
       ORDER BY f.name ASC NULLS FIRST, v.created_at DESC`,
      [share.project_id]
    );

    res.json(videosResult.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar vídeos do projeto:", err);
    res.status(500).json({ error: "Erro ao buscar vídeos" });
  }
});

// GET /api/shares/:token/folder-videos - Busca vídeos de uma pasta compartilhada (PÚBLICO)
router.get("/:token/folder-videos", async (req, res) => {
  try {
    const { token } = req.params;

    const share = await loadShare(req, res, token);
    if (!share) return;

    if (!share.folder_id) {
      return res.status(400).json({ error: "Este compartilhamento não é de uma pasta" });
    }

    const videosResult = await query(
      `SELECT v.*,
              COALESCE(c.comments_count, 0) as comments_count,
              COALESCE(c.open_comments_count, 0) as open_comments_count
       FROM brickreview_videos v
       LEFT JOIN (
         SELECT video_id,
         COUNT(*) as comments_count,
         COUNT(CASE WHEN status = 'open' THEN 1 END) as open_comments_count
         FROM brickreview_comments
         GROUP BY video_id
       ) c ON c.video_id = v.id
       WHERE v.folder_id = $1
         AND v.parent_video_id IS NULL
         AND v.deleted_at IS NULL
       ORDER BY v.created_at DESC`,
      [share.folder_id]
    );

    res.json(videosResult.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar vídeos da pasta:", err);
    res.status(500).json({ error: "Erro ao buscar vídeos" });
  }
});

// GET /api/shares/:token - Busca informações do link compartilhado (PÚBLICO)
router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const share = await loadShare(req, res, token);
    if (!share) return;

    let data = null;
    if (share.project_id) {
      const projectResult = await query(
        "SELECT * FROM brickreview_projects_with_stats WHERE id = $1",
        [share.project_id]
      );
      data = { type: "project", content: projectResult.rows[0] };
    } else if (share.folder_id) {
      const folderResult = await query(
        "SELECT * FROM brickreview_folders_with_stats WHERE id = $1",
        [share.folder_id]
      );
      data = { type: "folder", content: folderResult.rows[0] };
    } else if (share.video_id) {
      const videoResult = await query("SELECT * FROM brickreview_videos_with_stats WHERE id = $1", [
        share.video_id,
      ]);
      const video = videoResult.rows[0];

      let versions = [];
      if (video.parent_video_id) {
        const versionsResult = await query(
          `SELECT * FROM brickreview_videos_with_stats
           WHERE id = $1 OR parent_video_id = $1
           ORDER BY version_number`,
          [video.parent_video_id]
        );
        versions = versionsResult.rows;
      } else {
        const versionsResult = await query(
          `SELECT * FROM brickreview_videos_with_stats
           WHERE parent_video_id = $1
           ORDER BY version_number`,
          [share.video_id]
        );
        versions = versionsResult.rows;
      }

      data = { type: "video", content: video, versions };
    }

    res.json({
      ...share,
      resource: data,
    });
  } catch (err) {
    console.error("❌ Erro ao buscar share link:", err);
    res.status(500).json({ error: "Erro interno ao processar link" });
  }
});

// GET /api/shares/:token/video/:videoId/download - Gera link de download (PÚBLICO)
router.get("/:token/video/:videoId/download", async (req, res) => {
  try {
    const { token, videoId } = req.params;
    const { type } = req.query;

    const share = await loadShare(req, res, token);
    if (!share) return;

    const videoIdInt = Number(videoId);
    if (!Number.isInteger(videoIdInt)) {
      return res.status(400).json({ error: "videoId inválido" });
    }

    if (!(await checkShareAccess(share, videoIdInt))) {
      return res.status(403).json({ error: "Vídeo não pertence a este compartilhamento" });
    }

    const resDownload = await query(
      "SELECT title, r2_key, r2_url, proxy_url FROM brickreview_videos WHERE id = $1",
      [videoIdInt]
    );

    if (resDownload.rows.length === 0) {
      return res.status(404).json({ error: "Vídeo não encontrado" });
    }

    const video = resDownload.rows[0];
    const resolvedType = type === "proxy" ? "proxy" : "original";
    const url = resolvedType === "proxy" ? video.proxy_url || video.r2_url : video.r2_url;
    const originalFilename = getOriginalFilename(video.r2_key, video.title);
    const filename = buildDownloadFilename(originalFilename, resolvedType === "proxy");

    res.json({
      url,
      filename,
    });
  } catch (err) {
    console.error("Erro ao gerar download compartilhado:", err);
    res.status(500).json({ error: "Erro ao processar download" });
  }
});

// DELETE /api/shares/:token/comments/:id - Deleta um comentário de convidado
router.delete("/:token/comments/:id", async (req, res) => {
  try {
    const { token, id } = req.params;
    const share = await loadShare(req, res, token);
    if (!share) return;

    const commentId = Number(id);
    if (!Number.isInteger(commentId)) {
      return res.status(400).json({ error: "ID de comentário inválido" });
    }

    const commentResult = await query("SELECT * FROM brickreview_comments WHERE id = $1", [
      commentId,
    ]);
    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: "Comentário não encontrado" });
    }
    const comment = commentResult.rows[0];

    if (comment.user_id !== null) {
      return res
        .status(403)
        .json({ error: "Não é possível deletar comentários de usuários registrados" });
    }

    if (!(await checkShareAccess(share, comment.video_id))) {
      return res.status(403).json({ error: "Comentário não pertence a este compartilhamento" });
    }

    await query("DELETE FROM brickreview_comments WHERE id = $1", [commentId]);
    res.status(200).json({ message: "Comentário deletado com sucesso" });
  } catch (err) {
    console.error("Erro ao deletar comentário de convidado:", err);
    res.status(500).json({ error: "Erro ao deletar comentário" });
  }
});

// PATCH /api/shares/:token/comments/:id - Edita um comentário de convidado
router.patch("/:token/comments/:id", async (req, res) => {
  try {
    const { token, id } = req.params;
    const { content } = req.body;
    const share = await loadShare(req, res, token);
    if (!share) return;

    const commentId = Number(id);
    if (!Number.isInteger(commentId)) {
      return res.status(400).json({ error: "ID de comentário inválido" });
    }

    if (!content) {
      return res.status(400).json({ error: "Conteúdo é obrigatório" });
    }

    const commentResult = await query("SELECT * FROM brickreview_comments WHERE id = $1", [
      commentId,
    ]);
    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: "Comentário não encontrado" });
    }
    const comment = commentResult.rows[0];

    if (comment.user_id !== null) {
      return res
        .status(403)
        .json({ error: "Não é possível editar comentários de usuários registrados" });
    }

    if (!(await checkShareAccess(share, comment.video_id))) {
      return res.status(403).json({ error: "Comentário não pertence a este compartilhamento" });
    }

    const updatedComment = await query(
      "UPDATE brickreview_comments SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
      [content, commentId]
    );

    res.status(200).json(updatedComment.rows[0]);
  } catch (err) {
    console.error("Erro ao editar comentário de convidado:", err);
    res.status(500).json({ error: "Erro ao editar comentário" });
  }
});

export default router;
