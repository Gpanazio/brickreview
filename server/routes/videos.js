import express from "express";
import multer from "multer";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { query } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireProjectAccess, requireProjectAccessFromVideo } from "../utils/permissions.js";
import r2Client from "../utils/r2.js";
import { buildDownloadFilename, getOriginalFilename } from "../utils/filename.js";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { processVideo } from "../../scripts/process-video-metadata.js";
import { ensureVideoAssets } from "../jobs/ensureVideoAssets.js";
import { addVideoJobSafe } from "../queue/index.js";
import { FEATURES } from "../config/features.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

// Configuração do Multer para upload temporário
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "temp-uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 * 1024, // 100GB (Big files supported now)
  },
});

/**
 * @route POST /api/videos/upload
 * @desc Upload: Uploads original to R2 and marks as ready (no queue processing)
 */
router.post("/upload", authenticateToken, upload.single("video"), async (req, res) => {
  // Increase timeout for large file upload to R2
  res.setTimeout(3600000); // 1 hour

  const { project_id, title, description, folder_id } = req.body;
  const file = req.file;

  const missingR2Config = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
  ].filter((key) => !process.env[key]);

  if (missingR2Config.length > 0) {
    return res.status(500).json({
      error: "Configuração do R2 ausente",
      missing: missingR2Config,
    });
  }

  if (!file || !project_id || !title) {
    return res.status(400).json({ error: "Dados insuficientes para o upload" });
  }

  const projectId = Number(project_id);
  if (!Number.isInteger(projectId)) {
    return res.status(400).json({ error: "project_id inválido" });
  }

  if (!(await requireProjectAccess(req, res, projectId))) return;

  const folderId = folder_id ? Number(folder_id) : null;
  if (folder_id && !Number.isInteger(folderId)) {
    return res.status(400).json({ error: "folder_id inválido" });
  }

  try {
    // 1. Upload Original Video to R2
    const fileKey = `videos/${project_id}/${uuidv4()}-${file.originalname}`;
    console.log(`⬆️ Uploading original to R2: ${fileKey}`);

    const fileStream = fs.createReadStream(file.path);
    await r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileKey,
        Body: fileStream,
        ContentType: file.mimetype,
      })
    );
    const r2Url = `${process.env.R2_PUBLIC_URL}/${fileKey}`;

    // 2. Create DB Record with status 'processing'
    const result = await query(
      `
      INSERT INTO brickreview_videos (
        project_id, folder_id, title, description, 
        r2_key, r2_url, 
        file_size, mime_type, uploaded_by, 
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'processing')
      RETURNING *
    `,
      [
        projectId,
        folderId,
        title,
        description,
        fileKey,
        r2Url,
        file.size,
        file.mimetype,
        req.user.id,
      ]
    );

    const video = result.rows[0];

    // 3. Return success first
    res.status(201).json({
      message: "Upload concluído com sucesso.",
      video: video,
    });

    // 4. Processamento: Fila (Assíncrono) ou Fallback Síncrono
    const processData = { r2Key: fileKey, projectId: projectId };

    // Função de fallback para não duplicar código
    const runSyncFallback = (reason) => {
      logger.warn("VIDEO_PROCESS", `Executando fallback síncrono (${reason})`, {
        videoId: video.id,
      });
      processVideo(video.id).catch((err) => {
        logger.error("VIDEO_PROCESS", `Erro fatal no processamento síncrono`, {
          videoId: video.id,
          error: err.message,
        });
        // Aqui poderíamos atualizar o status do vídeo para 'failed' no banco
      });
    };

    // Tenta usar a fila se a flag estiver ativa e o Redis configurado
    if (FEATURES.USE_VIDEO_QUEUE && process.env.REDIS_URL) {
      addVideoJobSafe(video.id, processData).catch((err) => {
        logger.error("VIDEO_PROCESS", "Falha ao adicionar à fila, ativando fallback", {
          error: err.message,
        });
        runSyncFallback("queue_error");
      });
    } else {
      runSyncFallback("feature_flag_disabled_or_no_redis");
    }
  } catch (error) {
    console.error("Erro no upload assíncrono:", error);
    res.status(500).json({ error: "Erro ao processar upload" });
  } finally {
    // Cleanup local temp file
    if (file && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        console.warn("Failed to cleanup temp upload:", e);
      }
    }
  }
});

