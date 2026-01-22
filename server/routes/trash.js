
import express from "express";
import { query } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import { validateId } from "../utils/validateId.js";
import logger from "../utils/logger.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import r2Client from "../utils/r2.js";

const router = express.Router();

/**
 * Helper: Delete an R2 object by key
 * Returns true on success, false on failure (logs but doesn't throw)
 */
async function deleteR2Object(key) {
  if (!key) return true;

  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      })
    );
    logger.debug("R2_CLEANUP", "Object deleted", { key });
    return true;
  } catch (error) {
    logger.error("R2_CLEANUP", "Failed to delete object", { key, error: error.message });
    return false;
  }
}

/**
 * Helper: Delete all R2 objects for a video
 */
async function cleanupVideoR2(video) {
  const keysToDelete = [
    video.r2_key,
    video.proxy_r2_key,
    video.streaming_high_r2_key,
    video.thumbnail_r2_key,
    video.sprite_r2_key,
  ].filter(Boolean);

  const results = await Promise.all(keysToDelete.map(deleteR2Object));
  const successCount = results.filter(Boolean).length;

  logger.info("R2_CLEANUP", "Video cleanup complete", {
    videoId: video.id,
    keysDeleted: successCount,
    keysTotal: keysToDelete.length,
  });

  return successCount === keysToDelete.length;
}

/**
 * Helper: Delete all R2 objects for a file
 */
async function cleanupFileR2(file) {
  const keysToDelete = [
    file.r2_key,
    file.thumbnail_r2_key,
  ].filter(Boolean);

  const results = await Promise.all(keysToDelete.map(deleteR2Object));
  const successCount = results.filter(Boolean).length;

  logger.info("R2_CLEANUP", "File cleanup complete", {
    fileId: file.id,
    keysDeleted: successCount,
    keysTotal: keysToDelete.length,
  });

  return successCount === keysToDelete.length;
}

// GET all soft-deleted items
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [projects, folders, videos, files] = await Promise.all([
      query("SELECT * FROM brickreview_projects WHERE deleted_at IS NOT NULL AND created_by = $1", [req.user.id]),
      // Folders belong to projects, so we check who created the project
      query(`
        SELECT f.* FROM brickreview_folders f
        JOIN brickreview_projects p ON f.project_id = p.id
        WHERE f.deleted_at IS NOT NULL AND p.created_by = $1
      `, [req.user.id]),
      query("SELECT * FROM brickreview_videos WHERE deleted_at IS NOT NULL AND uploaded_by = $1", [req.user.id]),
      query("SELECT * FROM brickreview_files WHERE deleted_at IS NOT NULL AND uploaded_by = $1", [req.user.id]),
    ]);

    res.json({
      projects: projects.rows,
      folders: folders.rows,
      videos: videos.rows,
      files: files.rows,
    });
  } catch (error) {
    logger.error("TRASH", "Error fetching soft-deleted items", { error: error.message, userId: req.user.id });
    res.status(500).json({ error: "Internal server error" });
  }
});

// Restore a soft-deleted item
router.post("/:type/:id/restore", authenticateToken, async (req, res) => {
  const { type, id } = req.params;
  const { user } = req;

  if (!validateId(id)) {
    return res.status(400).json({ error: "Invalid item ID" });
  }

  try {
    let tableName;
    let ownerCol = 'user_id'; // default fallback
    let joinClause = '';
    let whereClause = '';

    switch (type) {
      case "project":
        tableName = "brickreview_projects";
        ownerCol = 'created_by';
        break;
      case "folder":
        tableName = "brickreview_folders";
        // Complex case: update folder where project produced by user
        // But standard UPDATE doesn't support JOIN easily in all dialects with RETURNING cleanly in one go for simple RBAC
        // We will do a two-step check for folders to be safe and simple
        break;
      case "video":
        tableName = "brickreview_videos";
        ownerCol = 'uploaded_by';
        break;
      case "file":
        tableName = "brickreview_files";
        ownerCol = 'uploaded_by';
        break;
      default:
        return res.status(400).json({ error: "Invalid item type" });
    }

    let result;

    if (type === 'folder') {
      // Check permission for folder
      const folderCheck = await query(`
         SELECT f.id FROM brickreview_folders f
         JOIN brickreview_projects p ON f.project_id = p.id
         WHERE f.id = $1 AND p.created_by = $2
       `, [id, user.id]);

      if (folderCheck.rows.length === 0) {
        return res.status(404).json({ error: "Item not found or you don't have permission." });
      }

      result = await query(
        `UPDATE brickreview_folders SET deleted_at = NULL WHERE id = $1 RETURNING *`,
        [id]
      );
    } else {
      result = await query(
        `UPDATE ${tableName} SET deleted_at = NULL WHERE id = $1 AND ${ownerCol} = $2 RETURNING *`,
        [id, user.id]
      );
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Item not found or you don't have permission to restore it." });
    }

    logger.info("TRASH", "Item restored", { type, id, userId: user.id });
    res.json(result.rows[0]);
  } catch (error) {
    logger.error("TRASH", "Error restoring item", { error: error.message, type, id, userId: user.id });
    res.status(500).json({ error: "Internal server error" });
  }
});

