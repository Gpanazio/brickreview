import r2Manager from './r2-manager.js';
import googleDriveManager from './google-drive.js';
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

/**
 * Hybrid Storage Manager
 * Coordinates between R2 (fast) and Google Drive (legacy)
 */
class HybridStorageManager {
  constructor() {
    this.autoMigrateDays = parseInt(process.env.GOOGLE_DRIVE_AUTO_MIGRATE_DAYS || '30');
  }

  /**
   * Get comprehensive storage statistics
   */
  async getAllStorageStats() {
    const r2Stats = await r2Manager.getAllBucketsUsage();
    const driveStats = await googleDriveManager.getStorageStats();

    // Calculate combined totals
    const totalUsed = r2Stats.total.used + driveStats.used;
    const totalLimit = r2Stats.total.limit + driveStats.limit;
    const totalAvailable = totalLimit - totalUsed;
    const totalObjects = r2Stats.total.objectCount + driveStats.objectCount;

    return {
      r2: r2Stats,
      drive: {
        id: 'google-drive',
        name: 'Google Drive (Legacy)',
        enabled: driveStats.enabled,
        ...driveStats,
      },
      total: {
        used: totalUsed,
        limit: totalLimit,
        available: totalAvailable,
        usedPercentage: (totalUsed / totalLimit) * 100,
        objectCount: totalObjects,
      },
    };
  }

  /**
   * Migrate video from R2 to Google Drive
   */
  async migrateToGoogleDrive(video, bucketId = 'primary') {
    if (!googleDriveManager.isEnabled()) {
      throw new Error('Google Drive is not enabled');
    }

    const bucket = r2Manager.getBucket(bucketId);
    if (!bucket) {
      throw new Error(`Bucket ${bucketId} not found`);
    }

    try {
      console.log(`🔄 Starting migration: ${video.title} (${video.id})`);

      // Step 1: Download from R2
      console.log('📥 Downloading from R2...');
      const getCommand = new GetObjectCommand({
        Bucket: bucket.bucketName,
        Key: video.file_path,
      });

      const r2Response = await bucket.client.send(getCommand);
      const videoBuffer = await this.streamToBuffer(r2Response.Body);

      // Step 2: Upload to Google Drive
      console.log('📤 Uploading to Google Drive...');
      const driveFile = await googleDriveManager.uploadFile(
        `${video.id}_${video.title}.mp4`,
        videoBuffer,
        'video/mp4'
      );

      // Step 3: Migrate additional assets (sprites, thumbnails)
      const assets = {
        sprite_url: video.sprite_url,
        sprite_vtt_url: video.sprite_vtt_url,
        thumbnail_url: video.thumbnail_url,
      };

      const migratedAssets = {};
      for (const [key, url] of Object.entries(assets)) {
        if (url && url.includes(bucket.publicUrl)) {
          try {
            const assetPath = url.split(bucket.publicUrl + '/')[1];
            const assetCommand = new GetObjectCommand({
              Bucket: bucket.bucketName,
              Key: assetPath,
            });
            const assetResponse = await bucket.client.send(assetCommand);
            const assetBuffer = await this.streamToBuffer(assetResponse.Body);

            const mimeType = this.getMimeType(assetPath);
            const assetFile = await googleDriveManager.uploadFile(
              `${video.id}_${key}_${assetPath.split('/').pop()}`,
              assetBuffer,
              mimeType
            );

            migratedAssets[key] = assetFile.id;
          } catch (err) {
            console.warn(`⚠️ Failed to migrate asset ${key}:`, err.message);
          }
        }
      }

      // Step 4: Delete from R2
      console.log('🗑️ Deleting from R2...');
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucket.bucketName,
        Key: video.file_path,
      });
      await bucket.client.send(deleteCommand);

      // Delete assets from R2
      for (const url of Object.values(assets)) {
        if (url && url.includes(bucket.publicUrl)) {
          try {
            const assetPath = url.split(bucket.publicUrl + '/')[1];
            const deleteAssetCommand = new DeleteObjectCommand({
              Bucket: bucket.bucketName,
              Key: assetPath,
            });
            await bucket.client.send(deleteAssetCommand);
          } catch (err) {
            console.warn(`⚠️ Failed to delete asset:`, err.message);
          }
        }
      }

      console.log(`✅ Migration completed: ${video.title}`);

      return {
        success: true,
        driveFileId: driveFile.id,
        driveUrl: driveFile.webViewLink,
        migratedAssets,
        size: videoBuffer.length,
      };
    } catch (error) {
      console.error(`❌ Migration failed: ${video.title}`, error);
      throw error;
    }
  }

  /**
   * Retrieve video from Google Drive
   */
  async getVideoFromDrive(driveFileId) {
    if (!googleDriveManager.isEnabled()) {
      throw new Error('Google Drive is not enabled');
    }

    try {
      const stream = await googleDriveManager.downloadFile(driveFileId);
      return stream;
    } catch (error) {
      console.error('❌ Failed to retrieve from Drive:', error);
      throw error;
    }
  }

  /**
   * Delete video from Google Drive
   */
  async deleteFromGoogleDrive(driveFileId) {
    if (!googleDriveManager.isEnabled()) {
      throw new Error('Google Drive is not enabled');
    }

    try {
      await googleDriveManager.deleteFile(driveFileId);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to delete from Drive:', error);
      throw error;
    }
  }

  /**
   * Find videos eligible for auto-migration
   */
  async findVideosForAutoMigration(db) {
    if (!googleDriveManager.isEnabled()) {
      return [];
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.autoMigrateDays);

    try {
      const result = await db.query(
        `SELECT * FROM videos
         WHERE storage_location = 'r2'
         AND status = 'ready'
         AND created_at < $1
         ORDER BY created_at ASC
         LIMIT 10`,
        [cutoffDate]
      );

      return result.rows;
    } catch (error) {
      console.error('❌ Failed to find videos for migration:', error);
      return [];
    }
  }

  /**
   * Helper: Convert stream to buffer
   */
  async streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  /**
   * Helper: Get MIME type from file extension
   */
  getMimeType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const mimeTypes = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'vtt': 'text/vtt',
      'json': 'application/json',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

// Export singleton instance
const hybridStorageManager = new HybridStorageManager();
export default hybridStorageManager;
