/**
 * ============================================================================
 * MONITORING UTILITIES - BrickReview
 * ============================================================================
 * 
 * Sistema de monitoramento e métricas para produção.
 * Coleta métricas de performance, saúde do sistema e eventos críticos.
 * 
 * Funcionalidades:
 * - Métricas de requisições (latência, throughput, erros)
 * - Métricas de recursos (memória, CPU, conexões DB)
 * - Eventos de segurança (rate limiting, auth failures)
 * - Health checks automatizados
 * 
 * Integração:
 * - Logs estruturados para CloudWatch/Datadog/etc
 * - Formato compatível com Prometheus/Grafana
 * - Webhook para alertas externos
 */

import { pool } from '../db.js';
import cache from './cache.js';

// ============================================================================
// MÉTRICAS EM MEMÓRIA
// ============================================================================

const metrics = {
    requests: {
        total: 0,
        success: 0,
        errors: 0,
        byRoute: new Map(),
        byStatusCode: new Map()
    },
    latency: {
        samples: [],
        maxSamples: 1000 // Mantém últimas 1000 amostras
    },
    rateLimiting: {
        hits: 0,
        byRoute: new Map()
    },
    auth: {
        successfulLogins: 0,
        failedLogins: 0,
        tokenRefreshes: 0
    },
    uploads: {
        total: 0,
        success: 0,
        rejected: 0,
        totalBytes: 0
    },
    errors: {
        total: 0,
        byType: new Map(),
        recent: [] // Últimos 50 erros
    },
    startTime: Date.now()
};

// ============================================================================
// FUNÇÕES DE COLETA
// ============================================================================

/**
 * Registra uma requisição
 */
export function recordRequest(route, method, statusCode, latencyMs) {
    metrics.requests.total++;

    if (statusCode < 400) {
        metrics.requests.success++;
    } else {
        metrics.requests.errors++;
    }

    // Por rota
    const routeKey = `${method} ${route}`;
    metrics.requests.byRoute.set(
        routeKey,
        (metrics.requests.byRoute.get(routeKey) || 0) + 1
    );

    // Por status code
    metrics.requests.byStatusCode.set(
        statusCode,
        (metrics.requests.byStatusCode.get(statusCode) || 0) + 1
    );

    // Latência
    metrics.latency.samples.push(latencyMs);
    if (metrics.latency.samples.length > metrics.latency.maxSamples) {
        metrics.latency.samples.shift();
    }
}

/**
 * Registra hit de rate limiting
 */
export function recordRateLimitHit(route, ip, userId = null) {
    metrics.rateLimiting.hits++;
    metrics.rateLimiting.byRoute.set(
        route,
        (metrics.rateLimiting.byRoute.get(route) || 0) + 1
    );

    // Log estruturado para alertas
    logSecurityEvent('RATE_LIMIT_HIT', {
        route,
        ip: sanitizeIP(ip),
        userId,
        timestamp: new Date().toISOString()
    });
}

/**
 * Registra evento de autenticação
 */
export function recordAuthEvent(type, userId = null, metadata = {}) {
    switch (type) {
        case 'login_success':
            metrics.auth.successfulLogins++;
            break;
        case 'login_failure':
            metrics.auth.failedLogins++;
            logSecurityEvent('AUTH_FAILURE', { userId, ...metadata });
            break;
        case 'token_refresh':
            metrics.auth.tokenRefreshes++;
            break;
    }
}

/**
 * Registra upload
 */
export function recordUpload(success, sizeBytes = 0, reason = null) {
    metrics.uploads.total++;

    if (success) {
        metrics.uploads.success++;
        metrics.uploads.totalBytes += sizeBytes;
    } else {
        metrics.uploads.rejected++;
        logSecurityEvent('UPLOAD_REJECTED', { reason, sizeBytes });
    }
}

/**
 * Registra erro
 */
export function recordError(errorType, message, _stack = null) {
    metrics.errors.total++;

    metrics.errors.byType.set(
        errorType,
        (metrics.errors.byType.get(errorType) || 0) + 1
    );

    // Mantém últimos 50 erros
    metrics.errors.recent.push({
        type: errorType,
        message,
        timestamp: new Date().toISOString()
    });

    if (metrics.errors.recent.length > 50) {
        metrics.errors.recent.shift();
    }
}

// ============================================================================
// HEALTH CHECKS
// ============================================================================

/**
 * Verifica saúde do sistema
 */
