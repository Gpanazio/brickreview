
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
 * Helper: Ensure parent folders are restored so the item is visible
 */
async function ensureParentFoldersRestored(folderId) {
  if (!folderId) return;

  try {
    // Busca a pasta pai
    const res = await query('SELECT id, parent_folder_id, deleted_at FROM brickreview_folders WHERE id = $1', [folderId]);
    if (res.rows.length === 0) return;

    const folder = res.rows[0];

    // Se estiver deletada, restaura
    if (folder.deleted_at) {
      await query('UPDATE brickreview_folders SET deleted_at = NULL WHERE id = $1', [folderId]);
      logger.info("TRASH", "Parent folder auto-restored", { folderId });
    }

    // Recursivamente checa o pai desta pasta
    if (folder.parent_folder_id) {
      await ensureParentFoldersRestored(folder.parent_folder_id);
    }
  } catch (err) {
    logger.error("TRASH", "Error ensuring parent folders restored", { error: err.message, folderId });
  }
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
    switch (type) {
      case "project":
        // Apenas o dono pode restaurar projeto
        const projectResult = await query(
          `UPDATE brickreview_projects SET deleted_at = NULL WHERE id = $1 AND created_by = $2 RETURNING *`,
          [id, user.id]
        );
        if (projectResult.rowCount === 0) return res.status(404).json({ error: "Project not found or permission denied" });

        await query("UPDATE brickreview_folders SET deleted_at = NULL WHERE project_id = $1", [id]);
        await query("UPDATE brickreview_videos SET deleted_at = NULL WHERE project_id = $1", [id]);
        await query("UPDATE brickreview_files SET deleted_at = NULL WHERE project_id = $1", [id]);

        return res.json(projectResult.rows[0]);

      case "folder":
        const folderCheck = await query(`
            SELECT f.id, f.parent_folder_id FROM brickreview_folders f
            JOIN brickreview_projects p ON f.project_id = p.id
            WHERE f.id = $1 AND (p.created_by = $2 OR EXISTS (SELECT 1 FROM brickreview_project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2))
         `, [id, user.id]);

        if (folderCheck.rowCount === 0) return res.status(403).json({ error: "Permission denied" });

        const folderResult = await query(`UPDATE brickreview_folders SET deleted_at = NULL WHERE id = $1 RETURNING *`, [id]);
        await query("UPDATE brickreview_videos SET deleted_at = NULL WHERE folder_id = $1", [id]);
        await query("UPDATE brickreview_files SET deleted_at = NULL WHERE folder_id = $1", [id]);

        if (folderCheck.rows[0].parent_folder_id) {
          await ensureParentFoldersRestored(folderCheck.rows[0].parent_folder_id);
        }

        return res.json(folderResult.rows[0]);

      case "video":
      case "file":
        const tableName = type === "video" ? "brickreview_videos" : "brickreview_files";
        const itemCheck = await query(`
            SELECT t.id, t.folder_id FROM ${tableName} t
            JOIN brickreview_projects p ON t.project_id = p.id
            WHERE t.id = $1 AND (p.created_by = $2 OR EXISTS (SELECT 1 FROM brickreview_project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2))
        `, [id, user.id]);

        if (itemCheck.rowCount === 0) return res.status(403).json({ error: "Permission denied" });

        const itemResult = await query(`UPDATE ${tableName} SET deleted_at = NULL WHERE id = $1 RETURNING *`, [id]);

        if (itemCheck.rows[0].folder_id) {
          await ensureParentFoldersRestored(itemCheck.rows[0].folder_id);
        }

        return res.json(itemResult.rows[0]);

      default:
        return res.status(400).json({ error: "Invalid item type" });
    }
  } catch (error) {
    logger.error("TRASH", "Error restoring item", { error: error.message, type, id });
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

    if (type === "project") {
      const projectCheck = await query("SELECT id FROM brickreview_projects WHERE id = $1 AND created_by = $2", [id, user.id]);
      if (projectCheck.rowCount === 0) return res.status(403).json({ error: "Permission denied (Project Owner Only)" });

      await query("DELETE FROM brickreview_projects WHERE id = $1", [id]);
      return res.status(204).send();

    } else if (type === "folder") {
      const folderCheck = await query(`
            SELECT f.id FROM brickreview_folders f
            JOIN brickreview_projects p ON f.project_id = p.id
            WHERE f.id = $1 AND (p.created_by = $2 OR EXISTS (SELECT 1 FROM brickreview_project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2))
        `, [id, user.id]);
      if (folderCheck.rowCount === 0) return res.status(403).json({ error: "Permission denied" });

      await query("DELETE FROM brickreview_folders WHERE id = $1", [id]);
      return res.status(204).send();

    } else if (type === "video" || type === "file") {
      tableName = type === "video" ? "brickreview_videos" : "brickreview_files";

      const itemCheck = await query(`
            SELECT t.* FROM ${tableName} t
            JOIN brickreview_projects p ON t.project_id = p.id
            WHERE t.id = $1 AND (p.created_by = $2 OR EXISTS (SELECT 1 FROM brickreview_project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2))
        `, [id, user.id]);

      if (itemCheck.rowCount === 0) return res.status(403).json({ error: "Permission denied" });

      itemData = itemCheck.rows[0];
      r2CleanupFn = type === "video" ? cleanupVideoR2 : cleanupFileR2;
    } else {
      return res.status(400).json({ error: "Invalid item type" });
    }

    // R2 cleanup (async)
    if (r2CleanupFn && itemData) {
      r2CleanupFn(itemData).catch((err) => {
        logger.error("TRASH", "R2 cleanup failed", { type, id, error: err.message });
      });
    }

    // Hard Delete from DB
    await query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);

    logger.info("TRASH", "Item permanently deleted", { type, id, userId: user.id });
    res.status(204).send();
  } catch (error) {
    logger.error("TRASH", "Error permanently deleting item", { error: error.message, type, id, userId: user.id });
    res.status(500).json({ error: "Internal server error" });
  }
});

