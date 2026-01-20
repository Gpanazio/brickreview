# 🔄 ROLLBACK PLAN - BrickReview

> **Data:** 2026-01-20

## Critérios para Rollback

| Severidade | Tempo Máximo | Ação |
|------------|--------------|------|
| **CRÍTICO** | 5 min | Rollback imediato |
| **ALTO** | 15 min | Tentar hotfix |
| **MÉDIO** | 1 hora | Analisar |

### Gatilhos Automáticos
- Taxa de erro 5xx > 10%
- Health check falhando 3x
- Latência p99 > 10s

## Railway Rollback

### Via Dashboard
1. Acesse Railway Dashboard
2. Projeto > Deployments
3. Clique nos 3 pontos do deploy anterior
4. Selecione "Rollback"

### Via CLI
```bash
railway login
railway deployments
railway rollback <DEPLOYMENT_ID>
```

## Git Rollback

```bash
# Revert (seguro)
git revert HEAD
git push origin main

# Reset (cuidado)
git reset --hard <COMMIT>
git push --force origin main
```

## Database Rollback

```sql
-- Ver migrações
SELECT * FROM schema_migrations ORDER BY applied_at DESC;
-- Executar rollback manual conforme migração
```

## Checklist Pós-Rollback

- [ ] curl /api/health retorna 200
- [ ] Login funcionando
- [ ] Upload funcionando
- [ ] Vídeo reproduz
- [ ] Comentários funcionando
- [ ] Rate limiting ativo

## Desabilitar Feature (Emergência)

```bash
railway variables set FEATURE_X_ENABLED=false
```

## Contatos

| Função | Contato |
|--------|---------|
| Dev Lead | [contato] |
| DevOps | [contato] |
| CTO | [contato] |
