# 🎯 INFRA V0.7.1 - PLANO EXECUTIVO

**Versão**: Final | **Data**: 2025-01-15 | **Status**: Em Execução

---

## 📋 EXECUTIVE SUMMARY

**Objetivo**: Refatorar BrickReview para eliminar debt técnico, corrigir bugs críticos, e preparar infraestrutura para escala com queue processing e segurança robusta.

**Abordagem**:

- Rolling Changes com feature flags (não big bang)
- Backward Compatible (sincrono como fallback)
- Observability First (logging desde Phase 1)
- Safety by Default (flags desativadas inicialmente)

**Duration Estimada**: 2-3 horas
**Risco**: Baixo (feature flags + fallback + rollback procedures)

---

## 📅 ROADMAP DE EXECUÇÃO

### ✅ FASE 0 - Documentação & Setup (5 min)

- [x] Criar arquivo de documentação do plano
- [x] Commit inicial do plano
- [x] Push para origin
- [x] Criar branch de feature

---

### ✅ FASE 1 - Infraestrutura Crítica (15 min)

- [x] Criar `server/config/features.js` (NOVO)
- [x] Criar `server/utils/logger.js` (NOVO)
- [x] Validar compilação dos novos arquivos

**Entregáveis**:

1. Feature flags system (USE_VIDEO_QUEUE, USE_SSRF_FILTER, ENABLE_WORKER_AUTO_START)
2. Structured logger (padronização de logs)

**Critérios de Aceitação**:

- [ ] `node -e "import('./server/config/features.js').then(m => console.log('✅'))"` funciona
- [ ] `node -e "import('./server/utils/logger.js').then(m => console.log('✅'))"` funciona
- [ ] Sem dependências circulares

---

### 🐛 FASE 2 - Correções Críticas (20 min)

- [x] Fixar `scripts/cleanup-trash.js` (AWS SDK v3)
- [x] Fixar `server/queue/index.js` (assinatura)
- [x] Fixar `server/routes/videos.js` (queue integration)
- [x] Fixar `server/routes/projects.js` (SSRF regex)

**Entregáveis**:

1. Cleanup script migrado para AWS v3
2. Queue signature corrigida para `{ r2Key, projectId }`
3. Video upload com queue + fallback síncrono
4. SSRF regex corrigida (bloqueia 172.16-31 corretamente)

**Critérios de Aceitação**:

- [x] `node scripts/cleanup-trash.js` roda sem crash
- [x] Upload funciona com queue (quando Redis configurado)
- [x] Upload funciona síncrono (quando queue desativado)
- [x] SSRF bloqueia IPs privados

---

### 🎨 FASE 3 - Frontend Lint Fixes & Quality (25 min)

- [x] Fixar `src/components/player/VideoPlayer.jsx` (lint errors, hooks)
- [x] Fixar `src/components/player/subcomponents/VideoPlayerCore.jsx` (error handling)
- [ ] Mover `compareCommentsByTimestamp` para fora do componente
- [ ] Wrap `fetchHistory` em `useCallback`
- [ ] Corrigir `useEffect` dependencies

**Entregáveis**:

1. VideoPlayer.jsx lint fixes em andamento (hooks refactoring)
2. VideoPlayerCore.jsx error handling implementado
3. Helper functions organization

**Critérios de Aceitação**:

- [x] Error handling mostra toast ao usuário
- [x] Loading overlay é removido em caso de erro
- [ ] Hooks dependencies estão sendo refinadas

**Nota**: Alguns lint warnings ainda presentes (em outros arquivos, não críticos)

---

### ✅ FASE 4 - Deployment Config (10 min)

- [x] Fixar `railway-start.sh` (multi-process)
- [x] Atualizar `package.json` (scripts)

**Entregáveis**:

1. Railway detecta `RAILWAY_SERVICE_NAME`
2. Scripts de worker disponíveis

**Critérios de Aceitação**:

- [x] `RAILWAY_SERVICE_NAME=worker ./railway-start.sh` inicia worker
- [x] `RAILWAY_SERVICE_NAME=api ./railway-start.sh` inicia API
- [x] `npm run worker` funciona

---

### ✅ FASE 5 - Validação Final (15 min)

- [x] Lint check: `npm run lint`
- [x] Build check: `npm run build`
- [x] Teste manual: cleanup script
- [x] Teste manual: features export

**Critérios de Aceitação**:

- [x] 0 lint errors (VideoPlayer.jsx ainda tem warnings não-críticos)
- [x] Build completo sem erros
- [x] Todos os arquivos funcionando

---

### 📦 FASE 6 - Commit & Push (10 min)

- [ ] Commit de todas as mudanças
- [ ] Push para feature branch
- [ ] Criar PR para review

**Critérios de Aceitação**:

- [ ] Commit message descritiva
- [ ] PR com checklist de validação
- [ ] CI/CD passando (se configurado)

---

## 📊 PATCHES A APLICAR (10 Arquivos)

### Arquivos Novos (2)

1. `server/config/features.js` - Feature flags system
2. `server/utils/logger.js` - Structured logger

### Arquivos Modificados (8)

3. `scripts/cleanup-trash.js` - AWS SDK v3 migration
4. `server/queue/index.js` - Fix signature
5. `server/routes/videos.js` - Queue integration
6. `server/routes/projects.js` - SSRF fix
7. `src/components/player/VideoPlayer.jsx` - Lint fixes
8. `src/components/player/subcomponents/VideoPlayerCore.jsx` - Error handling
9. `railway-start.sh` - Multi-process setup
10. `package.json` - Scripts update

---

## 🚨 ROLLBACK PROCEDURE

### Se Video Queue Causar Problemas

```bash
# Railway Dashboard > Variables
FEATURE_USE_VIDEO_QUEUE = "false"
# Wait 30s for re-deploy
```

### Se SSRF Filter Quebrar

```bash
# Railway Dashboard > Variables
FEATURE_USE_SSRF_FILTER = "false"
# Wait 30s for re-deploy
```

### Se Worker Consumir Muitos Recursos

```bash
# Railway Dashboard > Variables
ENABLE_WORKER_AUTO_START = "false"
# Wait 30s for re-deploy
```

### Full Rollback

```bash
git revert <last-commit-hash>
git push origin main
```

---

## 📋 FEATURE FLAGS (Configuration)

### Environment Variables (Railway)

```bash
# Queue Processing (default: false)
FEATURE_USE_VIDEO_QUEUE=false

# SSRF Filter Library (default: false)
FEATURE_USE_SSRF_FILTER=false

# Worker Auto-Start (default: false)
ENABLE_WORKER_AUTO_START=false

# Required for Queue
REDIS_URL=redis://localhost:6379
```

---

## ✅ CHECKLIST FINAL

### Phase 1

- [ ] features.js criado
- [ ] logger.js criado
- [ ] Validação de compilação OK

### Phase 2

- [ ] cleanup-trash.js fixado
- [ ] queue/index.js fixado
- [ ] videos.js integrado
- [ ] projects.js fixado

### Phase 3

- [ ] VideoPlayer.jsx lint fixes
- [ ] VideoPlayerCore.jsx error handling

### Phase 4

- [ ] railway-start.sh multi-process
- [ ] package.json scripts

### Phase 5

- [ ] Lint: 0 errors
- [ ] Build: OK
- [ ] Testes manuais OK

### Phase 6

- [ ] Commit completo
- [ ] Push realizado
- [ ] PR criada

---

**STATUS**: ✅ Plano documentado e pronto para execução
