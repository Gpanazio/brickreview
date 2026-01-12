# BrickReview - Guia de Funcionalidades

Este documento detalha todas as funcionalidades implementadas no BrickReview.

---

## 🎨 Drawing Annotations (Desenhos Frame-by-Frame)

### O que é
Ferramenta de desenho que permite marcar áreas específicas do vídeo em timestamps, similar ao Frame.io.

### Como usar
1. Pause o vídeo no frame desejado
2. Clique no botão de pincel na toolbar
3. Escolha uma cor (vermelho, laranja, amarelo, verde, azul, branco)
4. Desenhe sobre o vídeo usando o mouse
5. Clique em "Salvar Desenho"
6. O desenho aparecerá sempre naquele timestamp específico

### Recursos
- **6 cores disponíveis**: Vermelho, laranja, amarelo, verde, azul, branco
- **Canvas overlay**: Camada de desenho sobre o player sem afetar o vídeo
- **Persistência**: Desenhos salvos em `brickreview_drawings`
- **Visibilidade**: Todos os membros do projeto veem os desenhos
- **Guest access**: Visitantes veem desenhos em share links
- **Toast feedback**: Confirmação visual ao salvar

### Database
- Tabela: `brickreview_drawings`
- Campos: `video_id`, `timestamp`, `drawing_data` (JSON), `user_id`, `created_at`
- Relacionamento: Cada desenho vinculado a um vídeo e timestamp específico

---

## 💬 Guest Comments (Comentários de Visitantes)

### O que é
Sistema que permite visitantes comentarem em vídeos através de share links sem criar conta.

### Como funciona

#### Fluxo completo:
1. **Admin/owner** gera link de compartilhamento no menu do vídeo
2. Define **access type**: "view" (apenas visualização) ou "comment" (com interação)
3. **Guest** acessa via `/share/:token`
4. Se access type = "comment", guest pode fornecer nome de visitante
5. **Visitor name** é salvo em `localStorage` para conveniência
6. Comentários são salvos com `visitor_name` ao invés de `user_id`
7. Sistema cria **usuário temporário** via hash do nome

### Recursos
- **Sem autenticação**: Não precisa criar conta
- **Visitor name**: Nome personalizado do visitante
- **localStorage**: Nome salvo para próximas visitas
- **Emoji picker**: Visitantes podem usar emojis
- **Threads**: Visitantes podem responder comentários
- **Temp users**: Sistema cria usuário temporário para rastreamento

### Database

#### Tabela `brickreview_comments`
- `visitor_name` VARCHAR(255) - Nome do visitante
- `user_id` UUID - Nullable (guests não têm user_id)
- **Constraint CHECK**: `user_id IS NOT NULL OR visitor_name IS NOT NULL`

#### Tabela `brickreview_temp_guest_users`
- Hash do visitor_name
- Usado para rastrear guest sem expor identidade

### Endpoints
- `GET /api/shares/:token/comments/video/:videoId` - Buscar comentários (público)
- `POST /api/shares/:token/comments` - Guest adiciona comentário
- `GET /api/shares/:token/drawings/video/:videoId` - Buscar desenhos (público)

---

## 🔄 Version Management (Gerenciamento de Versões)

### O que é
Sistema de versionamento que permite múltiplas iterações de um vídeo, facilitando o processo de revisão.

### Como funciona

1. **Upload inicial** cria versão 1 (v1) sem `parent_video_id`
2. Botão **"Adicionar versão"** permite upload de nova iteração
3. Nova versão criada com `parent_video_id` apontando para o original
4. **Version selector** no player mostra todas as versões
5. **Default**: Ao abrir vídeo, mostra versão mais recente
6. Cada versão mantém **comentários independentes**

### Recursos
- **Versionamento automático**: Número de versão incremental
- **Histórico completo**: Todas as versões acessíveis
- **Comentários isolados**: Cada versão tem seus próprios comentários
- **Timeline**: Rastreamento de quando cada versão foi criada
- **Version selector**: Dropdown integrado no player

