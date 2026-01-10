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

// POST /api/shares/:token/comments - Adiciona comentário como convidado (PÚBLICO)
router.post('/:token/comments', async (req, res) => {
  try {
    const { token } = req.params;
    const { video_id, parent_comment_id, content, timestamp, visitor_name } = req.body;

    if (!video_id || !content || !visitor_name) {
      return res.status(400).json({ error: 'Vídeo ID, conteúdo e nome do visitante são obrigatórios' });
    }

    // Valida que o share token existe e permite comentários
    const shareResult = await query(
      `SELECT * FROM brickreview_shares WHERE token = $1`,
      [token]
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Link de compartilhamento não encontrado' });
    }

    const share = shareResult.rows[0];

    // Verifica expiração
    if (share.expires_at && new Date() > new Date(share.expires_at)) {
      return res.status(410).json({ error: 'Este link expirou' });
    }

    // Verifica se o acesso permite comentários
    if (share.access_type !== 'comment') {
      return res.status(403).json({ error: 'Este link não permite comentários' });
    }

    // Verifica que o vídeo pertence ao recurso compartilhado
    // (para evitar que alguém comente em vídeos não compartilhados)
    if (share.video_id && share.video_id !== parseInt(video_id)) {
      return res.status(403).json({ error: 'Vídeo não pertence a este compartilhamento' });
    }

    // Cria um user_id temporário baseado no nome do visitante
    // Usamos um UUID consistente para o mesmo nome
    const crypto = await import('crypto');
    const guestUserId = crypto.createHash('md5').update(visitor_name.toLowerCase().trim()).digest('hex').substring(0, 8);

    // Insere comentário como convidado
    // IMPORTANTE: comments ainda requer user_id (UUID), mas para guests usamos um hash do nome
    // Precisamos criar um guest user temporário OU ajustar o schema
    // Por ora, vamos criar um guest user se não existir

    // Verifica se já existe um guest user com este nome
    let guestUser = await query(
      `SELECT id FROM master_users WHERE username = $1 AND email LIKE 'guest+%'`,
      [`guest_${guestUserId}`]
    );

    if (guestUser.rows.length === 0) {
      // Cria guest user
      guestUser = await query(
        `INSERT INTO master_users (id, username, email, password_hash, role)
         VALUES (gen_random_uuid(), $1, $2, 'guest', 'guest')
         RETURNING id`,
        [`guest_${guestUserId}`, `guest+${guestUserId}@brickreview.local`]
      );
    }

    const userId = guestUser.rows[0].id;

    // Insere o comentário
    const commentResult = await query(`
      INSERT INTO brickreview_comments (video_id, parent_comment_id, user_id, content, timestamp)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [video_id, parent_comment_id, userId, content, timestamp]);

    // Busca detalhes do comentário com dados do usuário
    const fullComment = await query(
      'SELECT * FROM brickreview_comments_with_user WHERE id = $1',
      [commentResult.rows[0].id]
    );

    res.status(201).json(fullComment.rows[0]);
  } catch (err) {
    console.error('Erro ao adicionar comentário de convidado:', err);
    res.status(500).json({ error: 'Erro ao adicionar comentário' });
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
