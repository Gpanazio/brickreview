import express from 'express';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// POST /api/shares - Gera um novo share link
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { project_id, folder_id, video_id, access_type, expires_in_days, password } = req.body;
    
    // Validação básica: pelo menos um ID deve ser fornecido
    if (!project_id && !folder_id && !video_id) {
      return res.status(400).json({ error: 'É necessário fornecer um projeto, pasta ou vídeo para compartilhar' });
    }

    // Gera um token curto usando a primeira parte de um UUID para evitar dependência extra de nanoid
    const token = uuidv4().split('-')[0]; 
    let expires_at = null;
    if (expires_in_days) {
      expires_at = new Date();
      expires_at.setDate(expires_at.getDate() + parseInt(expires_in_days));
    }

    // Hash da senha se fornecida (simplificado aqui, ideal usar bcrypt)
    const password_hash = password || null;

    const result = await query(
      `INSERT INTO brickreview_shares 
       (token, project_id, folder_id, video_id, access_type, password_hash, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [token, project_id, folder_id, video_id, access_type || 'view', password_hash, expires_at, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao gerar share link:', err);
    res.status(500).json({ error: 'Erro interno ao gerar link de compartilhamento' });
  }
});

// GET /api/shares/:token - Busca informações do link compartilhado (PÚBLICO)
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const result = await query(
      `SELECT * FROM brickreview_shares WHERE token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link de compartilhamento não encontrado ou expirado' });
    }

    const share = result.rows[0];

    // Verifica expiração
    if (share.expires_at && new Date() > new Date(share.expires_at)) {
      return res.status(410).json({ error: 'Este link de compartilhamento expirou' });
    }

    // Se o link tiver senha, o frontend precisará lidar com o desafio antes de carregar os dados reais
    if (share.password_hash) {
      return res.json({ 
        requires_password: true,
        access_type: share.access_type 
      });
    }

    // Busca os dados do recurso compartilhado
    let data = null;
    if (share.project_id) {
      const projectResult = await query('SELECT * FROM brickreview_projects_with_stats WHERE id = $1', [share.project_id]);
      data = { type: 'project', content: projectResult.rows[0] };
    } else if (share.folder_id) {
      const folderResult = await query('SELECT * FROM brickreview_folders_with_stats WHERE id = $1', [share.folder_id]);
      data = { type: 'folder', content: folderResult.rows[0] };
    } else if (share.video_id) {
      const videoResult = await query('SELECT * FROM brickreview_videos_with_stats WHERE id = $1', [share.video_id]);
      data = { type: 'video', content: videoResult.rows[0] };
    }

    res.json({
      ...share,
      resource: data
    });
  } catch (err) {
    console.error('Erro ao buscar share link:', err);
    res.status(500).json({ error: 'Erro interno ao processar link' });
  }
});

export default router;
