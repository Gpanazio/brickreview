import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

// Configura caminhos do FFmpeg
// Primeiro tenta usar variáveis de ambiente, depois tenta encontrar automaticamente
function findExecutable(name, envVar) {
  // 1. Tentar variável de ambiente
  if (envVar && process.env[envVar]) {
    console.log(`✅ ${name} path configurado via env:`, process.env[envVar]);
    return process.env[envVar];
  }

  // 2. Tentar which (procura no PATH)
  try {
    const path = execSync(`which ${name}`, { encoding: 'utf8' }).trim();
    if (path) {
      console.log(`✅ ${name} encontrado via which:`, path);
      return path;
    }
  } catch {
    // Continua para próxima tentativa
  }

  // 3. Tentar caminhos comuns do sistema
  const commonPaths = [
    `/usr/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/opt/homebrew/bin/${name}`,
  ];

  for (const path of commonPaths) {
    if (fs.existsSync(path)) {
      console.log(`✅ ${name} encontrado em caminho comum:`, path);
      return path;
    }
  }

  // 4. Tentar procurar no nix store (Railway/Nixpacks)
  try {
    const nixPath = execSync(`find /nix/store -name ${name} -type f 2>/dev/null | head -1`, {
      encoding: 'utf8',
      timeout: 5000
    }).trim();
    if (nixPath) {
      console.log(`✅ ${name} encontrado no Nix store:`, nixPath);
      return nixPath;
    }
  } catch {
    // Continua
  }

  console.warn(`⚠️  ${name} não encontrado no sistema`);
  return null;
}

const ffmpegPath = findExecutable('ffmpeg', 'FFMPEG_PATH');
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

const ffprobePath = findExecutable('ffprobe', 'FFPROBE_PATH');
if (ffprobePath) {
  ffmpeg.setFfprobePath(ffprobePath);
}

/**
 * Gera uma thumbnail de um vídeo em um timestamp específico
 * @param {string} videoPath - Caminho local do vídeo
 * @param {string} outputDir - Diretório de saída
 * @param {string} filename - Nome do arquivo de saída
 * @returns {Promise<string>} - Caminho local da thumbnail gerada
 */
export const generateThumbnail = (videoPath, outputDir, filename) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['00:00:01'],
        filename: filename,
        folder: outputDir,
        size: '640x?'
      })
      .on('end', () => {
        resolve(path.join(outputDir, filename));
      })
      .on('error', (err) => {
        console.error('Erro ao gerar thumbnail:', err);
        reject(err);
      });
  });
};

/**
 * Obtém metadados do vídeo (duração, resolução, etc)
 * @param {string} videoPath - Caminho local do vídeo
 * @returns {Promise<object>} - Objeto com metadados
 */
export const getVideoMetadata = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');

      // Parse FPS from fraction format (e.g., "30000/1001")
      let fps = 30; // default
      if (videoStream && videoStream.avg_frame_rate) {
        const fpsString = videoStream.avg_frame_rate;
        if (fpsString.includes('/')) {
          const [numerator, denominator] = fpsString.split('/').map(Number);
          if (denominator && denominator !== 0) {
            fps = Math.round(numerator / denominator);
          }
        } else {
          const parsedFps = parseFloat(fpsString);
          if (!isNaN(parsedFps)) {
            fps = Math.round(parsedFps);
          }
        }
      }
      
      // Validação final de FPS para evitar Infinity/NaN no banco
      if (!Number.isFinite(fps) || fps <= 0) {
        fps = 30;
      }

      resolve({
        duration: metadata.format.duration,
        width: videoStream ? videoStream.width : null,
        height: videoStream ? videoStream.height : null,
        fps: fps
      });
    });
  });
};

/**
 * Gera um proxy do vídeo em 720p @ 5000kbps para playback otimizado
 * @param {string} videoPath - Caminho local do vídeo original
 * @param {string} outputDir - Diretório de saída
 * @param {string} filename - Nome do arquivo de saída
 * @returns {Promise<string>} - Caminho local do proxy gerado
 */
