import express from "express";
import { query } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireProjectAccess } from "../utils/permissions.js";
import { attachmentUpload } from "../utils/attachmentStorage.js";
import { validateId } from "../utils/validateId.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * @route GET /api/comments/video/:videoId
 * @desc Get all comments for a video
 */
router.get("/video/:videoId", authenticateToken, async (req, res) => {
  try {
    const videoId = Number(req.params.videoId);
    if (!validateId(videoId)) {
      return res.status(400).json({ error: "videoId inválido" });
    }

    // Permite leitura livre para qualquer usuário autenticado
    const videoExists = await query("SELECT 1 FROM brickreview_videos WHERE id = $1", [videoId]);
    if (videoExists.rows.length === 0) {
      return res.status(404).json({ error: "Vídeo não encontrado" });
    }

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
      [videoId]
    );

    res.json(comments.rows);
  } catch (error) {
    logger.error('COMMENTS', 'Error fetching comments', { error: error.message });
    res.status(500).json({ error: "Erro ao buscar comentários" });
  }
});

/**
 * @route POST /api/comments
 * @desc Add a comment to a video
 */
router.post('/', authenticateToken, attachmentUpload.single('file'), async (req, res) => {
  const { video_id, parent_comment_id, content, timestamp, timestamp_end } = req.body;

  if (!video_id || !content) {
    return res.status(400).json({ error: "Vídeo ID e conteúdo são obrigatórios" });
  }

  try {
    const videoId = Number(video_id);
    if (!validateId(videoId)) {
      return res.status(400).json({ error: "video_id inválido" });
    }

    const videoExists = await query("SELECT 1 FROM brickreview_videos WHERE id = $1", [videoId]);
    if (videoExists.rows.length === 0) {
      return res.status(404).json({ error: "Vídeo não encontrado" });
    }

    const attachment_name = req.file ? req.file.originalname : null;
    const attachment_url = req.file ? `/anexos/${req.file.filename}` : null;

    const result = await query(
      `INSERT INTO brickreview_comments (video_id, parent_comment_id, user_id, content, timestamp, timestamp_end, attachment_url, attachment_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        videoId,
        parent_comment_id || null,
        req.user.id,
        content,
        timestamp ? parseFloat(timestamp) : null,
        timestamp_end ? parseFloat(timestamp_end) : null,
        attachment_url,
        attachment_name
      ]
    )

    // Busca detalhes do comentário recém criado com dados do usuário
    const commentResult = await query(
      "SELECT * FROM brickreview_comments_with_user WHERE id = $1",
      [result.rows[0].id]
    );

    res.status(201).json(commentResult.rows[0]);
  } catch (error) {
    logger.error('COMMENTS', 'Error adding comment', { error: error.message });
    res.status(500).json({ error: "Erro ao adicionar comentário" });
  }
});

/**
 * @route PATCH /api/comments/:id
 * @desc Update comment status or content
 */
router.patch("/:id", authenticateToken, async (req, res) => {
  const { content, status } = req.body;

  try {
    const commentId = Number(req.params.id);
    if (!validateId(commentId)) {
      return res.status(400).json({ error: "ID de comentário inválido" });
    }

    const projectResult = await query(
      `SELECT v.project_id
       FROM brickreview_comments c
       JOIN brickreview_videos v ON v.id = c.video_id
       WHERE c.id = $1`,
      [commentId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: "Comentário não encontrado" });
    }

    if (!(await requireProjectAccess(req, res, projectResult.rows[0].project_id))) return;

    const result = await query(
      `UPDATE brickreview_comments
       SET content = COALESCE($1, content),
           status = COALESCE($2, status),
           timestamp = COALESCE($6, timestamp),
           timestamp_end = COALESCE($7, timestamp_end),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND (user_id = $4 OR $5 = 'admin')
       RETURNING *`,
      [content, status, commentId, req.user.id, req.user.role, req.body.timestamp, req.body.timestamp_end]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Comentário não encontrado ou sem permissão" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('COMMENTS', 'Error updating comment', { error: error.message });
    res.status(500).json({ error: "Erro ao atualizar comentário" });
  }
});

/**
 * @route DELETE /api/comments/:id
 * @desc Delete comment
 */
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const commentId = Number(req.params.id);
    if (!validateId(commentId)) {
      return res.status(400).json({ error: "ID de comentário inválido" });
    }

    // Verify permissions: Author, Project Owner, or Admin
    const contextResult = await query(
      `SELECT c.user_id as author_id, p.created_by as project_owner_id
       FROM brickreview_comments c
       JOIN brickreview_videos v ON v.id = c.video_id
       JOIN brickreview_projects p ON p.id = v.project_id
       WHERE c.id = $1`,
      [commentId]
    );

    if (contextResult.rows.length === 0) {
      return res.status(404).json({ error: "Comentário não encontrado" });
    }

    const { author_id, project_owner_id } = contextResult.rows[0];
    const isAuthor = req.user.id === author_id;
    const isProjectOwner = req.user.id === project_owner_id;
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isProjectOwner && !isAdmin) {
      return res.status(403).json({ error: "Você não tem permissão para excluir este comentário." });
    }

    const result = await query("DELETE FROM brickreview_comments WHERE id = $1 RETURNING id", [
      commentId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Comentário não encontrado" });
    }

    res.json({ message: "Comentário removido com sucesso", id: commentId });
  } catch (error) {
    logger.error('COMMENTS', 'Error deleting comment', { error: error.message });
    res.status(500).json({ error: "Erro ao remover comentário" });
  }
});

export default router;
