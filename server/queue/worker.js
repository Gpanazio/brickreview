import { Worker } from "bullmq";
import connection from "./connection.js";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db.js";
import { downloadFile, uploadFile } from "../utils/r2-helpers.js";
import {
  analyzeVideo,
  generateThumbnail,
  generateProxy,
  generateStreamingHigh,
  generateSpriteSheet,
  generateSpriteVtt,
} from "../utils/video.js";

// Bitrate Matrix Thresholds (kbps)
const THRESHOLDS = {
  "4K": { res: 2160, limit: 50000, target: 35000 },
  FHD: { res: 1080, limit: 20000, target: 15000 },
  SD: { res: 0, limit: 15000, target: 10000 },
};

const worker = new Worker(
  "video-processing",
  async (job) => {
    const { videoId, r2Key, projectId } = job.data;
    console.log(`🎬 Processing video job ${job.id} for videoId: ${videoId}`);

    const tempDir = path.resolve("temp-processing", job.id);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const localVideoPath = path.join(tempDir, "original.mp4");

    try {
      await query("UPDATE brickreview_videos SET status = $1 WHERE id = $2", [
        "processing",
        videoId,
      ]);

      // 1. Download Original
      await downloadFile(r2Key, localVideoPath);

      // 2. Analyze Video
      console.log("🔍 Analyzing video...");
      const metadata = await analyzeVideo(localVideoPath);
      console.log("📊 Metadata:", metadata);

      // 3. Bitrate Matrix Decision
      let streamingHighUrl = null;
      let streamingHighKey = null;
      const bitrateKbps = metadata.bitrate / 1000;
      const height = metadata.height || 1080; // Fallback to 1080 if unknown

      let profile = "SD";
      if (height >= 2160) profile = "4K";
      else if (height >= 1080) profile = "FHD";

      const rule = THRESHOLDS[profile];
      console.log(
        `🧠 Decision Logic: Profile=${profile}, Bitrate=${bitrateKbps}kbps, Limit=${rule.limit}kbps`
      );

      // Determine if Streaming High is needed
      if (bitrateKbps > rule.limit) {
        console.log(`⚠️  Bitrate exceeds limit. Generating Streaming High (${rule.target}kbps)...`);
        const highFilename = `high-${uuidv4()}.mp4`;
        const highPath = await generateStreamingHigh(
          localVideoPath,
          tempDir,
          highFilename,
          rule.target
        );

        streamingHighKey = `videos/${projectId}/${highFilename}`;
        streamingHighUrl = await uploadFile(highPath, streamingHighKey, "video/mp4");
      } else {
        console.log("✅ Original file is optimized. Using as Streaming High.");
        // If original is used, we don't need to generate/upload a new file for streaming high
        // The DB update logic will handle this logic (if streaming_high_url is null, fallback to original)
        // But explicitly, we might want to store the original URL in the streaming_high_url column
        // OR just leave it null and handle it in the player/API.
        // For consistency with the plan "Original First", we can set streamingHighUrl = originalUrl
      }

      // 4. Generate Proxy (Always)
      console.log("🔨 Generating Proxy 720p...");
      const proxyFilename = `proxy-${uuidv4()}.mp4`;
      const proxyPath = await generateProxy(localVideoPath, tempDir, proxyFilename);
      const proxyKey = `proxies/${projectId}/${proxyFilename}`;
      const proxyUrl = await uploadFile(proxyPath, proxyKey, "video/mp4");

      // 5. Generate Thumbnail (Always)
      console.log("🖼️  Generating Thumbnail...");
      const thumbFilename = `thumb-${uuidv4()}.jpg`;
      const thumbPath = await generateThumbnail(localVideoPath, tempDir, thumbFilename);
      const thumbKey = `thumbnails/${projectId}/${thumbFilename}`;
      const thumbUrl = await uploadFile(thumbPath, thumbKey, "image/jpeg");

      // 6. Generate Sprites (Always)
      console.log("🎞️  Generating Sprites...");
      const spriteFilename = `sprite-${uuidv4()}.jpg`;
      const spriteResult = await generateSpriteSheet(localVideoPath, tempDir, spriteFilename, {
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
      });
      const spriteKey = `sprites/${projectId}/${spriteFilename}`;
      const spriteUrl = await uploadFile(spriteResult.spritePath, spriteKey, "image/jpeg");

      const spriteVttFilename = `sprite-${uuidv4()}.vtt`;
      const spriteVttPath = generateSpriteVtt({
        outputDir: tempDir,
        filename: spriteVttFilename,
        spriteUrl: spriteUrl, // Use public URL for VTT
        duration: spriteResult.duration,
        intervalSeconds: spriteResult.intervalSeconds,
        columns: spriteResult.columns,
        thumbWidth: spriteResult.thumbWidth,
        thumbHeight: spriteResult.thumbHeight,
      });
      const spriteVttKey = `sprites/${projectId}/${spriteVttFilename}`;
      const spriteVttUrl = await uploadFile(spriteVttPath, spriteVttKey, "text/vtt");

      // 7. Update Database
      console.log("💾 Updating Database...");
      await query(
        `UPDATE brickreview_videos SET
          proxy_r2_key = $1,
          proxy_url = $2,
          thumbnail_r2_key = $3,
          thumbnail_url = $4,
          sprite_r2_key = $5,
          sprite_url = $6,
          sprite_vtt_url = $7,
          width = $8,
          height = $9,
          fps = $10,
          duration = $11,
          streaming_high_r2_key = $12,
          streaming_high_url = $13,
          status = 'ready',
          updated_at = NOW()
         WHERE id = $14`,
        [
          proxyKey,
          proxyUrl,
          thumbKey,
          thumbUrl,
          spriteKey,
          spriteUrl,
          spriteVttUrl,
          metadata.width,
          metadata.height,
          metadata.fps,
          metadata.duration,
          streamingHighKey,
          streamingHighUrl,
          videoId,
        ]
      );

      console.log("✨ Processing Complete!");
      return { status: "completed" };
    } catch (err) {
      console.error("❌ Job Failed:", err);
      await query("UPDATE brickreview_videos SET status = $1 WHERE id = $2", [
        "failed",
        videoId,
      ]).catch((e) => console.error("Failed to update status:", e));
      throw err;
    } finally {
      // Cleanup
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  },
  {
    connection,
    concurrency: 1,
  }
);

worker.on("completed", (job) => {
  console.log(`🎉 Job ${job.id} has completed!`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} has failed with ${err.message}`);
});

export default worker;
