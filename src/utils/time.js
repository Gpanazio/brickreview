/**
 * Formata duração de vídeo em segundos para hh:mm:ss ou mm:ss
 * @param {number} seconds - Duração em segundos
 * @returns {string} - Tempo formatado
 */
export function formatVideoDuration(seconds) {
  if (!seconds || seconds < 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  // Se tiver horas, mostra hh:mm:ss
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Se não tiver horas, mostra apenas mm:ss
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
