import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

// Configura caminhos do FFmpeg a partir das variáveis de ambiente
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}
if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
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
          fps = Math.round(numerator / denominator);
        } else {
          fps = Math.round(parseFloat(fpsString));
        }
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
