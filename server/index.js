// Main entry point for the BrickReview server
// Last update: 2026-01-16T19:40:00
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { initDatabase } from './database.js'
import { validateEnvironment } from './utils/validateEnv.js'
import { requestLogger } from './middleware/requestLogger.js'
import { errorHandler } from './middleware/errorHandler.js'
import { pool } from './db.js'
import cache from './utils/cache.js'

dotenv.config()

// Valida variáveis de ambiente ANTES de fazer qualquer outra coisa
try {
  validateEnvironment()
} catch {
  console.error('\n🛑 Servidor não pode iniciar devido a erros de configuração.')
  process.exit(1)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3002

// Confia em proxies (necessário para req.protocol e req.get('host') quando atrás de Nginx/Railway/etc)
app.set('trust proxy', 1)

import cookieParser from 'cookie-parser'

// Middleware
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use(cookieParser())

// Aumenta timeout para uploads grandes
app.use((req, res, next) => {
  res.setTimeout(600000, () => {
    console.error('Request timeout:', req.method, req.path);
    if (!res.headersSent) {
      res.status(504).json({ error: 'Tempo limite da requisição excedido' });
    }
  });
  next();
});

// Request Logging and ID generation
app.use(requestLogger);

const allowAnyOrigin = process.env.CORS_ORIGIN === '*'

// Middleware de segurança (CSP)
app.use((req, res, next) => {
  // Em desenvolvimento, CSP mais permissivo para facilitar debug e hot reload
  if (process.env.NODE_ENV !== 'production') {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' ws: wss: https:; media-src 'self' blob: https:; frame-src 'self' https:;"
    );
  } else {
    // Em produção, CSP estrita
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; media-src 'self' blob: https:; frame-src 'self' https://drive.google.com https://docs.google.com; frame-ancestors 'self';"
    );
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Frame-Options');

  // Cache Control
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  } else if (req.path.match(/\.(css|js|jpg|png|svg|ico)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Se permitir qualquer origem (*), reflete a origem do request para suportar credentials
      if (allowAnyOrigin) {
        return callback(null, true);
      }
      // Se não, verifica a lista branca
      const allowedOrigins = process.env.CORS_ORIGIN.split(',').map((o) => o.trim());
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Sempre permite cookies/auth headers
  })
)

// Request logging legacy (removido em favor do requestLogger)
// if (process.env.NODE_ENV !== 'production') { ... }

// Health check
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    service: 'brickreview',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    checks: {
      database: 'unknown',
      redis: 'unknown'
    }
  };

  try {
    // Check DB
    if (pool) {
      const dbStart = Date.now();
      await pool.query('SELECT 1');
      health.checks.database = { status: 'healthy', latency: `${Date.now() - dbStart}ms` };
    } else {
      health.checks.database = { status: 'disabled' };
    }

    // Check Redis
    const redis = cache.getClient();
    if (redis) {
      const redisStart = Date.now();
      await redis.ping();
      health.checks.redis = { status: 'healthy', latency: `${Date.now() - redisStart}ms` };
    } else {
      health.checks.redis = { status: 'disabled' };
    }

    res.json(health);
  } catch (error) {
    health.status = 'error';
    health.error = error.message;
    res.status(503).json(health);
  }
})

// Rate limiters
import { authLimiter, shareLimiter, apiLimiter } from './middleware/rateLimiter.js'

// Routes
import authRoutes from './routes/auth.js'
import projectsRoutes from './routes/projects.js'
import foldersRoutes from './routes/folders.js'
import videosRoutes from './routes/videos.js'
import commentsRoutes from './routes/comments.js'
import reviewsRoutes from './routes/reviews.js'
import sharesRoutes from './routes/shares.js'
import filesRoutes from './routes/files.js'
import drawingsRoutes from './routes/drawings.js'
import imagesRoutes from './routes/images.js'
import storageRoutes from './routes/storage.js'
import driveRoutes from './routes/drive.js'
import portfolioRoutes from './routes/portfolio.js'
import portfolioCollectionsRoutes from './routes/portfolio-collections.js'
import portfolioSharesRoutes from './routes/portfolio-shares.js'
import masonRoutes from './routes/mason.js'
// TODO: Import other routes
// import notificationsRoutes from './routes/notifications.js'

// Aplicar rate limiters específicos
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/shares', shareLimiter, sharesRoutes)
app.use('/api/portfolio/shares', shareLimiter, portfolioSharesRoutes)
app.use('/api/mason', masonRoutes)

// Rotas protegidas (Rate limiter será aplicado internamente ou via router wrapper se necessário)
// Para simplificar e garantir que req.user exista, o apiLimiter deve ser usado APÓS authenticateToken
// nas rotas que o exigem.

app.use('/api/projects', projectsRoutes)
app.use('/api/folders', foldersRoutes)
app.use('/api/videos', videosRoutes)
app.use('/api/comments', commentsRoutes)
app.use('/api/reviews', reviewsRoutes)
app.use('/api/files', filesRoutes)
app.use('/api/drawings', drawingsRoutes)
app.use('/api/images', imagesRoutes)
app.use('/api/storage', storageRoutes)
app.use('/api/drive', driveRoutes)
app.use('/api/portfolio', portfolioRoutes)
app.use('/api/portfolio/collections', portfolioCollectionsRoutes)
// app.use('/api/notifications', notificationsRoutes)

// Serve comment attachments from Railway Volume
const ANEXOS_PATH = process.env.ANEXOS_PATH || '/anexos';
if (fs.existsSync(ANEXOS_PATH)) {
  console.log(`📂 Servindo anexos de: ${ANEXOS_PATH}`);
  app.use('/anexos', express.static(ANEXOS_PATH));
} else {
  // Local development fallback
  const localAnexos = path.join(__dirname, 'anexos');
  if (!fs.existsSync(localAnexos)) fs.mkdirSync(localAnexos, { recursive: true });
  console.log(`📂 Servindo anexos (local): ${localAnexos}`);
  app.use('/anexos', express.static(localAnexos));
}

// Serve static files em produção
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../dist')

  // Helper to set no-cache headers
  const setNoCacheHeaders = (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  };

  // 1. Assets com hash (JS/CSS/Images) -> Cache Imutável (1 ano)
  app.use(express.static(buildPath, {
    maxAge: '1y',
    immutable: true,
    index: false, // Desabilita index.html automático aqui para controlarmos o header
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) {
        // Se por acaso pedir um .html direto (ex: /index.html), não cachear
        setNoCacheHeaders(res);
      }
    }
  }))

  // 1.5 Strict 404 for missing assets (prevents index.html fallback for scripts)
  app.use('/assets', (req, res) => {
    console.info(`[404] Asset missing: ${req.originalUrl}`);
    res.status(404).send('Asset not found');
  });

  // 2. Catch-all para SPA -> index.html (SEM CACHE)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next()
    }

    // IMPORTANTE: Prevenir cache do index.html para evitar erros de MIME type 
    // quando os assets (JS/CSS) mudam de hash após novo deploy.
    setNoCacheHeaders(res);

    res.sendFile(path.join(buildPath, 'index.html'))
  })
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  })
})

// Global Error Handler
app.use(errorHandler)

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase()

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════╗
║   🎬 BrickReview Server               ║
║   Port: ${PORT}                        ║
║   Environment: ${process.env.NODE_ENV || 'development'}     ║
║   Time: ${new Date().toLocaleTimeString()}              ║
╚═══════════════════════════════════════╝
      `)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer()
}

export { app, startServer }