/**
 * @route GET /api/videos/:id/stream
 * @desc Get the video URL for streaming (Supports quality selection)
 */
router.get("/:id/stream", authenticateToken, async (req, res) => {
  try {
    const videoId = Number(req.params.id);
    const { quality } = req.query; // 'original' or 'proxy' (default)

    if (!Number.isInteger(videoId)) {
      return res.status(400).json({ error: "ID de vídeo inválido" });
    }

    if (!(await requireProjectAccessFromVideo(req, res, videoId))) return;

    const videoResult = await query(
      "SELECT r2_key, r2_url, proxy_r2_key, proxy_url, streaming_high_r2_key, streaming_high_url, mime_type FROM brickreview_videos WHERE id = $1",
      [req.params.id]
    );

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ error: "Vídeo não encontrado" });
    }

    const {
      r2_key,
      r2_url,
      proxy_r2_key,
      proxy_url,
      streaming_high_r2_key,
      streaming_high_url,
      mime_type,
    } = videoResult.rows[0];

    // DEBUG: Log video data
    console.log(`🎬 Stream request for video ${req.params.id}:`, {
      r2_url,
      proxy_url,
      streaming_high_url,
      quality,
    });

    // Se quality for 'original', tenta usar Streaming High se existir, senão Original.
    // Senão (ou se original falhar), tenta o proxy.
    let streamKey, streamUrl, isOriginal;

    if (quality === "original") {
      // Prioriza Streaming High se existir (pois é otimizado para web mas alta qualidade)
      // Se não, usa o original
      if (streaming_high_url) {
        streamKey = streaming_high_r2_key;
        streamUrl = streaming_high_url;
      } else {
        streamKey = r2_key;
        streamUrl = r2_url;
      }
      isOriginal = true;
    } else {
      // Para qualidade 'proxy' (default)
      // Tenta: Proxy -> Streaming High -> Original
      if (proxy_url) {
        streamKey = proxy_r2_key;
        streamUrl = proxy_url;
        isOriginal = false;
      } else if (streaming_high_url) {
        streamKey = streaming_high_r2_key;
        streamUrl = streaming_high_url;
        isOriginal = true; // High quality is close to original
      } else {
        streamKey = r2_key;
        streamUrl = r2_url;
        isOriginal = true;
      }
    }

    console.log(`📡 Resolved stream for video ${req.params.id}:`, {
      streamUrl,
      isOriginal,
      quality,
    });

    if (process.env.R2_PUBLIC_URL && streamUrl && streamUrl.includes(process.env.R2_PUBLIC_URL)) {
      console.log(`🔗 Returning public R2 URL`);
      return res.json({
        url: streamUrl,
        mime: isOriginal ? mime_type || "video/mp4" : "video/mp4",
        isProxy: !isOriginal,
      });
    }

    if (!process.env.R2_BUCKET_NAME) {
      return res.status(500).json({ error: "Configuração do R2 ausente" });
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
      mime: isOriginal ? mime_type || "video/mp4" : "video/mp4",
    });
  } catch (error) {
    console.error("Erro crítico ao gerar URL de streaming:", error);
    res.status(500).json({ error: "Falha no sistema de streaming" });
  }
});

/**
 * @route GET /api/videos/:id/download
 * @desc Get download URL for original or proxy video
 */
