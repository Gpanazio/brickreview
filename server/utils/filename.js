import path from 'path';

const getOriginalFilename = (r2Key, title) => {
  const base = r2Key ? path.basename(r2Key) : '';
  const cleaned = base.replace(/^[0-9a-fA-F-]{36}-/, '');
  if (cleaned) return cleaned;
  if (title) return `${title}.mp4`;
  return 'video.mp4';
};

const buildDownloadFilename = (originalFilename, isProxy) => {
  if (!isProxy) return originalFilename;
  const parsed = path.parse(originalFilename);
  const extension = parsed.ext || '.mp4';
  const baseName = parsed.name || 'video';
  return `${baseName}_proxy${extension}`;
};

export { getOriginalFilename, buildDownloadFilename };
