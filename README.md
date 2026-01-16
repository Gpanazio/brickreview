# BrickReview

> ✅ **Nota de Desenvolvimento (v0.7.3):** Projeto em produção estável. Melhorias significativas na interface de Storage (UI estilo Google Drive) e sistema de compartilhamento. Consulte [CHANGELOG.md](CHANGELOG.md) para detalhes.

Sistema de revisão de vídeos estilo Frame.io com identidade visual BRICK (preto/vermelho/branco).

## 🎯 Funcionalidades

- [x] **Storage UI estilo Google Drive** (drag-drop, context menus, breadcrumbs)
- ✅ Upload de vídeos via drag-drop
- ✅ Player customizado com marcações temporais
- ✅ Comentários frame-by-frame com threads
- ✅ **Sistema de desenho frame-by-frame** (drawing annotations)
- ✅ **Comentários de visitantes** (guest comments sem conta)
- ✅ **Compartilhamento público** de arquivos e pastas via Storage
- ✅ **Emoji picker** nos comentários
- ✅ Sistema de aprovação de clientes
- ✅ Versionamento de arquivos (múltiplas versões por vídeo)
- ✅ Notificações in-app + email
- ✅ Cloudflare R2 para storage de vídeos
- ✅ Railway para banco de dados e API
- ✅ Integração Híbrida Google Drive (Backup + UI)
- ✅ Autenticação JWT compartilhada

## 🚀 Stack Tecnológica

**Frontend:**

- React 19 + Vite 7
- Tailwind CSS 4
- Radix UI + shadcn/ui
- Native HTML5 Video Player customizado (desacoplado)
- React Router 7
- Lucide React
- emoji-picker-react (emojis em comentários)
- Framer Motion (animações)
- Sonner (toast notifications)

**Backend:**

- Node.js + Express
- PostgreSQL (Railway)
- BullMQ + Redis (background jobs)
- JWT Authentication
- Multer (upload)
- FFmpeg (thumbnails)
- Cloudflare R2 (storage)
- Resend (emails)
- ssrf-req-filter (SSRF protection)

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
│   │   ├── ui/              # shadcn/ui (60+ componentes)
│   │   ├── player/          # Video player customizado (desacoplado)
│   │   │   ├── VideoPlayer.jsx
│   │   │   ├── subcomponents/
│   │   │   │   ├── VideoPlayerCore.jsx
│   │   │   │   ├── CommentSidebar.jsx
│   │   │   │   └── TimelineControls.jsx
│   │   │   ├── context/      # VideoContext
│   │   │   └── VideoComparison.jsx
│   │   ├── projects/        # Gestão de projetos
│   │   ├── viewer/          # Visualizador de arquivos
│   │   └── shared/         # Componentes compartilhados
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Utilitários
│   ├── context/            # Contexts (VideoContext)
│   └── App.jsx
├── server/
│   ├── routes/             # API routes
│   ├── middleware/         # Auth, upload, etc
│   ├── utils/              # R2, email, FFmpeg, logger
│   ├── config/             # Configurações (features.js)
│   ├── queue/              # BullMQ (background jobs)
│   ├── db.js               # PostgreSQL connection
│   └── index.js            # Express app
├── scripts/                # Scripts utilitários
│   ├── cleanup-r2.js       # Remove arquivos órfãos do R2
│   ├── cleanup-trash.js     # Limpa lixeira do DB
│   ├── process-video-metadata.js  # Recalcula metadados
│   └── diagnose-ffmpeg.js  # Diagnóstico FFmpeg
├── temp-uploads/           # Temporário (não versionado)
├── .prettierrc             # Config Prettier
├── nixpacks.toml          # Config Railway build
└── railway-start.sh        # Script de inicialização Railway
```

## 🗄️ Banco de Dados (Railway)

### Tabelas Principais

1. **brickreview_projects** - Projetos
2. **brickreview_folders** - Organização em pastas
3. **brickreview_videos** - Vídeos (URLs do R2) com versionamento
4. **brickreview_comments** - Comentários frame-by-frame (suporta guests via `visitor_name`)
5. **brickreview_drawings** - Desenhos frame-by-frame
6. **brickreview_shares** - Links de compartilhamento público
7. **brickreview_approvals** - Aprovações de clientes
8. **brickreview_project_members** - Membros por projeto
9. **brickreview_notifications** - Notificações
10. **brickreview_temp_guest_users** - Usuários temporários para guests
11. **master_users** - Usuários (compartilhada com outros sistemas BRICK)

### Infraestrutura de Background Jobs

- **BullMQ** - Sistema de filas para processamento assíncrono
- **Redis** - Store de filas e jobs
- **Filas principais:**
  - `video-processing` - Processamento de vídeos e geração de thumbnails
  - `email-sending` - Envio de emails assíncronos
  - `notifications` - Processamento de notificações

## 🎨 Tema BRICK

### Cores

- Background: `#000000` (preto puro)
- Primary: `#DC2626` (vermelho)
- Text: `#FFFFFF`, `#A1A1AA`, `#71717A`
- Borders: `#27272A`, `#18181B`

