import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDatabase } from './database.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3002

// Middleware
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}))

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
// TODO: Import other routes
// import notificationsRoutes from './routes/notifications.js'

app.use('/api/auth', authRoutes)
app.use('/api/projects', projectsRoutes)
app.use('/api/folders', foldersRoutes)
app.use('/api/videos', videosRoutes)
app.use('/api/comments', commentsRoutes)
app.use('/api/reviews', reviewsRoutes)
app.use('/api/shares', sharesRoutes)
// app.use('/api/notifications', notificationsRoutes)

// Serve static files em produção
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../dist')
  app.use(express.static(buildPath))

  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'))
  })
}

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
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
