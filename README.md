# BrickReview

Sistema de revisão de vídeos estilo Frame.io com identidade visual BRICK (preto/vermelho/branco).

## 🎯 Funcionalidades

- ✅ Upload de vídeos via drag-drop
- ✅ Player customizado com marcações temporais
- ✅ Comentários frame-by-frame com threads
- ✅ Sistema de aprovação de clientes
- ✅ Versionamento de arquivos
- ✅ Notificações in-app + email
- ✅ Cloudflare R2 para storage de vídeos
- ✅ Railway para banco de dados e API
- ✅ Autenticação JWT compartilhada

## 🚀 Stack Tecnológica

**Frontend:**
- React 19 + Vite 7
- Tailwind CSS 4
- Radix UI + shadcn/ui
- Plyr.js (video player)
- React Router 7
- Lucide React

**Backend:**
- Node.js + Express
- PostgreSQL (Railway)
- JWT Authentication
- Multer (upload)
- FFmpeg (thumbnails)
- Cloudflare R2 (storage)
- Resend (emails)

## ⚙️ Setup Inicial

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Crie `.env` na raiz:

```bash
# Database (Railway PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database

# JWT
JWT_SECRET=your-secret-key-here

# Cloudflare R2 (apenas para vídeos)
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=brickreview-videos
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev

# FFmpeg (ajuste os caminhos para seu sistema)
# macOS (Homebrew): /opt/homebrew/bin/ffmpeg
# Linux/Ubuntu: /usr/bin/ffmpeg
# Windows: C:\ffmpeg\bin\ffmpeg.exe
FFMPEG_PATH=/opt/homebrew/bin/ffmpeg
FFPROBE_PATH=/opt/homebrew/bin/ffprobe

# Resend (Email) - Opcional
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Server
PORT=3002
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

**Como encontrar o caminho do FFmpeg no seu sistema:**

```bash
# macOS/Linux
which ffmpeg
which ffprobe

# Ou instalar via Homebrew (macOS)
brew install ffmpeg

# Ou via apt (Ubuntu/Debian)
sudo apt install ffmpeg
```

### 3. Criar Schema do Banco

```bash
npm run server
# Schema será criado automaticamente
```

### 4. Rodar o Projeto

```bash
# Frontend + Backend juntos
npm run dev:full

# Ou separadamente:
npm run dev      # Frontend apenas
npm run server   # Backend apenas
```

## 📁 Estrutura

```
brickreview/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui (copiar de meu-brickflow)
│   │   ├── player/          # Video player
│   │   ├── comments/        # Sistema de comentários
│   │   ├── review/          # Aprovação
│   │   ├── upload/          # Upload
│   │   └── projects/        # Projetos
│   ├── hooks/
│   ├── utils/
│   └── App.jsx
├── server/
│   ├── routes/
│   ├── middleware/
│   ├── utils/
│   ├── db.js
│   └── index.js
├── temp-uploads/            # Temporário
└── thumbnails/              # Cache local
```

## 🗄️ Banco de Dados (Railway)

### Tabelas

1. **review_projects** - Projetos
2. **review_folders** - Organização em pastas
3. **review_videos** - Vídeos (URLs do R2)
4. **review_comments** - Comentários frame-by-frame
5. **review_approvals** - Aprovações de clientes
6. **review_project_members** - Membros por projeto
7. **review_notifications** - Notificações

## 🎨 Tema BRICK

### Cores
- Background: `#000000` (preto puro)
- Primary: `#DC2626` (vermelho)
- Text: `#FFFFFF`, `#A1A1AA`, `#71717A`
- Borders: `#27272A`, `#18181B`

### Tipografia
```css
.brick-title {
  font-family: 'Inter', sans-serif;
  font-weight: 900;
  letter-spacing: -0.05em;
  text-transform: uppercase;
}

.brick-tech {
  font-family: 'JetBrains Mono', monospace;
}
```

## 📋 Roadmap

### ✅ Fase 1: Inicialização
- [x] Repositório criado
- [x] Vite + React setup
- [x] package.json completo
- [ ] Copiar componentes UI
- [ ] Express server
- [ ] Tailwind config

### Fase 2: Backend Core
- [ ] PostgreSQL connection
- [ ] Schema do banco
- [ ] Rotas de autenticação
- [ ] Multer config
- [ ] R2 integration

### Fase 3: Upload System
- [ ] FFmpeg processing
- [ ] DropZone component
- [ ] Upload to R2
- [ ] Progress tracking