### Tipografia

```css
.brick-title {
  font-family: "Inter", sans-serif;
  font-weight: 900;
  letter-spacing: -0.05em;
  text-transform: uppercase;
}

.brick-tech {
  font-family: "JetBrains Mono", monospace;
}
```

## 💬 Guest Comments (Comentários de Visitantes)

O sistema permite que visitantes sem conta comentem em vídeos através de links de compartilhamento:

### Como funciona

1. Admin/owner gera link de compartilhamento com access type "comment"
2. Visitante acessa via `/share/:token`
3. Visitante fornece nome (salvo em localStorage)
4. Comentários são salvos com `visitor_name` ao invés de `user_id`
5. Sistema cria usuário temporário via hash do nome

### Database

- `brickreview_comments.visitor_name` - Nome do visitante
- `brickreview_comments.user_id` - Nullable (guests não têm user_id)
- Constraint CHECK: `user_id IS NOT NULL OR visitor_name IS NOT NULL`

## 🎨 Drawing Annotations (Desenhos Frame-by-Frame)

Ferramenta de desenho que permite marcar áreas específicas do vídeo em timestamps:

### Recursos

- Canvas overlay sobre o player
- 6 cores disponíveis (vermelho, laranja, amarelo, verde, azul, branco)
- Persistência em `brickreview_drawings`
- Visível para todos os membros do projeto
- Visível para guests em share links

### Como usar

1. Pause o vídeo no frame desejado
2. Clique no botão de pincel
3. Escolha uma cor
4. Desenhe sobre o vídeo
5. Salve o desenho

## 🔗 Sistema de Compartilhamento

### Tipos de compartilhamento

- **Video**: Compartilha um vídeo (+ todas as versões)
- **Folder**: Compartilha todos os vídeos de uma pasta
- **Project**: Compartilha todos os vídeos de um projeto

### Access Types

- **view**: Apenas visualização
- **comment**: Visualização + comentários + desenhos

### Clipboard Fallback

Implementação robusta em 3 camadas:

1. Modern Clipboard API (`navigator.clipboard`)
2. Legacy `execCommand('copy')`
3. Manual `prompt()` como último recurso

## 📋 Roadmap

### ✅ v0.7.2 - Melhorias de UX e Correções (CONCLUÍDO)

- [x] Preview de timeline (sprites VTT) corrigido e funcional
- [x] Scrubbing control no input de Range (arrastar para ajustar)
- [x] Correção de path do FFmpeg em ambientes macOS/Homebrew

### ✅ v0.7.1 - Infraestrutura Estável (CONCLUÍDO)

- [x] Fix de crashes do video player
- [x] Desacoplamento do VideoPlayer em componentes menores
- [x] Implementação de VideoContext para gerenciamento de estado
- [x] Sistema de filas com BullMQ + Redis
- [x] Processamento assíncrono de vídeos
- [x] Script de inicialização Railway com FFmpeg
- [x] Sistema de logs centralizado (logger)
- [x] Feature flags para controle de funcionalidades
- [x] Proteção SSRF em endpoints

### ✅ Fase 1-8: CONCLUÍDAS

- [x] Repositório e setup inicial
- [x] Backend core (Express + PostgreSQL)
- [x] Upload system (FFmpeg + R2)
- [x] Video player customizado (HTML5 Video)
- [x] Comments system (threads + replies)
- [x] Drawing annotations
- [x] Guest access (visitor comments)
- [x] Share system (links públicos)

### 🚧 v0.8.0 - Performance & Mobile (Planejado)

#### Etapa 1: Mobile Responsiveness