router.get("/:id/download", authenticateToken, async (req, res) => {
  try {
    const videoId = Number(req.params.id);
    if (!Number.isInteger(videoId)) {
      return res.status(400).json({ error: "ID de vídeo inválido" });
    }

    if (!(await requireProjectAccessFromVideo(req, res, videoId))) return;

    const { type } = req.query; // 'original' or 'proxy'

    const videoResult = await query(
      "SELECT r2_key, r2_url, proxy_r2_key, proxy_url, title FROM brickreview_videos WHERE id = $1",
      [req.params.id]
    );

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ error: "Vídeo não encontrado" });
    }

    const { r2_key, r2_url, proxy_r2_key, proxy_url, title } = videoResult.rows[0];

    let downloadKey, downloadUrl;
    const resolvedType = type === "proxy" ? "proxy" : "original";
    const originalFilename = getOriginalFilename(r2_key, title);
    const filename = buildDownloadFilename(originalFilename, resolvedType === "proxy");

    if (resolvedType === "proxy") {
      if (!proxy_r2_key || !proxy_url) {
        return res.status(404).json({ error: "Proxy não disponível para este vídeo" });
      }
      downloadKey = proxy_r2_key;
      downloadUrl = proxy_url;
    } else {
      downloadKey = r2_key;
      downloadUrl = r2_url;
    }

    // Se temos URL pública, retorna diretamente
    if (
      process.env.R2_PUBLIC_URL &&
      downloadUrl &&
      downloadUrl.includes(process.env.R2_PUBLIC_URL)
    ) {
      return res.json({
        url: downloadUrl,
        filename,
        type: resolvedType,
      });
    }

    // Senão, gera signed URL
    if (!process.env.R2_BUCKET_NAME) {
      return res.status(500).json({ error: "Configuração do R2 ausente" });
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
      filename,
      type: resolvedType,
    });
  } catch (error) {
    console.error("Erro ao gerar URL de download:", error);
    res.status(500).json({ error: "Falha ao gerar URL de download" });
  }
});

/**
 * @route GET /api/videos/:id
 * @desc Get video details and its comments
 */
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const videoId = Number(req.params.id);
    if (!Number.isInteger(videoId)) {
      return res.status(400).json({ error: "ID de vídeo inválido" });
    }

    if (!(await requireProjectAccessFromVideo(req, res, videoId))) return;

    const videoResult = await query("SELECT * FROM brickreview_videos_with_stats WHERE id = $1", [
      videoId,
    ]);

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ error: "Vídeo não encontrado" });
    }

    const video = videoResult.rows[0];

    // Busca comentários do vídeo
    const commentsResult = await query(
      `SELECT * FROM brickreview_comments_with_user
       WHERE video_id = $1 AND parent_comment_id IS NULL
       ORDER BY timestamp ASC, created_at ASC`,
      [req.params.id]
    );

    res.json({
      ...video,
      comments: commentsResult.rows,
    });

    // Background: Verificar e gerar assets faltantes (sprites/thumbnail)
    if (video.status === "ready" && (!video.sprite_vtt_url || !video.thumbnail_url)) {
      console.log(`[VideoGet] Vídeo ${videoId} sem assets, disparando geração em background...`);
      ensureVideoAssets(videoId).catch((err) => {
        console.error(`[VideoGet] Erro ao gerar assets para vídeo ${videoId}:`, err);
      });
    }
  } catch (error) {
    console.error("Erro ao buscar detalhes do vídeo:", error);
    res.status(500).json({ error: "Erro ao buscar detalhes do vídeo" });
  }
});

/**
 * @route PATCH /api/videos/:id/move
 * @desc Move video to a different folder
 */
router.patch("/:id/move", authenticateToken, async (req, res) => {
  try {
    const { folder_id } = req.body;
    const videoId = Number(req.params.id);

    if (!Number.isInteger(videoId)) {
      return res.status(400).json({ error: "ID de vídeo inválido" });
    }

    const projectId = await requireProjectAccessFromVideo(req, res, videoId);
    if (!projectId) return;

    const folderId = folder_id ? Number(folder_id) : null;
    if (folder_id && !Number.isInteger(folderId)) {
      return res.status(400).json({ error: "folder_id inválido" });
    }

    if (folderId) {
      const folderCheck = await query(
        "SELECT 1 FROM brickreview_folders WHERE id = $1 AND project_id = $2",
        [folderId, projectId]
      );
      if (folderCheck.rows.length === 0) {
        return res.status(400).json({ error: "folder_id não pertence ao projeto" });
      }
    }

    // Atualiza o folder_id do vídeo (null significa sem pasta)
    const result = await query(
      "UPDATE brickreview_videos SET folder_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [folderId || null, videoId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vídeo não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao mover vídeo:", error);
    res.status(500).json({ error: "Erro ao mover vídeo" });
  }
});

/**
 * @route POST /api/videos/:id/create-version
 * @desc Create a new version relationship between videos
 */
