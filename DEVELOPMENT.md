# BrickReview - Development Guide

Este documento serve como guia para continuar o desenvolvimento do BrickReview, seja manualmente, com outras IAs, ou retomando depois de um intervalo.

## Status Atual do Projeto

### ✅ Concluído (Fases 1-8)
- [x] Todas as fases 1-8 concluídas
- [x] Sistema funcional em produção v0.5.0
- [x] Video player com Plyr.js customizado
- [x] Sistema de comentários com threads
- [x] Drawing annotations frame-by-frame
- [x] Guest access e share links públicos
- [x] Versionamento de vídeos

### 🚧 Em Progresso (Fase 9: Refatoração v0.6.0)
- [ ] Linting e correção de erros
- [ ] Configuração de Prettier
- [ ] Desacoplamento de componentes
- [ ] Virtualização de listas
- [ ] Atualização de documentação

### 📋 Próximos Passos (pós-refatoração)
1. **Fase 10:** Infraestrutura assíncrona (filas BullMQ + Redis)
2. **Fase 11:** Streaming HLS adaptativo
3. **Fase 12:** Integrações NLEs (DaVinci, Premiere)

---

> ⚠️ **Nota sobre Código de Exemplo Abaixo:**
> As seções seguintes contêm código de exemplo do setup inicial do projeto (v0.1.0).
> Este código **JÁ FOI IMPLEMENTADO** e está em produção.
> Consulte os arquivos reais em `server/` e `src/` para a implementação atual.
> Preservamos estes exemplos apenas como referência histórica.

---

---

## 🔧 Padrões de Código e Linting

### Pre-Commit Checklist
Antes de fazer commit de código, garanta que:

1. **Formatação Automática**
   ```bash
   npx prettier --write "src/**/*.{js,jsx,css}" "server/**/*.js"
   ```

2. **Verificação de Linting**
   ```bash
   npm run lint
   ```
   - O lint deve passar com **0 erros**
   - Warnings devem ser corrigidos ou documentados

3. **Build Test**
   ```bash
   npm run build
   ```
   - Build deve compilar sem erros
   - Warnings devem ser mínimos e justificados

### Regras de Código

#### React Hooks
- ✅ Sempre declarar hooks no topo do componente
- ✅ Hooks não podem ser chamados condicionalmente
- ❌ Proibido chamar `setState` dentro de `useEffect` sem motivo documentado

#### Imports
- ✅ Usar aliases `@/` para imports internos
- ❌ Remover imports não utilizados (ESLint erro)
- ✅ Imports de terceiros primeiro, depois internos

#### Console Logs
- ❌ Remover `console.log` antes de commitar
- ✅ Manter `console.error` em blocos `catch`
- ✅ Logs de progresso em `server/` são permitidos (upload, FFmpeg)

---

## Como Continuar o Desenvolvimento

```bash
# Criar repo no GitHub primeiro (veja GITHUB_SETUP.md)
git remote add origin https://github.com/Gpanazio/brickreview.git
git branch -M main
git push -u origin main
```

### Passo 2: Copiar Componentes UI do meu-brickflow

```bash
cd /Users/gabrielpanazio/brickreview

# Copiar todos os componentes UI (shadcn/ui)
cp -r ../meu-brickflow/src/components/ui/* src/components/ui/

# Copiar utilitário cn()
mkdir -p src/lib
cp ../meu-brickflow/src/lib/utils.js src/lib/utils.js

# Copiar tema BRICK (CSS)
cp ../meu-brickflow/src/App.css src/App.css

# Copiar components.json (config do shadcn)
cp ../meu-brickflow/components.json .
```

Isso dará cerca de **48 componentes** prontos:
- Button, Dialog, Input, Label, Textarea
- Dropdown, Select, Tabs, Separator
- Avatar, Badge, Card, etc.

### Passo 3: Configurar Tailwind CSS

Criar `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
      },
      borderRadius: {
        DEFAULT: '4px', // BRICK style: minimal radius
      },
    },
  },
  plugins: [],
}
```

Criar `vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
})
```

### Passo 4: Criar Servidor Express Básico

Criar `server/index.js`:

```javascript
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3002

// Middleware
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))

// Logging em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`)
    next()
  })
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'brickreview',
    timestamp: new Date().toISOString(),
  })
})

// TODO: Import routes here
// import authRoutes from './routes/auth.js'
// import projectsRoutes from './routes/projects.js'
// app.use('/api/auth', authRoutes)
// app.use('/api/projects', projectsRoutes)

