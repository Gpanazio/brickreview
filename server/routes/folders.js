import express from 'express';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js'
import { requireProjectAccess, requireProjectAccessFromFolder } from '../utils/permissions.js'
import { validateId } from '../utils/validateId.js';

const router = express.Router();

/**
 * @route GET /api/folders/project/:projectId
 * @desc Get all folders for a project with video previews
 */
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId)
    if (!validateId(projectId)) {
      return res.status(400).json({ error: 'projectId inválido' })
    }

    if (!(await requireProjectAccess(req, res, projectId))) return

    const result = await query(
      `WITH ranked_videos AS (
        SELECT
          folder_id,
          thumbnail_url,
          created_at,
          ROW_NUMBER() OVER (PARTITION BY folder_id ORDER BY created_at DESC) as rn
        FROM brickreview_videos
        WHERE thumbnail_url IS NOT NULL AND deleted_at IS NULL
      ),
      folder_previews AS (
        SELECT
          folder_id,
          json_agg(thumbnail_url ORDER BY created_at DESC) as previews
        FROM ranked_videos
        WHERE rn <= 3
        GROUP BY folder_id
      )
      SELECT
        f.*,
        COALESCE(fp.previews, '[]'::json) as previews
      FROM brickreview_folders_with_stats f
      LEFT JOIN folder_previews fp ON f.id = fp.folder_id
      WHERE project_id = $1 AND deleted_at IS NULL
      ORDER BY parent_folder_id NULLS FIRST, name ASC`,
      [projectId]
    )

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar pastas:', error);
    res.status(500).json({ error: 'Erro ao buscar pastas' });
  }
});

/**
 * @route GET /api/folders/:id
 * @desc Get folder details with subfolders and videos
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const folderId = Number(req.params.id)
    if (!validateId(folderId)) {
      return res.status(400).json({ error: 'ID de pasta inválido' })
    }

    if (!(await requireProjectAccessFromFolder(req, res, folderId))) return

    const folderResult = await query(
      'SELECT * FROM brickreview_folders_with_stats WHERE id = $1 AND deleted_at IS NULL',
      [folderId]
    )

    if (folderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pasta não encontrada' });
    }

    const folder = folderResult.rows[0];

    // Busca subpastas diretas
    const subfoldersResult = await query(`
      SELECT * FROM brickreview_folders_with_stats
      WHERE parent_folder_id = $1 AND deleted_at IS NULL
      ORDER BY name ASC
    `, [req.params.id]);

    // Busca vídeos da pasta
    const videosResult = await query(`
      SELECT * FROM brickreview_videos_with_stats
      WHERE folder_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `, [req.params.id]);

    res.json({
      ...folder,
      subfolders: subfoldersResult.rows,
      videos: videosResult.rows
    });
  } catch (error) {
    console.error('Erro ao buscar detalhes da pasta:', error);
    res.status(500).json({ error: 'Erro ao buscar detalhes da pasta' });
  }
});

/**
 * @route POST /api/folders
 * @desc Create a new folder
 */
