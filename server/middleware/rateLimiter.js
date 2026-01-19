import rateLimit from "express-rate-limit";

/**
 * Rate limiter para rotas de autenticação
 * - Limita por username (se disponível) ou IP
 * - Permite 5 tentativas a cada 15 minutos
 * - Só conta requisições com falha
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas por janela
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
export const shareLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 requisições por minuto
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
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // 100 requisições por minuto
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
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // 10 uploads por hora
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
