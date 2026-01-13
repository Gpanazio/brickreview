import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDatabase } from './database.js'
import { validateEnvironment } from './utils/validateEnv.js'

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

// Middleware
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

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
const allowAnyOrigin = !process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*'

app.use(
  cors({
    origin: allowAnyOrigin
      ? true
      : process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    credentials: !allowAnyOrigin,
  })
)

// Request logging em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
    next()
  })
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'brickreview',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  })
})

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
// TODO: Import other routes
// import notificationsRoutes from './routes/notifications.js'

app.use('/api/auth', authRoutes)
app.use('/api/projects', projectsRoutes)
app.use('/api/folders', foldersRoutes)
app.use('/api/videos', videosRoutes)
app.use('/api/comments', commentsRoutes)
app.use('/api/reviews', reviewsRoutes)
app.use('/api/shares', sharesRoutes)
app.use('/api/files', filesRoutes)
app.use('/api/drawings', drawingsRoutes)
app.use('/api/images', imagesRoutes)
// app.use('/api/notifications', notificationsRoutes)

// Serve static files em produção
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../dist')
  app.use(express.static(buildPath))

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next()
    }
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

// Error handler
app.use((err, req, res, _next) => {
  console.error('❌ Unhandled error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  })
})

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

startServer()
