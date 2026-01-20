/**
 * ============================================================================
 * ALERTING SYSTEM - BrickReview
 * ============================================================================
 * 
 * Sistema de alertas para produção.
 * Monitora condições críticas e envia notificações.
 * 
 * Tipos de alertas:
 * - CRITICAL: Sistema inoperante, requer ação imediata
 * - WARNING: Degradação de performance ou recursos
 * - INFO: Eventos importantes para auditoria
 * 
 * Canais de notificação:
 * - Console (desenvolvimento)
 * - Webhook (Slack, Discord, etc)
 * - Email (via Resend - já configurado no projeto)
 */

import { Resend } from 'resend';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const config = {
    // Thresholds para alertas automáticos
    thresholds: {
        errorRate: parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD || '5'), // 5%
        latencyP99: parseInt(process.env.ALERT_LATENCY_P99_THRESHOLD || '2000', 10), // 2000ms
        memoryUsage: parseInt(process.env.ALERT_MEMORY_THRESHOLD || '90', 10), // 90%
        rateLimitHits: parseInt(process.env.ALERT_RATE_LIMIT_THRESHOLD || '100', 10), // 100 hits/min
        authFailures: parseInt(process.env.ALERT_AUTH_FAILURES_THRESHOLD || '50', 10), // 50 failures/min
    },

    // Canais de notificação
    webhookUrl: process.env.ALERT_WEBHOOK_URL, // Slack/Discord webhook
    emailRecipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [],

    // Cooldown para evitar spam de alertas (em ms)
    cooldown: parseInt(process.env.ALERT_COOLDOWN || '300000', 10), // 5 minutos

    // Ambiente
    environment: process.env.NODE_ENV || 'development',
    serviceName: 'brickreview'
};

// Track de alertas enviados (para cooldown)
const alertHistory = new Map();

// Resend client (opcional - só se configurado)
let resendClient = null;
if (process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
}

// ============================================================================
// TIPOS DE ALERTA
// ============================================================================

export const AlertLevel = {
    CRITICAL: 'CRITICAL',
    WARNING: 'WARNING',
    INFO: 'INFO'
};

// ============================================================================
// FUNÇÕES PRINCIPAIS
// ============================================================================

/**
 * Envia um alerta
 * @param {string} level - AlertLevel (CRITICAL, WARNING, INFO)
 * @param {string} title - Título do alerta
 * @param {object} details - Detalhes do alerta
 * @param {boolean} forceSend - Ignora cooldown
 */
export async function sendAlert(level, title, details = {}, forceSend = false) {
    const alertKey = `${level}:${title}`;
    const now = Date.now();

    // Verifica cooldown (exceto para CRITICAL ou forceSend)
    if (!forceSend && level !== AlertLevel.CRITICAL) {
        const lastSent = alertHistory.get(alertKey);
        if (lastSent && (now - lastSent) < config.cooldown) {
            return { sent: false, reason: 'cooldown' };
        }
    }

    // Registra o alerta
    alertHistory.set(alertKey, now);

    const alert = {
        timestamp: new Date().toISOString(),
        level,
        title,
        service: config.serviceName,
        environment: config.environment,
        details
    };

    // Log local sempre
    logAlert(alert);

    // Notificações externas
    const results = {
        console: true,
        webhook: false,
        email: false
    };

    // Webhook (Slack/Discord)
    if (config.webhookUrl) {
        try {
            await sendWebhook(alert);
            results.webhook = true;
        } catch (error) {
            console.error('[ALERT] Webhook failed:', error.message);
        }
    }

    // Email (apenas para CRITICAL)
    if (level === AlertLevel.CRITICAL && resendClient && config.emailRecipients.length > 0) {
        try {
            await sendEmail(alert);
            results.email = true;
        } catch (error) {
            console.error('[ALERT] Email failed:', error.message);
        }
    }

    return { sent: true, results };
}

// ============================================================================
// ALERTAS PRÉ-DEFINIDOS
// ============================================================================

