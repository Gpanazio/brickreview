import path from 'path';

/**
 * Derives a filename from an R2 storage key or a video title.
 * Strips a UUID prefix from the R2 key when present.
 * @param {string | null | undefined} r2Key - The R2 storage key.
 * @param {string | null | undefined} title - The video title fallback.
 * @returns {string} The derived filename.
 */
const getOriginalFilename = (r2Key, title) => {
  const base = r2Key ? path.basename(r2Key) : '';
  const cleaned = base.replace(/^[0-9a-fA-F-]{36}-/, '');
  if (cleaned) return cleaned;
  if (title) return `${title}.mp4`;
  return 'video.mp4';
};

/**
 * Builds a download filename, optionally appending a "_proxy" suffix.
 * @param {string} originalFilename - The original filename.
 * @param {boolean} isProxy - Whether the download targets a proxy.
 * @returns {string} The download filename.
 */
const buildDownloadFilename = (originalFilename, isProxy) => {
  if (!isProxy) return originalFilename;
  const parsed = path.parse(originalFilename);
  const extension = parsed.ext || '.mp4';
  const baseName = parsed.name || 'video';
  return `${baseName}_proxy${extension}`;
};

export { getOriginalFilename, buildDownloadFilename };
