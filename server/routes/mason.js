import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { masonService } from '../services/masonService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import logger from '../utils/logger.js';

const router = express.Router();

// POST /api/mason/chat
router.post('/chat', authenticateToken, asyncHandler(async (req, res) => {
    const { message, history, context } = req.body;
    const user = req.user;

    if (!message) {
        return res.status(400).json({ error: "Message required" });
    }

    try {
        const response = await masonService.processMessage(
            history || [],
            message,
            { ...context, userId: user.id }
        );

        res.json({ response });
    } catch (error) {
        logger.error('MASON_ROUTE', 'Chat error', { error: error.message });
        res.status(500).json({
            error: "System Failure",
            message: error.message
        });
    }
}));

export default router;
