# 🚀 Plano de Ação: BrickReview v0.6+

Este documento descreve o roteiro estratégico para as próximas fases de desenvolvimento do BrickReview, focando em refatoração técnica, escalabilidade de infraestrutura e integração com ferramentas de edição profissional (NLEs).

---

## 📅 Fase 1: Refatoração e Estabilidade (Imediato)
**Foco:** Resolver dívidas técnicas críticas e melhorar a performance do cliente.

### 1.1 Desacoplamento do `VideoPlayer.jsx`
O componente atual acumula muitas responsabilidades (player, canvas, comentários, aprovação).
- [ ] **Extrair `ReviewCanvas.jsx`**: Isolar toda a lógica de desenho (`canvasRef`, eventos de mouse) em um componente puro que recebe apenas dimensões e timestamp.
- [ ] **Extrair `CommentSidebar.jsx`**: Mover a lista de comentários, lógica de threads e formulário de input para um componente lateral independente.
- [ ] **Extrair `TimelineMarkers.jsx`**: Criar um componente dedicado para renderizar os "pontos" de comentários/desenhos na barra de progresso.
- [ ] **Gerenciamento de Estado**: Implementar um Contexto (`VideoContext`) ou Zustand para compartilhar o estado do player (`currentTime`, `isPlaying`, `duration`) entre esses sub-componentes sem *prop drilling*.

### 1.2 Otimização de Performance
- [ ] **Virtualização de Listas**: Implementar `react-window` ou `virtua` na lista de arquivos (`FolderView`) e na lista de comentários para suportar centenas de itens sem travar a UI.
- [ ] **Memoização**: Revisar componentes de cartões (`VideoCard`, `FileCard`) e aplicar `React.memo` corretamente, garantindo que funções de callback (`onDelete`, `onMove`) sejam estáveis com `useCallback`.

---

## 📅 Fase 2: Infraestrutura e Escalabilidade (Curto Prazo)
**Foco:** Resolver o gargalo de processamento de vídeo e evitar timeouts em uploads grandes.

### 2.1 Processamento Assíncrono (Background Jobs)
O processamento atual do FFmpeg bloqueia a requisição HTTP.
- [ ] **Setup de Fila**: Adicionar Redis e BullMQ ao stack do projeto (serviço adicional no Railway).
- [ ] **Worker de Processamento**: Criar um processo Node.js separado (worker) que consome a fila de uploads.
- [ ] **Refatoração do Upload**:
    1. Rota `POST /upload` apenas salva o arquivo "cru" no R2 e cria registro no DB com status `processing`.
    2. Retorna `202 Accepted` imediatamente.
    3. Worker baixa o arquivo, gera thumbnail/proxy/sprites e atualiza o DB para `ready`.
- [ ] **Feedback na UI**: Implementar *polling* ou *sockets* para atualizar o status do vídeo na tela do usuário ("Processando... 45%").

### 2.2 Streaming Adaptativo (HLS)
- [ ] **Transcodificação**: Atualizar o script FFmpeg para gerar playlists HLS (`.m3u8`) e segmentos (`.ts`) além do MP4 proxy.
- [ ] **Player HLS**: Configurar o Plyr para consumir o stream HLS nativamente, permitindo ajuste automático de qualidade (360p, 720p, 1080p) conforme a banda do cliente.

---

## 📅 Fase 3: Integração Profissional (Médio Prazo)
**Foco:** Conectar o BrickReview ao fluxo de trabalho dos editores (DaVinci Resolve / Premiere).

### 3.1 Plugin DaVinci Resolve (MVP - Scripting)
Uma abordagem inicial baseada em scripts para importar feedback.
- [ ] **Script Python Local**: Criar um script `.py` que roda dentro do console do DaVinci.
- [ ] **Fluxo de Autenticação**: O script pede Login/Senha do BrickReview.
- [ ] **Seleção de Projeto**: Lista os projetos/vídeos disponíveis na API.
- [ ] **Importação de Marcadores**: Lê os comentários do vídeo selecionado e cria marcadores na timeline ativa do DaVinci usando a API `Resolve().GetCurrentTimeline().AddMarker()`.

### 3.2 Painel de Extensão (Workflow Integration)
Uma aplicação visual dentro do DaVinci.
- [ ] **Setup Electron**: Configurar um projeto Electron compatível com o Workflow Integration do DaVinci.
- [ ] **Frontend Embarcado**: Reutilizar os componentes React (`CommentSidebar`, `Login`) adaptados para o painel estreito do editor.
- [ ] **Comunicação Bidirecional**: Implementar lógica onde clicar em um comentário no painel move a agulha da timeline do DaVinci para o frame exato.

---

## 📅 Fase 4: Funcionalidades Avançadas (Longo Prazo)
**Foco:** Colaboração em tempo real e busca.

### 4.1 Colaboração em Tempo Real (WebSockets)
- [ ] **Servidor Socket.io**: Subir instância de Socket.io junto ao Express.
- [ ] **Eventos**:
    - `new_comment`: Atualiza a lista de todos os conectados no mesmo vídeo.
    - `typing`: Mostra "Fulano está digitando...".
    - `cursor_move`: (Opcional) Mostra cursores de outros usuários sobre o vídeo.

### 4.2 Busca Global (Full Text Search)
- [ ] **Indexação**: Configurar índices `tsvector` no PostgreSQL para as tabelas `brickreview_projects`, `brickreview_videos` e `brickreview_comments`.
- [ ] **Endpoint de Busca**: Criar rota `/api/search` que aceita uma query e retorna resultados categorizados.
- [ ] **UI de Busca**: Conectar o componente `Command` (Cmd+K) existente a este endpoint.

---

## 🛠️ Stack Tecnológica Sugerida para Expansão

| Componente | Tecnologia Atual | Sugestão de Upgrade |
|:---|:---|:---|
| **Fila** | *Nenhuma (Síncrono)* | **BullMQ + Redis** |
| **Streaming** | MP4 Progressivo | **HLS (HTTP Live Streaming)** |
| **Real-time** | *Nenhum (Polling)* | **Socket.io** |
| **Busca** | `ILIKE` SQL simples | **PostgreSQL Full Text Search** |
| **DaVinci** | *Nenhum* | **Python Scripting API** |
