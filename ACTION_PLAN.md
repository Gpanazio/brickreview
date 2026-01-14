# 🚀 Plano de Ação: BrickReview v0.7+ (Fase de Infraestrutura)

Este documento descreve o roteiro para a implementação da infraestrutura de processamento assíncrono, focando na qualidade de vídeo e estabilidade do servidor.

---

## 📅 Fase 10: Infraestrutura de Escala & Fidelidade (Prioridade Imediata)

**Foco:** Garantir que uploads grandes não travem o servidor e que a qualidade de imagem seja profissional.

### 10.1 Setup de Fila (Background Jobs)

- [ ] **Instalar Dependências**: `bullmq` e `ioredis`.
- [ ] **Configurar Redis**: Adicionar conexão Redis ao projeto (Railway ou local).
- [ ] **Criar Queue**: Inicializar a fila `video-processing`.
- [ ] **Criar Worker**: Implementar o processador de jobs que rodará o FFmpeg.

### 10.2 Pipeline de Decisão de Qualidade (The Bitrate Matrix)

Implementar a lógica inteligente que decide se o vídeo original pode ser usado diretamente ou se precisa de re-encoding de alta qualidade.

- [ ] **Análise**: Usar `ffprobe` para extrair bitrate e resolução.
- [ ] **Regras de Negócio**:
  - **Original**: Se bitrate < Threshold (ex: 15Mbps para 1080p), usa o original.
  - **Streaming High**: Se bitrate > Threshold, gera novo MP4 (ex: 35Mbps para 4K).
  - **Proxy**: Sempre gera 720p leve.
- [ ] **Normalização de Áudio**: Converter áudio para AAC 320kbps em todos os processamentos.

### 10.3 Pipeline de Cor (FFmpeg)

Configurar flags do FFmpeg para garantir que não haja mudança de gama ou cor.

- [ ] **Flags Obrigatórias**: `-pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709`.
- [ ] **Otimização de Seek**: Garantir GOP fixo para navegação rápida.

### 10.4 Feedback na UI (Tempo Real)

- [ ] **API de Status**: Criar endpoint para consultar status do job (`pending`, `processing`, `completed`, `failed`).
- [ ] **Polling no Frontend**: Atualizar o `VideoCard` e `ProjectDetailPage` para mostrar "Processando..." ou barra de progresso.

---

## 📅 Fase 11: Performance de UI (Frontend)

**Foco:** Otimizar a experiência do usuário em projetos grandes.

### 11.1 Virtualização

- [ ] **CommentSidebar**: Implementar `virtua` para listas com centenas de comentários.
- [ ] **FolderView**: Virtualizar grid de arquivos.

### 11.2 Atalhos Profissionais

- [ ] **Navegação**: J-K-L (Play/Pause/Rewind).
- [ ] **Precisão**: Setas para frame-by-frame.
- [ ] **Marcação**: I / O para In/Out points (futuro).

---

## 📅 Fase 12: Integrações Externas (Médio Prazo)

**Foco:** Conectar com NLEs (DaVinci/Premiere).

### 12.1 Scripting DaVinci Resolve

- [ ] **Python Script**: Script local que autentica na API do BrickReview.
- [ ] **Importação de Markers**: Baixar comentários como marcadores na timeline do DaVinci.

---

## 🛠️ Stack Tecnológica (Atualizada)

| Componente        | Tecnologia Atual       | Upgrade Fase 10                            |
| :---------------- | :--------------------- | :----------------------------------------- |
| **Fila**          | _Nenhuma (Síncrono)_   | **BullMQ + Redis**                         |
| **Processamento** | Servidor Web (Express) | **Worker Isolado (Node.js)**               |
| **Streaming**     | MP4 Básico             | **MP4 High Fidelity (Bitrate Controlado)** |
| **Cor**           | Padrão FFmpeg          | **Pipeline BT.709 Gerenciado**             |