router.post('/', authenticateToken, async (req, res) => {
  const { project_id, parent_folder_id, name } = req.body;

  if (!project_id || !name) {
    return res.status(400).json({ error: 'project_id e name são obrigatórios' });
  }

  try {
    const projectId = Number(project_id)
    if (!validateId(projectId)) {
      return res.status(400).json({ error: 'project_id inválido' })
    }

    if (!(await requireProjectAccess(req, res, projectId))) return

    const parentFolderId = parent_folder_id ? Number(parent_folder_id) : null
    if (parent_folder_id && !validateId(parentFolderId)) {
      return res.status(400).json({ error: 'parent_folder_id inválido' })
    }

    // Verifica se o projeto existe
    const projectCheck = await query(
      'SELECT id FROM brickreview_projects WHERE id = $1',
      [projectId]
    )

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    // Se parent_folder_id foi fornecido, verifica se existe
    if (parent_folder_id) {
      const parentCheck = await query(
        'SELECT id FROM brickreview_folders WHERE id = $1 AND project_id = $2',
        [parentFolderId, projectId]
      )

      if (parentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Pasta pai não encontrada' });
      }
    }

    const result = await query(`
      INSERT INTO brickreview_folders (project_id, parent_folder_id, name)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [projectId, parentFolderId || null, name])

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar pasta:', error);
    res.status(500).json({ error: 'Erro ao criar pasta' });
  }
});

/**
 * @route PATCH /api/folders/:id
 * @desc Rename folder
 */
router.patch('/:id', authenticateToken, async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nome da pasta é obrigatório' });
  }

  try {
    const folderId = Number(req.params.id)
    if (!validateId(folderId)) {
      return res.status(400).json({ error: 'ID de pasta inválido' })
    }

    if (!(await requireProjectAccessFromFolder(req, res, folderId))) return

    const result = await query(
      `UPDATE brickreview_folders
       SET name = $1
       WHERE id = $2
       RETURNING *`,
      [name, folderId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pasta não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao renomear pasta:', error);
    res.status(500).json({ error: 'Erro ao renomear pasta' });
  }
});

/**
 * @route DELETE /api/folders/:id
 * @desc Delete folder (Soft Delete)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const folderId = Number(req.params.id)
    if (!validateId(folderId)) {
      return res.status(400).json({ error: 'ID de pasta inválido' })
    }

    if (!(await requireProjectAccessFromFolder(req, res, folderId))) return

    const now = new Date();
    await query('BEGIN');

    const result = await query(
      'UPDATE brickreview_folders SET deleted_at = $1 WHERE id = $2 RETURNING id',
      [now, folderId]
    )

    if (result.rows.length === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'Pasta não encontrada' });
    }

    // Soft delete recursivo para vídeos e arquivos dentro da pasta
    await query('UPDATE brickreview_videos SET deleted_at = $1 WHERE folder_id = $2', [now, folderId]);
    await query('UPDATE brickreview_files SET deleted_at = $1 WHERE folder_id = $2', [now, folderId]);

    await query('COMMIT');
    res.json({ message: 'Pasta enviada para a lixeira', id: folderId })
  } catch (error) {
    await query('ROLLBACK');
    console.error('Erro ao excluir pasta:', error);
    res.status(500).json({ error: 'Erro ao excluir pasta' });
  }
});

/**
 * @route POST /api/folders/:id/restore
 * @desc Restore a deleted folder
 */
router.post('/:id/restore', authenticateToken, async (req, res) => {
  const folderId = Number(req.params.id)
  if (!validateId(folderId)) {
    return res.status(400).json({ error: 'ID de pasta inválido' })
  }

  try {
    await query('BEGIN');
    const result = await query(
      'UPDATE brickreview_folders SET deleted_at = NULL WHERE id = $1 RETURNING *',
      [folderId]
    )

    if (result.rows.length === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'Pasta não encontrada' });
    }

    // Restaura conteúdos
    await query('UPDATE brickreview_videos SET deleted_at = NULL WHERE folder_id = $1', [folderId]);
    await query('UPDATE brickreview_files SET deleted_at = NULL WHERE folder_id = $1', [folderId]);

    await query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await query('ROLLBACK');
    console.error('Erro ao restaurar pasta:', error);
    res.status(500).json({ error: 'Erro ao restaurar pasta' });
  }
});

/**
 * @route POST /api/folders/:id/move
 * @desc Move folder to another parent folder or root
 */
router.post('/:id/move', authenticateToken, async (req, res) => {
  const { new_parent_folder_id } = req.body

  try {
    const folderId = Number(req.params.id)
    if (!validateId(folderId)) {
      return res.status(400).json({ error: 'ID de pasta inválido' })
    }

    const projectId = await requireProjectAccessFromFolder(req, res, folderId)
    if (!projectId) return

    // Se new_parent_folder_id foi fornecido, verifica se existe e não é o mesmo folder
    if (new_parent_folder_id) {
      if (parseInt(new_parent_folder_id) === folderId) {
        return res.status(400).json({ error: 'Não é possível mover uma pasta para dentro dela mesma' });
      }

      const parentCheck = await query(
        'SELECT id, project_id FROM brickreview_folders WHERE id = $1',
        [new_parent_folder_id]
      );

      if (parentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Pasta de destino não encontrada' });
      }

      // Verifica se ambas as pastas pertencem ao mesmo projeto
      const currentFolderCheck = await query(
        'SELECT project_id FROM brickreview_folders WHERE id = $1',
        [folderId]
      )

      if (currentFolderCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Pasta não encontrada' });
      }

      if (currentFolderCheck.rows[0].project_id !== parentCheck.rows[0].project_id) {
        return res.status(400).json({ error: 'Não é possível mover pasta entre projetos diferentes' });
      }
    }

    const result = await query(`
      UPDATE brickreview_folders
      SET parent_folder_id = $1
      WHERE id = $2
      RETURNING *
    `, [new_parent_folder_id || null, folderId])

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao mover pasta:', error);
    res.status(500).json({ error: 'Erro ao mover pasta' });
  }
});

export default router;
