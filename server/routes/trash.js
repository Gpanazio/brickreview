
import express from "express";
import { query } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import { validateId } from "../utils/validateId.js";
import logger from "../utils/logger.js";

const router = express.Router();

// GET all soft-deleted items
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [projects, folders, videos, files] = await Promise.all([
      query("SELECT * FROM brickreview_projects WHERE deleted_at IS NOT NULL AND user_id = $1", [req.user.id]),
      query("SELECT * FROM brickreview_folders WHERE deleted_at IS NOT NULL AND user_id = $1", [req.user.id]),
      query("SELECT * FROM brickreview_videos WHERE deleted_at IS NOT NULL AND user_id = $1", [req.user.id]),
      query("SELECT * FROM brickreview_files WHERE deleted_at IS NOT NULL AND user_id = $1", [req.user.id]),
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
    switch (type) {
      case "project":
        tableName = "brickreview_projects";
        break;
      case "folder":
        tableName = "brickreview_folders";
        break;
      case "video":
        tableName = "brickreview_videos";
        break;
      case "file":
        tableName = "brickreview_files";
        break;
      default:
        return res.status(400).json({ error: "Invalid item type" });
    }

    const result = await query(
      `UPDATE ${tableName} SET deleted_at = NULL WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, user.id]
    );

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
    switch (type) {
      case "project":
        tableName = "brickreview_projects";
        break;
      case "folder":
        tableName = "brickreview_folders";
        break;
      case "video":
        tableName = "brickreview_videos";
        break;
      case "file":
        tableName = "brickreview_files";
        break;
      default:
        return res.status(400).json({ error: "Invalid item type" });
    }

    // TODO: Add logic to delete files from R2/Drive storage

    const result = await query(
      `DELETE FROM ${tableName} WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );

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
