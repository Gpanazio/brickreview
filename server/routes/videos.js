import express from 'express';
import multer from 'multer';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js'
import { requireProjectAccess, requireProjectAccessFromVideo } from '../utils/permissions.js'
import r2Client from '../utils/r2.js'
import { generateThumbnail, getVideoMetadata, generateProxy, generateSpriteSheet, generateSpriteVtt } from '../utils/video.js';
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

  const thumbDir = 'thumbnails/';
  const thumbFilename = `thumb-${uuidv4()}.jpg`;
  const proxyDir = 'temp-uploads/proxies/';
  const proxyFilename = `proxy-720p-${uuidv4()}.mp4`;
  const spriteDir = 'temp-uploads/sprites/';
  const spriteFilename = `sprite-${uuidv4()}.jpg`;
  const spriteVttFilename = `sprite-${uuidv4()}.vtt`;
  let thumbPath = '';
  let thumbKey = null;
  let thumbUrl = null;
  let proxyPath = '';
  let proxyKey = null;
  let proxyUrl = null;
  let spritePath = '';
  let spriteKey = null;
  let spriteUrl = null;
  let spriteVttPath = '';
  let spriteVttKey = null;
  let spriteVttUrl = null;
  let metadata = {
    duration: null,
    fps: 30,
    width: null,
    height: null
  };

  try {
    // 1. Obter metadados
    try {
      console.log('📊 Obtendo metadados do vídeo:', file.path);
      metadata = await getVideoMetadata(file.path);
      console.log('✅ Metadados obtidos:', metadata);
    } catch (metadataError) {
      console.error('❌ Falha ao obter metadados do vídeo:', metadataError.message);
      console.error('Stack trace:', metadataError.stack);
    }

    // 2. Gerar thumbnail
    try {
      console.log('🖼️  Gerando thumbnail...');
      thumbPath = await generateThumbnail(file.path, thumbDir, thumbFilename);
      thumbKey = `thumbnails/${project_id}/${thumbFilename}`;
      console.log('✅ Thumbnail gerada localmente:', thumbPath);

      // Upload Thumbnail para R2 (usando stream)
      const thumbStream = fs.createReadStream(thumbPath);
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: thumbKey,
        Body: thumbStream,
        ContentType: 'image/jpeg',
      }));

      thumbUrl = `${process.env.R2_PUBLIC_URL}/${thumbKey}`;
      console.log('✅ Thumbnail enviada para R2:', thumbUrl);
    } catch (thumbnailError) {
      console.error('❌ Falha ao gerar thumbnail:', thumbnailError.message);
      console.error('Stack trace:', thumbnailError.stack);
    }

    // 3. Gerar proxy 720p @ 5000kbps
    try {
      console.log('🎬 Iniciando geração de proxy 720p...');
      proxyPath = await generateProxy(file.path, proxyDir, proxyFilename);
      proxyKey = `proxies/${project_id}/${proxyFilename}`;

      // Upload Proxy para R2 (usando stream)
      const proxyStream = fs.createReadStream(proxyPath);
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: proxyKey,
        Body: proxyStream,
        ContentType: 'video/mp4',
      }));

      proxyUrl = `${process.env.R2_PUBLIC_URL}/${proxyKey}`;
      console.log('✅ Proxy gerado e enviado para R2');
    } catch (proxyError) {
      console.warn('⚠️  Falha ao gerar proxy, usando vídeo original:', proxyError.message);
    }

    // 4. Gerar sprite sheet para hover scrubbing
    try {
      console.log('🧩 Gerando sprite sheet...');
      const spriteResult = await generateSpriteSheet(file.path, spriteDir, spriteFilename, {
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height
      });

      spritePath = spriteResult.spritePath;
      spriteKey = `sprites/${project_id}/${spriteFilename}`;
      spriteUrl = `${process.env.R2_PUBLIC_URL}/${spriteKey}`;

      const spriteStream = fs.createReadStream(spritePath);
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: spriteKey,
        Body: spriteStream,
        ContentType: 'image/jpeg',
      }));

      spriteVttPath = generateSpriteVtt({
        outputDir: spriteDir,
        filename: spriteVttFilename,
        spriteUrl,
        duration: spriteResult.duration,
        intervalSeconds: spriteResult.intervalSeconds,
        columns: spriteResult.columns,
        thumbWidth: spriteResult.thumbWidth,
        thumbHeight: spriteResult.thumbHeight
      });

      spriteVttKey = `sprites/${project_id}/${spriteVttFilename}`;
      const vttStream = fs.createReadStream(spriteVttPath);
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: spriteVttKey,
        Body: vttStream,
        ContentType: 'text/vtt',
      }));

      spriteVttUrl = `${process.env.R2_PUBLIC_URL}/${spriteVttKey}`;
      console.log('✅ Sprite e VTT enviados para R2');
    } catch (spriteError) {
      console.warn('⚠️  Falha ao gerar sprite sheet:', spriteError.message);
    }

    // 5. Upload Vídeo original para R2 (usando stream para reduzir uso de memória)
    const fileKey = `videos/${project_id}/${uuidv4()}-${file.originalname}`;
    const fileStream = fs.createReadStream(file.path);

    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
      Body: fileStream,
      ContentType: file.mimetype,
    }));

    const r2Url = `${process.env.R2_PUBLIC_URL}/${fileKey}`;

    // 6. Salva no banco
    const result = await query(`
      INSERT INTO brickreview_videos (
        project_id, title, description, r2_key, r2_url,
        proxy_r2_key, proxy_url,
        thumbnail_r2_key, thumbnail_url,
        sprite_r2_key, sprite_url, sprite_vtt_url,
        duration, fps, width, height,
        file_size, mime_type, uploaded_by, folder_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [
      project_id, title, description, fileKey, r2Url,
      proxyKey, proxyUrl,
      thumbKey, thumbUrl,
      spriteKey, spriteUrl, spriteVttUrl,
      metadata.duration, metadata.fps, metadata.width, metadata.height,
      file.size, file.mimetype, req.user.id, folderId || null
    ]);

    // Cleanup - Isolated from DB success to prevent 500 on success
    const cleanup = (p) => {
      try {
        if (p && fs.existsSync(p)) fs.unlinkSync(p)
      } catch (err) {
        console.warn(`⚠️ Falha ao remover arquivo temporário ${p}:`, err.message)
      }
    }

    cleanup(file.path)
    cleanup(thumbPath)
    cleanup(proxyPath)
    cleanup(spritePath)
    cleanup(spriteVttPath)

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
 * @desc Get the video URL for streaming (Supports quality selection)
 */
router.get('/:id/stream', authenticateToken, async (req, res) => {
  try {
    const videoId = Number(req.params.id)
    const { quality } = req.query; // 'original' or 'proxy' (default)

    if (!Number.isInteger(videoId)) {
      return res.status(400).json({ error: 'ID de vídeo inválido' })
    }

    if (!(await requireProjectAccessFromVideo(req, res, videoId))) return

    const videoResult = await query(
      'SELECT r2_key, r2_url, proxy_r2_key, proxy_url, mime_type FROM brickreview_videos WHERE id = $1',
      [req.params.id]
    );

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    const { r2_key, r2_url, proxy_r2_key, proxy_url, mime_type } = videoResult.rows[0];

    // Se quality for 'original', tenta usar o original. 
    // Senão (ou se original falhar), tenta o proxy.
    let streamKey, streamUrl, isOriginal;

    if (quality === 'original') {
      streamKey = r2_key;
      streamUrl = r2_url;
      isOriginal = true;
    } else {
      streamKey = proxy_r2_key || r2_key;
      streamUrl = proxy_url || r2_url;
      isOriginal = !proxy_url;
    }

    if (process.env.R2_PUBLIC_URL && streamUrl && streamUrl.includes(process.env.R2_PUBLIC_URL)) {
      return res.json({
        url: streamUrl,
        mime: isOriginal ? (mime_type || 'video/mp4') : 'video/mp4',
        isProxy: !isOriginal,
      });
    }

    if (!process.env.R2_BUCKET_NAME) {
      return res.status(500).json({ error: 'Configuração do R2 ausente' });
    }

    const signedUrl = await getSignedUrl(
      r2Client,
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: streamKey,
      }),
      { expiresIn: 60 * 60 * 24 }
    );

    res.json({
      url: signedUrl,
      isProxy: !isOriginal,
      mime: isOriginal ? (mime_type || 'video/mp4') : 'video/mp4',
    });
  } catch (error) {
    console.error('Erro crítico ao gerar URL de streaming:', error);
    res.status(500).json({ error: 'Falha no sistema de streaming' });
  }
});

/**
 * @route GET /api/videos/:id/download
 * @desc Get download URL for original or proxy video
 */
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const videoId = Number(req.params.id)
    if (!Number.isInteger(videoId)) {
      return res.status(400).json({ error: 'ID de vídeo inválido' })
    }

    if (!(await requireProjectAccessFromVideo(req, res, videoId))) return

    const { type } = req.query // 'original' or 'proxy'
    const downloadType = type === 'proxy' ? 'proxy' : 'original'

    const videoResult = await query(
      'SELECT r2_key, r2_url, proxy_r2_key, proxy_url, title FROM brickreview_videos WHERE id = $1',
      [req.params.id]
    );

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vídeo não encontrado' });
    }

    const { r2_key, r2_url, proxy_r2_key, proxy_url, title } = videoResult.rows[0];

    let downloadKey, downloadUrl;

    if (downloadType === 'proxy') {
      if (!proxy_r2_key || !proxy_url) {
        return res.status(404).json({ error: 'Proxy não disponível para este vídeo' });
      }
      downloadKey = proxy_r2_key;
      downloadUrl = proxy_url;
    } else {
      downloadKey = r2_key;
      downloadUrl = r2_url;
    }

    // Se temos URL pública, retorna diretamente
    if (process.env.R2_PUBLIC_URL && downloadUrl && downloadUrl.includes(process.env.R2_PUBLIC_URL)) {
      return res.json({
        url: downloadUrl,
        filename: `${title}_${downloadType}.mp4`,
        type: downloadType
      });
    }

    // Senão, gera signed URL
    if (!process.env.R2_BUCKET_NAME) {
      return res.status(500).json({ error: 'Configuração do R2 ausente' });
    }

    const signedUrl = await getSignedUrl(
      r2Client,
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: downloadKey,
      }),
      { expiresIn: 60 * 60 * 24 } // 24 horas
    );

    res.json({
      url: signedUrl,
      filename: `${title}_${downloadType}.mp4`,
      type: downloadType
    });
  } catch (error) {
    console.error('Erro ao gerar URL de download:', error);
    res.status(500).json({ error: 'Falha ao gerar URL de download' });
  }
});

/**
 * @route GET /api/videos/:id
 * @desc Get video details and its comments
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const videoId = Number(req.params.id)
    if (!Number.isInteger(videoId)) {
      return res.status(400).json({ error: 'ID de vídeo inválido' })
    }

    if (!(await requireProjectAccessFromVideo(req, res, videoId))) return

    const videoResult = await query(
      'SELECT * FROM brickreview_videos_with_stats WHERE id = $1',
      [videoId]
    )

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vídeo não encontrado' })
    }

    const video = videoResult.rows[0]

    // Busca comentários do vídeo
    const commentsResult = await query(
      `SELECT * FROM brickreview_comments_with_user
       WHERE video_id = $1 AND parent_comment_id IS NULL
       ORDER BY timestamp ASC, created_at ASC`,
      [req.params.id]
    )

    res.json({
      ...video,
      comments: commentsResult.rows,
    })

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
    const { folder_id } = req.body
    const videoId = Number(req.params.id)

    if (!Number.isInteger(videoId)) {
      return res.status(400).json({ error: 'ID de vídeo inválido' })
    }

    const projectId = await requireProjectAccessFromVideo(req, res, videoId)
    if (!projectId) return

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

    // Atualiza o folder_id do vídeo (null significa sem pasta)
    const result = await query(
      'UPDATE brickreview_videos SET folder_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [folderId || null, videoId]
    )

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
    const { parent_video_id } = req.body
    const childVideoId = Number(req.params.id)

    if (!Number.isInteger(childVideoId)) {
      return res.status(400).json({ error: 'ID de vídeo inválido' })
    }

    const projectId = await requireProjectAccessFromVideo(req, res, childVideoId)
    if (!projectId) return

    if (!parent_video_id) {
      return res.status(400).json({ error: 'parent_video_id é obrigatório' });
    }

    // Previne ciclos: não permite que um vídeo seja pai de si mesmo
    if (parseInt(childVideoId) === parseInt(parent_video_id)) {
      return res.status(400).json({ error: 'Um vídeo não pode ser versão de si mesmo' });
    }

    // Verifica se o vídeo pai existe e busca info sobre ele
    const parentCheck = await query(
      'SELECT id, version_number, parent_video_id, project_id FROM brickreview_videos WHERE id = $1',
      [parent_video_id]
    );

    if (parentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vídeo pai não encontrado' });
    }

    if (parentCheck.rows[0].project_id !== projectId) {
      return res.status(400).json({ error: 'Vídeo pai não pertence ao mesmo projeto' })
    }

    // Previne ciclos: parent não pode ter parent (somente vídeos raiz podem ser pais)
    if (parentCheck.rows[0].parent_video_id !== null) {
      return res.status(400).json({
        error: 'Não é possível criar versão de uma versão. Apenas vídeos raiz podem ter versões.',
      })
    }

    // Verifica se o child já não é pai de outro vídeo (evita ciclos)
    const childIsParentCheck = await query('SELECT COUNT(*) as count FROM brickreview_videos WHERE parent_video_id = $1', [childVideoId]);
    if (parseInt(childIsParentCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Este vídeo já é pai de outras versões e não pode se tornar uma versão' });
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

/**
 * @route DELETE /api/videos/:id
 * @desc Delete a video and its files from R2
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const videoId = Number(id)
    if (!Number.isInteger(videoId)) {
      return res.status(400).json({ error: 'ID de vídeo inválido' })
    }

    if (!(await requireProjectAccessFromVideo(req, res, videoId))) return

    // Busca as chaves dos arquivos antes de deletar do banco
    const videoResult = await query(
      'SELECT r2_key, thumbnail_r2_key, proxy_r2_key, sprite_r2_key, sprite_vtt_url FROM brickreview_videos WHERE id = $1',
      [videoId]
    )

    if (videoResult.rows.length > 0) {
      const { r2_key, thumbnail_r2_key, proxy_r2_key, sprite_r2_key, sprite_vtt_url } = videoResult.rows[0]
      const bucket = process.env.R2_BUCKET_NAME
      const spriteVttKey = sprite_vtt_url && process.env.R2_PUBLIC_URL
        && sprite_vtt_url.startsWith(`${process.env.R2_PUBLIC_URL}/`)
        ? sprite_vtt_url.replace(`${process.env.R2_PUBLIC_URL}/`, '')
        : null

      // Deleta arquivos do R2 em background
      const deletePromises = [
        r2_key && r2Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: r2_key })),
        thumbnail_r2_key && r2Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: thumbnail_r2_key })),
        proxy_r2_key && r2Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: proxy_r2_key })),
        sprite_r2_key && r2Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: sprite_r2_key })),
        spriteVttKey && r2Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: spriteVttKey }))
      ].filter(Boolean)

      Promise.all(deletePromises).catch(err => {
        console.error(`❌ Erro ao deletar objetos do R2 para o vídeo ${videoId}:`, err)
      })
    }

    // Exclui do banco de dados (CASCADE vai remover comentários, aprovações, etc.)
    await query('DELETE FROM brickreview_videos WHERE id = $1', [videoId])

    res.json({ message: 'Vídeo excluído com sucesso', id: videoId })
  } catch (error) {
    console.error('Erro ao excluir vídeo:', error);
    res.status(500).json({ error: 'Erro ao excluir vídeo' });
  }
});

export default router;
