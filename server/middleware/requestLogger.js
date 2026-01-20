import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
    req.id = uuidv4();
    const start = Date.now();

    // Log request start
    logger.info('HTTP', `Incoming ${req.method} ${req.url}`, {
        requestId: req.id,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });

    // Intercept response finish to log completion
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP', `Completed ${req.method} ${req.url} ${res.statusCode}`, {
            requestId: req.id,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            contentLength: res.get('content-length')
        });
    });

    next();
};
