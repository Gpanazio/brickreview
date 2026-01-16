import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import r2Manager from '../utils/r2-manager.js';
import hybridStorageManager from '../utils/hybrid-storage.js';
import pool from '../database.js';

const router = express.Router();

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

export default router;
