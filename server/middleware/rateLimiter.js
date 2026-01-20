import rateLimit from "express-rate-limit";
import featureFlags from "../utils/featureFlags.js";

/**
 * Wrapper que permite desabilitar rate limiting via feature flag
 */
const createLimiter = (config) => {
  const limiter = rateLimit(config);

  return (req, res, next) => {
    // Se rate limiting estiver desabilitado, passa direto
    if (!featureFlags.RATE_LIMITING_ENABLED) {
      return next();
    }
    return limiter(req, res, next);
  };
};

/**
 * Rate limiter para rotas de autenticação
 * - Limita por username (se disponível) ou IP
 * - Configurável via RATE_LIMIT_AUTH_MAX e RATE_LIMIT_AUTH_WINDOW_MS
 * - Só conta requisições com falha
 */
export const authLimiter = createLimiter({
  windowMs: featureFlags.RATE_LIMIT_AUTH_WINDOW_MS,
  max: featureFlags.RATE_LIMIT_AUTH_MAX,
  message: {
    error: "Muitas tentativas de login. Tente novamente em 15 minutos.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Rate limit por username se disponível
  // Se não houver username, deixa o middleware usar o IP padrão
  keyGenerator: (req) => {
    // Se tem username, usa ele como chave (não depende de IP)
    if (req.body?.username) {
      return `username:${req.body.username}`;
    }
    // Se não tem username, retorna undefined para usar o comportamento padrão
    // que trata IPv6 corretamente
    return undefined;
  },
  // Só conta falhas de login
  skipSuccessfulRequests: true,
});

/**
 * Rate limiter para rotas de compartilhamento público
 * - Limita por token (se disponível)
 * - Permite 30 requisições por minuto
 */
export const shareLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minuto
  max: featureFlags.RATE_LIMIT_SHARE_MAX,
  message: {
    error: "Muitas requisições. Tente novamente em alguns instantes.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const token = req.params.token || req.query.token;
    // Se tem token, usa ele como chave (independe de IP)
    if (token) {
      return `share:${token}`;
    }
    // Se não tem token, usa comportamento padrão (IP)
    return undefined;
  },
});

/**
 * Rate limiter geral para API
 * - Limita por usuário autenticado ou IP
 * - Permite 100 requisições por minuto
 */
export const apiLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minuto
  max: featureFlags.RATE_LIMIT_API_MAX,
  message: {
    error: "Muitas requisições. Tente novamente em alguns instantes.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Se autenticado, usa user ID (independe de IP)
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    // Se não autenticado, usa comportamento padrão (IP)
    return undefined;
  },
});

/**
 * Rate limiter para uploads
 * - Limita por usuário autenticado
 * - Permite 10 uploads por hora
 */
export const uploadLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: featureFlags.RATE_LIMIT_UPLOAD_MAX,
  message: {
    error: "Limite de uploads atingido. Tente novamente em 1 hora.",
    code: "UPLOAD_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Uploads sempre requerem autenticação, então usa user ID
    if (req.user?.id) {
      return `upload:${req.user.id}`;
    }
    // Fallback para IP se não autenticado (não deveria acontecer)
    return undefined;
  },
});
