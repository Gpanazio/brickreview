# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

### 🧹 Code Cleanup v0.6.0

#### Dependencies
- **REMOVED**: `plyr-react@5.3.0` (usando Plyr diretamente)
- **REMOVED**: `react-aptor@2.0.0` (não utilizado)
- **ADDED**: `prettier` (devDependency)

#### Linting
- ✅ Corrigidos 13 erros ESLint
- ✅ Corrigidos 11 warnings ESLint
- ✅ Configurado Prettier com padrão de projeto

#### Refactoring
- ✅ Extraído constantes de desenho para `src/constants/drawing.js`
- ✅ Movido `diagnose-ffmpeg.js` → `scripts/`
- ✅ Removidos console logs de debug em `src/`

#### Fixes
- ✅ Corrigido loop de renderização em `CreateFolderDialog.jsx`
- ✅ Removida variável `savedTime` não usada em `VideoPlayer.jsx`

---

## [0.5.0] - 2026-01-11

### 🎉 Marcos Importantes
- Sistema completo e funcional em produção
- Todas as 8 fases principais implementadas
- Guest access totalmente operacional

### ✨ Adicionado
- **Drawing Annotations**: Sistema de desenho frame-by-frame com 6 cores
- **Guest Comments**: Visitantes podem comentar sem criar conta
- **Share System**: Links públicos com controle de acesso (view/comment)
- **Emoji Picker**: emoji-picker-react integrado nos comentários
- **Version Management**: Versionamento completo de vídeos
- **Player Stability**: Fixes para prevenir tela preta e crashes

### 🔧 Corrigido
- Tela preta ao trocar versões do vídeo
- Clipboard API bloqueada em contextos não-seguros
- Play button deslocando ao hover
- DOM conflicts ao trocar versão rapidamente
- Comentários não carregando para guests
- Drawings não visíveis para guests

### 🗄️ Database
- Adicionado coluna `visitor_name` em `brickreview_comments`
- Coluna `user_id` agora nullable para suportar guests
- Constraint CHECK: `user_id OR visitor_name` deve existir
- Nova tabela: `brickreview_drawings`
- Nova tabela: `brickreview_shares`
- Nova tabela: `brickreview_temp_guest_users`

### 🔐 Segurança
- Validação de share tokens
- Access control em endpoints públicos
- Sanitização de visitor names
- Rate limiting para guest actions (futuro)

---

## [0.4.0] - 2026-01-10

### ✨ Adicionado
- Sistema de comentários com threads e replies
- Timestamp markers na timeline
- Notificações in-app e por email
- Sistema de aprovação (pending/approved/changes_requested)

### 🔧 Corrigido
- FFmpeg paths no Railway/Nixpacks
- Thumbnails não gerando em produção
- Upload progress não atualizando

---

## [0.3.0] - 2026-01-09

### ✨ Adicionado
- Upload system completo com drag-drop
- FFmpeg processing (metadata + thumbnails)
- Cloudflare R2 integration
- Progress tracking durante upload
- Proxy generation (720p) para streaming rápido

### 🔧 Corrigido
- Memory leaks durante processamento de vídeo
- Timeout errors em vídeos grandes
- Encoding issues com caracteres especiais em nomes

---

## [0.2.0] - 2026-01-09

### ✨ Adicionado
- Video player customizado com Plyr.js
- Frame-by-frame navigation (← →)
- Timeline com markers
- Download options (proxy/original)
- Version selector integrado

### 🎨 Melhorado
- UI/UX do player
- Responsividade em mobile
- Performance de loading

---

## [0.1.0] - 2026-01-09

### 🎉 Lançamento Inicial

#### Backend
- Express server configurado
- PostgreSQL connection via Railway
- JWT authentication
- Database schema (7 tabelas iniciais)
- Auth routes (login/verify/logout)
- Middleware de autenticação

#### Frontend
- React 19 + Vite 7 setup
- Tailwind CSS 4 com tema BRICK
- 48 componentes shadcn/ui
- React Router 7
- Estrutura de componentes

#### Documentação
- README.md completo
- DEVELOPMENT.md
- QUICKSTART.md
- GITHUB_SETUP.md
- .env.example

---

## Tipos de Mudanças
- ✨ **Adicionado**: Novas funcionalidades
- 🔧 **Corrigido**: Bug fixes
- 🎨 **Melhorado**: Melhorias em funcionalidades existentes
- 🗄️ **Database**: Mudanças no schema do banco
- 🔐 **Segurança**: Correções de segurança
- 📝 **Documentação**: Mudanças na documentação
- ⚡ **Performance**: Melhorias de performance
- 🔥 **Removido**: Funcionalidades removidas
- 🚨 **Breaking**: Mudanças que quebram compatibilidade

---

## Roadmap Futuro

### [0.6.0] - Mobile Responsiveness
- [ ] UI responsiva completa para mobile
- [ ] Touch gestures no player
- [ ] Mobile-friendly comment interface
- [ ] PWA support

### [0.7.0] - Performance
- [ ] Lazy loading de componentes
- [ ] Virtual scrolling para listas longas
- [ ] Image optimization
- [ ] Cache strategies
- [ ] Optimistic updates

### [0.8.0] - Analytics
- [ ] Dashboard de métricas
- [ ] Tracking de views
- [ ] Tempo médio de review
- [ ] Estatísticas de aprovação
- [ ] User engagement metrics

### [0.9.0] - Advanced Features
- [ ] Keyboard shortcuts
- [ ] Bulk operations
- [ ] Advanced search/filtering
- [ ] Custom branding por projeto
- [ ] Integração com Slack/Discord

### [1.0.0] - Production Ready
- [ ] Full test coverage
- [ ] Performance benchmarks
- [ ] Security audit
- [ ] Documentation completa
- [ ] Onboarding flow
