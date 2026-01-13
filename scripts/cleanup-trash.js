
import db from "../server/db.js";
import { R2 } from "../server/utils/r2.js";
import dotenv from "dotenv";

dotenv.config({ path: "./server/.env" });

const BUCKET_NAME = process.env.R2_BUCKET_NAME;

async function cleanupTrash() {
  console.log("Starting trash cleanup...");

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const tables = ["projects", "folders", "videos", "files"];

  for (const table of tables) {
    try {
      const res = await db.query(
        `SELECT * FROM ${table} WHERE deleted_at <= $1`,
        [sevenDaysAgo]
      );

      if (res.rows.length === 0) {
        console.log(`No items to delete from ${table}.`);
        continue;
      }

      for (const item of res.rows) {
        console.log(`Permanently deleting ${table.slice(0, -1)}: ${item.name || item.id}`);

        // If the item is a video or a file, delete it from R2
        if ((table === "videos" || table === "files") && item.r2_object_key) {
          try {
            await R2.deleteObject({
              Bucket: BUCKET_NAME,
              Key: item.r2_object_key,
            }).promise();
            console.log(`Deleted ${item.r2_object_key} from R2.`);
          } catch (r2Error) {
            console.error(`Failed to delete ${item.r2_object_key} from R2:`, r2Error);
          }
        }

        // Delete the item from the database
        await db.query(`DELETE FROM ${table} WHERE id = $1`, [item.id]);
      }
    } catch (error) {
      console.error(`Error cleaning up ${table}:`, error);
    }
  }

  console.log("Trash cleanup finished.");
  process.exit(0);
}

cleanupTrash();
