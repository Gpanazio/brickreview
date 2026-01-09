import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

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
      
      resolve({
        duration: metadata.format.duration,
        width: videoStream ? videoStream.width : null,
        height: videoStream ? videoStream.height : null,
        fps: videoStream && videoStream.avg_frame_rate ? 
             eval(videoStream.avg_frame_rate) : 30
      });
    });
  });
};
