import { query } from "../db.js";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import r2Client from "../utils/r2.js";
import googleDriveManager from "../utils/google-drive.js";
import { addVideoJobSafe } from "../queue/index.js";
import { FEATURES } from "../config/features.js";
import { processVideo } from "../../scripts/process-video-metadata.js";
import { buildDownloadFilename, getOriginalFilename } from "../utils/filename.js";
import logger from "../utils/logger.js";

async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

class VideoService {
    async handleUpload({ file, project_id, title, description, folder_id, user_id }) {
        // 1. Upload Original Video to R2
        // Sanitize filename: remove special chars, limit length, keep extension
        const ext = file.originalname.split('.').pop() || 'mp4';
        const sanitizedName = file.originalname
            .replace(/\.[^/.]+$/, '') // remove extension
            .replace(/[^a-zA-Z0-9_-]/g, '_') // replace special chars
            .substring(0, 50); // limit length
        const fileKey = `videos/${project_id}/${uuidv4()}-${sanitizedName}.${ext}`;

        // Upload via Stream
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

        // 2. Create DB Record with status 'ready'
        const result = await query(
            `
      INSERT INTO brickreview_videos (
        project_id, folder_id, title, description, 
        r2_key, r2_url, 
        file_size, mime_type, uploaded_by, 
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ready')
      RETURNING *
    `,
            [
                project_id,
                folder_id,
                title,
                description,
                fileKey,
                r2Url,
                file.size,
                file.mimetype,
                user_id,
            ]
        );

        const video = result.rows[0];

        // 3. Trigger Async Processing (Drive Backup + Queue)
        this.handleAsyncProcessing(video.id, file.path, file.mimetype, fileKey, project_id, title);

        return video;
    }

    // Separated Async Processing Logic
    async handleAsyncProcessing(videoId, filePath, mimeType, r2Key, projectId, title) {
        let shouldCleanup = true;

        // Google Drive Backup
        if (googleDriveManager.isEnabled()) {
            shouldCleanup = false; // Drive needs the file
            (async () => {
                try {
                    // Handle race condition: attempt to read and catch ENOENT
                    let fileBuffer;
                    try {
                        const fileStream = fs.createReadStream(filePath);
                        fileBuffer = await streamToBuffer(fileStream);
                    } catch (readError) {
                        if (readError.code === 'ENOENT') {
                            logger.warn("DRIVE_BACKUP", `File already deleted before backup: ${filePath}`);
                            return;
                        }
                        throw readError;
                    }

                    const driveFile = await googleDriveManager.uploadFile(
                        `${videoId}_${title}.mp4`,
                        fileBuffer,
                        mimeType
                    );

                    await query(
                        `UPDATE brickreview_videos
              SET drive_file_id = $1, drive_backup_date = NOW(), storage_location = 'both'
              WHERE id = $2`,
                        [driveFile.id, videoId]
                    );
                } catch (error) {
                    logger.error("DRIVE_BACKUP", `Failed to backup video ${videoId}`, { error: error.message });
                } finally {
                    if (filePath) {
                        try { await fs.promises.unlink(filePath); } catch (e) { /* file may already be deleted */ }
                    }
                }
            })();
        }

        // Video Processing Queue
        const processData = { r2Key, projectId };
        const runSyncFallback = () => {
            processVideo(videoId).catch((err) => {
                logger.error("VIDEO_PROCESS", `Fatal sync fallback error`, { videoId, error: err.message });
            });
        };

        if (FEATURES.USE_VIDEO_QUEUE && process.env.REDIS_URL) {
            addVideoJobSafe(videoId, processData).catch(() => runSyncFallback());
        } else {
            runSyncFallback();
        }

        // Cleanup if not deferred
        if (shouldCleanup && filePath && fs.existsSync(filePath)) {
            try { await fs.promises.unlink(filePath); } catch (e) { }
        }
    }

    async getStreamUrl(video, quality) {
        const {
            r2_key, r2_url, proxy_r2_key, proxy_url, streaming_high_r2_key, streaming_high_url, mime_type
        } = video;

        let streamKey, streamUrl, isOriginal;

        if (quality === "original") {
            if (streaming_high_url) {
                streamKey = streaming_high_r2_key;
                streamUrl = streaming_high_url;
            } else {
                streamKey = r2_key;
                streamUrl = r2_url;
            }
            isOriginal = true;
        } else {
            streamKey = proxy_r2_key || streaming_high_r2_key || r2_key;
            streamUrl = proxy_url || streaming_high_url || r2_url;
            isOriginal = !proxy_url && !proxy_r2_key;
        }

        if (process.env.R2_PUBLIC_URL && streamUrl && streamUrl.includes(process.env.R2_PUBLIC_URL)) {
            return {
                url: streamUrl,
                mime: isOriginal ? mime_type || "video/mp4" : "video/mp4",
                isProxy: !isOriginal,
            };
        }

        if (!process.env.R2_BUCKET_NAME) {
            throw new Error("R2 Config Missing: R2_BUCKET_NAME environment variable is not set");
        }

        const signedUrl = await getSignedUrl(
            r2Client,
            new GetObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: streamKey,
            }),
            { expiresIn: 60 * 60 * 24 }
        );

        return {
            url: signedUrl,
            isProxy: !isOriginal,
            mime: isOriginal ? mime_type || "video/mp4" : "video/mp4",
        };
    }
}

export const videoService = new VideoService();
