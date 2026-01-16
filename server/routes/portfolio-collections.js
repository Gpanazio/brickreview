import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../db.js';

const router = express.Router();

/**
 * @route GET /api/portfolio/collections
 * @desc Get all collections with stats
 * @access Private
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM portfolio_collections_with_stats
      ORDER BY parent_collection_id NULLS FIRST, name ASC
    `);

    res.json({ collections: result.rows });
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

/**
 * @route GET /api/portfolio/collections/:id
 * @desc Get single collection with videos and subcollections
 * @access Private
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get collection
    const collectionResult = await pool.query(
      'SELECT * FROM portfolio_collections_with_stats WHERE id = $1',
      [id]
    );

    if (collectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Get videos in collection
    const videosResult = await pool.query(
      'SELECT * FROM portfolio_videos_with_stats WHERE collection_id = $1 ORDER BY created_at DESC',
      [id]
    );

    // Get subcollections
    const subcollectionsResult = await pool.query(
      'SELECT * FROM portfolio_collections_with_stats WHERE parent_collection_id = $1 ORDER BY name ASC',
      [id]
    );

    res.json({
      collection: collectionResult.rows[0],
      videos: videosResult.rows,
      subcollections: subcollectionsResult.rows,
    });
  } catch (error) {
    console.error('Error fetching collection:', error);
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
});

/**
 * @route POST /api/portfolio/collections
 * @desc Create new collection
 * @access Private
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, parent_collection_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await pool.query(
      `INSERT INTO portfolio_collections (name, description, parent_collection_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description || null, parent_collection_id || null]
    );

    res.json({ collection: result.rows[0] });
  } catch (error) {
    console.error('Error creating collection:', error);
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

/**
 * @route PATCH /api/portfolio/collections/:id
 * @desc Update collection
 * @access Private
 */
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_public } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }

    if (is_public !== undefined) {
      updates.push(`is_public = $${paramIndex++}`);
      values.push(is_public);
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE portfolio_collections
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    res.json({ collection: result.rows[0] });
  } catch (error) {
    console.error('Error updating collection:', error);
    res.status(500).json({ error: 'Failed to update collection' });
  }
});

/**
 * @route DELETE /api/portfolio/collections/:id
 * @desc Delete collection (soft delete)
 * @access Private
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE portfolio_collections SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    res.json({ success: true, message: 'Collection deleted' });
  } catch (error) {
    console.error('Error deleting collection:', error);
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

/**
 * @route PATCH /api/portfolio/collections/:id/move
 * @desc Move collection to different parent
 * @access Private
 */
router.patch('/:id/move', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { parent_collection_id } = req.body;

    const result = await pool.query(
      `UPDATE portfolio_collections
       SET parent_collection_id = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [parent_collection_id || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    res.json({ collection: result.rows[0] });
  } catch (error) {
    console.error('Error moving collection:', error);
    res.status(500).json({ error: 'Failed to move collection' });
  }
});

/**
 * @route PATCH /api/portfolio/videos/:id/move
 * @desc Move video to collection
 * @access Private
 */
router.patch('/videos/:id/move', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { collection_id } = req.body;

    const result = await pool.query(
      `UPDATE portfolio_videos
       SET collection_id = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [collection_id || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({ video: result.rows[0] });
  } catch (error) {
    console.error('Error moving video:', error);
    res.status(500).json({ error: 'Failed to move video' });
  }
});

/**
 * @route POST /api/portfolio/collections/:id/share
 * @desc Generate share link for collection
 * @access Private
 */
router.post('/:id/share', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { password, expires_in_days } = req.body;

    // Check if collection exists
    const collectionCheck = await pool.query(
      'SELECT id FROM portfolio_collections WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (collectionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Generate token
    const tokenResult = await pool.query('SELECT generate_portfolio_share_token() as token');
    const token = tokenResult.rows[0].token;

    // Hash password if provided
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // Calculate expiration
    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000)
      : null;

    // Create share
    const result = await pool.query(
      `INSERT INTO portfolio_shares (token, collection_id, password_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [token, id, passwordHash, expiresAt]
    );

    res.json({
      share: result.rows[0],
      url: `${process.env.APP_URL || req.protocol + '://' + req.get('host')}/portfolio/c/${token}`,
    });
  } catch (error) {
    console.error('Error creating share:', error);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

export default router;
