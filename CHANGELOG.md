# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

### 🔧 Critical Fixes v0.7.1 (2026-01-14)

#### Bug Fixes
- **FIXED**: `ReferenceError: Cannot access 'h' before initialization` - Crash ao iniciar aplicação
  - Causa: Temporal Dead Zone (TDZ) em hooks React
  - Solução: Reordenação de `useCallback` e `useEffect` em `useAuth.jsx` e `ShareViewPage.jsx`
- **FIXED**: CSP bloqueando vídeos do R2 CDN
  - Adicionado `media-src 'self' https: blob:` ao Content-Security-Policy
  - Adicionado `style-src https:` para fontes externas
- **FIXED**: Conflito de merge em `server/database.sql` (coluna `timestamp_end`)

#### Reverts
- `VideoPlayer.jsx` revertido para estado estável anterior
  - Mantida funcionalidade completa de player, comentários e desenhos

#### Dependencies
- **REMOVED**: `react-window` (removido por complexidade e incompatibilidade com React 19)

#### Linting
- ✅ Corrigidos todos os erros ESLint restantes
- ✅ Corrigidos warnings de `react-hooks/exhaustive-deps`

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
