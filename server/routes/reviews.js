import express from 'express';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js'
import { requireProjectAccessFromVideo } from '../utils/permissions.js'

const router = express.Router();

/**
 * @route POST /api/reviews/approve
 * @desc Approve or Request Changes for a video
 */
router.post('/', authenticateToken, async (req, res) => {
  const { video_id, status, notes } = req.body;

  if (!video_id || !status) {
    return res.status(400).json({ error: 'Vídeo ID e status são obrigatórios' });
  }

  const allowedStatus = ['approved', 'changes_requested', 'pending'];
  if (!allowedStatus.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  try {
    const videoId = Number(video_id)
    if (!Number.isInteger(videoId)) {
      return res.status(400).json({ error: 'video_id inválido' })
    }

    if (!(await requireProjectAccessFromVideo(req, res, videoId))) return

    const result = await query(
      `INSERT INTO brickreview_approvals (video_id, user_id, status, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [videoId, req.user.id, status, notes]
    )

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao salvar aprovação:', error);
    res.status(500).json({ error: 'Erro ao salvar aprovação' });
  }
});

/**
 * @route GET /api/reviews/:video_id
 * @desc Get approval history for a video
 */
router.get('/:video_id', authenticateToken, async (req, res) => {
  try {
    const videoId = Number(req.params.video_id)
    if (!Number.isInteger(videoId)) {
      return res.status(400).json({ error: 'video_id inválido' })
    }

    if (!(await requireProjectAccessFromVideo(req, res, videoId))) return

    const result = await query(
      `SELECT a.*, u.username
       FROM brickreview_approvals a
       JOIN master_users u ON a.user_id = u.id
       WHERE a.video_id = $1
       ORDER BY a.created_at DESC`,
      [videoId]
    )

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar histórico de aprovação:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico de aprovação' });
  }
});

export default router;
