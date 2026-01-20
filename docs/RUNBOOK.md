# 📋 RUNBOOK DE PRODUÇÃO - BrickReview

> **Última atualização:** 2026-01-20

## 🏥 Health Checks

### Verificar Saúde do Sistema
```bash
# Health check básico
curl https://your-domain.railway.app/api/health

# Resposta esperada:
# { "status": "ok", "timestamp": "...", "uptime": 12345 }
```

### Indicadores de Saúde
| Métrica | Normal | Alerta | Crítico |
|---------|--------|--------|---------|
| CPU | < 70% | 70-85% | > 85% |
| Memória | < 80% | 80-90% | > 90% |
| Latência p99 | < 500ms | 500ms-2s | > 2s |
| Taxa de Erro 5xx | < 1% | 1-5% | > 5% |

---

## 🔥 Procedimentos de Emergência

### 1. Alta Taxa de Erros 5xx

**Diagnóstico:**
```bash
# Verificar logs recentes
railway logs --lines 100 | grep -i error

# Testar endpoints críticos
curl -I https://your-domain/api/auth/verify
curl -I https://your-domain/api/projects
```

**Ações:**
1. Verificar conexão com banco: `SELECT 1` no Railway DB
2. Verificar uso de memória
3. Considerar rollback se erro recente em deploy

### 2. Banco de Dados Lento

**Diagnóstico:**
```sql
-- Queries lentas
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Conexões ativas
SELECT count(*) FROM pg_stat_activity;
```

**Ações:**
1. Verificar índices: `EXPLAIN ANALYZE <query>`
2. Limpar conexões idle: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';`
3. Aumentar pool se necessário

### 3. Rate Limiting Bloqueando Usuários Legítimos

**Diagnóstico:**
```bash
# Verificar logs de rate limit
railway logs | grep "RATE_LIMIT"
```

**Ações:**
1. Verificar se é ataque ou uso legítimo
2. Desabilitar temporariamente:
   ```bash
   railway variables set FEATURE_RATE_LIMITING=false
   ```
3. Ajustar limites no código se necessário

### 4. Upload Falhando

**Diagnóstico:**
```bash
# Verificar espaço em disco
df -h

# Verificar logs de upload
railway logs | grep -i "upload\|r2\|ffmpeg"
```

**Checklist:**
- [ ] FFmpeg funcionando? (`which ffmpeg`)
- [ ] R2 acessível? (verificar credenciais)
- [ ] Disco temp-uploads cheio?
- [ ] Memória suficiente?

---

## 🔧 Manutenção Rotineira

### Diária
- [ ] Verificar health check
- [ ] Revisar alertas de erro
- [ ] Verificar uso de disco

### Semanal
- [ ] Executar `npm audit`
- [ ] Revisar métricas de performance
- [ ] Limpar lixeira: `node scripts/cleanup-trash.js`

### Mensal
- [ ] Limpar R2 órfãos: `node scripts/cleanup-r2.js`
- [ ] Atualizar dependências (teste em staging primeiro)
- [ ] Revisar logs de segurança

---

## 📊 Comandos Úteis

### Logs
```bash
# Últimos 100 logs
railway logs --lines 100

# Seguir logs em tempo real
railway logs --follow

# Filtrar por erro
railway logs | grep -i error
```

### Variáveis de Ambiente
```bash
# Listar todas
railway variables

# Definir variável
railway variables set KEY=value

# Feature flags de emergência
railway variables set FEATURE_RATE_LIMITING=false
railway variables set FEATURE_EMAIL_NOTIFICATIONS=false
```

### Rollback
```bash
# Via Railway CLI
railway deployments
railway rollback <DEPLOYMENT_ID>

# Via Git
git revert HEAD
git push origin main
```

---

## 🛠️ Scripts de Manutenção

### Limpeza de Lixeira (> 7 dias)
```bash
node scripts/cleanup-trash.js
```

### Sincronizar Metadados de Vídeo
```bash
node scripts/process-video-metadata.js
```

### Diagnóstico FFmpeg
```bash
node scripts/diagnose-ffmpeg.js
```

### Limpar Arquivos Órfãos R2
```bash
node scripts/cleanup-r2.js
```

---

## 📞 Escalação

| Nível | Tempo | Ação |
|-------|-------|------|
| L1 | 0-15min | Diagnóstico inicial, restart |
| L2 | 15-30min | Rollback, desabilitar feature |
| L3 | 30min+ | Escalar para Dev Lead |

## 🔗 Links Úteis

- [Railway Dashboard](https://railway.app/dashboard)
- [Cloudflare R2 Dashboard](https://dash.cloudflare.com)
- [Rollback Plan](./ROLLBACK_PLAN.md)
- [API Reference](../API_REFERENCE.md)
