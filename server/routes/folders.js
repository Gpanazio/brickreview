import express from 'express';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route GET /api/folders/project/:projectId
 * @desc Get all folders for a project (hierarchical structure)
 */
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM brickreview_folders_with_stats
      WHERE project_id = $1
      ORDER BY parent_folder_id NULLS FIRST, name ASC
    `, [req.params.projectId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar pastas:', error);
    res.status(500).json({ error: 'Erro ao buscar pastas' });
  }
});

/**
 * @route GET /api/folders/root
 * @desc Get all root folders (for Home OS mode)
 */
router.get('/root', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM brickreview_folders_with_stats
      WHERE project_id IS NULL
      ORDER BY parent_folder_id NULLS FIRST, name ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar pastas raiz:', error);
    res.status(500).json({ error: 'Erro ao buscar pastas raiz' });
  }
});

/**
 * @route GET /api/folders/:id
 * @desc Get folder details with subfolders and videos
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const folderResult = await query(
      'SELECT * FROM brickreview_folders_with_stats WHERE id = $1',
      [req.params.id]
    );

    if (folderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pasta não encontrada' });
    }

    const folder = folderResult.rows[0];

    // Busca subpastas diretas
    const subfoldersResult = await query(`
      SELECT * FROM brickreview_folders_with_stats
      WHERE parent_folder_id = $1
      ORDER BY name ASC
    `, [req.params.id]);

    // Busca vídeos da pasta
    const videosResult = await query(`
      SELECT * FROM brickreview_videos_with_stats
      WHERE folder_id = $1
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

  if (!name) {
    return res.status(400).json({ error: 'name é obrigatório' });
  }

  try {
    // Se project_id foi fornecido, verifica se o projeto existe
    if (project_id) {
      const projectCheck = await query(
        'SELECT id FROM brickreview_projects WHERE id = $1',
        [project_id]
      );

      if (projectCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Projeto não encontrado' });
      }
    }

    // Se parent_folder_id foi fornecido, verifica se existe
    if (parent_folder_id) {
      const parentCheck = await query(
        'SELECT id, project_id FROM brickreview_folders WHERE id = $1',
        [parent_folder_id]
      );

      if (parentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Pasta pai não encontrada' });
      }

      // Se estamos criando pasta dentro de uma pasta de projeto, herdamos o project_id
      if (parentCheck.rows[0].project_id && !project_id) {
        return res.status(400).json({ error: 'Pasta pai pertence a um projeto, mas project_id não foi fornecido' });
      }
    }

    const result = await query(`
      INSERT INTO brickreview_folders (project_id, parent_folder_id, name)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [project_id || null, parent_folder_id || null, name]);

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
    const result = await query(`
      UPDATE brickreview_folders
      SET name = $1
      WHERE id = $2
      RETURNING *
    `, [name, req.params.id]);

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
 * @desc Delete folder (CASCADE will delete subfolders and unlink videos)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM brickreview_folders WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pasta não encontrada' });
    }

    res.json({ message: 'Pasta removida com sucesso', id: req.params.id });
  } catch (error) {
    console.error('Erro ao remover pasta:', error);
    res.status(500).json({ error: 'Erro ao remover pasta' });
  }
});

/**
 * @route POST /api/folders/:id/move
 * @desc Move folder to another parent folder or root
 */
router.post('/:id/move', authenticateToken, async (req, res) => {
  const { new_parent_folder_id } = req.body;

  try {
    // Se new_parent_folder_id foi fornecido, verifica se existe e não é o mesmo folder
    if (new_parent_folder_id) {
      if (parseInt(new_parent_folder_id) === parseInt(req.params.id)) {
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
        [req.params.id]
      );

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
    `, [new_parent_folder_id || null, req.params.id]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao mover pasta:', error);
    res.status(500).json({ error: 'Erro ao mover pasta' });
  }
});

export default router;
