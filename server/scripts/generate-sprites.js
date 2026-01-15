/**
 * Script para gerar sprites VTT para vídeos existentes
 *
 * Uso: node server/scripts/generate-sprites.js [--all] [--video-id=ID]
 *
 * Flags:
 *   --all         Processa todos os vídeos sem sprites
 *   --video-id=X  Processa apenas o vídeo com ID específico
 *   --dry-run     Apenas mostra o que seria feito, sem executar
 */

import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db.js";
import { generateSpriteSheet, generateSpriteVtt, getVideoMetadata } from "../utils/video.js";
import { downloadFile, uploadFile } from "../utils/r2-helpers.js";

dotenv.config();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const processAll = args.includes("--all");
const videoIdArg = args.find((a) => a.startsWith("--video-id="));
const specificVideoId = videoIdArg ? parseInt(videoIdArg.split("=")[1], 10) : null;

console.log("🎞️  Script de Geração de Sprites para Vídeos Existentes");
console.log("=========================================================");
console.log(`   Modo: ${dryRun ? "DRY RUN (simulação)" : "EXECUÇÃO REAL"}`);
console.log(
  `   Alvo: ${specificVideoId ? `Vídeo ID ${specificVideoId}` : processAll ? "Todos sem sprites" : "Nenhum (use --all ou --video-id=X)"}`
);
console.log("");

async function main() {
  if (!processAll && !specificVideoId) {
    console.log("⚠️  Nenhum alvo especificado. Use --all ou --video-id=X");
    console.log("");
    console.log("Exemplos:");
    console.log("  node server/scripts/generate-sprites.js --all");
    console.log("  node server/scripts/generate-sprites.js --video-id=123");
    console.log("  node server/scripts/generate-sprites.js --all --dry-run");
    process.exit(1);
  }

  try {
    // Buscar vídeos que precisam de sprites
    let videosQuery;
    if (specificVideoId) {
      videosQuery = await query(
        `SELECT id, title, r2_key, proxy_r2_key, duration, width, height, project_id
         FROM brickreview_videos 
         WHERE id = $1`,
        [specificVideoId]
      );
    } else {
      videosQuery = await query(
        `SELECT id, title, r2_key, proxy_r2_key, duration, width, height, project_id
         FROM brickreview_videos 
         WHERE (sprite_vtt_url IS NULL OR sprite_vtt_url = '')
         AND (r2_key IS NOT NULL OR proxy_r2_key IS NOT NULL)
         ORDER BY id`
      );
    }

    const videos = videosQuery.rows;
    console.log(`📊 Encontrados ${videos.length} vídeos para processar`);
    console.log("");

    if (videos.length === 0) {
      console.log("✅ Nenhum vídeo precisa de processamento!");
      process.exit(0);
    }

    let processed = 0;
    let failed = 0;

    for (const video of videos) {
      console.log(
        `\n📹 [${processed + failed + 1}/${videos.length}] Processando: ${video.title} (ID: ${video.id})`
      );

      if (dryRun) {
        console.log(`   → DRY RUN: Geraria sprites para vídeo ${video.id}`);
        processed++;
        continue;
      }

      try {
        // Criar diretório temporário
        const tempDir = path.join(os.tmpdir(), `sprite-${video.id}-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });

        // Usar proxy se disponível (menor), senão original
        const videoR2Key = video.proxy_r2_key || video.r2_key;
        if (!videoR2Key) {
          console.log(`   ⚠️  Sem arquivo de vídeo no R2, pulando...`);
          failed++;
          continue;
        }

        // Baixar vídeo
        console.log(`   📥 Baixando vídeo do R2...`);
        const localVideoPath = path.join(tempDir, `video-${video.id}.mp4`);
        await downloadFile(videoR2Key, localVideoPath);

        // Obter metadados se não existirem
        let duration = video.duration;
        let width = video.width;
        let height = video.height;

        if (!duration || !width || !height) {
          console.log(`   📊 Obtendo metadados do vídeo...`);
          const metadata = await getVideoMetadata(localVideoPath);
          duration = duration || metadata.duration;
          width = width || metadata.width;
          height = height || metadata.height;
        }

        // Gerar sprite sheet
        console.log(`   🎞️  Gerando sprite sheet...`);
        const spriteFilename = `sprite-${uuidv4()}.jpg`;
        const spriteResult = await generateSpriteSheet(localVideoPath, tempDir, spriteFilename, {
          intervalSeconds: 5,
          duration,
          width,
          height,
        });

        // Upload do sprite
        console.log(`   📤 Fazendo upload do sprite...`);
        const spriteKey = `sprites/${video.project_id}/${spriteFilename}`;
        const spriteUrl = await uploadFile(spriteResult.spritePath, spriteKey, "image/jpeg");

        // Gerar VTT
        console.log(`   📝 Gerando arquivo VTT...`);
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

        // Upload do VTT
        const spriteVttKey = `sprites/${video.project_id}/${spriteVttFilename}`;
        const spriteVttUrl = await uploadFile(spriteVttPath, spriteVttKey, "text/vtt");

        // Atualizar banco de dados
        console.log(`   💾 Atualizando banco de dados...`);
        await query(
          `UPDATE brickreview_videos 
           SET sprite_r2_key = $1, sprite_url = $2, sprite_vtt_url = $3, updated_at = NOW()
           WHERE id = $4`,
          [spriteKey, spriteUrl, spriteVttUrl, video.id]
        );

        // Limpar temporários
        fs.rmSync(tempDir, { recursive: true, force: true });

        console.log(`   ✅ Sprites gerados com sucesso!`);
        processed++;
      } catch (error) {
        console.error(`   ❌ Erro: ${error.message}`);
        failed++;
      }
    }

    console.log("\n=========================================================");
    console.log(`📊 Resultado Final:`);
    console.log(`   ✅ Sucesso: ${processed}`);
    console.log(`   ❌ Falhas: ${failed}`);
    console.log("=========================================================");

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  }
}

main();