### Database
- `brickreview_videos.parent_video_id` - ID do vídeo pai (NULL para v1)
- `brickreview_videos.version_number` - Número sequencial da versão
- **Estrutura**: Versões são filhas que referenciam o vídeo original

### Exemplo
```
Vídeo Original (id: 10, version: 1, parent_video_id: NULL)
├── Versão 2 (id: 11, version: 2, parent_video_id: 10)
├── Versão 3 (id: 12, version: 3, parent_video_id: 10)
└── Versão 4 (id: 13, version: 4, parent_video_id: 10)
```

### Share Links
- Ao compartilhar um vídeo, **todas as versões vão junto**
- Guest pode trocar entre versões
- Cada versão mantém seus próprios comentários e desenhos

---

## 🔗 Share System (Sistema de Compartilhamento)

### O que é
Sistema de links públicos para compartilhar vídeos com controle granular de acesso.

### Tipos de Compartilhamento

#### 1. Video Share
- Compartilha um vídeo específico
- **Inclui todas as versões** desse vídeo
- Guest pode trocar entre versões

#### 2. Folder Share
- Compartilha todos os vídeos de uma pasta
- Útil para compartilhar projeto inteiro

#### 3. Project Share
- Compartilha todos os vídeos de um projeto
- Acesso completo ao projeto

### Access Types

#### View (Visualização)
- **Acesso**: Apenas assistir o vídeo
- **Restrições**: Não pode comentar, desenhar ou fazer download
- **Use case**: Cliente final que só precisa visualizar

#### Comment (Comentário)
- **Acesso**: Visualização + comentários + desenhos
- **Recursos**: Pode adicionar comentários, emojis, e ver desenhos
- **Restrições**: Não pode fazer download
- **Use case**: Revisão colaborativa com feedback

### Clipboard Fallback

Implementação robusta para garantir que o link sempre seja copiado:

#### Camada 1: Modern Clipboard API
```javascript
await navigator.clipboard.writeText(url)
```
- Melhor UX
- Requer HTTPS
- Pode ser bloqueado por browser

#### Camada 2: Legacy execCommand
```javascript
document.execCommand('copy')
```
- Fallback para browsers antigos
- Funciona em HTTP
- Deprecated mas funcional

#### Camada 3: Manual Prompt
```javascript
prompt('Copie o link:', url)
```
- Último recurso
- Sempre funciona
- UX inferior mas garantido

### Recursos
- **Token-based auth**: URLs com tokens aleatórios
- **Expiration dates**: Links podem expirar
- **Access control**: Validação de permissões no backend
- **Share tracking**: Rastreamento de acessos (futuro)

### Database
- Tabela: `brickreview_shares`
- Campos: `token`, `resource_type`, `resource_id`, `access_type`, `expires_at`, `created_by`

### Endpoints
- `POST /api/shares` - Criar share link
- `GET /api/shares/:token` - Validar e obter share data
- `DELETE /api/shares/:token` - Invalidar share link (futuro)

---

## 🎬 Video Player

### Recursos do Player

#### Plyr.js Customizado
- Player baseado em Plyr.js com customizações para tema BRICK
- Controles personalizados com estilo minimalista
- Timeline com markers visuais

#### Frame-by-Frame Navigation
- **Setas ← →**: Avançar/retroceder frame por frame
- **Precisão**: Controle exato para marcar timestamps
- **Use case**: Identificar frame exato para comentários

#### Timeline com Markers
- **Comment markers**: Pontos vermelhos na timeline indicam comentários
- **Drawing markers**: Indicadores visuais de onde há desenhos
- **Click to jump**: Clicar no marker pula para aquele timestamp