- [ ] Adaptar video player para mobile
- [ ] Touch-friendly controls
- [ ] Responsive layouts

#### Etapa 2: Performance Optimization

- [ ] Code splitting (lazy loading)
- [ ] Image optimization
- [ ] Virtual scrolling em listas longas

### 🚧 Próximas fases (pós-v0.8.0)

- [ ] Integração com NLEs (DaVinci, Premiere)
- [ ] Streaming HLS adaptativo
- [ ] Analytics dashboard
- [ ] Offline support (PWA)

### ✅ v0.7.3 - Storage UI & Sharing (CONCLUÍDO)

- [x] UI estilo Google Drive (Drag & Drop visual, Context Menus)
- [x] Compartilhamento de links públicos para arquivos e pastas
- [x] Navegação por breadcrumbs com suporte a drag-and-drop
- [x] Gerenciamento avançado de arquivos (renomear, mover para raiz)

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

- [INFRA_V0.7.1_PLAN.md](INFRA_V0.7.1_PLAN.md) - Plano de infraestrutura v0.7.1
- [FEATURES.md](FEATURES.md) - Guia completo de funcionalidades
- [API_REFERENCE.md](API_REFERENCE.md) - Documentação da API
- [STATUS.md](STATUS.md) - Progresso do projeto
- [DEVELOPMENT.md](DEVELOPMENT.md) - Guia para desenvolvedores
- [RAILWAY_FFMPEG_FIX.md](RAILWAY_FFMPEG_FIX.md) - Fix para FFmpeg no Railway
- [ARCHITECTURE.md](ARCHITECTURE.md) - Documentação de arquitetura

## 🔧 Scripts Utilitários

### Worker (Background Jobs)

Roda worker BullMQ para processamento assíncrono:

```bash
npm run worker
```

### Cleanup R2

Remove arquivos órfãos do Cloudflare R2:

```bash
node scripts/cleanup-r2.js
```

### Cleanup Trash

Remove permanentemente itens da lixeira (7 dias ou mais):

```bash
node scripts/cleanup-trash.js
```

### Process Video Metadata

Recalcula metadados de vídeos existentes:

```bash
node scripts/process-video-metadata.js
```

### Diagnóstico FFmpeg

Diagnostica instalação do FFmpeg (útil para Railway):

```bash
node scripts/diagnose-ffmpeg.js
```

### Cleanup Trash

Remove permanentemente itens da lixeira (7 dias ou mais):

```bash
node scripts/cleanup-trash.js
```

### Process Video Metadata

Recalcula metadados de vídeos existentes:

```bash
node scripts/process-video-metadata.js
```

### Diagnóstico FFmpeg

Diagnostica instalação do FFmpeg (útil para Railway):

```bash
node scripts/diagnose-ffmpeg.js
```

## 🔗 Recursos Externos

- [Plyr.js](https://github.com/sampotts/plyr)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Resend](https://resend.com/docs)
- [Railway](https://railway.app/docs)
- [shadcn/ui](https://ui.shadcn.com/)

## 🔐 Autenticação

Usa a tabela `master_users` compartilhada com outros sistemas BRICK (brickprojects, BrickAI).

**Roles:**

- `admin` - Equipe interna (full access)
- `client` - Clientes externos (restricted)

## 🎬 Como Usar

1. Admin cria projeto e adiciona membros
2. Upload de vídeo via drag-drop
3. Vídeo é processado (FFmpeg) via BullMQ (background job) e enviado para R2
4. Cliente/Admin revisa e adiciona comentários em timestamps
5. Comentários geram notificações (in-app + email)
6. Cliente aprova ou solicita mudanças
7. Nova versão pode ser enviada
8. Comparação lado-a-lado de versões

---

**Status:** ✅ Em produção estável
**Versão:** 0.7.3
**Licença:** Privado (BRICK Produtora)

---

Para mais detalhes, consulte:

- [FEATURES.md](FEATURES.md) - Guia completo de funcionalidades
- [API_REFERENCE.md](API_REFERENCE.md) - Documentação da API
- [STATUS.md](STATUS.md) - Progresso do projeto
- [DEVELOPMENT.md](DEVELOPMENT.md) - Guia para desenvolvedores
- [INFRA_V0.7.1_PLAN.md](INFRA_V0.7.1_PLAN.md) - Plano de infraestrutura v0.7.1
