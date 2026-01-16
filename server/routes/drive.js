import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import googleDriveManager from '../utils/google-drive.js';

const router = express.Router();

/**
 * @route GET /api/drive/auth-url
 * @desc Get OAuth URL for Google Drive authorization
 * @access Public (Temporary for initial setup - REMOVE AFTER CONFIGURATION)
 */
router.get('/auth-url', (req, res) => {
  try {
    const authUrl = googleDriveManager.getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

/**
 * @route GET /api/drive/oauth/callback
 * @desc OAuth callback endpoint for Google Drive
 * @access Public (OAuth flow)
 */
router.get('/oauth/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send('Authorization code not provided');
    }

    const tokens = await googleDriveManager.getTokensFromCode(code);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google Drive Authorization</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background: #0d0d0e;
            color: #fff;
          }
          .success {
            background: #10b981;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .token-box {
            background: #1a1a1b;
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
            word-break: break-all;
            font-family: monospace;
            font-size: 12px;
          }
          h1 { margin-top: 0; }
          .label { color: #9ca3af; font-size: 14px; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <div class="success">
          <h1>✅ Authorization Successful!</h1>
          <p>Google Drive has been authorized. Copy the refresh token below and add it to your environment variables.</p>
        </div>

        <div class="label">Refresh Token (add to GOOGLE_DRIVE_REFRESH_TOKEN):</div>
        <div class="token-box">${tokens.refresh_token}</div>

        <p style="color: #9ca3af; font-size: 14px;">
          After adding this token to your Railway environment variables, restart your server.
        </p>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authorization Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background: #0d0d0e;
            color: #fff;
          }
          .error {
            background: #ef4444;
            padding: 20px;
            border-radius: 8px;
          }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>❌ Authorization Failed</h1>
          <p>${error.message}</p>
        </div>
      </body>
      </html>
    `);
  }
});

/**
 * @route GET /api/drive/status
 * @desc Check if Google Drive is enabled and configured
 * @access Private (Admin only)
 */
router.get('/status', authenticateToken, requireAdmin, (req, res) => {
  try {
    const isEnabled = googleDriveManager.isEnabled();

    res.json({
      enabled: isEnabled,
      configured: isEnabled,
      message: isEnabled
        ? 'Google Drive is enabled and ready'
        : 'Google Drive is not configured. Add credentials to environment variables.',
    });
  } catch (error) {
    console.error('Error checking Drive status:', error);
    res.status(500).json({ error: 'Failed to check Drive status' });
  }
});

export default router;
