import { GetObjectCommand, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

/**
 * Uploads a thumbnail buffer to R2 for a Google Drive file
 * @param {Buffer} thumbnailBuffer - The JPEG thumbnail buffer
 * @param {string} driveFileId - The Google Drive file ID
 * @returns {string} The public URL of the thumbnail
 */
export const uploadDriveThumbnail = async (thumbnailBuffer, driveFileId) => {
  try {
    const key = `drive-thumbs/${driveFileId}.jpg`;
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg',
    });

    await r2Client.send(command);
    console.log(`🖼️ Uploaded Drive thumbnail: ${key}`);
    return `${process.env.R2_PUBLIC_URL}/${key}`;
  } catch (error) {
    console.error(`❌ Error uploading Drive thumbnail:`, error);
    throw error;
  }
};

/**
 * Checks if an object exists in R2
 * @param {string} key - R2 object key
 * @returns {boolean} True if object exists, false otherwise
 */
export const checkR2ObjectExists = async (key) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });
    await r2Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
};

/**
 * Deletes a Drive thumbnail from R2
 * @param {string} driveFileId - The Google Drive file ID
 * @returns {boolean} True if deleted, false if not found
 */
export const deleteDriveThumbnail = async (driveFileId) => {
  try {
    const key = `drive-thumbs/${driveFileId}.jpg`;
    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });
    await r2Client.send(command);
    console.log(`🗑️ Deleted Drive thumbnail: ${key}`);
    return true;
  } catch (error) {
    console.log(`ℹ️ No Drive thumbnail to delete for ${driveFileId}`);
    return false;
  }
};
