import express from 'express';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/drawings
 * @desc Save a drawing annotation on a video frame
 */
router.post('/', authenticateToken, async (req, res) => {
  const { video_id, timestamp, drawing_data, color } = req.body;
  const userId = req.user.id;

  if (!video_id || timestamp === undefined || !drawing_data) {
    return res.status(400).json({ error: 'Dados insuficientes' });
  }

  try {
    const result = await query(
      `INSERT INTO brickreview_drawings (video_id, user_id, timestamp, drawing_data, color)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, video_id, user_id, timestamp, drawing_data, color, created_at`,
      [video_id, userId, timestamp, JSON.stringify(drawing_data), color || '#FF0000']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao salvar desenho:', error);
    res.status(500).json({ error: 'Erro ao salvar desenho' });
  }
});

/**
 * @route GET /api/drawings/video/:videoId
 * @desc Get all drawings for a specific video
 */
router.get('/video/:videoId', authenticateToken, async (req, res) => {
  const { videoId } = req.params;

  try {
    const result = await query(
      `SELECT
        d.id,
        d.video_id,
        d.user_id,
        d.timestamp,
        d.drawing_data,
        d.color,
        d.created_at,
        u.username
       FROM brickreview_drawings d
       LEFT JOIN master_users u ON d.user_id = u.id
       WHERE d.video_id = $1
       ORDER BY d.timestamp ASC`,
      [videoId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar desenhos:', error);
    res.status(500).json({ error: 'Erro ao buscar desenhos' });
  }
});

/**
 * @route DELETE /api/drawings/:id
 * @desc Delete a drawing
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // Verifica se o desenho existe e se pertence ao usuário
    const checkResult = await query(
      'SELECT user_id FROM brickreview_drawings WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Desenho não encontrado' });
    }

    if (checkResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Você não tem permissão para deletar este desenho' });
    }

    await query('DELETE FROM brickreview_drawings WHERE id = $1', [id]);
    res.json({ message: 'Desenho deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar desenho:', error);
    res.status(500).json({ error: 'Erro ao deletar desenho' });
  }
});

export default router;