export const generateProxy = (videoPath, outputDir, filename) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, filename);

    ffmpeg(videoPath)
      .outputOptions([
        '-c:v libx264',           // Codec H.264
        '-preset fast',            // Preset de encoding rápido
        '-crf 23',                 // Qualidade constante (23 é boa qualidade)
        '-vf scale=-2:720',        // Escala para 720p mantendo aspect ratio
        '-b:v 5000k',              // Bitrate de vídeo 5000kbps
        '-maxrate 5000k',          // Taxa máxima
        '-bufsize 10000k',         // Buffer size
        '-c:a aac',                // Codec de áudio AAC
        '-b:a 192k',               // Bitrate de áudio 192kbps
        '-ac 2',                   // Stereo
        '-ar 48000',               // Sample rate 48kHz
        '-movflags +faststart'     // Otimização para streaming
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('🎬 Gerando proxy 720p:', commandLine);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`   Progresso: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        console.log('✅ Proxy gerado com sucesso:', outputPath);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ Erro ao gerar proxy:', err.message);
        reject(err);
      })
      .run();
  });
};

const formatVttTimestamp = (seconds) => {
  const safeSeconds = Number(seconds);
  const totalMs = Number.isFinite(safeSeconds) && safeSeconds > 0 ? Math.round(safeSeconds * 1000) : 0;
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
};

/**
 * Gera sprite sheet para preview thumbnails
 * @param {string} videoPath - Caminho local do vídeo
 * @param {string} outputDir - Diretório de saída
 * @param {string} filename - Nome do sprite
 * @param {object} options - Opções de geração
 * @returns {Promise<object>} - Dados da sprite gerada
 */
export const generateSpriteSheet = async (videoPath, outputDir, filename, options = {}) => {
  const {
    intervalSeconds = 5,
    thumbWidth = 160,
    columns = 10,
    duration,
    width,
    height
  } = options;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : intervalSeconds;
  const totalFrames = Math.max(1, Math.ceil(safeDuration / intervalSeconds));
  const safeColumns = Math.max(1, columns);
  const rows = Math.max(1, Math.ceil(totalFrames / safeColumns));

  const aspectRatio = Number.isFinite(width) && Number.isFinite(height)
    ? height / width
    : 9 / 16;
  const thumbHeight = Math.max(1, Math.round(thumbWidth * aspectRatio));

  const outputPath = path.join(outputDir, filename);
  const filter = `fps=1/${intervalSeconds},scale=${thumbWidth}:${thumbHeight},tile=${safeColumns}x${rows}`;

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        '-vf', filter,
        '-frames:v', '1',
        '-q:v', '2'
      ])
      .output(outputPath)
      .on('end', () => {
        resolve({
          spritePath: outputPath,
          duration: safeDuration,
          intervalSeconds,
          columns: safeColumns,
          rows,
          thumbWidth,
          thumbHeight,
          totalFrames
        });
      })
      .on('error', (err) => {
        console.error('Erro ao gerar sprite sheet:', err);
        reject(err);
      })
      .run();
  });
};

/**
 * Gera arquivo WebVTT para sprite sheets
 * @param {object} options - Opções do VTT
 * @returns {Promise<string>} - Caminho local do VTT gerado
 */
export const generateSpriteVtt = (options) => {
  const {
    outputDir,
    filename,
    spriteUrl,
    duration,
    intervalSeconds,
    columns,
    thumbWidth,
    thumbHeight
  } = options;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : intervalSeconds;
  const totalFrames = Math.max(1, Math.ceil(safeDuration / intervalSeconds));
  const lines = ['WEBVTT', ''];

  for (let index = 0; index < totalFrames; index += 1) {
    const start = index * intervalSeconds;
    const end = Math.min(safeDuration, start + intervalSeconds);
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * thumbWidth;
    const y = row * thumbHeight;
    lines.push(
      `${formatVttTimestamp(start)} --> ${formatVttTimestamp(end)}`,
      `${spriteUrl}#xywh=${x},${y},${thumbWidth},${thumbHeight}`,
      ''
    );
  }

  const outputPath = path.join(outputDir, filename);
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
  return outputPath;
};
