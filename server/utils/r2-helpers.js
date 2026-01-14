import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import { pipeline } from "stream/promises";
import r2Client from "./r2.js";

/**
 * Downloads a file from R2 to a local path
 * @param {string} key - R2 object key
 * @param {string} localPath - Local destination path
 */
export const downloadFile = async (key, localPath) => {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    const response = await r2Client.send(command);
    await pipeline(response.Body, fs.createWriteStream(localPath));
    console.log(`⬇️ Downloaded ${key} to ${localPath}`);
  } catch (error) {
    console.error(`❌ Error downloading ${key}:`, error);
    throw error;
  }
};

/**
 * Uploads a local file to R2
 * @param {string} localPath - Local file path
 * @param {string} key - R2 destination key
 * @param {string} contentType - MIME type
 */
export const uploadFile = async (localPath, key, contentType) => {
  try {
    const fileStream = fs.createReadStream(localPath);
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: fileStream,
      ContentType: contentType,
    });

    await r2Client.send(command);
    console.log(`⬆️ Uploaded ${localPath} to ${key}`);
    return `${process.env.R2_PUBLIC_URL}/${key}`;
  } catch (error) {
    console.error(`❌ Error uploading ${key}:`, error);
    throw error;
  }
};