/**
 * Alerta de sistema inoperante
 */
export async function alertSystemDown(service, error) {
    return sendAlert(AlertLevel.CRITICAL, `🚨 ${service} DOWN`, {
        service,
        error: error?.message || error,
        action: 'Verificar logs e reiniciar serviço'
    }, true);
}

/**
 * Alerta de alta taxa de erros
 */
export async function alertHighErrorRate(errorRate, threshold) {
    return sendAlert(AlertLevel.WARNING, '⚠️ Alta Taxa de Erros', {
        currentRate: `${errorRate.toFixed(2)}%`,
        threshold: `${threshold}%`,
        action: 'Verificar logs de erro recentes'
    });
}

/**
 * Alerta de latência alta
 */
export async function alertHighLatency(p99, threshold) {
    return sendAlert(AlertLevel.WARNING, '⚠️ Latência Alta', {
        p99: `${p99}ms`,
        threshold: `${threshold}ms`,
        action: 'Verificar queries lentas e recursos do servidor'
    });
}

/**
 * Alerta de uso de memória alto
 */
export async function alertHighMemoryUsage(usage, threshold) {
    return sendAlert(AlertLevel.WARNING, '⚠️ Uso de Memória Alto', {
        current: `${usage}%`,
        threshold: `${threshold}%`,
        action: 'Considerar escalar ou reiniciar o serviço'
    });
}

/**
 * Alerta de muitos hits de rate limiting
 */
export async function alertRateLimitingSpike(hits, routes) {
    return sendAlert(AlertLevel.WARNING, '🛡️ Rate Limiting Spike', {
        totalHits: hits,
        topRoutes: routes,
        action: 'Investigar possível ataque ou bot'
    });
}

/**
 * Alerta de muitas falhas de autenticação
 */
export async function alertAuthFailuresSpike(failures) {
    return sendAlert(AlertLevel.WARNING, '🔐 Auth Failures Spike', {
        failures,
        action: 'Investigar possível tentativa de brute-force'
    });
}

/**
 * Alerta de database desconectado
 */
export async function alertDatabaseDown(error) {
    return sendAlert(AlertLevel.CRITICAL, '🔴 Database Desconectado', {
        error: error?.message || error,
        action: 'Verificar conexão com PostgreSQL'
    }, true);
}

/**
 * Alerta de Redis desconectado
 */
export async function alertRedisDown(error) {
    return sendAlert(AlertLevel.WARNING, '🟠 Redis Desconectado', {
        error: error?.message || error,
        action: 'Verificar conexão com Redis (cache degradado)'
    });
}

/**
 * Alerta de deploy/rollback
 */
export async function alertDeployment(version, action) {
    return sendAlert(AlertLevel.INFO, `🚀 ${action}`, {
        version,
        action,
        timestamp: new Date().toISOString()
    }, true);
}

// ============================================================================
// CANAIS DE NOTIFICAÇÃO
// ============================================================================

/**
 * Log local formatado
 */
function logAlert(alert) {
    const emoji = {
        [AlertLevel.CRITICAL]: '🚨',
        [AlertLevel.WARNING]: '⚠️',
        [AlertLevel.INFO]: 'ℹ️'
    }[alert.level] || '📢';

    if (config.environment === 'production') {
        // Log estruturado para produção
        console.log(JSON.stringify({
            ...alert,
            _type: 'alert'
        }));
    } else {
        // Log legível para desenvolvimento
        console.log(`\n${emoji} [ALERT] ${alert.level}: ${alert.title}`);
        console.log(`   Environment: ${alert.environment}`);
        console.log(`   Time: ${alert.timestamp}`);
        if (Object.keys(alert.details).length > 0) {
            console.log(`   Details:`, alert.details);
        }
        console.log('');
    }
}

/**
 * Envia para webhook (Slack/Discord)
 */
