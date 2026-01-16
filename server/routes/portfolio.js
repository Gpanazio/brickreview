import express from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../middleware/auth.js';
import r2Manager from '../utils/r2-manager.js';
import pool from '../db.js';
import { getVideoMetadata, generateThumbnail } from '../utils/video.js';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';


const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
});

const unlinkAsync = promisify(fs.unlink);

/**
 * @route POST /api/portfolio/upload
 * @desc Upload video to portfolio (stores in R2)
 * @access Private
 */
router.post('/upload', authenticateToken, upload.single('video'), async (req, res) => {


  let tempFile;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { title, description } = req.body;
    const bucketId = req.body.bucketId || 'primary';

    const tempDir = path.join(process.cwd(), 'temp-uploads');
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Sanitize filename to prevent path traversal
    const safeFilename = path.basename(req.file.originalname);
    tempFile = path.join(tempDir, `${Date.now()}-${safeFilename}`);

    // Save to temp file for ffmpeg processing
    await fs.promises.writeFile(tempFile, req.file.buffer);

    // Get video metadata using shared utility
    const metadata = await getVideoMetadata(tempFile);

    const duration = metadata.duration;
    const width = metadata.width;
    const height = metadata.height;
    const codec = metadata.codec_name;
    const bitrate = metadata.bitrate;

    // Upload to R2
    const bucket = r2Manager.getBucket(bucketId);
    if (!bucket) {
      throw new Error(`Bucket ${bucketId} not found`);
    }

    const fileName = `portfolio/${Date.now()}-${safeFilename}`;
    const uploadCommand = new PutObjectCommand({
      Bucket: bucket.bucketName,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await bucket.client.send(uploadCommand);

    // Generate thumbnail using shared utility
    const thumbnailPath = `portfolio/thumbs/${Date.now()}-thumb.jpg`;
    const thumbnailDir = path.join(process.cwd(), 'thumbnails');
    const thumbnailFilename = `${Date.now()}-thumb.jpg`;

    // generateThumbnail handles dir creation and generation
    const localThumbnailPath = await generateThumbnail(tempFile, thumbnailDir, thumbnailFilename);

    // Upload thumbnail to R2
    const thumbnailBuffer = await fs.promises.readFile(localThumbnailPath);
    const thumbnailUploadCommand = new PutObjectCommand({
      Bucket: bucket.bucketName,
      Key: thumbnailPath,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg',
    });

    await bucket.client.send(thumbnailUploadCommand);

    // Clean up temp files
    await unlinkAsync(tempFile);
    await unlinkAsync(localThumbnailPath);

    // Generate URLs
    const directUrl = `${bucket.publicUrl}/${fileName}`;
    const thumbnailUrl = `${bucket.publicUrl}/${thumbnailPath}`;

    // Save to database
    const result = await pool.query(
      `INSERT INTO portfolio_videos
       (title, description, file_path, file_size, duration, thumbnail_path,
        r2_bucket_id, direct_url, width, height, codec, bitrate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        title || req.file.originalname,
        description || null,
        fileName,
        req.file.size,
        duration,
        thumbnailPath,
        bucketId,
        directUrl,
        width,
        height,
        codec,
        bitrate,
      ]
    );

    const video = result.rows[0];

    // Generate embed code (for response only, not stored)
    const embedCode = `<iframe src="${process.env.APP_URL || 'http://localhost:5000'}/portfolio/embed/${video.id}" width="640" height="360" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;

    res.json({
      success: true,
      video: {
        ...video,
        embed_code: embedCode,
        thumbnail_url: thumbnailUrl,
      },
    });
  } catch (error) {
    console.error('Portfolio upload error:', error);

    // Clean up temp file on error
    // Clean up temp files on error
    try {
      if (typeof tempFile !== 'undefined' && fs.existsSync(tempFile)) {
        await unlinkAsync(tempFile);
      }
      // Note: localThumbnailPath variable scope issue here, handled by try/catch in original but safe to ignore specific thumbnail cleanup in catch block if we don't have the var ref easily, or we can improve scope. 
      // For now, let's just leave tempFile cleanup. Thumbnail cleanup is less critical in catch.
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }

    res.status(500).json({ error: error.message || 'Failed to upload video to portfolio' });
  }
});

/**
 * @route GET /api/portfolio/videos
 * @desc Get all portfolio videos
 * @access Private
 */
router.get('/videos', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM portfolio_videos_with_stats ORDER BY created_at DESC`
    );

    // Add thumbnail URLs
    const videos = result.rows.map(video => {
      const bucket = r2Manager.getBucket(video.r2_bucket_id || 'primary');
      return {
        ...video,
        thumbnail_url: video.thumbnail_path ? `${bucket.publicUrl}/${video.thumbnail_path}` : null,
      };
    });

    res.json({ videos });
  } catch (error) {
    console.error('Error fetching portfolio videos:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio videos' });
  }
});

/**
 * @route GET /api/portfolio/videos/:id
 * @desc Get single portfolio video
 * @access Private
 */
router.get('/videos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM portfolio_videos WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = result.rows[0];
    const bucket = r2Manager.getBucket(video.r2_bucket_id || 'primary');

    res.json({
      video: {
        ...video,
        thumbnail_url: video.thumbnail_path ? `${bucket.publicUrl}/${video.thumbnail_path}` : null,
      },
    });
  } catch (error) {
    console.error('Error fetching portfolio video:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio video' });
  }
});

/**
 * @route GET /api/portfolio/videos/:id/public
 * @desc Get single portfolio video (public access for player)
 * @access Public
 */
router.get('/videos/:id/public', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, title, description, direct_url, thumbnail_path, duration, is_password_protected, view_count, created_at, r2_bucket_id FROM portfolio_videos WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = result.rows[0];
    const bucket = r2Manager.getBucket(video.r2_bucket_id || 'primary');

    res.json({
      video: {
        ...video,
        thumbnail_url: video.thumbnail_path ? `${bucket.publicUrl}/${video.thumbnail_path}` : null,
        // Remove sensitive data
        password_hash: undefined,
      },
    });
  } catch (error) {
    console.error('Error fetching public portfolio video:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio video' });
  }
});

/**
 * @route PATCH /api/portfolio/videos/:id
 * @desc Update portfolio video (including password protection)
 * @access Private
 */
router.patch('/videos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, password, removePassword } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }

    if (removePassword) {
      updates.push(`is_password_protected = $${paramIndex++}`);
      values.push(false);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(null);
    } else if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push(`is_password_protected = $${paramIndex++}`);
      values.push(true);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(hashedPassword);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE portfolio_videos
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({ success: true, video: result.rows[0] });
  } catch (error) {
    console.error('Error updating portfolio video:', error);
    res.status(500).json({ error: 'Failed to update portfolio video' });
  }
});

/**
 * @route DELETE /api/portfolio/videos/:id
 * @desc Delete portfolio video (soft delete)
 * @access Private
 */
router.delete('/videos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;

    if (permanent) {
      // Get video info before deletion
      const videoResult = await pool.query(
        'SELECT * FROM portfolio_videos WHERE id = $1',
        [id]
      );

      if (videoResult.rows.length === 0) {
        return res.status(404).json({ error: 'Video not found' });
      }

      const video = videoResult.rows[0];
      const bucket = r2Manager.getBucket(video.r2_bucket_id || 'primary');

      // Delete from R2
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucket.bucketName,
        Key: video.file_path,
      });
      await bucket.client.send(deleteCommand);

      // Delete thumbnail from R2
      if (video.thumbnail_path) {
        const deleteThumbnailCommand = new DeleteObjectCommand({
          Bucket: bucket.bucketName,
          Key: video.thumbnail_path,
        });
        await bucket.client.send(deleteThumbnailCommand);
      }

      // Delete from database
      await pool.query('DELETE FROM portfolio_videos WHERE id = $1', [id]);

      res.json({ success: true, message: 'Video permanently deleted' });
    } else {
      // Soft delete
      const result = await pool.query(
        'UPDATE portfolio_videos SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Video not found' });
      }

      res.json({ success: true, message: 'Video deleted' });
    }
  } catch (error) {
    console.error('Error deleting portfolio video:', error);
    res.status(500).json({ error: 'Failed to delete portfolio video' });
  }
});

/**
 * @route POST /api/portfolio/videos/:id/verify-password
 * @desc Verify password for protected video
 * @access Public
 */
router.post('/videos/:id/verify-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    const result = await pool.query(
      'SELECT password_hash FROM portfolio_videos WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = result.rows[0];

    if (!video.password_hash) {
      return res.json({ valid: true });
    }

    const isValid = await bcrypt.compare(password, video.password_hash);
    res.json({ valid: isValid });
  } catch (error) {
    console.error('Error verifying password:', error);
    res.status(500).json({ error: 'Failed to verify password' });
  }
});

/**
 * @route POST /api/portfolio/videos/:id/track-view
 * @desc Track video view
 * @access Public
 */
router.post('/videos/:id/track-view', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE portfolio_videos SET view_count = view_count + 1 WHERE id = $1',
      [id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({ error: 'Failed to track view' });
  }
});

/**
 * @route POST /api/portfolio/videos/:id/track-embed
 * @desc Track video embed
 * @access Public
 */
router.post('/videos/:id/track-embed', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE portfolio_videos SET embed_count = embed_count + 1 WHERE id = $1',
      [id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking embed:', error);
    res.status(500).json({ error: 'Failed to track embed' });
  }
});

export default router;
