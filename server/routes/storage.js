import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import r2Manager from '../utils/r2-manager.js';
import hybridStorageManager from '../utils/hybrid-storage.js';
import googleDriveManager from '../utils/google-drive.js';
import pool from '../db.js';
import fs from 'fs';
import path from 'path';
import { generateThumbnail } from '../utils/video.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @route GET /api/storage/stats
 * @desc Get storage statistics for all storage (R2 + Google Drive)
 * @access Private (requires authentication)
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await hybridStorageManager.getAllStorageStats();

    // Format the response with human-readable sizes
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return {
        value: parseFloat((bytes / Math.pow(k, i)).toFixed(2)),
        unit: sizes[i],
        bytes: bytes,
      };
    };

    const formattedStats = {
      r2: {
        buckets: stats.r2.buckets.map(bucket => ({
          ...bucket,
          usedFormatted: formatBytes(bucket.used),
          limitFormatted: formatBytes(bucket.limit),
          availableFormatted: formatBytes(bucket.available),
          usedPercentage: parseFloat(bucket.usedPercentage.toFixed(2)),
        })),
        total: {
          ...stats.r2.total,
          usedFormatted: formatBytes(stats.r2.total.used),
          limitFormatted: formatBytes(stats.r2.total.limit),
          availableFormatted: formatBytes(stats.r2.total.available),
          usedPercentage: parseFloat(stats.r2.total.usedPercentage.toFixed(2)),
        },
      },
      drive: {
        ...stats.drive,
        usedFormatted: formatBytes(stats.drive.used),
        limitFormatted: formatBytes(stats.drive.limit),
        availableFormatted: formatBytes(stats.drive.available),
        usedPercentage: parseFloat(stats.drive.usedPercentage.toFixed(2)),
      },
      total: {
        ...stats.total,
        usedFormatted: formatBytes(stats.total.used),
        limitFormatted: formatBytes(stats.total.limit),
        availableFormatted: formatBytes(stats.total.available),
        usedPercentage: parseFloat(stats.total.usedPercentage.toFixed(2)),
      },
    };

    res.json(formattedStats);
  } catch (error) {
    console.error('Error fetching storage stats:', error);
    res.status(500).json({ error: 'Failed to fetch storage statistics' });
  }
});

/**
 * @route GET /api/storage/buckets
 * @desc Get list of configured R2 buckets
 * @access Private
 */
router.get('/buckets', authenticateToken, async (req, res) => {
  try {
    const buckets = r2Manager.getBuckets();

    const bucketInfo = buckets.map(bucket => ({
      id: bucket.id,
      name: bucket.name,
      bucketName: bucket.bucketName,
      publicUrl: bucket.publicUrl,
      limit: bucket.limit,
    }));

    res.json(bucketInfo);
  } catch (error) {
    console.error('Error fetching bucket list:', error);
    res.status(500).json({ error: 'Failed to fetch bucket list' });
  }
});

/**
 * @route POST /api/storage/migrate/:videoId
 * @desc Backup video to Google Drive (keeps in R2 unless removeFromR2=true)
 * @access Private
 */
router.post('/migrate/:videoId', authenticateToken, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { removeFromR2 = false } = req.body;

    // Get video details
    const videoResult = await pool.query('SELECT * FROM videos WHERE id = $1', [videoId]);
    if (videoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = videoResult.rows[0];

    // Check if already backed up
    if (video.drive_file_id && !removeFromR2) {
      return res.json({
        success: true,
        message: 'Video already backed up to Google Drive',
        driveFileId: video.drive_file_id,
      });
    }

    // Migrate to Drive
    const result = await hybridStorageManager.migrateToGoogleDrive(
      video,
      video.r2_bucket_id || 'primary'
    );

    // Update database
    const updateQuery = removeFromR2
      ? `UPDATE videos SET drive_file_id = $1, drive_backup_date = NOW(), storage_location = 'drive' WHERE id = $2`
      : `UPDATE videos SET drive_file_id = $1, drive_backup_date = NOW(), storage_location = 'both' WHERE id = $2`;

    await pool.query(updateQuery, [result.driveFileId, videoId]);

    res.json({
      success: true,
      message: removeFromR2
        ? 'Video migrated to Google Drive and removed from R2'
        : 'Video backed up to Google Drive',
      driveFileId: result.driveFileId,
      driveUrl: result.driveUrl,
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: error.message || 'Failed to migrate video' });
  }
});