async function sendWebhook(alert) {
    const color = {
        [AlertLevel.CRITICAL]: '#FF0000',  // Red
        [AlertLevel.WARNING]: '#FFA500',   // Orange
        [AlertLevel.INFO]: '#0000FF'       // Blue
    }[alert.level] || '#808080';

    const payload = {
        // Formato compatível com Slack
        attachments: [{
            color,
            title: alert.title,
            fields: [
                { title: 'Service', value: alert.service, short: true },
                { title: 'Environment', value: alert.environment, short: true },
                { title: 'Level', value: alert.level, short: true },
                { title: 'Time', value: alert.timestamp, short: true },
                ...Object.entries(alert.details).map(([key, value]) => ({
                    title: key.charAt(0).toUpperCase() + key.slice(1),
                    value: String(value),
                    short: true
                }))
            ],
            footer: 'BrickReview Alert System'
        }]
    };

    const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
    }
}

/**
 * Envia email (via Resend)
 */
async function sendEmail(alert) {
    if (!resendClient || config.emailRecipients.length === 0) {
        return;
    }

    const html = `
        <h2 style="color: #FF0000;">🚨 ${alert.title}</h2>
        <p><strong>Service:</strong> ${alert.service}</p>
        <p><strong>Environment:</strong> ${alert.environment}</p>
        <p><strong>Time:</strong> ${alert.timestamp}</p>
        <h3>Details:</h3>
        <pre style="background: #f4f4f4; padding: 10px; border-radius: 4px;">
${JSON.stringify(alert.details, null, 2)}
        </pre>
        <hr>
        <p style="color: #666; font-size: 12px;">BrickReview Alert System</p>
    `;

    await resendClient.emails.send({
        from: 'alerts@brickreview.com',
        to: config.emailRecipients,
        subject: `[${alert.level}] ${alert.title} - ${alert.service}`,
        html
    });
}

// ============================================================================
// MONITOR AUTOMÁTICO
// ============================================================================

/**
 * Inicia monitoramento automático
 * Verifica métricas periodicamente e envia alertas se necessário
 */
export function startAutoMonitor(getMetrics, intervalMs = 60000) {
    console.log('[ALERT] Auto-monitor started');

    return setInterval(async () => {
        try {
            const metrics = getMetrics();

            // Verifica taxa de erro
            const errorRate = parseFloat(metrics.requests.errorRate) || 0;
            if (errorRate > config.thresholds.errorRate) {
                await alertHighErrorRate(errorRate, config.thresholds.errorRate);
            }

            // Verifica latência
            if (metrics.latency.p99 > config.thresholds.latencyP99) {
                await alertHighLatency(metrics.latency.p99, config.thresholds.latencyP99);
            }

            // Verifica memória
            const memUsage = parseInt(metrics.resources?.memory?.heapUsed) || 0;
            const memTotal = parseInt(metrics.resources?.memory?.heapTotal) || 100;
            const memPercent = Math.round((memUsage / memTotal) * 100);
            if (memPercent > config.thresholds.memoryUsage) {
                await alertHighMemoryUsage(memPercent, config.thresholds.memoryUsage);
            }

            // Verifica rate limiting (por minuto)
            if (metrics.security.rateLimitHits > config.thresholds.rateLimitHits) {
                await alertRateLimitingSpike(
                    metrics.security.rateLimitHits,
                    metrics.security.rateLimitByRoute
                );
            }

            // Verifica falhas de auth
            if (metrics.security.authFailures > config.thresholds.authFailures) {
                await alertAuthFailuresSpike(metrics.security.authFailures);
            }

        } catch (error) {
            console.error('[ALERT] Auto-monitor error:', error.message);
        }
    }, intervalMs);
}

export default {
    AlertLevel,
    sendAlert,
    alertSystemDown,
    alertHighErrorRate,
    alertHighLatency,
    alertHighMemoryUsage,
    alertRateLimitingSpike,
    alertAuthFailuresSpike,
    alertDatabaseDown,
    alertRedisDown,
    alertDeployment,
    startAutoMonitor
};