// Empty trash (Delete all items permanently)
router.delete("/empty", authenticateToken, async (req, res) => {
  const { user } = req;

  try {
    // Buscar todos os itens deletados do usuário para limpeza do R2
    const [videos, files] = await Promise.all([
      query("SELECT * FROM brickreview_videos WHERE deleted_at IS NOT NULL AND uploaded_by = $1", [user.id]),
      query("SELECT * FROM brickreview_files WHERE deleted_at IS NOT NULL AND uploaded_by = $1", [user.id])
    ]);

    // Limpeza assíncrona do R2 (fire and forget para não bloquear muito a resposta)
    (async () => {
      for (const video of videos.rows) {
        await cleanupVideoR2(video).catch(() => { });
      }
      for (const file of files.rows) {
        await cleanupFileR2(file).catch(() => { });
      }
    })();

    // Deletar do banco (Hard Delete)
    // A ordem importa por causa das chaves estrangeiras (files/videos -> folders -> projects)

    // 1. Arquivos e Vídeos
    await Promise.all([
      query("DELETE FROM brickreview_files WHERE deleted_at IS NOT NULL AND uploaded_by = $1", [user.id]),
      query("DELETE FROM brickreview_videos WHERE deleted_at IS NOT NULL AND uploaded_by = $1", [user.id])
    ]);

    // 2. Pastas (apenas as que o usuário pode deletar e estão na lixeira)
    // Nota: Pastas podem ser deletadas se pertencerem a projetos que o usuário criou
    await query(`
      DELETE FROM brickreview_folders 
      WHERE id IN (
        SELECT f.id FROM brickreview_folders f
        JOIN brickreview_projects p ON f.project_id = p.id
        WHERE f.deleted_at IS NOT NULL AND p.created_by = $1
      )
    `, [user.id]);

    // 3. Projetos
    await query("DELETE FROM brickreview_projects WHERE deleted_at IS NOT NULL AND created_by = $1", [user.id]);

    logger.info("TRASH", "Trash emptied", { userId: user.id });
    res.status(204).send();
  } catch (error) {
    logger.error("TRASH", "Error emptying trash", { error: error.message, userId: user.id });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
