import { query } from "../db.js";

const runMigration = async () => {
  try {
    console.log("🚀 Starting migration: recreate views to include new columns...");

    // Drop existing view
    await query(`DROP VIEW IF EXISTS brickreview_videos_with_stats CASCADE`);

    // Recreate view with new columns (implicitly via v.*)
    await query(`
      CREATE VIEW brickreview_videos_with_stats AS
      SELECT
        v.*,
        COUNT(DISTINCT c.id) as comments_count,
        COUNT(DISTINCT CASE WHEN c.status = 'open' THEN c.id END) as open_comments_count,
        (SELECT status FROM brickreview_approvals WHERE video_id = v.id ORDER BY created_at DESC LIMIT 1) as latest_approval_status,
        (SELECT username FROM master_users WHERE id = v.uploaded_by) as uploaded_by_username
      FROM brickreview_videos v
      LEFT JOIN brickreview_comments c ON c.video_id = v.id
      WHERE v.deleted_at IS NULL
      GROUP BY v.id;
    `);

    console.log("✅ Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
};

runMigration();
