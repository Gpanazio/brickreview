import { query } from '../db.js'

function ensureAuthenticated(req, res) {
  if (!req.user) {
    res.status(401).json({ error: 'Autenticação necessária' })
    return false
  }

  return true
}

export function requireProjectAccess(getProjectId) {
  return async (req, res, next) => {
    if (!ensureAuthenticated(req, res)) return

    const projectId = getProjectId(req)
    if (!projectId) {
      return res.status(400).json({ error: 'Projeto inválido' })
    }

    if (req.user.role === 'admin') {
      return next()
    }

    try {
      const result = await query(
        `SELECT 1 FROM brickreview_project_members
         WHERE project_id = $1 AND user_id = $2`,
        [projectId, req.user.id]
      )

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Acesso negado ao projeto' })
      }

      return next()
    } catch (error) {
      console.error('Erro ao verificar acesso ao projeto:', error)
      return res.status(500).json({ error: 'Erro ao verificar acesso ao projeto' })
    }
  }
}

export function requireVideoAccess(getVideoId) {
  return async (req, res, next) => {
    if (!ensureAuthenticated(req, res)) return

    const videoId = getVideoId(req)
    if (!videoId) {
      return res.status(400).json({ error: 'Vídeo inválido' })
    }

    if (req.user.role === 'admin') {
      return next()
    }

    try {
      const result = await query(
        `SELECT 1
         FROM brickreview_videos v
         JOIN brickreview_project_members m ON m.project_id = v.project_id
         WHERE v.id = $1 AND m.user_id = $2`,
        [videoId, req.user.id]
      )

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Acesso negado ao vídeo' })
      }

      return next()
    } catch (error) {
      console.error('Erro ao verificar acesso ao vídeo:', error)
      return res.status(500).json({ error: 'Erro ao verificar acesso ao vídeo' })
    }
  }
}

export function requireCommentAccess(getCommentId) {
  return async (req, res, next) => {
    if (!ensureAuthenticated(req, res)) return

    const commentId = getCommentId(req)
    if (!commentId) {
      return res.status(400).json({ error: 'Comentário inválido' })
    }

    if (req.user.role === 'admin') {
      return next()
    }

    try {
      const result = await query(
        `SELECT 1
         FROM brickreview_comments c
         JOIN brickreview_videos v ON v.id = c.video_id
         JOIN brickreview_project_members m ON m.project_id = v.project_id
         WHERE c.id = $1 AND m.user_id = $2`,
        [commentId, req.user.id]
      )

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Acesso negado ao comentário' })
      }

      return next()
    } catch (error) {
      console.error('Erro ao verificar acesso ao comentário:', error)
      return res.status(500).json({ error: 'Erro ao verificar acesso ao comentário' })
    }
  }
}

export default { requireProjectAccess, requireVideoAccess, requireCommentAccess }