// Static files (production)
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../dist')
  app.use(express.static(buildPath))
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'))
  })
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🎬 BrickReview server running on port ${PORT}`)
})
```

Criar `server/db.js` (PostgreSQL connection):

```javascript
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.warn('⚠️  DATABASE_URL not set. Database features will be disabled.')
}

const isLocal = connectionString?.includes('localhost')
const useSSL = connectionString && !isLocal

export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 20,
    })
  : null

// Test connection
if (pool) {
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('❌ Database connection failed:', err.message)
    } else {
      console.log('✅ Database connected:', res.rows[0].now)
    }
  })
}

export function query(text, params) {
  return pool.query(text, params)
}
```

Criar `server/database.js` (schema initialization):

```javascript
import { pool, query } from './db.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function initDatabase() {
  if (!pool) {
    console.log('⚠️  Database not configured, skipping schema initialization')
    return
  }

  try {
    const sqlFile = path.join(__dirname, 'database.sql')
    const sql = fs.readFileSync(sqlFile, 'utf8')

    await query(sql)
    console.log('✅ Database schema initialized')
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message)
  }
}

// Auto-init on import (opcional)
// initDatabase()
```

### Passo 5: Instalar Dependências

```bash
npm install
```

### Passo 6: Testar Servidor

```bash
# Terminal 1: Backend
npm run server

# Terminal 2: Frontend
npm run dev

# Ou juntos:
npm run dev:full
```

Acesse:
- Frontend: http://localhost:5173
- API Health: http://localhost:3002/api/health

---

## Próximas Fases de Desenvolvimento

### Fase 2: Backend Core (2-3 dias)

**Objetivo:** Database + autenticação + Cloudflare R2

1. **Rotas de Autenticação** (`server/routes/auth.js`)
   - Copiar de `brickprojects/server/routes/auth.js`
   - POST `/api/auth/login` - Login com master_users
   - GET `/api/auth/verify` - Verificar JWT
   - POST `/api/auth/logout` - Logout

2. **Middleware de Auth** (`server/middleware/auth.js`)
   ```javascript
   import jwt from 'jsonwebtoken'

   export function authenticateToken(req, res, next) {
     const authHeader = req.headers['authorization']
     const token = authHeader?.split(' ')[1]

     if (!token) {
       return res.status(401).json({ error: 'Token not provided' })
     }

     try {
       const user = jwt.verify(token, process.env.JWT_SECRET)
       req.user = user
       next()
     } catch (err) {
       return res.status(403).json({ error: 'Invalid token' })
     }
   }
   ```

3. **Cloudflare R2 Client** (`server/utils/r2.js`)
   ```javascript
   import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
   import { v4 as uuidv4 } from 'uuid'

   const r2 = new S3Client({
     region: 'auto',
     endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
     credentials: {
       accessKeyId: process.env.R2_ACCESS_KEY_ID,
       secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
     },
   })

   export async function uploadToR2(file, folder = 'videos') {
     const key = `${folder}/${uuidv4()}-${file.originalname}`

     const command = new PutObjectCommand({
       Bucket: process.env.R2_BUCKET_NAME,
       Key: key,
       Body: file.buffer,
       ContentType: file.mimetype,
     })

     await r2.send(command)
     return {
       key,
       url: `${process.env.R2_PUBLIC_URL}/${key}`,
     }
   }

   export async function deleteFromR2(key) {
     const command = new DeleteObjectCommand({
       Bucket: process.env.R2_BUCKET_NAME,
       Key: key,
     })
     await r2.send(command)
   }
   ```

4. **FFmpeg Middleware** (`server/middleware/ffmpeg.js`)
   ```javascript
   import ffmpeg from 'fluent-ffmpeg'
   import path from 'path'

   export function extractMetadata(videoPath) {
     return new Promise((resolve, reject) => {
       ffmpeg.ffprobe(videoPath, (err, metadata) => {
         if (err) return reject(err)

         const video = metadata.streams.find(s => s.codec_type === 'video')
         resolve({
           duration: metadata.format.duration,
           width: video.width,
           height: video.height,
           fps: eval(video.r_frame_rate), // ex: "30000/1001" -> 29.97
         })
       })
     })
   }

   export function generateThumbnail(videoPath, outputPath) {
     return new Promise((resolve, reject) => {
       ffmpeg(videoPath)
         .screenshots({
           timestamps: ['50%'],
           filename: path.basename(outputPath),
           folder: path.dirname(outputPath),
           size: '640x?',
         })
         .on('end', () => resolve(outputPath))
         .on('error', reject)
     })
   }
   ```

