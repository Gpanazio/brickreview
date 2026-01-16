import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Gerenciador de múltiplos buckets R2
 */
class R2Manager {
  constructor() {
    this.buckets = this.initializeBuckets();
  }

  initializeBuckets() {
    const buckets = [];

    // Primary bucket (always required)
    if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID) {
      const primaryClient = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
      });

      buckets.push({
        id: 'primary',
        name: 'Primary Bucket',
        client: primaryClient,
        bucketName: process.env.R2_BUCKET_NAME,
        publicUrl: process.env.R2_PUBLIC_URL,
        limit: parseInt(process.env.R2_PRIMARY_LIMIT || '10737418240'), // 10GB default
      });
    }

    // Secondary bucket (optional)
    if (process.env.R2_SECONDARY_ACCOUNT_ID && process.env.R2_SECONDARY_ACCESS_KEY_ID) {
      const secondaryClient = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_SECONDARY_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_SECONDARY_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECONDARY_SECRET_ACCESS_KEY || '',
        },
      });

      buckets.push({
        id: 'secondary',
        name: 'Secondary Bucket',
        client: secondaryClient,
        bucketName: process.env.R2_SECONDARY_BUCKET_NAME,
        publicUrl: process.env.R2_SECONDARY_PUBLIC_URL,
        limit: parseInt(process.env.R2_SECONDARY_LIMIT || '10737418240'), // 10GB default
      });
    }

    return buckets;
  }

  /**
   * Get all configured buckets
   */
  getBuckets() {
    return this.buckets;
  }

  /**
   * Get a specific bucket by ID
   */
  getBucket(bucketId) {
    return this.buckets.find(b => b.id === bucketId);
  }

  /**
   * Get the primary bucket (default)
   */
  getPrimaryBucket() {
    return this.buckets.find(b => b.id === 'primary');
  }

  /**
   * Calculate storage usage for a specific bucket
   */
  async getBucketUsage(bucketId) {
    const bucket = this.getBucket(bucketId);
    if (!bucket) {
      throw new Error(`Bucket ${bucketId} not found`);
    }

    let totalSize = 0;
    let totalObjects = 0;
    let continuationToken = null;

    try {
      do {
        const command = new ListObjectsV2Command({
          Bucket: bucket.bucketName,
          ContinuationToken: continuationToken,
        });

        const response = await bucket.client.send(command);

        if (response.Contents) {
          for (const object of response.Contents) {
            totalSize += object.Size || 0;
            totalObjects++;
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return {
        bucketId: bucket.id,
        bucketName: bucket.name,
        used: totalSize,
        limit: bucket.limit,
        available: bucket.limit - totalSize,
        usedPercentage: (totalSize / bucket.limit) * 100,
        objectCount: totalObjects,
      };
    } catch (error) {
      console.error(`Error calculating usage for bucket ${bucketId}:`, error);
      throw error;
    }
  }

  /**
   * Get storage statistics for all buckets
   */
  async getAllBucketsUsage() {
    const stats = [];

    for (const bucket of this.buckets) {
      try {
        const usage = await this.getBucketUsage(bucket.id);
        stats.push(usage);
      } catch (error) {
        console.error(`Failed to get usage for bucket ${bucket.id}:`, error);
        stats.push({
          bucketId: bucket.id,
          bucketName: bucket.name,
          error: error.message,
          used: 0,
          limit: bucket.limit,
          available: bucket.limit,
          usedPercentage: 0,
          objectCount: 0,
        });
      }
    }

    // Calculate totals
    const totalUsed = stats.reduce((sum, s) => sum + s.used, 0);
    const totalLimit = stats.reduce((sum, s) => sum + s.limit, 0);
    const totalAvailable = totalLimit - totalUsed;
    const totalObjects = stats.reduce((sum, s) => sum + s.objectCount, 0);

    return {
      buckets: stats,
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
   * Get the bucket with most available space
   */
  async getBucketWithMostSpace() {
    const allUsage = await this.getAllBucketsUsage();

    // Sort by available space (descending)
    const sortedBuckets = [...allUsage.buckets].sort((a, b) => b.available - a.available);

    return sortedBuckets[0];
  }
}

// Export singleton instance
const r2Manager = new R2Manager();
export default r2Manager;
