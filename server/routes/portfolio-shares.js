import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import r2Manager from '../utils/r2-manager.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @route GET /api/portfolio/shares/:token
 * @desc Get shared collection or video info
 * @access Public
 */
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `SELECT * FROM portfolio_shares
       WHERE token = $1
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Share link not found or expired' });
    }

    const share = result.rows[0];

    // Update view count and last accessed
    await pool.query(
      `UPDATE portfolio_shares
       SET view_count = view_count + 1, last_accessed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [share.id]
    );

    // Get the shared resource info
    let resource = null;
    let type = null;

    if (share.collection_id) {
      type = 'collection';
      const collectionResult = await pool.query(
        'SELECT * FROM portfolio_collections_with_stats WHERE id = $1',
        [share.collection_id]
      );
      resource = collectionResult.rows[0];
    } else if (share.video_id) {
      type = 'video';
      const videoResult = await pool.query(
        'SELECT * FROM portfolio_videos_with_stats WHERE id = $1',
        [share.video_id]
      );
      resource = videoResult.rows[0];
    }

    res.json({
      share: {
        ...share,
        password_hash: undefined, // Don't expose password hash
      },
      type,
      resource,
      requires_password: !!share.password_hash,
    });
  } catch (error) {
    logger.error('PORTFOLIO_SHARES', 'Error fetching share', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch share' });
  }
});

/**
 * @route POST /api/portfolio/shares/:token/verify-password
 * @desc Verify password for protected share
 * @access Public
 */
router.post('/:token/verify-password', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const result = await pool.query(
      'SELECT password_hash FROM portfolio_shares WHERE token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Share not found' });
    }

    const share = result.rows[0];

    if (!share.password_hash) {
      return res.json({ valid: true });
    }

    const isValid = await bcrypt.compare(password, share.password_hash);
    res.json({ valid: isValid });
  } catch (error) {
    logger.error('PORTFOLIO_SHARES', 'Error verifying password', { error: error.message });
    res.status(500).json({ error: 'Failed to verify password' });
  }
});

/**
 * @route GET /api/portfolio/shares/:token/collection-videos
 * @desc Get videos in shared collection
 * @access Public
 */
router.get('/:token/collection-videos', async (req, res) => {
  try {
    const { token } = req.params;
    const { collection_id } = req.query;

    // Verify share exists and get collection_id
    const shareResult = await pool.query(
      `SELECT collection_id FROM portfolio_shares
       WHERE token = $1
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [token]
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Share not found or expired' });
    }

    const rootCollectionId = shareResult.rows[0].collection_id;

    if (!rootCollectionId) {
      return res.status(400).json({ error: 'This share is not for a collection' });
    }

    // If collection_id is provided, verify it's a subcollection of the root
    let targetCollectionId = collection_id || rootCollectionId;

    if (collection_id && collection_id !== rootCollectionId) {
      // Verify the collection is a descendant of the root collection
      const isDescendant = await pool.query(
        `WITH RECURSIVE collection_tree AS (
          SELECT id, parent_collection_id FROM portfolio_collections WHERE id = $1
          UNION ALL
          SELECT c.id, c.parent_collection_id
          FROM portfolio_collections c
          INNER JOIN collection_tree ct ON c.id = ct.parent_collection_id
        )
        SELECT EXISTS(SELECT 1 FROM collection_tree WHERE id = $2) as is_valid`,
        [collection_id, rootCollectionId]
      );

      if (!isDescendant.rows[0].is_valid) {
        return res.status(403).json({ error: 'Access denied to this collection' });
      }
    }

    // Get videos in the collection
    const videosResult = await pool.query(
      `SELECT v.*,
        CASE WHEN v.file_size IS NOT NULL THEN pg_size_pretty(v.file_size) ELSE NULL END as file_size_formatted
       FROM portfolio_videos v
       WHERE v.collection_id = $1
       AND v.deleted_at IS NULL
       ORDER BY v.created_at DESC`,
      [targetCollectionId]
    );

    // Get subcollections
    const subcollectionsResult = await pool.query(
      'SELECT * FROM portfolio_collections_with_stats WHERE parent_collection_id = $1 ORDER BY name ASC',
      [targetCollectionId]
    );

    // Get collection info
    const collectionResult = await pool.query(
      'SELECT * FROM portfolio_collections_with_stats WHERE id = $1',
      [targetCollectionId]
    );

    // Add thumbnail URLs to videos
    const bucket = r2Manager.getBucket('primary');
    const videos = videosResult.rows.map((video) => ({
      ...video,
      thumbnail_url: video.thumbnail_path ? `${bucket.publicUrl}/${video.thumbnail_path}` : null,
    }));

    res.json({
      collection: collectionResult.rows[0],
      videos,
      subcollections: subcollectionsResult.rows,
    });
  } catch (error) {
    logger.error('PORTFOLIO_SHARES', 'Error fetching collection videos', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch collection videos' });
  }
});

/**
 * @route GET /api/portfolio/shares/:token/breadcrumbs
 * @desc Get breadcrumb trail for shared collection navigation
 * @access Public
 */
router.get('/:token/breadcrumbs', async (req, res) => {
  try {
    const { token } = req.params;
    const { collection_id } = req.query;

    // Verify share exists and get root collection_id
    const shareResult = await pool.query(
      `SELECT collection_id FROM portfolio_shares
       WHERE token = $1
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [token]
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Share not found or expired' });
    }

    const rootCollectionId = shareResult.rows[0].collection_id;

    if (!collection_id) {
      // At root level
      const rootResult = await pool.query(
        'SELECT id, name FROM portfolio_collections WHERE id = $1',
        [rootCollectionId]
      );

      return res.json({
        breadcrumbs: [rootResult.rows[0]],
      });
    }

    // Get full path from root to current collection
    const pathResult = await pool.query(
      `WITH RECURSIVE collection_path AS (
        SELECT id, name, parent_collection_id, 0 as level
        FROM portfolio_collections
        WHERE id = $1

        UNION ALL

        SELECT c.id, c.name, c.parent_collection_id, cp.level + 1
        FROM portfolio_collections c
        INNER JOIN collection_path cp ON c.id = cp.parent_collection_id
        WHERE c.id = $2
      )
      SELECT id, name FROM collection_path
      ORDER BY level DESC`,
      [collection_id, rootCollectionId]
    );

    res.json({
      breadcrumbs: pathResult.rows,
    });
  } catch (error) {
    logger.error('PORTFOLIO_SHARES', 'Error fetching breadcrumbs', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch breadcrumbs' });
  }
});

export default router;
