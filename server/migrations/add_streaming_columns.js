import { query } from "../db.js";

const runMigration = async () => {
  try {
    console.log("🚀 Starting migration: add streaming_high columns...");

    await query(`
      ALTER TABLE brickreview_videos 
      ADD COLUMN IF NOT EXISTS streaming_high_r2_key VARCHAR(500),
      ADD COLUMN IF NOT EXISTS streaming_high_url TEXT;
    `);

    console.log("✅ Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
};

runMigration();
