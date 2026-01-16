import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import r2Manager from '../utils/r2-manager.js';
import hybridStorageManager from '../utils/hybrid-storage.js';
import googleDriveManager from '../utils/google-drive.js';
import pool from '../db.js';

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

    // Upload directly to Google Drive
    const driveFile = await googleDriveManager.uploadFile(
      originalname,
      buffer,
      mimetype,
      parentId
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

    // Add webViewLink to each file
    const filesWithLinks = await Promise.all(
      result.files.map(async (file) => {
        try {
          const metadata = await googleDriveManager.getFileMetadata(file.id);
          return {
            ...file,
            webViewLink: metadata.webViewLink,
          };
        } catch (error) {
          console.error(`Error getting metadata for ${file.id}:`, error);
          return file;
        }
      })
    );

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

    res.json({
      success: true,
      message: 'Share link generated successfully',
      shareLink: result.shareLink,
      name: result.name,
    });
  } catch (error) {
    console.error('Share file error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate share link' });
  }
});

export default router;

