import express from 'express';
import multer from 'multer';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
  const { project_id, title, description, folder_id } = req.body;
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
      thumbKey = `thumbnails/${project_id}/${thumbFilename}`;

      // 4. Upload Thumbnail para R2 (usando stream)
      const thumbStream = fs.createReadStream(thumbPath);
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: thumbKey,
        Body: thumbStream,
        ContentType: 'image/jpeg',
      }));

      thumbUrl = `${process.env.R2_PUBLIC_URL}/${thumbKey}`;
    } catch (thumbnailError) {
      console.warn('Falha ao gerar thumbnail, seguindo sem thumbnail:', thumbnailError);
    }

    // 3. Upload Vídeo para R2 (usando stream para reduzir uso de memória)
    const fileKey = `videos/${project_id}/${uuidv4()}-${file.originalname}`;
    const fileStream = fs.createReadStream(file.path);

    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
      Body: fileStream,
      ContentType: file.mimetype,
    }));

    const r2Url = `${process.env.R2_PUBLIC_URL}/${fileKey}`;

    // 5. Salva no banco
    const result = await query(`
      INSERT INTO brickreview_videos (
        project_id, title, description, r2_key, r2_url,
        thumbnail_r2_key, thumbnail_url,
        duration, fps, width, height,
        file_size, mime_type, uploaded_by, folder_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      project_id, title, description, fileKey, r2Url,
      thumbKey, thumbUrl,
      metadata.duration, metadata.fps, metadata.width, metadata.height,
      file.size, file.mimetype, req.user.id, folder_id || null
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
 * @route GET /api/videos/:id/stream
 * @desc Get the video URL for streaming (Prioritizes Public CDN)
 */
router.get('/:id/stream', authenticateToken, async (req, res) => {
  try {
    const videoResult = await query(
      'SELECT r2_key, r2_url, mime_type FROM brickreview_videos WHERE id = $1',
      [req.params.id]
    );

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    const { r2_key, r2_url, mime_type } = videoResult.rows[0];

    if (process.env.R2_PUBLIC_URL && r2_url && r2_url.includes(process.env.R2_PUBLIC_URL)) {
      return res.json({
        url: r2_url,
        mime: mime_type || 'video/mp4',
      });
    }

    if (!process.env.R2_BUCKET_NAME) {
      return res.status(500).json({ error: 'Configuração do R2 ausente' });
    }

    const signedUrl = await getSignedUrl(
      r2Client,
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: r2_key,
      }),
      { expiresIn: 60 * 60 * 24 }
    );

    res.json({
      url: signedUrl,
      mime: mime_type || 'video/mp4',
    });
  } catch (error) {
    console.error('Erro crítico ao gerar URL de streaming:', error);
    res.status(500).json({ error: 'Falha no sistema de streaming' });
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

/**
 * @route PATCH /api/videos/:id/move
 * @desc Move video to a different folder
 */
router.patch('/:id/move', authenticateToken, async (req, res) => {
  try {
    const { folder_id } = req.body;
    const videoId = req.params.id;

    // Atualiza o folder_id do vídeo (null significa sem pasta)
    const result = await query(
      'UPDATE brickreview_videos SET folder_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [folder_id || null, videoId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao mover vídeo:', error);
    res.status(500).json({ error: 'Erro ao mover vídeo' });
  }
});

/**
 * @route POST /api/videos/:id/create-version
 * @desc Create a new version relationship between videos
 */
router.post('/:id/create-version', authenticateToken, async (req, res) => {
  try {
    const { parent_video_id } = req.body;
    const childVideoId = req.params.id;

    if (!parent_video_id) {
      return res.status(400).json({ error: 'parent_video_id é obrigatório' });
    }

    // Verifica se o vídeo pai existe
    const parentCheck = await query(
      'SELECT id, version_number FROM brickreview_videos WHERE id = $1',
      [parent_video_id]
    );

    if (parentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vídeo pai não encontrado' });
    }

    // Busca o maior version_number dos vídeos que têm o mesmo parent
    const maxVersionResult = await query(
      'SELECT MAX(version_number) as max_version FROM brickreview_videos WHERE parent_video_id = $1 OR id = $1',
      [parent_video_id]
    );

    const nextVersion = (maxVersionResult.rows[0].max_version || parentCheck.rows[0].version_number || 1) + 1;

    // Atualiza o vídeo para ser versão do pai
    const result = await query(
      'UPDATE brickreview_videos SET parent_video_id = $1, version_number = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [parent_video_id, nextVersion, childVideoId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vídeo filho não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar versão:', error);
    res.status(500).json({ error: 'Erro ao criar versão' });
  }
});

export default router;
