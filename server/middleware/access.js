import { query } from '../db.js'

function createAccessMiddleware({
  getId,
  invalidMessage,
  forbiddenMessage,
  errorMessage,
  errorLog,
  queryText,
}) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticação necessária' })
    }

    const id = getId(req)
    if (!id) {
      return res.status(400).json({ error: invalidMessage })
    }

    if (req.user.role === 'admin') {
      return next()
    }

    try {
      const result = await query(queryText, [id, req.user.id])

      if (result.rows.length === 0) {
        return res.status(403).json({ error: forbiddenMessage })
      }

      return next()
    } catch (error) {
      console.error(errorLog, error)
      return res.status(500).json({ error: errorMessage })
    }
  }
}

export function requireProjectAccess(getProjectId) {
  return createAccessMiddleware({
    getId: getProjectId,
    invalidMessage: 'Projeto inválido',
    forbiddenMessage: 'Acesso negado ao projeto',
    errorMessage: 'Erro ao verificar acesso ao projeto',
    errorLog: 'Erro ao verificar acesso ao projeto:',
    queryText: `SELECT 1 FROM brickreview_project_members
      WHERE project_id = $1 AND user_id = $2`,
  })
}

export function requireVideoAccess(getVideoId) {
  return createAccessMiddleware({
    getId: getVideoId,
    invalidMessage: 'Vídeo inválido',
    forbiddenMessage: 'Acesso negado ao vídeo',
    errorMessage: 'Erro ao verificar acesso ao vídeo',
    errorLog: 'Erro ao verificar acesso ao vídeo:',
    queryText: `SELECT 1
      FROM brickreview_videos v
      JOIN brickreview_project_members m ON m.project_id = v.project_id
      WHERE v.id = $1 AND m.user_id = $2`,
  })
}

export function requireCommentAccess(getCommentId) {
  return createAccessMiddleware({
    getId: getCommentId,
    invalidMessage: 'Comentário inválido',
    forbiddenMessage: 'Acesso negado ao comentário',
    errorMessage: 'Erro ao verificar acesso ao comentário',
    errorLog: 'Erro ao verificar acesso ao comentário:',
    queryText: `SELECT 1
      FROM brickreview_comments c
      JOIN brickreview_videos v ON v.id = c.video_id
      JOIN brickreview_project_members m ON m.project_id = v.project_id
      WHERE c.id = $1 AND m.user_id = $2`,
  })
}

export default { requireProjectAccess, requireVideoAccess, requireCommentAccess }