### Fase 4: Video Player
- [ ] Plyr.js integration
- [ ] Timeline com markers
- [ ] Frame-by-frame
- [ ] Timecode display

### Fase 5-10: Ver [plano completo](.claude/plans/typed-booping-haven.md)

## 🚀 Deploy

### Railway (Recomendado)

**Database:**
1. Create PostgreSQL service
2. Copy DATABASE_URL

**API:**
1. Connect GitHub repo
2. Environment variables (ver seção abaixo)
3. Build: `npm install && npm run build`
4. Start: `chmod +x railway-start.sh && ./railway-start.sh` (Configurado automaticamente)
5. Volumes: `/temp-uploads`, `/thumbnails`

**🔧 Configuração do FFmpeg:**
O projeto possui configurações especiais para garantir que o FFmpeg funcione no Railway. Se tiver problemas com thumbnails ou proxies, consulte [RAILWAY_FFMPEG_FIX.md](./RAILWAY_FFMPEG_FIX.md).

**⚠️ IMPORTANTE - Variáveis de Ambiente Obrigatórias no Railway:**

```bash
# Banco de Dados
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=your-secret-key

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=brickreview-videos
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev

# FFmpeg (CRÍTICO - NÃO definir no Railway/Nixpacks)
# No Railway, o FFmpeg é encontrado automaticamente via 'which'
# Apenas defina FFMPEG_PATH/FFPROBE_PATH se estiver usando Dockerfile customizado

# Email (opcional)
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Configuração (opcional - tem valores padrão)
CORS_ORIGIN=*
PORT=8080
NODE_ENV=production
```

**⚠️ IMPORTANTE: NÃO configure FFMPEG_PATH/FFPROBE_PATH no Railway!**

Quando você usa Nixpacks (padrão do Railway), o FFmpeg fica em `/nix/store` com um caminho dinâmico que muda a cada build. O código já detecta automaticamente usando `which ffmpeg`.

**Apenas defina FFMPEG_PATH/FFPROBE_PATH se:**
- Estiver usando um Dockerfile customizado (não Nixpacks)
- O FFmpeg estiver em um caminho não-padrão

**Como verificar se FFmpeg está funcionando:**

Nos logs do Railway, você deve ver:
```
✅ ffmpeg encontrado via which: /nix/store/xxxxx-ffmpeg-6.x/bin/ffmpeg
✅ ffprobe encontrado via which: /nix/store/xxxxx-ffmpeg-6.x/bin/ffprobe
```

Ou em caminhos comuns:
```
✅ ffmpeg encontrado em caminho comum: /usr/bin/ffmpeg
✅ ffprobe encontrado em caminho comum: /usr/bin/ffprobe
```

Ao fazer upload de vídeo:
```
📊 Obtendo metadados do vídeo: temp-uploads/video-123.mp4
✅ Metadados obtidos: { duration: 120, width: 1920, height: 1080, fps: 30 }
🖼️ Gerando thumbnail...
✅ Thumbnail gerada localmente: thumbnails/thumb-abc.jpg
✅ Thumbnail enviada para R2: https://...
```

**Nota:** Vídeos vão para Cloudflare R2 (não Railway)

### Cloudflare R2

1. Create bucket `brickreview-videos`
2. Generate API token
3. Configure public access
4. Add credentials to env

## 📚 Documentação

- [Plano completo](.claude/plans/typed-booping-haven.md)
- [Plyr.js](https://github.com/sampotts/plyr)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Resend](https://resend.com/docs)
- [Railway](https://railway.app/docs)

## 🔐 Autenticação

Usa a tabela `master_users` compartilhada com outros sistemas BRICK (brickprojects, BrickAI).

**Roles:**
- `admin` - Equipe interna (full access)
- `client` - Clientes externos (restricted)

## 🎬 Como Usar

1. Admin cria projeto e adiciona membros
2. Upload de vídeo via drag-drop
3. Vídeo é processado (FFmpeg) e enviado para R2
4. Cliente/Admin revisa e adiciona comentários em timestamps
5. Comentários geram notificações (in-app + email)
6. Cliente aprova ou solicita mudanças
7. Nova versão pode ser enviada
8. Comparação lado-a-lado de versões

---

**Status:** 🚧 Em desenvolvimento
**Versão:** 0.1.0
**Licença:** Privado (BRICK Produtora)
