import express from "express";
import multer from "multer";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { query } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  requireProjectAccess,
  requireProjectAccessFromFile,
  requireProjectAccessFromFolder,
} from "../utils/permissions.js";
import r2Client from "../utils/r2.js";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { validateId } from "../utils/validateId.js";
import logger from "../utils/logger.js";

const router = express.Router();

// Configuração do Multer para upload temporário
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = "temp-uploads/";
    try {
      await fs.promises.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
});

/**
 * Determina o tipo de arquivo baseado no mime type
 */
function getFileType(mimeType) {
  if (!mimeType) return "other";

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "document";
  if (
    mimeType.includes("document") ||
    mimeType.includes("text") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("presentation")
  ) {
    return "document";
  }

  return "other";
}

/**
 * @route POST /api/files/upload
 * @desc Upload any file type to R2 and save metadata
 */
router.post("/upload", authenticateToken, upload.single("file"), async (req, res) => {
  res.setTimeout(300000, () => {
    logger.error('FILES', 'Upload timeout');
    if (!res.headersSent) {
      res.status(504).json({ error: "Tempo limite de upload excedido" });
    }
  });
  const { project_id, name, description, folder_id } = req.body;
  const file = req.file;

  const missingR2Config = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
  ].filter((key) => !process.env[key]);

  if (missingR2Config.length > 0) {
    return res.status(500).json({
      error: "Configuração do R2 ausente",
      missing: missingR2Config,
    });
  }

  if (!file || !project_id) {
    return res.status(400).json({ error: "Dados insuficientes para o upload" });
  }

  const projectId = Number(project_id);
  if (!validateId(projectId)) {
    return res.status(400).json({ error: "project_id inválido" });
  }

  if (!(await requireProjectAccess(req, res, projectId))) return;

  const folderId = folder_id ? Number(folder_id) : null;
  if (folder_id && !validateId(folderId)) {
    return res.status(400).json({ error: "folder_id inválido" });
  }

  if (folderId) {
    const folderCheck = await query(
      "SELECT 1 FROM brickreview_folders WHERE id = $1 AND project_id = $2",
      [folderId, projectId]
    );
    if (folderCheck.rows.length === 0) {
      return res.status(400).json({ error: "folder_id não pertence ao projeto" });
    }
  }

  const fileName = name || file.originalname;
  const fileType = getFileType(file.mimetype);
  let thumbnailKey = null;
  let thumbnailUrl = null;
  let width = null;
  let height = null;

  try {
    // Se for imagem, a própria imagem serve como thumbnail
    // Para imagens grandes, poderíamos redimensionar, mas por ora usamos a original
    if (fileType === "image") {
      // Tentar obter dimensões da imagem
      try {
        const sharp = await import("sharp");
        const imageInfo = await sharp.default(file.path).metadata();
        width = imageInfo.width;
        height = imageInfo.height;
      } catch (err) {
        logger.warn("Não foi possível obter dimensões da imagem:", err.message);
      }
    }

    // Upload do arquivo para R2
    const fileKey = `files/${project_id}/${uuidv4()}-${file.originalname}`;
    const fileStream = fs.createReadStream(file.path);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileKey,
        Body: fileStream,
        ContentType: file.mimetype,
      })
    );

    const r2Url = `${process.env.R2_PUBLIC_URL}/${fileKey}`;

    // Para imagens, a URL do arquivo é também a thumbnail
    if (fileType === "image") {
      thumbnailKey = fileKey;
      thumbnailUrl = r2Url;
    }

    // Salva no banco
    const result = await query(
      `
      INSERT INTO brickreview_files (
        project_id, folder_id, name, description,
        r2_key, r2_url, thumbnail_r2_key, thumbnail_url,
        file_type, mime_type, file_size, width, height, uploaded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `,
      [
        projectId,
        folderId || null,
        fileName,
        description || null,
        fileKey,
        r2Url,
        thumbnailKey,
        thumbnailUrl,
        fileType,
        file.mimetype,
        file.size,
        width,
        height,
        req.user.id,
      ]
    );

    // Cleanup
    try {
      if (file.path) await fs.promises.unlink(file.path);
    } catch (err) {
      logger.warn(`⚠️ Falha ao remover arquivo temporário ${file.path}:`, err.message);
    }

    logger.info(`✅ Arquivo enviado: ${fileName} (${fileType})`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error("Erro no upload de arquivo:", error);
    if (file && file.path) {
      try { await fs.promises.unlink(file.path); } catch (e) { /* ignore */ }
    }
    res.status(500).json({ error: "Erro ao processar upload" });
  }
});

