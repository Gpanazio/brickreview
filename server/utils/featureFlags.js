/**
 * Feature Flags - BrickReview
 * 
 * Configuração dinâmica de funcionalidades sem deploy.
 * Variáveis de ambiente controlam features em produção.
 */

const flags = {
    // Rate Limiting
    RATE_LIMITING_ENABLED: process.env.RATE_LIMITING_ENABLED !== 'false',
    RATE_LIMIT_AUTH_MAX: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5', 10),
    RATE_LIMIT_AUTH_WINDOW_MS: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '900000', 10),
    RATE_LIMIT_API_MAX: parseInt(process.env.RATE_LIMIT_API_MAX || '100', 10),
    RATE_LIMIT_SHARE_MAX: parseInt(process.env.RATE_LIMIT_SHARE_MAX || '30', 10),
    RATE_LIMIT_UPLOAD_MAX: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX || '10', 10),

    // Monitoramento
    MONITORING_ENABLED: process.env.MONITORING_ENABLED !== 'false',
    ALERTING_ENABLED: process.env.ALERTING_ENABLED !== 'false',

    // Cache
    CACHE_ENABLED: process.env.CACHE_ENABLED !== 'false',
    CACHE_TTL: parseInt(process.env.CACHE_TTL || '3600', 10),

    // Debug
    DEBUG_MODE: process.env.DEBUG_MODE === 'true',
    VERBOSE_LOGGING: process.env.VERBOSE_LOGGING === 'true'
};

export function isEnabled(flagName) {
    return flags[flagName] ?? false;
}

export function getValue(flagName) {
    return flags[flagName];
}

export function getAll() {
    return { ...flags };
}

export default { isEnabled, getValue, getAll, ...flags };