#### Version Selector
- **Dropdown integrado**: Troca entre versões sem sair do player
- **Badge de versão**: Mostra versão atual (v1, v2, v3...)
- **Indicador visual**: Versão atual destacada

#### Download Options
- **Proxy (720p)**: Versão comprimida para download rápido
- **Original (HD)**: Arquivo original em alta qualidade
- **Apenas autenticados**: Guests não podem fazer download

#### Approval Status
- **Badge visual**: Mostra status de aprovação (pending, approved, changes_requested)
- **Cores semânticas**: Verde (aprovado), amarelo (ajustes), cinza (pendente)

### Stability Fixes

#### Player Remount
- **Key composta**: `${currentVideoId}-${videoUrl}` força remontagem completa
- **Destruição explícita**: `player.destroy()` antes de trocar versão
- **Previne**: Crashes e conflitos de DOM

#### Loading States
- **isLoadingVideo**: Flag para controlar carregamento
- **Spinner**: Indicador visual durante transição
- **Previne**: Tela preta ao trocar versões

#### Debug Logs
- Console logs para troubleshooting
- Rastreamento de URL fetching
- Identificação de erros de streaming

### Guest Access
- **Detecção automática**: `isGuest = isPublic || !token`
- **Endpoints públicos**: Stream, comments, drawings via share token
- **Access control**: Validação de permissões no backend
- **UX consistente**: Guest tem mesma experiência visual

---

## 😊 Emoji Picker

### O que é
Picker de emojis integrado aos comentários para adicionar expressividade.

### Recursos
- **Biblioteca**: emoji-picker-react
- **Categorias**: Smileys, people, nature, food, etc.
- **Search**: Busca por nome do emoji
- **Skin tones**: Suporte a variações de tom de pele
- **Recent**: Emojis usados recentemente

### Como usar
1. Clique no ícone de emoji no campo de comentário
2. Escolha emoji no picker
3. Emoji inserido no cursor atual
4. Pode adicionar múltiplos emojis

### Integração
- **Posicionado**: Popup acima do campo de comentário
- **Responsivo**: Se adapta a tamanho da tela
- **Acessível**: Funciona com teclado

---

## 🔐 Sistema de Autenticação

### Master Users
- Tabela `master_users` compartilhada com outros sistemas BRICK
- Suporta: brickprojects, BrickAI, e futuras ferramentas

### Roles
- **admin**: Equipe interna - acesso completo
- **client**: Clientes externos - acesso restrito

### JWT Authentication
- Tokens JWT com expiração
- Refresh token strategy (futuro)
- Secure httpOnly cookies

### Guest vs Authenticated
- **Guests**: Access via share token, sem persistência de identidade
- **Authenticated**: Full access, ownership, notificações

---

## 📊 Sistema de Aprovação

### Status de Aprovação
- **pending**: Aguardando revisão
- **approved**: Aprovado pelo cliente
- **changes_requested**: Cliente solicitou ajustes

### Workflow
1. Admin faz upload do vídeo
2. Cliente revisa e adiciona comentários
3. Cliente aprova ou solicita changes
4. Se changes, nova versão é enviada
5. Processo repete até aprovação final

### Notificações
- Email enviado quando status muda
- Notificação in-app
- Rastreamento de quem aprovou/rejeitou

---

## 🔔 Notificações

### Tipos
- **Novo comentário**: Quando alguém comenta em seu vídeo
- **Resposta**: Quando alguém responde seu comentário
- **Aprovação**: Quando status de aprovação muda
- **Nova versão**: Quando nova versão é enviada

### Canais
- **In-app**: Dropdown de notificações no header
- **Email**: Via Resend API
- **Badge count**: Contador de não lidas

---

Para mais informações técnicas, consulte:
- [README.md](README.md) - Visão geral do projeto
- [API_REFERENCE.md](API_REFERENCE.md) - Documentação completa da API
- [DEVELOPMENT.md](DEVELOPMENT.md) - Guia para desenvolvedores