/**
 * @route GET /api/files/folder/:folderId
 * @desc Get all files in a folder
 */
router.get("/folder/:folderId", authenticateToken, async (req, res) => {
  try {
    const folderId = Number(req.params.folderId);
    if (!validateId(folderId)) {
      return res.status(400).json({ error: "folderId inválido" });
    }

    if (!(await requireProjectAccessFromFolder(req, res, folderId))) return;

    const result = await query(
      `SELECT * FROM brickreview_files
       WHERE folder_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [folderId]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error("Erro ao buscar arquivos da pasta:", error);
    res.status(500).json({ error: "Erro ao buscar arquivos" });
  }
});

/**
 * @route GET /api/files/project/:projectId
 * @desc Get all files in a project (without folder)
 */
router.get("/project/:projectId", authenticateToken, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    if (!validateId(projectId)) {
      return res.status(400).json({ error: "projectId inválido" });
    }

    if (!(await requireProjectAccess(req, res, projectId))) return;

    const result = await query(
      `SELECT * FROM brickreview_files
       WHERE project_id = $1 AND folder_id IS NULL AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [projectId]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error("Erro ao buscar arquivos do projeto:", error);
    res.status(500).json({ error: "Erro ao buscar arquivos" });
  }
});

/**
 * @route DELETE /api/files/:id
 * @desc Soft delete a file
 */
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const fileId = Number(req.params.id);
    if (!validateId(fileId)) {
      return res.status(400).json({ error: "ID de arquivo inválido" });
    }

    if (!(await requireProjectAccessFromFile(req, res, fileId))) return;

    const now = new Date();
    const result = await query(
      "UPDATE brickreview_files SET deleted_at = $1 WHERE id = $2 RETURNING id",
      [now, fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Arquivo não encontrado" });
    }

    res.json({ message: "Arquivo enviado para a lixeira", id: fileId });
  } catch (error) {
    logger.error("Erro ao excluir arquivo:", error);
    res.status(500).json({ error: "Erro ao excluir arquivo" });
  }
});

/**
 * @route PATCH /api/files/:id/move
 * @desc Move file to a different folder or project
 */
router.patch("/:id/move", authenticateToken, async (req, res) => {
  try {
    const { folder_id, project_id } = req.body;
    const fileId = Number(req.params.id);

    if (!validateId(fileId)) {
      return res.status(400).json({ error: "ID de arquivo inválido" });
    }

    const currentProjectId = await requireProjectAccessFromFile(req, res, fileId);
    if (!currentProjectId) return;

    if (project_id && Number(project_id) !== currentProjectId) {
      const hasAccess = await requireProjectAccess(req, res, Number(project_id));
      if (!hasAccess) return;
    }

    const targetProjectId = project_id ? Number(project_id) : currentProjectId;
    const targetFolderId = folder_id ? Number(folder_id) : null;

    if (targetFolderId) {
      const folderCheck = await query("SELECT project_id FROM brickreview_folders WHERE id = $1", [
        targetFolderId,
      ]);
      if (folderCheck.rows.length === 0) {
        return res.status(404).json({ error: "Pasta de destino não encontrada" });
      }
      if (folderCheck.rows[0].project_id !== targetProjectId) {
        return res.status(400).json({ error: "Pasta não pertence ao projeto de destino" });
      }
    }

    const result = await query(
      "UPDATE brickreview_files SET folder_id = $1, project_id = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
      [targetFolderId, targetProjectId, fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Arquivo não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error("Erro ao mover arquivo:", error);
    res.status(500).json({ error: "Erro ao mover arquivo" });
  }
});

/**
 * @route POST /api/files/:id/restore
 * @desc Restore a deleted file
 */
router.post("/:id/restore", authenticateToken, async (req, res) => {
  try {
    const fileId = Number(req.params.id);
    if (!validateId(fileId)) {
      return res.status(400).json({ error: "ID de arquivo inválido" });
    }

    // A verificação de permissão não é necessária aqui, pois o usuário não pode "adivinhar" o ID de um arquivo deletado
    // que ele não deveria ver. Se ele tem o ID, é porque ele viu em algum lugar (provavelmente na lixeira, que terá suas próprias permissões)

    const result = await query(
      "UPDATE brickreview_files SET deleted_at = NULL WHERE id = $1 RETURNING *",
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Arquivo não encontrado na lixeira" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error("Erro ao restaurar arquivo:", error);
    res.status(500).json({ error: "Erro ao restaurar arquivo" });
  }
});

export default router;
