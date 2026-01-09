import express from 'express';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireCommentAccess, requireVideoAccess } from '../middleware/access.js';

const router = express.Router();

/**
 * @route POST /api/comments
 * @desc Add a comment to a video
 */
router.post('/', authenticateToken, requireVideoAccess((req) => req.body.video_id), async (req, res) => {
  const { video_id, parent_comment_id, content, timestamp } = req.body;

  if (!video_id || !content) {
    return res.status(400).json({ error: 'Vídeo ID e conteúdo são obrigatórios' });
  }

  try {
    const result = await query(`
      INSERT INTO brickreview_comments (video_id, parent_comment_id, user_id, content, timestamp)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [video_id, parent_comment_id, req.user.id, content, timestamp]);

    // Busca detalhes do comentário recém criado com dados do usuário
    const commentResult = await query(
      'SELECT * FROM brickreview_comments_with_user WHERE id = $1',
      [result.rows[0].id]
    );

    res.status(201).json(commentResult.rows[0]);
  } catch (error) {
    console.error('Erro ao adicionar comentário:', error);
    res.status(500).json({ error: 'Erro ao adicionar comentário' });
  }
});

/**
 * @route PATCH /api/comments/:id
 * @desc Update comment status or content
 */
router.patch('/:id', authenticateToken, requireCommentAccess((req) => req.params.id), async (req, res) => {
  const { content, status } = req.body;

  try {
    const result = await query(`
      UPDATE brickreview_comments
      SET content = COALESCE($1, content),
          status = COALESCE($2, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND (user_id = $4 OR $5 = 'admin')
      RETURNING *
    `, [content, status, req.params.id, req.user.id, req.user.role]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comentário não encontrado ou sem permissão' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar comentário:', error);
    res.status(500).json({ error: 'Erro ao atualizar comentário' });
  }
});

/**
 * @route DELETE /api/comments/:id
 * @desc Delete comment
 */
router.delete('/:id', authenticateToken, requireCommentAccess((req) => req.params.id), async (req, res) => {
  try {
    const result = await query(
      "DELETE FROM brickreview_comments WHERE id = $1 AND (user_id = $2 OR $3 = 'admin') RETURNING id",
      [req.params.id, req.user.id, req.user.role]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comentário não encontrado ou sem permissão' });
    }

    res.json({ message: 'Comentário removido com sucesso', id: req.params.id });
  } catch (error) {
    console.error('Erro ao remover comentário:', error);
    res.status(500).json({ error: 'Erro ao remover comentário' });
  }
});

export default router;
