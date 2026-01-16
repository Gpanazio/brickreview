import { google } from 'googleapis';
import dotenv from 'dotenv';
import { Readable } from 'stream';

dotenv.config();

/**
 * Google Drive Manager for Legacy Storage
 */
class GoogleDriveManager {
  constructor() {
    this.enabled = process.env.GOOGLE_DRIVE_ENABLED === 'true';
    this.drive = null;
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    this.limit = parseInt(process.env.GOOGLE_DRIVE_LIMIT || '21474836480000'); // 20TB default

    if (this.enabled) {
      this.initializeDrive();
    }
  }

  initializeDrive() {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_DRIVE_CLIENT_ID,
        process.env.GOOGLE_DRIVE_CLIENT_SECRET,
        process.env.GOOGLE_DRIVE_REDIRECT_URI
      );

      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
      });

      this.drive = google.drive({ version: 'v3', auth: oauth2Client });
      console.log('✅ Google Drive initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive:', error);
      this.enabled = false;
    }
  }

  /**
   * Check if Google Drive is enabled and configured
   */
  isEnabled() {
    return this.enabled && this.drive !== null;
  }

  /**
   * Upload file to Google Drive
   */
  async uploadFile(fileName, fileBuffer, mimeType, parentId = null) {
    if (!this.isEnabled()) {
      throw new Error('Google Drive is not enabled');
    }

    try {
      const fileMetadata = {
        name: fileName,
        parents: [parentId || this.folderId],
      };

      const media = {
        mimeType: mimeType,
        body: Readable.from(fileBuffer),
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, size, webViewLink, webContentLink',
      });

      console.log(`✅ Uploaded to Drive: ${fileName} (${response.data.id})`);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to upload to Google Drive:', error);
      throw error;
    }
  }

  /**
   * Download file from Google Drive
   */
  async downloadFile(fileId) {
    if (!this.isEnabled()) {
      throw new Error('Google Drive is not enabled');
    }

    try {
      const response = await this.drive.files.get(
        {
          fileId: fileId,
          alt: 'media',
        },
        { responseType: 'stream' }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Failed to download from Google Drive:', error);
      throw error;
    }
  }

  /**
   * Get file metadata from Google Drive
   */
  async getFileMetadata(fileId) {
    if (!this.isEnabled()) {
      throw new Error('Google Drive is not enabled');
    }

    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, size, mimeType, createdTime, modifiedTime, webViewLink',
      });

      return response.data;
    } catch (error) {
      console.error('❌ Failed to get file metadata:', error);
      throw error;
    }
  }

  /**
   * Delete file from Google Drive
   */
  async deleteFile(fileId) {
    if (!this.isEnabled()) {
      throw new Error('Google Drive is not enabled');
    }

    try {
      await this.drive.files.delete({
        fileId: fileId,
      });

      console.log(`✅ Deleted from Drive: ${fileId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete from Google Drive:', error);
      throw error;
    }
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(name, parentId = null) {
    if (!this.isEnabled()) {
      throw new Error('Google Drive is not enabled');
    }

    try {
      const fileMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId || this.folderId],
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id, name, size, mimeType, createdTime',
      });

      console.log(`✅ Created Folder: ${name} (${response.data.id})`);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to create folder in Google Drive:', error);
      throw error;
    }
  }

  /**
   * Move a file or folder to a new parent folder
   */
  async moveFile(fileId, newParentId) {
    if (!this.isEnabled()) {
      throw new Error('Google Drive is not enabled');
    }

    try {
      // Retrieve the existing parents to remove
      const file = await this.drive.files.get({
        fileId: fileId,
        fields: 'parents',
      });

      const previousParents = file.data.parents.join(',');
      const response = await this.drive.files.update({
        fileId: fileId,
        addParents: newParentId,
        removeParents: previousParents,
        fields: 'id, parents',
      });

      console.log(`✅ Moved file ${fileId} to ${newParentId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to move file in Google Drive:', error);
      throw error;
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats() {
    if (!this.isEnabled()) {
      return {
        enabled: false,
        used: 0,
        limit: this.limit,
        available: this.limit,
        usedPercentage: 0,
        objectCount: 0,
      };
    }

    try {
      // Get folder contents
      const response = await this.drive.files.list({
        q: `'${this.folderId}' in parents and trashed=false`,
        fields: 'files(id, name, size)',
        pageSize: 1000,
      });

      const files = response.data.files || [];
      const totalSize = files.reduce((sum, file) => sum + (parseInt(file.size) || 0), 0);

      return {
        enabled: true,
        used: totalSize,
        limit: this.limit,
        available: this.limit - totalSize,
        usedPercentage: (totalSize / this.limit) * 100,
        objectCount: files.length,
      };
    } catch (error) {
      console.error('❌ Failed to get Drive storage stats:', error);
      return {
        enabled: true,
        error: error.message,
        used: 0,
        limit: this.limit,
        available: this.limit,
        usedPercentage: 0,
        objectCount: 0,
      };
    }
  }

  /**
   * List files in the configured folder or subfolder
   */
  async listFiles(pageSize = 100, pageToken = null, folderId = null) {
    if (!this.isEnabled()) {
      throw new Error('Google Drive is not enabled');
    }

    try {
      const parent = folderId || this.folderId;
      const response = await this.drive.files.list({
        q: `'${parent}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, size, mimeType, createdTime, modifiedTime)',
        pageSize: pageSize,
        pageToken: pageToken,
        orderBy: 'folder, createdTime desc',
      });

      return {
        files: response.data.files || [],
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error) {
      console.error('❌ Failed to list files:', error);
      throw error;
    }
  }

  /**
   * Generate OAuth URL for initial setup
   */
  getAuthUrl() {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      process.env.GOOGLE_DRIVE_REDIRECT_URI
    );

    const scopes = ['https://www.googleapis.com/auth/drive.file'];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });

    return url;
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      process.env.GOOGLE_DRIVE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  }
}

// Export singleton instance
const googleDriveManager = new GoogleDriveManager();
export default googleDriveManager;
