import express from 'express';
import multer from 'multer';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js'
import { requireProjectAccess } from '../utils/permissions.js'
import r2Client from '../utils/r2.js'
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configuração do Multer para upload de imagens
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'temp-uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cover-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Apenas imagens (JPEG, PNG, WebP) são permitidas'));
  }
});

/**
 * @route GET /api/projects
 * @desc Get all projects for the current user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { recent } = req.query;
    // Se for admin, vê todos. Se for cliente, vê apenas onde é membro.
    let projects;
    let limitClause = recent === 'true' ? ' LIMIT 5' : '';

    if (req.user.role === 'admin') {
      projects = await query(`
        SELECT * FROM brickreview_projects_with_stats 
        ORDER BY updated_at DESC
        ${limitClause}
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
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const projectId = Number(req.params.id)
    if (!Number.isInteger(projectId)) {
      return res.status(400).json({ error: 'ID de projeto inválido' })
    }

    if (!(await requireProjectAccess(req, res, projectId))) return

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
    `, [projectId])

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
router.patch('/:id', authenticateToken, async (req, res) => {
  const { name, description, client_name, status } = req.body

  const projectId = Number(req.params.id)
  if (!Number.isInteger(projectId)) {
    return res.status(400).json({ error: 'ID de projeto inválido' })
  }

  if (!(await requireProjectAccess(req, res, projectId))) return

  try {
    const result = await query(`
      UPDATE brickreview_projects
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          client_name = COALESCE($3, client_name),
          status = COALESCE($4, status)
      WHERE id = $5
      RETURNING *
    `, [name, description, client_name, status, projectId])

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
router.delete('/:id', authenticateToken, async (req, res) => {
  const projectId = Number(req.params.id)
  if (!Number.isInteger(projectId)) {
    return res.status(400).json({ error: 'ID de projeto inválido' })
  }

  if (!(await requireProjectAccess(req, res, projectId))) return

  try {
    const result = await query(
      'DELETE FROM brickreview_projects WHERE id = $1 RETURNING id',
      [projectId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    res.json({ message: 'Projeto removido com sucesso', id: projectId })
  } catch (error) {
    console.error('Erro ao remover projeto:', error);
    res.status(500).json({ error: 'Erro ao remover projeto' });
  }
});

/**
 * @route POST /api/projects/:id/cover
 * @desc Upload cover image for project
 */
router.post('/:id/cover', authenticateToken, uploadImage.single('cover'), async (req, res) => {
  const projectId = Number(req.params.id)
  const file = req.file

  if (!file) {
    return res.status(400).json({ error: 'Nenhuma imagem foi enviada' })
  }

  if (!Number.isInteger(projectId)) {
    fs.unlinkSync(file.path)
    return res.status(400).json({ error: 'ID de projeto inválido' })
  }

  if (!(await requireProjectAccess(req, res, projectId))) {
    fs.unlinkSync(file.path)
    return
  }

  try {
    // Verifica se o projeto existe
    const projectCheck = await query(
      'SELECT id FROM brickreview_projects WHERE id = $1',
      [projectId]
    )

    if (projectCheck.rows.length === 0) {
      fs.unlinkSync(file.path); // Remove arquivo temporário
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    // Upload para R2 (usando stream para reduzir uso de memória)
    const r2Key = `project-covers/${projectId}/${Date.now()}-${file.originalname}`;
    const fileStream = fs.createReadStream(file.path);

    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2Key,
      Body: fileStream,
      ContentType: file.mimetype
    }));

    const coverUrl = `${process.env.R2_PUBLIC_URL}/${r2Key}`;

    // Atualiza o banco de dados
    const result = await query(
      `UPDATE brickreview_projects
       SET cover_image_r2_key = $1, cover_image_url = $2
       WHERE id = $3
       RETURNING *`,
      [r2Key, coverUrl, projectId]
    );

    // Remove arquivo temporário
    fs.unlinkSync(file.path);

    res.json({
      message: 'Imagem de capa atualizada com sucesso',
      project: result.rows[0]
    });

  } catch (error) {
    console.error('Erro ao fazer upload da imagem de capa:', error);
    // Tenta remover arquivo temporário em caso de erro
    if (file && file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    res.status(500).json({ error: 'Erro ao fazer upload da imagem de capa' });
  }
});

/**
 * @route POST /api/projects/:id/cover-url
 * @desc Set cover image from remote URL
 */
router.post('/:id/cover-url', authenticateToken, async (req, res) => {
  const projectId = Number(req.params.id)
  const { url } = req.body || {}

  if (!Number.isInteger(projectId)) {
    return res.status(400).json({ error: 'ID de projeto inválido' })
  }

  if (typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'URL da imagem é obrigatória' })
  }

  if (!(await requireProjectAccess(req, res, projectId))) {
    return
  }

  let parsedUrl
  try {
    parsedUrl = new URL(url)
  } catch {
    return res.status(400).json({ error: 'URL inválida' })
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: 'URL deve ser http(s)' })
  }

  const hostname = parsedUrl.hostname.toLowerCase()
  const blockedHosts = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])
  if (blockedHosts.has(hostname)) {
    return res.status(400).json({ error: 'Host não permitido' })
  }

  // Block obvious private IP ranges (best-effort SSRF guard)
  if (/^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^169\.254\./.test(hostname)) {
    return res.status(400).json({ error: 'Host não permitido' })
  }
  const match172 = hostname.match(/^172\.(\d+)\./)
  if (match172) {
    const second = Number(match172[1])
    if (second >= 16 && second <= 31) {
      return res.status(400).json({ error: 'Host não permitido' })
    }
  }

  try {
    const projectCheck = await query('SELECT id FROM brickreview_projects WHERE id = $1', [projectId])
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado' })
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      return res.status(400).json({ error: 'Não foi possível baixar a imagem' })
    }

    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const extByType = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    }

    const ext = extByType[contentType]
    if (!ext) {
      return res.status(400).json({ error: 'Tipo de imagem não suportado (use JPG, PNG ou WebP)' })
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const maxBytes = 10 * 1024 * 1024
    if (buffer.length > maxBytes) {
      return res.status(413).json({ error: 'Imagem muito grande (máx 10MB)' })
    }

    const r2Key = `project-covers/${projectId}/${Date.now()}-cover${ext}`

    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2Key,
      Body: buffer,
      ContentType: contentType,
    }))

    const coverUrl = `${process.env.R2_PUBLIC_URL}/${r2Key}`

    const result = await query(
      `UPDATE brickreview_projects
       SET cover_image_r2_key = $1, cover_image_url = $2
       WHERE id = $3
       RETURNING *`,
      [r2Key, coverUrl, projectId]
    )

    res.json({
      message: 'Imagem de capa atualizada com sucesso',
      project: result.rows[0],
    })
  } catch (error) {
    console.error('Erro ao atualizar capa por URL:', error)
    res.status(500).json({ error: 'Erro ao atualizar capa por URL' })
  }
})

/**
 * @route DELETE /api/projects/:id/cover
 * @desc Remove cover image from project
 */
router.delete('/:id/cover', authenticateToken, async (req, res) => {
  const projectId = req.params.id;

  try {
    const result = await query(
      `UPDATE brickreview_projects
       SET cover_image_r2_key = NULL, cover_image_url = NULL
       WHERE id = $1
       RETURNING *`,
      [projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    res.json({
      message: 'Imagem de capa removida com sucesso',
      project: result.rows[0]
    });

  } catch (error) {
    console.error('Erro ao remover imagem de capa:', error);
    res.status(500).json({ error: 'Erro ao remover imagem de capa' });
  }
});

export default router;