5. **Multer Config** (`server/middleware/upload.js`)
   ```javascript
   import multer from 'multer'
   import path from 'path'

   const storage = multer.diskStorage({
     destination: (req, file, cb) => {
       cb(null, 'temp-uploads/')
     },
     filename: (req, file, cb) => {
       const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
       cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`)
     },
   })

   export const upload = multer({
     storage,
     limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
     fileFilter: (req, file, cb) => {
       const allowedTypes = /mp4|mov|avi|webm|mkv/
       const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
       const mimetype = allowedTypes.test(file.mimetype)

       if (extname && mimetype) {
         cb(null, true)
       } else {
         cb(new Error('Only video files allowed'))
       }
     },
   })
   ```

### Fase 3: Upload System (2 dias)

1. **POST /api/videos/upload**
2. **Frontend: DropZone component**
3. **Frontend: UploadProgress component**
4. **Teste com vídeo real**

### Fase 4: Video Player (2 dias)

1. **VideoPlayer component com Plyr**
2. **Timeline com marcadores**
3. **Frame-by-frame navigation**
4. **Timecode display**

### Fase 5-10: Ver README.md "Roadmap"

---

## Comandos Úteis

### Desenvolvimento
```bash
npm run dev:full     # Frontend + Backend
npm run dev          # Frontend apenas
npm run server       # Backend apenas
```

### Linting e Formatação
```bash
# Verificar problemas no código
npm run lint

# Tentar corrigir problemas automaticamente
npm run lint -- --fix

# Formatar código com Prettier
npx prettier --write "src/**/*.{js,jsx,css}" "server/**/*.js"
```

### Build e Deploy
```bash
npm run build        # Build para produção
npm start            # Rodar em produção
```

### Database
```bash
psql $DATABASE_URL < server/database.sql  # Criar schema
psql $DATABASE_URL                         # Connect to DB
```

### Git
```bash
git status
git add .
git commit -m "feat: description"
git push origin main
```

## Estrutura de Commits

Use conventional commits:

```
feat: nova funcionalidade
fix: correção de bug
docs: atualização de documentação
style: formatação, ponto e vírgula, etc
refactor: refatoração de código
test: adição de testes
chore: tarefas de build, configs, etc
```

Exemplos:
```
feat: add video upload with R2 integration
fix: resolve comment timestamp calculation
docs: update deployment instructions
refactor: simplify FFmpeg thumbnail generation
```

## Debugging

### Backend
```javascript
// Em qualquer lugar do código:
console.log('[DEBUG]', variable)
console.error('[ERROR]', error)
```

### Frontend
```javascript
// React DevTools (extensão do Chrome/Firefox)
console.log('[COMPONENT]', props, state)
```

### Database
```bash
# Ver logs do Railway
railway logs

# Query manual
psql $DATABASE_URL
SELECT * FROM review_videos LIMIT 10;
```

---

## Recursos Externos

- **Plyr.js Docs:** https://github.com/sampotts/plyr
- **Cloudflare R2:** https://developers.cloudflare.com/r2/
- **Resend:** https://resend.com/docs
- **Railway:** https://railway.app/docs
- **shadcn/ui:** https://ui.shadcn.com/
- **Tailwind CSS:** https://tailwindcss.com/docs

---

## Checklist de Features (para você ou outra IA)

### Backend
- [ ] Autenticação com JWT
- [ ] CRUD de projetos
- [ ] CRUD de vídeos (com upload para R2)
- [ ] CRUD de comentários
- [ ] CRUD de aprovações
- [ ] Sistema de notificações
- [ ] Envio de emails (Resend)
- [ ] FFmpeg processing
- [ ] Versionamento de vídeos

### Frontend
- [ ] Login/logout
- [ ] Lista de projetos
- [ ] Detalhes do projeto
- [ ] Upload de vídeo
- [ ] Video player
- [ ] Timeline com comentários
- [ ] Modal de comentário
- [ ] Thread de respostas
- [ ] Painel de aprovação
- [ ] Notificações in-app
- [ ] Comparação de versões
- [ ] Dashboard de estatísticas

### Deploy
- [ ] Push para GitHub
- [ ] Deploy no Railway
- [ ] Configure environment variables
- [ ] Setup PostgreSQL
- [ ] Setup Cloudflare R2
- [ ] Setup Resend
- [ ] Testar end-to-end

---

**Última atualização:** 2026-01-09
**Status:** Fase 1 concluída, pronto para Fase 2
**Próximo passo:** Copiar componentes UI e setup Express
