import { query } from '../db.js'

export function isAdmin(user) {
  return user?.role === 'admin'
}

export async function requireProjectAccess(req, res, projectId) {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Autenticação necessária' })
    return false
  }

  if (isAdmin(req.user)) return true

  const membership = await query(
    'SELECT 1 FROM brickreview_project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, req.user.id]
  )

  if (membership.rows.length === 0) {
    res.status(403).json({ error: 'Acesso negado ao projeto' })
    return false
  }

  return true
}

export async function requireProjectAccessFromVideo(req, res, videoId) {
  const videoResult = await query(
    'SELECT project_id FROM brickreview_videos WHERE id = $1',
    [videoId]
  )

  if (videoResult.rows.length === 0) {
    res.status(404).json({ error: 'Vídeo não encontrado' })
    return null
  }

  const projectId = videoResult.rows[0].project_id
  const allowed = await requireProjectAccess(req, res, projectId)
  return allowed ? projectId : null
}

export async function requireProjectAccessFromFolder(req, res, folderId) {
  const folderResult = await query(
    'SELECT project_id FROM brickreview_folders WHERE id = $1',
    [folderId]
  )

  if (folderResult.rows.length === 0) {
    res.status(404).json({ error: 'Pasta não encontrada' })
    return null
  }

  const projectId = folderResult.rows[0].project_id
  const allowed = await requireProjectAccess(req, res, projectId)
  return allowed ? projectId : null
}

export async function requireProjectAccessFromFile(req, res, fileId) {
  const fileResult = await query(
    'SELECT project_id FROM brickreview_files WHERE id = $1',
    [fileId]
  )

  if (fileResult.rows.length === 0) {
    res.status(404).json({ error: 'Arquivo não encontrado' })
    return null
  }

  const projectId = fileResult.rows[0].project_id
  const allowed = await requireProjectAccess(req, res, projectId)
  return allowed ? projectId : null
}
