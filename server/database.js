import { pool, query } from "./db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDatabase() {
  if (!pool) {
    console.error("\n❌ ERRO CRÍTICO: DATABASE_URL não configurada!");
    console.error("╔═══════════════════════════════════════════════════════════╗");
    console.error("║  O servidor NÃO PODE INICIAR sem conexão com o banco!  ║");
    console.error("╚═══════════════════════════════════════════════════════════╝");
    console.error("\n💡 Solução:");
    console.error("   1. Certifique-se que o arquivo .env existe no diretório server/");
    console.error("   2. O arquivo .env deve conter a variável DATABASE_URL");
    console.error("   3. Exemplo:");
    console.error("      DATABASE_URL=postgresql://user:pass@host:port/database\n");

    throw new Error(
      "DATABASE_URL não configurada. O servidor não pode funcionar sem banco de dados."
    );
  }

  try {
    // Verifica se as tabelas principais já existem
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'brickreview_projects'
      ) as exists
    `);

    const tablesExist = tableCheck.rows[0].exists;

    // If the tables exist, check if brickreview_shares and the required views also exist
    if (tablesExist && process.env.RESET_DB !== "true") {
      const requiredViews = [
        "brickreview_projects_with_stats",
        "brickreview_videos_with_stats",
        "brickreview_comments_with_user",
        "brickreview_folders_with_stats",
      ];

      const schemaCheck = await query(
        `
        SELECT
          (
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.tables
              WHERE table_name = 'brickreview_shares'
            )
          ) as "shareTableExists",
          (
            SELECT array_agg(table_name)
            FROM information_schema.views
            WHERE table_name = ANY($1)
          ) as "existingViewNames",
          (
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'brickreview_projects' AND column_name = 'deleted_at'
            )
          ) as "projectsHaveDeletedAt",
          (
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'brickreview_folders' AND column_name = 'deleted_at'
            )
          ) as "foldersHaveDeletedAt",
          (
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'brickreview_videos' AND column_name = 'deleted_at'
            )
          ) as "videosHaveDeletedAt",
          (
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'brickreview_files' AND column_name = 'deleted_at'
            )
          ) as "filesHaveDeletedAt",
          (
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'brickreview_projects_with_stats' AND column_name = 'deleted_at'
            )
          ) as "projectsViewHasDeletedAt",
          (
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'brickreview_folders_with_stats' AND column_name = 'deleted_at'
            )
          ) as "foldersViewHasDeletedAt"
      `,
        [requiredViews]
      );

      const {
        shareTableExists,
        existingViewNames,
        projectsHaveDeletedAt,
        foldersHaveDeletedAt,
        videosHaveDeletedAt,
        filesHaveDeletedAt,
        projectsViewHasDeletedAt,
        foldersViewHasDeletedAt,
      } = schemaCheck.rows[0];

      const existingViews = new Set(existingViewNames || []);
      const missingViews = requiredViews.filter((view) => !existingViews.has(view));
      const softDeleteReady =
        projectsHaveDeletedAt &&
        foldersHaveDeletedAt &&
        videosHaveDeletedAt &&
        filesHaveDeletedAt &&
        projectsViewHasDeletedAt &&
        foldersViewHasDeletedAt;

      // Verifica se a coluna timestamp_end existe na tabela brickreview_comments
      const timestampEndCheck = await query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'brickreview_comments' AND column_name = 'timestamp_end'
        ) as "hasTimestampEnd"
      `);
      const hasTimestampEnd = timestampEndCheck.rows[0].hasTimestampEnd;

      if (shareTableExists && missingViews.length === 0 && softDeleteReady && hasTimestampEnd) {
        console.log("✅ Database schema already initialized. Skipping setup.");
        return;
      }

      const missingItems = [];
      if (!shareTableExists) {
        missingItems.push('"brickreview_shares" table');
      }
      if (missingViews.length > 0) {
        missingItems.push(`${missingViews.length} view(s)`);
      }

      if (!softDeleteReady) {
        missingItems.push("soft delete columns/views");
      }

      if (!hasTimestampEnd) {
        missingItems.push("timestamp_end column");
        console.log("🔄 Adding timestamp_end column to brickreview_comments...");
        await query(
          "ALTER TABLE brickreview_comments ADD COLUMN IF NOT EXISTS timestamp_end DECIMAL(10, 3)"
        );
      }

      console.log(
        `📦 Main tables exist but ${missingItems.join(" and ")} are missing. Updating schema...`
      );
      if (missingViews.length > 0) {
        console.log("   Missing views:", missingViews.join(", "));
      }
      if (!softDeleteReady) {
        console.log("   Missing soft delete columns or view columns (deleted_at)");
      }
    }

    console.log("🔄 Initializing database schema...");

    // Check if master_users table exists
    const masterUsersCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'master_users'
      ) as exists
    `);

    if (!masterUsersCheck.rows[0].exists) {
      throw new Error("master_users table not found");
    }

    const sqlFile = path.join(__dirname, "database.sql");
    if (!fs.existsSync(sqlFile)) return;

    const sql = fs.readFileSync(sqlFile, "utf8");

    // First, force drop all views to avoid column rename conflicts
    // This must be done separately before running the main SQL
    try {
      await query(`
        DROP VIEW IF EXISTS brickreview_projects_with_stats CASCADE;
        DROP VIEW IF EXISTS brickreview_videos_with_stats CASCADE;
        DROP VIEW IF EXISTS brickreview_comments_with_user CASCADE;
        DROP VIEW IF EXISTS brickreview_folders_with_stats CASCADE;
      `);
      console.log("🗑️  Dropped existing views to avoid conflicts");
    } catch (viewError) {
      // Ignore errors if views don't exist
      console.log("⚠️  Could not drop views (may not exist):", viewError.message);
    }

    // Execute setup
    await query(sql);
    console.log("✅ Database schema initialized successfully");

    // Log table statistics
    const stats = await query(`
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
      FROM pg_tables
      WHERE tablename LIKE 'brickreview_%' OR tablename = 'master_users'
      ORDER BY tablename
    `);

    console.log("\n📊 Database tables:");
    stats.rows.forEach((row) => {
      const icon = row.tablename === "master_users" ? "🔗" : "📦";
      console.log(`   ${icon} ${row.tablename} (${row.size})`);
    });
    console.log("");
  } catch (error) {
    console.error("❌ Failed to initialize database:", error.message);

    if (error.message.includes("master_users")) {
      console.error("\n💡 Solution:");
      console.error("   1. Use the same DATABASE_URL as brickprojects or BrickAI");
      console.error("   2. Or create master_users table first:");
      console.error("      CREATE TABLE master_users (");
      console.error("        id SERIAL PRIMARY KEY,");
      console.error("        username VARCHAR(100) UNIQUE NOT NULL,");
      console.error("        email VARCHAR(255) UNIQUE NOT NULL,");
      console.error("        password_hash VARCHAR(255) NOT NULL,");
      console.error("        role VARCHAR(50) DEFAULT 'admin',");
      console.error("        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
      console.error("      );");
    }

    throw error;
  }
}

// Helper para verificar se o banco está pronto
export async function isDatabaseReady() {
  if (!pool) return false;

  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'brickreview_projects'
      ) as exists
    `);
    return result.rows[0].exists;
  } catch {
    return false;
  }
}

export default { initDatabase, isDatabaseReady };