export async function getSystemHealth() {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
        checks: {}
    };

    // Check Database
    try {
        if (pool) {
            const start = Date.now();
            await pool.query('SELECT 1');
            health.checks.database = {
                status: 'healthy',
                latency: `${Date.now() - start}ms`
            };
        } else {
            health.checks.database = { status: 'disabled' };
        }
    } catch (error) {
        health.status = 'degraded';
        health.checks.database = {
            status: 'unhealthy',
            error: error.message
        };
    }

    // Check Redis
    try {
        const redis = cache.getClient();
        if (redis) {
            const start = Date.now();
            await redis.ping();
            health.checks.redis = {
                status: 'healthy',
                latency: `${Date.now() - start}ms`
            };
        } else {
            health.checks.redis = { status: 'disabled' };
        }
    } catch (error) {
        health.checks.redis = {
            status: 'unhealthy',
            error: error.message
        };
    }

    // Check Memory
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const memoryPercent = Math.round((heapUsedMB / heapTotalMB) * 100);

    health.checks.memory = {
        status: memoryPercent > 90 ? 'warning' : 'healthy',
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${heapTotalMB}MB`,
        usage: `${memoryPercent}%`
    };

    if (memoryPercent > 90) {
        health.status = 'degraded';
    }

    return health;
}

// ============================================================================
// MÉTRICAS AGREGADAS
// ============================================================================

/**
 * Retorna métricas agregadas para dashboards
 */
export function getMetrics() {
    const samples = metrics.latency.samples;
    const sortedSamples = [...samples].sort((a, b) => a - b);

    const percentile = (arr, p) => {
        if (arr.length === 0) return 0;
        const index = Math.ceil((p / 100) * arr.length) - 1;
        return arr[Math.max(0, index)];
    };

    return {
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - metrics.startTime) / 1000),

        requests: {
            total: metrics.requests.total,
            success: metrics.requests.success,
            errors: metrics.requests.errors,
            errorRate: metrics.requests.total > 0
                ? ((metrics.requests.errors / metrics.requests.total) * 100).toFixed(2) + '%'
                : '0%',
            topRoutes: Object.fromEntries(
                [...metrics.requests.byRoute.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
            ),
            statusCodes: Object.fromEntries(metrics.requests.byStatusCode)
        },

        latency: {
            samples: samples.length,
            avg: samples.length > 0
                ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
                : 0,
            p50: percentile(sortedSamples, 50),
            p95: percentile(sortedSamples, 95),
            p99: percentile(sortedSamples, 99),
            max: samples.length > 0 ? Math.max(...samples) : 0
        },

        security: {
            rateLimitHits: metrics.rateLimiting.hits,
            rateLimitByRoute: Object.fromEntries(metrics.rateLimiting.byRoute),
            authFailures: metrics.auth.failedLogins,
            successfulLogins: metrics.auth.successfulLogins
        },

        uploads: {
            total: metrics.uploads.total,
            success: metrics.uploads.success,
            rejected: metrics.uploads.rejected,
            totalBytes: metrics.uploads.totalBytes,
            successRate: metrics.uploads.total > 0
                ? ((metrics.uploads.success / metrics.uploads.total) * 100).toFixed(2) + '%'
                : '0%'
        },

        errors: {
            total: metrics.errors.total,
            byType: Object.fromEntries(metrics.errors.byType),
            recent: metrics.errors.recent.slice(-10)
        },

        resources: getResourceUsage()
    };
}

/**
 * Uso de recursos do sistema
 */
function getResourceUsage() {
    const memoryUsage = process.memoryUsage();

    return {
        memory: {
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
            external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB',
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB'
        },
        uptime: process.uptime()
    };
}

// ============================================================================
// LOGGING ESTRUTURADO
// ============================================================================

/**
 * Log de evento de segurança
 */
function logSecurityEvent(type, data) {
    const event = {
        timestamp: new Date().toISOString(),
        type,
        level: 'security',
        ...data
    };

    // Em produção, enviar para sistema de logs externo
    if (process.env.NODE_ENV === 'production') {
        console.log(JSON.stringify(event));
    } else {
        console.log(`[SECURITY] ${type}:`, data);
    }
}

/**
 * Sanitiza IP para logs (proteção de privacidade)
 */
function sanitizeIP(ip) {
    if (!ip) return 'unknown';

    // Para IPv4, mantém os 3 primeiros octetos
    if (ip.includes('.') && !ip.includes(':')) {
        const parts = ip.split('.');
        return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }

    // Para IPv6, mantém os primeiros 4 grupos
    if (ip.includes(':')) {
        const parts = ip.split(':');
        return parts.slice(0, 4).join(':') + '::xxxx';
    }

    return ip;
}

// ============================================================================
// MIDDLEWARE PARA COLETA AUTOMÁTICA
// ============================================================================

/**
 * Middleware para coletar métricas automaticamente
 */
export function metricsMiddleware(req, res, next) {
    const startTime = Date.now();

    res.on('finish', () => {
        const latency = Date.now() - startTime;
        const route = req.route?.path || req.path;

        recordRequest(route, req.method, res.statusCode, latency);
    });

    next();
}

// ============================================================================
// RESET (para testes)
// ============================================================================

export function resetMetrics() {
    metrics.requests = { total: 0, success: 0, errors: 0, byRoute: new Map(), byStatusCode: new Map() };
    metrics.latency = { samples: [], maxSamples: 1000 };
    metrics.rateLimiting = { hits: 0, byRoute: new Map() };
    metrics.auth = { successfulLogins: 0, failedLogins: 0, tokenRefreshes: 0 };
    metrics.uploads = { total: 0, success: 0, rejected: 0, totalBytes: 0 };
    metrics.errors = { total: 0, byType: new Map(), recent: [] };
    metrics.startTime = Date.now();
}

export default {
    recordRequest,
    recordRateLimitHit,
    recordAuthEvent,
    recordUpload,
    recordError,
    getSystemHealth,
    getMetrics,
    metricsMiddleware,
    resetMetrics
};
