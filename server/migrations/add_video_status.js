import { query } from "../db.js";

const runMigration = async () => {
  try {
    console.log("🚀 Starting migration: add status column to videos...");

    await query(`
      ALTER TABLE brickreview_videos 
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ready';
    `);

    // Set existing videos to 'ready'
    await query(`UPDATE brickreview_videos SET status = 'ready' WHERE status IS NULL`);

    console.log("✅ Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
};

runMigration();
