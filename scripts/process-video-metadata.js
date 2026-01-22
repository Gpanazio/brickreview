import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import {
  getVideoMetadata,
  generateThumbnail,
  generateSpriteSheet,
  generateSpriteVtt,
} from "../server/utils/video.js";
import { query } from "../server/db.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import r2Client from "../server/utils/r2.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Download file from URL
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to download: ${response.statusCode}`));
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => { }); // Delete file on error
        reject(err);
      });
  });
}

export async function processVideo(videoId) {
  try {
    console.log(`\n📹 Processing video ID: ${videoId}`);

    // Get video from database
    const result = await query(
      "SELECT id, title, r2_url, r2_key FROM brickreview_videos WHERE id = $1",
      [videoId]
    );

    if (result.rows.length === 0) {
      throw new Error("Video not found");
    }

    const video = result.rows[0];
    console.log(`📥 Downloading: ${video.title}`);

    // Download video temporarily
    const tempDir = path.join(__dirname, "../temp-processing");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const videoPath = path.join(tempDir, `video-${videoId}.mov`);
    await downloadFile(video.r2_url, videoPath);
    console.log(`✅ Downloaded to: ${videoPath}`);

    // Extract metadata
    console.log(`📊 Extracting metadata...`);
    const metadata = await getVideoMetadata(videoPath);
    console.log(
      `   Duration: ${Math.floor(metadata.duration / 60)}:${Math.floor(metadata.duration % 60)
        .toString()
        .padStart(2, "0")}`
    );
    console.log(`   Resolution: ${metadata.width}x${metadata.height}`);
    console.log(`   FPS: ${metadata.fps}`);

    // Generate thumbnail
    console.log(`🖼️  Generating thumbnail...`);
    const thumbFilename = `thumb-${Date.now()}.jpg`;
    const thumbPath = await generateThumbnail(videoPath, tempDir, thumbFilename);
    console.log(`✅ Thumbnail generated: ${thumbPath}`);

    // Upload thumbnail to R2
    console.log(`☁️  Uploading thumbnail to R2...`);
    const thumbKey = `thumbnails/${videoId}/${thumbFilename}`;
    const thumbContent = fs.readFileSync(thumbPath);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: thumbKey,
        Body: thumbContent,
        ContentType: "image/jpeg",
      })
    );

    const thumbnailUrl = `${process.env.R2_PUBLIC_URL}/${thumbKey}`;
    console.log(`✅ Thumbnail uploaded: ${thumbnailUrl}`);

    // Generate Sprite Sheet (VTT)
    console.log(`🎞️  Generating sprite sheet...`);
    const spriteFilename = `sprite-${Date.now()}.jpg`;
    const vttFilename = `sprite-${Date.now()}.vtt`;

    // Configurações do sprite
    const spriteOptions = {
      intervalSeconds: 2, // Um frame a cada 2 segundos
      thumbWidth: 160,    // Largura de cada miniatura
      columns: 5,        // 5 colunas no sprite sheet
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height
    };

    const spriteResult = await generateSpriteSheet(videoPath, tempDir, spriteFilename, spriteOptions);
    console.log(`✅ Sprite sheet generated: ${spriteResult.spritePath}`);

    // Gera o VTT
    // Precisamos da URL pública do sprite para o VTT
    const spriteKey = `sprites/${videoId}/${spriteFilename}`;
    const spriteUrl = `${process.env.R2_PUBLIC_URL}/${spriteKey}`;

    const vttPath = generateSpriteVtt({
      outputDir: tempDir,
      filename: vttFilename,
      spriteUrl: spriteUrl,
      ...spriteResult
    });
    console.log(`✅ VTT generated: ${vttPath}`);

    // Upload Sprite Sheet to R2
    console.log(`☁️  Uploading sprite sheet to R2...`);
    const spriteContent = fs.readFileSync(spriteResult.spritePath);
    await r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: spriteKey,
        Body: spriteContent,
        ContentType: "image/jpeg",
      })
    );
    console.log(`✅ Sprite sheet uploaded: ${spriteUrl}`);

    // Upload VTT to R2
    console.log(`☁️  Uploading VTT to R2...`);
    const vttKey = `sprites/${videoId}/${vttFilename}`;
    const vttContent = fs.readFileSync(vttPath);
    await r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: vttKey,
        Body: vttContent,
        ContentType: "text/vtt",
      })
    );
    const vttUrl = `${process.env.R2_PUBLIC_URL}/${vttKey}`;
    console.log(`✅ VTT uploaded: ${vttUrl}`);

    // Update database
    console.log(`💾 Updating database...`);
    await query(
      `UPDATE brickreview_videos
       SET duration = $1, width = $2, height = $3, fps = $4,
           thumbnail_r2_key = $5, thumbnail_url = $6,
           sprite_sheet_r2_key = $7, sprite_sheet_url = $8,
           sprite_vtt_r2_key = $9, sprite_vtt_url = $10
       WHERE id = $11`,
      [
        metadata.duration,
        metadata.width,
        metadata.height,
        metadata.fps,
        thumbKey,
        thumbnailUrl,
        spriteKey,
        spriteUrl,
        vttKey,
        vttUrl,
        videoId,
      ]
    );
    console.log(`✅ Database updated!`);

    // Cleanup
    console.log(`🧹 Cleaning up...`);
    fs.unlinkSync(videoPath);
    fs.unlinkSync(thumbPath);
    if (fs.existsSync(spriteResult.spritePath)) fs.unlinkSync(spriteResult.spritePath);
    if (fs.existsSync(vttPath)) fs.unlinkSync(vttPath);
    console.log(`✅ Video ${videoId} processed successfully!\n`);
  } catch (error) {
    console.error(`❌ Error processing video ${videoId}:`, error);
    throw error;
  }
}

// Main
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const videoId = process.argv[2];
  if (!videoId) {
    console.error("Usage: node process-video-metadata.js <video_id>");
    process.exit(1);
  }

  processVideo(videoId)
    .then(() => {
      console.log("✅ All done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Failed:", error);
      process.exit(1);
    });
}
