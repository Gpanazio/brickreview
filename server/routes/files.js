import express from 'express';
import multer from 'multer';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js'
import {
  requireProjectAccess,
  requireProjectAccessFromFile,
  requireProjectAccessFromFolder,
} from '../utils/permissions.js'
import r2Client from '../utils/r2.js'
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configuração do Multer para upload temporário
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'temp-uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  }
});

/**
 * Determina o tipo de arquivo baseado no mime type
 */
function getFileType(mimeType) {
  if (!mimeType) return 'other';

  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'document';
  if (mimeType.includes('document') || mimeType.includes('text') ||
      mimeType.includes('spreadsheet') || mimeType.includes('presentation')) {
    return 'document';
  }

  return 'other';
}

/**
 * @route POST /api/files/upload
 * @desc Upload any file type to R2 and save metadata
 */
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  const { project_id, name, description, folder_id } = req.body;
  const file = req.file;

  const missingR2Config = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_URL'
  ].filter((key) => !process.env[key]);

  if (missingR2Config.length > 0) {
    return res.status(500).json({
      error: 'Configuração do R2 ausente',
      missing: missingR2Config
    });
  }

  if (!file || !project_id) {
    return res.status(400).json({ error: 'Dados insuficientes para o upload' })
  }

  const projectId = Number(project_id)
  if (!Number.isInteger(projectId)) {
    return res.status(400).json({ error: 'project_id inválido' })
  }

  if (!(await requireProjectAccess(req, res, projectId))) return

  const folderId = folder_id ? Number(folder_id) : null
  if (folder_id && !Number.isInteger(folderId)) {
    return res.status(400).json({ error: 'folder_id inválido' })
  }

  if (folderId) {
    const folderCheck = await query(
      'SELECT 1 FROM brickreview_folders WHERE id = $1 AND project_id = $2',
      [folderId, projectId]
    )
    if (folderCheck.rows.length === 0) {
      return res.status(400).json({ error: 'folder_id não pertence ao projeto' })
    }
  }

  const fileName = name || file.originalname
  const fileType = getFileType(file.mimetype);
  let thumbnailKey = null;
  let thumbnailUrl = null;
  let width = null;
  let height = null;

  try {
    // Se for imagem, a própria imagem serve como thumbnail
    // Para imagens grandes, poderíamos redimensionar, mas por ora usamos a original
    if (fileType === 'image') {
      // Tentar obter dimensões da imagem
      try {
        const sharp = await import('sharp');
        const imageInfo = await sharp.default(file.path).metadata();
        width = imageInfo.width;
        height = imageInfo.height;
      } catch (err) {
        console.warn('Não foi possível obter dimensões da imagem:', err.message);
      }
    }

    // Upload do arquivo para R2
    const fileKey = `files/${project_id}/${uuidv4()}-${file.originalname}`;
    const fileStream = fs.createReadStream(file.path);

    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
      Body: fileStream,
      ContentType: file.mimetype,
    }));

    const r2Url = `${process.env.R2_PUBLIC_URL}/${fileKey}`;

    // Para imagens, a URL do arquivo é também a thumbnail
    if (fileType === 'image') {
      thumbnailKey = fileKey;
      thumbnailUrl = r2Url;
    }

    // Salva no banco
    const result = await query(`
      INSERT INTO brickreview_files (
        project_id, folder_id, name, description,
        r2_key, r2_url, thumbnail_r2_key, thumbnail_url,
        file_type, mime_type, file_size, width, height, uploaded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      projectId, folderId || null, fileName, description || null,
      fileKey, r2Url, thumbnailKey, thumbnailUrl,
      fileType, file.mimetype, file.size, width, height, req.user.id
    ]);

    // Cleanup
    fs.unlinkSync(file.path);

    console.log(`✅ Arquivo enviado: ${fileName} (${fileType})`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro no upload de arquivo:', error);
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    res.status(500).json({ error: 'Erro ao processar upload' });
  }
});

/**
 * @route GET /api/files/folder/:folderId
 * @desc Get all files in a folder
 */
router.get('/folder/:folderId', authenticateToken, async (req, res) => {
  try {
    const folderId = Number(req.params.folderId)
    if (!Number.isInteger(folderId)) {
      return res.status(400).json({ error: 'folderId inválido' })
    }

    if (!(await requireProjectAccessFromFolder(req, res, folderId))) return

    const result = await query(
      `SELECT * FROM brickreview_files
       WHERE folder_id = $1
       ORDER BY created_at DESC`,
      [folderId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar arquivos da pasta:', error);
    res.status(500).json({ error: 'Erro ao buscar arquivos' });
  }
});

/**
 * @route GET /api/files/project/:projectId
 * @desc Get all files in a project (without folder)
 */
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId)
    if (!Number.isInteger(projectId)) {
      return res.status(400).json({ error: 'projectId inválido' })
    }

    if (!(await requireProjectAccess(req, res, projectId))) return

    const result = await query(
      `SELECT * FROM brickreview_files
       WHERE project_id = $1 AND folder_id IS NULL
       ORDER BY created_at DESC`,
      [projectId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar arquivos do projeto:', error);
    res.status(500).json({ error: 'Erro ao buscar arquivos' });
  }
});

/**
 * @route DELETE /api/files/:id
 * @desc Delete a file
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const fileId = Number(req.params.id)
    if (!Number.isInteger(fileId)) {
      return res.status(400).json({ error: 'ID de arquivo inválido' })
    }

    if (!(await requireProjectAccessFromFile(req, res, fileId))) return

    // TODO: Excluir arquivo do R2

    await query('DELETE FROM brickreview_files WHERE id = $1', [fileId])
    res.json({ message: 'Arquivo excluído com sucesso', id: fileId })
  } catch (error) {
    console.error('Erro ao excluir arquivo:', error);
    res.status(500).json({ error: 'Erro ao excluir arquivo' });
  }
});

export default router;