// Permanently delete an item
router.delete("/:type/:id/permanent", authenticateToken, async (req, res) => {
  const { type, id } = req.params;
  const { user } = req;

  if (!validateId(id)) {
    return res.status(400).json({ error: "Invalid item ID" });
  }

  try {
    let tableName;
    let r2CleanupFn = null;
    let itemData = null;
    let ownerCol = 'user_id';

    switch (type) {
      case "project":
        tableName = "brickreview_projects";
        ownerCol = 'created_by';
        break;
      case "folder":
        tableName = "brickreview_folders";
        // Special check for folder
        break;
      case "video":
        tableName = "brickreview_videos";
        ownerCol = 'uploaded_by';
        // Fetch video data for R2 cleanup
        const videoResult = await query(
          `SELECT id, r2_key, proxy_r2_key, streaming_high_r2_key, thumbnail_r2_key, sprite_r2_key 
           FROM brickreview_videos WHERE id = $1 AND uploaded_by = $2`,
          [id, user.id]
        );
        if (videoResult.rows.length > 0) {
          itemData = videoResult.rows[0];
          r2CleanupFn = cleanupVideoR2;
        }
        break;
      case "file":
        tableName = "brickreview_files";
        ownerCol = 'uploaded_by';
        // Fetch file data for R2 cleanup
        const fileResult = await query(
          `SELECT id, r2_key, thumbnail_r2_key 
           FROM brickreview_files WHERE id = $1 AND uploaded_by = $2`,
          [id, user.id]
        );
        if (fileResult.rows.length > 0) {
          itemData = fileResult.rows[0];
          r2CleanupFn = cleanupFileR2;
        }
        break;
      default:
        return res.status(400).json({ error: "Invalid item type" });
    }

    // R2 cleanup (async, non-blocking - failures are logged but don't block DB deletion)
    if (r2CleanupFn && itemData) {
      r2CleanupFn(itemData).catch((err) => {
        logger.error("TRASH", "R2 cleanup failed", { type, id, error: err.message });
      });
    }

    let result;
    if (type === 'folder') {
      // Special check for generic delete folder
      const folderCheck = await query(`
         SELECT f.id FROM brickreview_folders f
         JOIN brickreview_projects p ON f.project_id = p.id
         WHERE f.id = $1 AND p.created_by = $2
       `, [id, user.id]);

      if (folderCheck.rows.length === 0) {
        return res.status(404).json({ error: "Item not found or you don't have permission." });
      }
      result = await query(`DELETE FROM brickreview_folders WHERE id = $1`, [id]);
    } else {
      result = await query(
        `DELETE FROM ${tableName} WHERE id = $1 AND ${ownerCol} = $2`,
        [id, user.id]
      );
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Item not found or you don't have permission to delete it." });
    }

    logger.info("TRASH", "Item permanently deleted", { type, id, userId: user.id });
    res.status(204).send();
  } catch (error) {
    logger.error("TRASH", "Error permanently deleting item", { error: error.message, type, id, userId: user.id });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

