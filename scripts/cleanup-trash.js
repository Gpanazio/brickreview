import { Pool } from "pg";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import r2Client from "../server/utils/r2.js";
import { logger } from "../server/utils/logger.js";
import dotenv from "dotenv";
import path from "path";

// Carrega .env apenas se não estiver em produção (Railway injeta env vars)
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.resolve(process.cwd(), "server/.env") });
}

// Configuração do Bucket
const BUCKET_NAME = process.env.R2_BUCKET_NAME;

// Setup do Pool do PostgreSQL
let dbPool = null;
if (process.env.DATABASE_URL) {
  dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });
  logger.info("CLEANUP", "Pool do PostgreSQL inicializada.");
} else {
  logger.error("CLEANUP", "DATABASE_URL não encontrada. Abortando.");
  process.exit(1);
}

async function cleanupTrash() {
  logger.info("CLEANUP", "Iniciando limpeza da lixeira...");

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Nomes corretos das tabelas conforme schema (brickreview_*)
  const tables = [
    "brickreview_projects",
    "brickreview_folders",
    "brickreview_videos",
    "brickreview_files",
  ];

  for (const table of tables) {
    try {
      const res = await dbPool.query(`SELECT * FROM ${table} WHERE deleted_at <= $1`, [
        sevenDaysAgo,
      ]);

      if (res.rows.length === 0) continue;

      for (const item of res.rows) {
        logger.info("CLEANUP", `Deletando permanentemente ${table}: ${item.id}`);

        // Deletar do R2 se for vídeo ou arquivo
        // Usa r2_key conforme schema do banco
        if ((table === "brickreview_videos" || table === "brickreview_files") && item.r2_key) {
          try {
            await r2Client.send(
              new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: item.r2_key,
              })
            );
            logger.info("CLEANUP", `Arquivo deletado do R2: ${item.r2_key}`);
          } catch (r2Error) {
            logger.error("CLEANUP", `Falha ao deletar do R2: ${item.r2_key}`, {
              error: r2Error.message,
            });
          }
        }

        // Delete DB
        await dbPool.query(`DELETE FROM ${table} WHERE id = $1`, [item.id]);
      }
    } catch (error) {
      logger.error("CLEANUP", `Erro ao limpar tabela ${table}`, { error: error.message });
    }
  }

  logger.info("CLEANUP", "Limpeza concluída.");

  // Encerra o pool para finalizar o script
  await dbPool.end();
  process.exit(0);
}

cleanupTrash().catch((err) => {
  logger.error("CLEANUP", "Erro fatal no script", { error: err.message });
  if (dbPool) dbPool.end();
  process.exit(1);
});