router.post("/:id/create-version", authenticateToken, async (req, res) => {
  try {
    const { parent_video_id } = req.body;
    const childVideoId = Number(req.params.id);

    if (!Number.isInteger(childVideoId)) {
      return res.status(400).json({ error: "ID de vídeo inválido" });
    }

    const projectId = await requireProjectAccessFromVideo(req, res, childVideoId);
    if (!projectId) return;

    if (!parent_video_id) {
      return res.status(400).json({ error: "parent_video_id é obrigatório" });
    }

    // Previne ciclos: não permite que um vídeo seja pai de si mesmo
    if (parseInt(childVideoId) === parseInt(parent_video_id)) {
      return res.status(400).json({ error: "Um vídeo não pode ser versão de si mesmo" });
    }

    // Verifica se o vídeo pai existe e busca info sobre ele
    const parentCheck = await query(
      "SELECT id, version_number, parent_video_id, project_id FROM brickreview_videos WHERE id = $1",
      [parent_video_id]
    );

    if (parentCheck.rows.length === 0) {
      return res.status(404).json({ error: "Vídeo pai não encontrado" });
    }

    if (parentCheck.rows[0].project_id !== projectId) {
      return res.status(400).json({ error: "Vídeo pai não pertence ao mesmo projeto" });
    }

    // Previne ciclos: parent não pode ter parent (somente vídeos raiz podem ser pais)
    if (parentCheck.rows[0].parent_video_id !== null) {
      return res.status(400).json({
        error: "Não é possível criar versão de uma versão. Apenas vídeos raiz podem ter versões.",
      });
    }

    // Verifica se o child já não é pai de outro vídeo (evita ciclos)
    const childIsParentCheck = await query(
      "SELECT COUNT(*) as count FROM brickreview_videos WHERE parent_video_id = $1",
      [childVideoId]
    );
    if (parseInt(childIsParentCheck.rows[0].count) > 0) {
      return res
        .status(400)
        .json({ error: "Este vídeo já é pai de outras versões e não pode se tornar uma versão" });
    }

    // Busca o maior version_number dos vídeos que têm o mesmo parent
    const maxVersionResult = await query(
      "SELECT MAX(version_number) as max_version FROM brickreview_videos WHERE parent_video_id = $1 OR id = $1",
      [parent_video_id]
    );

    const nextVersion =
      (maxVersionResult.rows[0].max_version || parentCheck.rows[0].version_number || 1) + 1;

    // Atualiza o vídeo para ser versão do pai
    const result = await query(
      "UPDATE brickreview_videos SET parent_video_id = $1, version_number = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
      [parent_video_id, nextVersion, childVideoId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vídeo filho não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao criar versão:", error);
    res.status(500).json({ error: "Erro ao criar versão" });
  }
});

/**
 * @route DELETE /api/videos/:id
 * @desc Soft delete a video and its versions
 */
router.delete("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const videoId = Number(id);
    if (!Number.isInteger(videoId)) {
      return res.status(400).json({ error: "ID de vídeo inválido" });
    }

    if (!(await requireProjectAccessFromVideo(req, res, videoId))) return;

    const now = new Date();
    // Marca o vídeo e todas as suas versões como deletados
    await query(
      "UPDATE brickreview_videos SET deleted_at = $1 WHERE id = $2 OR parent_video_id = $2",
      [now, videoId]
    );

    res.json({ message: "Vídeo enviado para a lixeira", id: videoId });
  } catch (error) {
    console.error("Erro ao excluir vídeo:", error);
    res.status(500).json({ error: "Erro ao excluir vídeo" });
  }
});

/**
 * @route POST /api/videos/:id/restore
 * @desc Restore a deleted video and its versions
 */
router.post("/:id/restore", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const videoId = Number(id);
    if (!Number.isInteger(videoId)) {
      return res.status(400).json({ error: "ID de vídeo inválido" });
    }

    const result = await query(
      "UPDATE brickreview_videos SET deleted_at = NULL WHERE id = $1 OR parent_video_id = $1 RETURNING *",
      [videoId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vídeo não encontrado na lixeira" });
    }

    res.json({ message: "Vídeo restaurado com sucesso", video: result.rows[0] });
  } catch (error) {
    console.error("Erro ao restaurar vídeo:", error);
    res.status(500).json({ error: "Erro ao restaurar vídeo" });
  }
});

export default router;
