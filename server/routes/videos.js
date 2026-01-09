import express from 'express';
import multer from 'multer';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import r2Client from '../utils/r2.js';
import { generateThumbnail, getVideoMetadata } from '../utils/video.js';
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

const upload = multer({ storage });

/**
 * @route POST /api/videos/upload
 * @desc Upload a video to R2 and save metadata
 */
router.post('/upload', authenticateToken, upload.single('video'), async (req, res) => {
  const { project_id, title, description } = req.body;
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

  if (!file || !project_id || !title) {
    return res.status(400).json({ error: 'Dados insuficientes para o upload' });
  }

  const thumbDir = 'thumbnails/';
  const thumbFilename = `thumb-${uuidv4()}.jpg`;
  let thumbPath = '';
  let thumbKey = null;
  let thumbUrl = null;
  let metadata = {
    duration: null,
    fps: 30,
    width: null,
    height: null
  };

  try {
    // 1. Obter metadados
    try {
      metadata = await getVideoMetadata(file.path);
    } catch (metadataError) {
      console.warn('Falha ao obter metadados do vídeo, seguindo com valores padrão:', metadataError);
    }

    // 2. Gerar thumbnail
    try {
      thumbPath = await generateThumbnail(file.path, thumbDir, thumbFilename);
      const thumbContent = await fs.promises.readFile(thumbPath);
      thumbKey = `thumbnails/${project_id}/${thumbFilename}`;

      // 4. Upload Thumbnail para R2
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: thumbKey,
        Body: thumbContent,
        ContentType: 'image/jpeg',
      }));

      thumbUrl = `${process.env.R2_PUBLIC_URL}/${thumbKey}`;
    } catch (thumbnailError) {
      console.warn('Falha ao gerar thumbnail, seguindo sem thumbnail:', thumbnailError);
    }

    // 3. Upload Vídeo para R2
    const fileContent = fs.readFileSync(file.path);
    const fileKey = `videos/${project_id}/${uuidv4()}-${file.originalname}`;

    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
      Body: fileContent,
      ContentType: file.mimetype,
    }));

    const r2Url = `${process.env.R2_PUBLIC_URL}/${fileKey}`;

    // 5. Salva no banco
    const result = await query(`
      INSERT INTO brickreview_videos (
        project_id, title, description, r2_key, r2_url, 
        thumbnail_r2_key, thumbnail_url,
        duration, fps, width, height,
        file_size, mime_type, uploaded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      project_id, title, description, fileKey, r2Url,
      thumbKey, thumbUrl,
      metadata.duration, metadata.fps, metadata.width, metadata.height,
      file.size, file.mimetype, req.user.id
    ]);

    // Cleanup
    fs.unlinkSync(file.path);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro no upload de vídeo:', error);
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    res.status(500).json({ error: 'Erro ao processar upload' });
  }
});

/**
 * @route GET /api/videos/:id
 * @desc Get video details and its comments
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const videoResult = await query(
      'SELECT * FROM brickreview_videos_with_stats WHERE id = $1',
      [req.params.id]
    );

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    const video = videoResult.rows[0];

    // Busca comentários do vídeo
    const commentsResult = await query(`
      SELECT * FROM brickreview_comments_with_user 
      WHERE video_id = $1 AND parent_comment_id IS NULL
      ORDER BY timestamp ASC, created_at ASC
    `, [req.params.id]);

    res.json({
      ...video,
      comments: commentsResult.rows
    });
  } catch (error) {
    console.error('Erro ao buscar detalhes do vídeo:', error);
    res.status(500).json({ error: 'Erro ao buscar detalhes do vídeo' });
  }
});

export default router;
