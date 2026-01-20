/**
 * Job para verificar e gerar sprites/thumbnails faltantes
 * Este job pode ser executado periodicamente ou sob demanda
 */

import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import os from "os";
import { query } from "../db.js";
import {
  generateSpriteSheet,
  generateSpriteVtt,
  generateThumbnail,
  getVideoMetadata,
} from "../utils/video.js";
import { downloadFile, uploadFile } from "../utils/r2-helpers.js";
import logger from "../utils/logger.js";

/**
 * Verifica e gera sprites para um vídeo específico
 * @param {number} videoId - ID do vídeo
 * @returns {Promise<object>} - Resultado da operação
 */
export async function ensureVideoAssets(videoId) {
  const result = {
    videoId,
    spriteGenerated: false,
    thumbnailGenerated: false,
    error: null,
  };

  try {
    // Buscar dados do vídeo
    const videoQuery = await query(
      `SELECT id, title, r2_key, proxy_r2_key, thumbnail_url, sprite_vtt_url, 
              duration, width, height, project_id
       FROM brickreview_videos WHERE id = $1`,
      [videoId]
    );

    if (videoQuery.rows.length === 0) {
      result.error = "Vídeo não encontrado";
      return result;
    }

    const video = videoQuery.rows[0];
    const needsSprite = !video.sprite_vtt_url;
    const needsThumbnail = !video.thumbnail_url;

    if (!needsSprite && !needsThumbnail) {
      return result; // Nada a fazer
    }

    const videoR2Key = video.proxy_r2_key || video.r2_key;
    if (!videoR2Key) {
      result.error = "Vídeo sem arquivo no R2";
      return result;
    }

    // Criar diretório temporário
    const tempDir = path.join(os.tmpdir(), `assets-${video.id}-${Date.now()}`);
    await fs.promises.mkdir(tempDir, { recursive: true });

    try {
      // Baixar vídeo
      logger.info(`[ensureVideoAssets] Baixando vídeo ${video.id}...`);
      const localVideoPath = path.join(tempDir, `video-${video.id}.mp4`);
      await downloadFile(videoR2Key, localVideoPath);

      // Obter metadados se necessário
      let duration = video.duration;
      let width = video.width;
      let height = video.height;

      if (!duration || !width || !height) {
        const metadata = await getVideoMetadata(localVideoPath);
        duration = duration || metadata.duration;
        width = width || metadata.width;
        height = height || metadata.height;
      }

      // Gerar thumbnail se necessário
      if (needsThumbnail) {
        logger.info(`[ensureVideoAssets] Gerando thumbnail para vídeo ${video.id}...`);
        const thumbFilename = `thumb-${uuidv4()}.jpg`;
        const thumbPath = await generateThumbnail(localVideoPath, tempDir, thumbFilename);
        const thumbKey = `thumbnails/${video.project_id}/${thumbFilename}`;
        const thumbUrl = await uploadFile(thumbPath, thumbKey, "image/jpeg");

        await query(
          `UPDATE brickreview_videos SET thumbnail_url = $1, updated_at = NOW() WHERE id = $2`,
          [thumbUrl, video.id]
        );
        result.thumbnailGenerated = true;
      }

      // Gerar sprites se necessário
      if (needsSprite) {
        logger.info(`[ensureVideoAssets] Gerando sprites para vídeo ${video.id}...`);
        const spriteFilename = `sprite-${uuidv4()}.jpg`;
        const spriteResult = await generateSpriteSheet(localVideoPath, tempDir, spriteFilename, {
          intervalSeconds: 5,
          duration,
          width,
          height,
        });

        const spriteKey = `sprites/${video.project_id}/${spriteFilename}`;
        const spriteUrl = await uploadFile(spriteResult.spritePath, spriteKey, "image/jpeg");

        const spriteVttFilename = `sprite-${uuidv4()}.vtt`;
        const spriteVttPath = generateSpriteVtt({
          outputDir: tempDir,
          filename: spriteVttFilename,
          spriteUrl: spriteUrl,
          duration: spriteResult.duration,
          intervalSeconds: spriteResult.intervalSeconds,
          columns: spriteResult.columns,
          thumbWidth: spriteResult.thumbWidth,
          thumbHeight: spriteResult.thumbHeight,
        });

        const spriteVttKey = `sprites/${video.project_id}/${spriteVttFilename}`;
        const spriteVttUrl = await uploadFile(spriteVttPath, spriteVttKey, "text/vtt");

        await query(
          `UPDATE brickreview_videos 
           SET sprite_r2_key = $1, sprite_url = $2, sprite_vtt_url = $3, updated_at = NOW()
           WHERE id = $4`,
          [spriteKey, spriteUrl, spriteVttUrl, video.id]
        );
        result.spriteGenerated = true;
      }

      logger.info(`[ensureVideoAssets] Vídeo ${video.id} processado com sucesso`);
    } finally {
      // Limpar temporários
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    logger.error(`[ensureVideoAssets] Erro no vídeo ${videoId}:`, error);
    result.error = error.message;
  }

  return result;
}

/**
 * Verifica e gera assets para todos os vídeos que precisam
 * @param {number} limit - Número máximo de vídeos a processar
 * @returns {Promise<object>} - Resumo da operação
 */
export async function processVideosWithMissingAssets(limit = 10) {
  const summary = {
    total: 0,
    processed: 0,
    failed: 0,
    results: [],
  };

  try {
    // Buscar vídeos que precisam de assets
    const videosQuery = await query(
      `SELECT id FROM brickreview_videos 
       WHERE (sprite_vtt_url IS NULL OR thumbnail_url IS NULL)
       AND (r2_key IS NOT NULL OR proxy_r2_key IS NOT NULL)
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    summary.total = videosQuery.rows.length;

    for (const row of videosQuery.rows) {
      const result = await ensureVideoAssets(row.id);
      summary.results.push(result);

      if (result.error) {
        summary.failed++;
      } else {
        summary.processed++;
      }
    }
  } catch (error) {
    logger.error("[processVideosWithMissingAssets] Erro:", error);
  }

  return summary;
}

export default { ensureVideoAssets, processVideosWithMissingAssets };
