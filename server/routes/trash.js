
import express from "express";
import db from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { validateId } from "../utils/validateId.js";

const router = express.Router();

// GET all soft-deleted items
router.get("/", authenticate, async (req, res) => {
  try {
    const [projects, folders, videos, files] = await Promise.all([
      db.query("SELECT * FROM projects WHERE deleted_at IS NOT NULL AND user_id = $1", [req.user.id]),
      db.query("SELECT * FROM folders WHERE deleted_at IS NOT NULL AND user_id = $1", [req.user.id]),
      db.query("SELECT * FROM videos WHERE deleted_at IS NOT NULL AND user_id = $1", [req.user.id]),
      db.query("SELECT * FROM files WHERE deleted_at IS NOT NULL AND user_id = $1", [req.user.id]),
    ]);

    res.json({
      projects: projects.rows,
      folders: folders.rows,
      videos: videos.rows,
      files: files.rows,
    });
  } catch (error) {
    console.error("Error fetching soft-deleted items:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Restore a soft-deleted item
router.post("/:type/:id/restore", authenticate, async (req, res) => {
  const { type, id } = req.params;
  const { user } = req;

  if (!validateId(id)) {
    return res.status(400).json({ error: "Invalid item ID" });
  }

  try {
    let tableName;
    switch (type) {
      case "project":
        tableName = "projects";
        break;
      case "folder":
        tableName = "folders";
        break;
      case "video":
        tableName = "videos";
        break;
      case "file":
        tableName = "files";
        break;
      default:
        return res.status(400).json({ error: "Invalid item type" });
    }

    const result = await db.query(
      `UPDATE ${tableName} SET deleted_at = NULL WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Item not found or you don't have permission to restore it." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error restoring item:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Permanently delete an item
router.delete("/:type/:id/permanent", authenticate, async (req, res) => {
  const { type, id } = req.params;
  const { user } = req;

  if (!validateId(id)) {
    return res.status(400).json({ error: "Invalid item ID" });
  }

  try {
    let tableName;
    switch (type) {
      case "project":
        tableName = "projects";
        break;
      case "folder":
        tableName = "folders";
        break;
      case "video":
        tableName = "videos";
        break;
      case "file":
        tableName = "files";
        break;
      default:
        return res.status(400).json({ error: "Invalid item type" });
    }

    // Here you would also add the logic to delete files from R2

    const result = await db.query(
      `DELETE FROM ${tableName} WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Item not found or you don't have permission to delete it." });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error permanently deleting item:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
