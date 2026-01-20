import Redis from 'ioredis';
import logger from './logger.js';

let redis = null;
let connectionFailed = false;

if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
        retryStrategy(times) {
            if (times > 3) {
                connectionFailed = true;
                return null; // Stop retrying
            }
            const delay = Math.min(times * 100, 2000);
            return delay;
        },
        lazyConnect: true,
    });

    redis.on('error', () => {
        // Suppress - errors are expected when Redis is not available
    });

    redis.on('connect', () => {
        connectionFailed = false;
        logger.info('REDIS', 'Connected to Redis (cache)');
    });

    // Try to connect silently
    redis.connect().catch(() => {
        connectionFailed = true;
        logger.warn('REDIS', 'Redis not available, cache disabled');
    });
} else {
    logger.info('REDIS', 'REDIS_URL not set, cache disabled');
}

export const cache = {
    async get(key) {
        if (!redis || connectionFailed) return null;
        try {
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    async set(key, value, ttlSeconds = 300) {
        if (!redis || connectionFailed) return null;
        try {
            await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        } catch {
            // Silently fail - cache is optional
        }
    },

    async del(key) {
        if (!redis || connectionFailed) return null;
        try {
            await redis.del(key);
        } catch {
            // Silently fail
        }
    },

    async flushPattern(pattern) {
        if (!redis || connectionFailed) return null;
        try {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(keys);
            }
        } catch {
            // Silently fail
        }
    },

    getClient() {
        if (connectionFailed) return null;
        return redis;
    },

    isAvailable() {
        return redis && !connectionFailed;
    }
};

export default cache;
