import express from 'express';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireProjectAccess } from '../middleware/access.js';

const router = express.Router();

/**
 * @route GET /api/projects
 * @desc Get all projects for the current user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Se for admin, vê todos. Se for cliente, vê apenas onde é membro.
    let projects;
    if (req.user.role === 'admin') {
      projects = await query(`
        SELECT * FROM brickreview_projects_with_stats 
        ORDER BY updated_at DESC
      `);
    } else {
      projects = await query(`
        SELECT p.* FROM brickreview_projects_with_stats p
        JOIN brickreview_project_members m ON p.id = m.project_id
        WHERE m.user_id = $1
        ORDER BY p.updated_at DESC
      `, [req.user.id]);
    }

    res.json(projects.rows);
  } catch (error) {
    console.error('Erro ao buscar projetos:', error);
    res.status(500).json({ error: 'Erro ao buscar projetos' });
  }
});

/**
 * @route POST /api/projects
 * @desc Create a new project
 */
router.post('/', authenticateToken, async (req, res) => {
  const { name, description, client_name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nome do projeto é obrigatório' });
  }

  try {
    const result = await query(`
      INSERT INTO brickreview_projects (name, description, client_name, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, description, client_name, req.user.id]);

    const newProject = result.rows[0];

    // Adiciona o criador como admin do projeto
    await query(`
      INSERT INTO brickreview_project_members (project_id, user_id, role)
      VALUES ($1, $2, 'admin')
    `, [newProject.id, req.user.id]);

    res.status(201).json(newProject);
  } catch (error) {
    console.error('Erro ao criar projeto:', error);
    res.status(500).json({ error: 'Erro ao criar projeto' });
  }
});

/**
 * @route GET /api/projects/:id
 * @desc Get project details and its videos
 */
router.get('/:id', authenticateToken, requireProjectAccess((req) => req.params.id), async (req, res) => {
  try {
    const projectResult = await query(
      'SELECT * FROM brickreview_projects_with_stats WHERE id = $1',
      [req.params.id]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    const project = projectResult.rows[0];

    // Busca vídeos do projeto
    const videosResult = await query(`
      SELECT * FROM brickreview_videos_with_stats 
      WHERE project_id = $1 
      ORDER BY created_at DESC
    `, [req.params.id]);

    res.json({
      ...project,
      videos: videosResult.rows
    });
  } catch (error) {
    console.error('Erro ao buscar detalhes do projeto:', error);
    res.status(500).json({ error: 'Erro ao buscar detalhes do projeto' });
  }
});

/**
 * @route PATCH /api/projects/:id
 * @desc Update project details
 */
router.patch('/:id', authenticateToken, requireProjectAccess((req) => req.params.id), async (req, res) => {
  const { name, description, client_name, status } = req.body;

  try {
    const result = await query(`
      UPDATE brickreview_projects
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          client_name = COALESCE($3, client_name),
          status = COALESCE($4, status)
      WHERE id = $5
      RETURNING *
    `, [name, description, client_name, status, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar projeto:', error);
    res.status(500).json({ error: 'Erro ao atualizar projeto' });
  }
});

/**
 * @route DELETE /api/projects/:id
 * @desc Delete project
 */
router.delete('/:id', authenticateToken, requireProjectAccess((req) => req.params.id), async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM brickreview_projects WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    res.json({ message: 'Projeto removido com sucesso', id: req.params.id });
  } catch (error) {
    console.error('Erro ao remover projeto:', error);
    res.status(500).json({ error: 'Erro ao remover projeto' });
  }
});

export default router;