/**
 * @route POST /api/storage/cleanup-r2
 * @desc Remove oldest videos from R2 when storage is full (keeps Drive backup)
 * @access Private
 */
router.post('/cleanup-r2', authenticateToken, async (req, res) => {
  try {
    const { targetFreeSpace = 1073741824 } = req.body; // Default: free 1GB

    const stats = await hybridStorageManager.getAllStorageStats();
    const r2Stats = stats.r2.total;

    if (r2Stats.available >= targetFreeSpace) {
      return res.json({
        success: true,
        message: 'R2 storage has sufficient space',
        available: r2Stats.available,
      });
    }

    // Find oldest videos in R2 that have Drive backup
    const oldestVideos = await pool.query(
      `SELECT * FROM videos
       WHERE storage_location IN ('r2', 'both')
       AND drive_file_id IS NOT NULL
       ORDER BY created_at ASC
       LIMIT 20`
    );

    let freedSpace = 0;
    const removedVideos = [];
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    for (const video of oldestVideos.rows) {
      if (freedSpace >= (targetFreeSpace - r2Stats.available)) break;

      try {
        // Remove from R2 (but keep in Drive)
        const bucket = r2Manager.getBucket(video.r2_bucket_id || 'primary');
        if (bucket) {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: bucket.bucketName,
            Key: video.file_path,
          });
          await bucket.client.send(deleteCommand);

          // Update database
          await pool.query(
            `UPDATE videos SET storage_location = 'drive' WHERE id = $1`,
            [video.id]
          );

          freedSpace += video.file_size || 0;
          removedVideos.push({ id: video.id, title: video.title });
        }
      } catch (err) {
        console.error(`Failed to remove video ${video.id}:`, err);
      }
    }

    res.json({
      success: true,
      message: `Cleaned up R2 storage`,
      freedSpace,
      removedCount: removedVideos.length,
      removedVideos,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup R2 storage' });
  }
});

/**
 * @route GET /api/storage/eligible-for-cleanup
 * @desc Get list of videos that can be safely removed from R2
 * @access Private
 */
