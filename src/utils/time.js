/**
 * Formata duração de vídeo em segundos para hh:mm:ss ou mm:ss
 * @param {number} seconds - Duração em segundos
 * @returns {string} - Tempo formatado
 */
export function formatVideoDuration(seconds) {
  if (!seconds || seconds < 0) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  // Se tiver horas, mostra hh:mm:ss
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  // Se não tiver horas, mostra apenas mm:ss
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function parseTimestampSeconds(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function formatTimecode(seconds, fps = 30) {
  const fpsInt = Math.max(1, Math.round(fps));
  const safeSeconds = Number(seconds);
  if (!Number.isFinite(safeSeconds) || safeSeconds < 0) return `0:00:00`;

  const totalFrames = Math.floor(safeSeconds * fpsInt);
  const mins = Math.floor(totalFrames / (fpsInt * 60));
  const secs = Math.floor(totalFrames / fpsInt) % 60;
  const frames = totalFrames % fpsInt;

  return `${mins}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}