router.get('/eligible-for-cleanup', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, created_at, file_size, drive_file_id, storage_location
       FROM videos
       WHERE storage_location IN ('r2', 'both')
       AND drive_file_id IS NOT NULL
       ORDER BY created_at ASC
       LIMIT 50`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching eligible videos:', error);
    res.status(500).json({ error: 'Failed to fetch eligible videos' });
  }
});

/**
 * @route POST /api/storage/upload-to-drive
 * @desc Upload file directly to Google Drive (bypasses R2)
 * @access Private
 */
router.post('/upload-to-drive', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!googleDriveManager.isEnabled()) {
      return res.status(503).json({ error: 'Google Drive is not enabled' });
    }

    const { originalname, buffer, mimetype } = req.file;
    const { parentId } = req.body;
    let thumbnailBuffer = null;

    // If it's a video, try to generate a thumbnail
    if (mimetype.startsWith('video/')) {
      try {
        const tempDir = path.resolve('temp-uploads');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempVideoId = `upload-${Date.now()}`;
        const tempVideoPath = path.join(tempDir, `${tempVideoId}-${originalname}`);
        const thumbFilename = `${tempVideoId}-thumb.jpg`;

        // Write buffer to temp file
        fs.writeFileSync(tempVideoPath, buffer);

        // Generate thumbnail
        const thumbPath = await generateThumbnail(tempVideoPath, tempDir, thumbFilename);

        // Read thumbnail buffer
        if (fs.existsSync(thumbPath)) {
          thumbnailBuffer = fs.readFileSync(thumbPath);

          // Cleanup thumbnail
          fs.unlinkSync(thumbPath);
        }

        // Cleanup video
        if (fs.existsSync(tempVideoPath)) {
          fs.unlinkSync(tempVideoPath);
        }
      } catch (err) {
        console.error('Failed to generate thumbnail for upload:', err);
        // Continue upload even if thumbnail fails
      }
    }

    // Upload directly to Google Drive
    const driveFile = await googleDriveManager.uploadFile(
      originalname,
      buffer,
      mimetype,
      parentId,
      thumbnailBuffer
    );

    res.json({
      success: true,
      message: 'File uploaded to Google Drive successfully',
      file: {
        id: driveFile.id,
        name: driveFile.name,
        size: driveFile.size,
        webViewLink: driveFile.webViewLink,
        webContentLink: driveFile.webContentLink,
      },
    });
  } catch (error) {
    console.error('Upload to Drive error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload file to Google Drive' });
  }
});

/**
 * @route GET /api/storage/drive-files
 * @desc List all files in Google Drive
 * @access Private
 */
router.get('/drive-files', authenticateToken, async (req, res) => {
  try {
    if (!googleDriveManager.isEnabled()) {
      return res.status(503).json({ error: 'Google Drive is not enabled' });
    }

    const { pageSize = 100, pageToken, folderId } = req.query;

    const result = await googleDriveManager.listFiles(
      parseInt(pageSize),
      pageToken,
      folderId
    );

    // webViewLink and thumbnailLink are now included in listFiles result
    const filesWithLinks = result.files;

    res.json({
      files: filesWithLinks,
      nextPageToken: result.nextPageToken,
    });
  } catch (error) {
    console.error('List Drive files error:', error);
    res.status(500).json({ error: error.message || 'Failed to list files from Google Drive' });
  }
});

/**
 * @route DELETE /api/storage/drive-files/:fileId
 * @desc Delete a file from Google Drive
 * @access Private
 */
router.delete('/drive-files/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!googleDriveManager.isEnabled()) {
      return res.status(503).json({ error: 'Google Drive is not enabled' });
    }

    await googleDriveManager.deleteFile(fileId);

    res.json({
      success: true,
      message: 'File deleted from Google Drive successfully',
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to delete file from Google Drive' });
  }
});

/**
 * @route POST /api/storage/folders
 * @desc Create a new folder in Google Drive
 * @access Private
 */
router.post('/folders', authenticateToken, async (req, res) => {
  try {
    const { name, parentId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    if (!googleDriveManager.isEnabled()) {
      return res.status(503).json({ error: 'Google Drive is not enabled' });
    }

    const folder = await googleDriveManager.createFolder(name, parentId);

    res.json({
      success: true,
      message: 'Folder created successfully',
      folder,
    });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: error.message || 'Failed to create folder' });
  }
});

/**
 * @route PATCH /api/storage/move
 * @desc Move a file or folder
 * @access Private
 */
router.patch('/move', authenticateToken, async (req, res) => {
  try {
    const { fileId, destinationFolderId } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }

    if (!googleDriveManager.isEnabled()) {
      return res.status(503).json({ error: 'Google Drive is not enabled' });
    }

    // If destinationFolderId is null/undefined, move to root folder
    const targetFolderId = destinationFolderId || googleDriveManager.folderId;
    const result = await googleDriveManager.moveFile(fileId, targetFolderId);

    res.json({
      success: true,
      message: 'File moved successfully',
      result,
    });
  } catch (error) {
    console.error('Move file error:', error);
    res.status(500).json({ error: error.message || 'Failed to move file' });
  }
});

/**
 * @route PATCH /api/storage/rename
 * @desc Rename a file or folder
 * @access Private
 */
router.patch('/rename', authenticateToken, async (req, res) => {
  try {
    const { fileId, name } = req.body;

    if (!fileId || !name) {
      return res.status(400).json({ error: 'File ID and new name are required' });
    }

    if (!googleDriveManager.isEnabled()) {
      return res.status(503).json({ error: 'Google Drive is not enabled' });
    }

    const result = await googleDriveManager.renameFile(fileId, name);

    res.json({
      success: true,
      message: 'Item renamed successfully',
      result,
    });
  } catch (error) {
    console.error('Rename item error:', error);
    res.status(500).json({ error: error.message || 'Failed to rename item' });
  }
});

/**
 * @route POST /api/storage/share
 * @desc Generate a public share link for a file or folder
 * @access Private
 */
router.post('/share', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }

    if (!googleDriveManager.isEnabled()) {
      return res.status(503).json({ error: 'Google Drive is not enabled' });
    }

    const result = await googleDriveManager.shareFile(fileId);

    const appUrl = process.env.APP_URL || (process.env.NODE_ENV === 'production' ? `${req.protocol}://${req.get('host')}` : 'http://localhost:5173');
    // Use the /storage/s/:id route we will create in frontend
    const internalShareLink = `${appUrl}/storage/s/${result.id}`;

    res.json({
      success: true,
      message: 'Share link generated successfully',
      shareLink: internalShareLink,
      googleLink: result.shareLink,
      name: result.name,
    });
  } catch (error) {
    console.error('Share file error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate share link' });
  }
});

// ... existing methods ...

/**
 * @route GET /api/storage/public/metadata/:fileId
 * @desc Get metadata for a public file/folder
 * @access Public
 */
router.get('/public/metadata/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!googleDriveManager.isEnabled()) {
      return res.status(503).json({ error: 'Google Drive is not enabled' });
    }

    const metadata = await googleDriveManager.getFileMetadata(fileId);

    res.json(metadata);
  } catch (error) {
    console.error('Public metadata error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch public metadata' });
  }
});

/**
 * @route GET /api/storage/public/files
 * @desc List files in a public folder
 * @access Public
 */
router.get('/public/files', async (req, res) => {
  try {
    const { folderId, pageToken, pageSize = 100 } = req.query;

    if (!folderId) {
      return res.status(400).json({ error: 'Folder ID is required for public listing' });
    }

    if (!googleDriveManager.isEnabled()) {
      return res.status(503).json({ error: 'Google Drive is not enabled' });
    }

    // Verify folder exists and is accessible
    try {
      await googleDriveManager.getFileMetadata(folderId);
    } catch (_e) {
      return res.status(404).json({ error: 'Folder not found or not accessible' });
    }

    const result = await googleDriveManager.listFiles(
      parseInt(pageSize),
      pageToken,
      folderId
    );

    // Enrich with webViewLinks
    const filesWithLinks = await Promise.all(
      result.files.map(async (file) => {
        try {
          const metadata = await googleDriveManager.getFileMetadata(file.id);
          return {
            ...file,
            webViewLink: metadata.webViewLink,
            thumbnailLink: metadata.thumbnailLink || null
          };
        } catch (_error) {
          return file;
        }
      })
    );

    res.json({
      files: filesWithLinks,
      nextPageToken: result.nextPageToken,
    });

  } catch (error) {
    console.error('Public list files error:', error);
    res.status(500).json({ error: error.message || 'Failed to list public files' });
  }
});

/**
 * @route GET /api/storage/proxy/:fileId
 * @desc Stream file content from Google Drive (acts as a proxy for authenticated users)
 * @access Private
 */
router.get('/proxy/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!googleDriveManager.isEnabled()) {
      return res.status(503).json({ error: 'Google Drive is not enabled' });
    }

    // Get metadata for content type and name
    const metadata = await googleDriveManager.getFileMetadata(fileId);

    // If it's a Google Doc/Sheet/Slide, we can't stream it directly as binary
    if (metadata.mimeType.startsWith('application/vnd.google-apps')) {
      return res.redirect(metadata.webViewLink);
    }

    // Set headers
    res.setHeader('Content-Type', metadata.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${metadata.name}"`);
    if (metadata.size) {
      res.setHeader('Content-Length', metadata.size);
    }

    // Get stream
    const fileStream = await googleDriveManager.downloadFile(fileId);

    // Pipe to response
    fileStream.pipe(res);

  } catch (error) {
    console.error('Proxy file error:', error);
    // If headers already sent, we can't send JSON error
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to proxy file' });
    }
  }
});

export default router;

