# Configuração de Múltiplos Buckets R2

Este guia explica como configurar múltiplos buckets Cloudflare R2 para expandir o armazenamento do BrickReview.

## Visão Geral

O BrickReview agora suporta múltiplos buckets R2, permitindo:
- ✅ Até 20GB de armazenamento gratuito (2 buckets x 10GB cada)
- ✅ Dashboard de monitoramento em tempo real
- ✅ Distribuição automática de carga entre buckets
- ✅ Estatísticas detalhadas por bucket

## Passo 1: Obter Credenciais do Bucket Secundário

### 1.1 Acesse o Cloudflare Dashboard da segunda conta
```
https://dash.cloudflare.com/
```

### 1.2 Navegue até R2
- No menu lateral, clique em **R2**
- Crie um novo bucket se ainda não tiver (ex: `brickreview-videos-secondary`)

### 1.3 Obtenha o Account ID
- No canto superior direito, copie o **Account ID**
- Exemplo: `18ddeeeb2895888087f28bba9d9815d6`

### 1.4 Crie um API Token R2
1. Clique em **Manage R2 API Tokens**
2. Clique em **Create API Token**
3. Configure:
   - **Token Name**: `brickreview-secondary`
   - **Permissions**: Object Read & Write
   - **R2 Buckets**: Include → Specific bucket → Selecione seu bucket
4. Copie:
   - **Access Key ID**
   - **Secret Access Key**

### 1.5 Configure o Public URL
1. No bucket, vá em **Settings**
2. Em **Public Access**, habilite **R2.dev subdomain**
3. Copie a URL pública (ex: `https://pub-yyyyy.r2.dev`)

## Passo 2: Configurar Variáveis de Ambiente no Railway

### Acessar Railway
```bash
https://railway.app/
```

### Adicionar Variáveis de Ambiente

No seu projeto Railway, adicione as seguintes variáveis:

```env
# Secondary Bucket Configuration
R2_SECONDARY_ACCOUNT_ID=seu-account-id-aqui
R2_SECONDARY_ACCESS_KEY_ID=sua-access-key-aqui
R2_SECONDARY_SECRET_ACCESS_KEY=sua-secret-key-aqui
R2_SECONDARY_BUCKET_NAME=brickreview-videos-secondary
R2_SECONDARY_PUBLIC_URL=https://pub-yyyyy.r2.dev

# Storage Limits (opcional, default: 10GB)
R2_PRIMARY_LIMIT=10737418240
R2_SECONDARY_LIMIT=10737418240
```

### Como Adicionar no Railway

1. Acesse seu projeto no Railway
2. Clique na aba **Variables**
3. Clique em **+ New Variable**
4. Adicione cada variável uma por uma
5. Clique em **Deploy** para aplicar as mudanças

## Passo 3: Verificar Configuração

### Testar API Token (Opcional)

Você pode verificar se o token está válido usando curl:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/SEU_ACCOUNT_ID/tokens/verify" \
  -H "Authorization: Bearer SEU_API_TOKEN"
```

### Acessar Dashboard de Armazenamento

1. Faça deploy das alterações no Railway
2. Acesse o BrickReview
3. Vá em **Configurações** no menu lateral
4. Você verá:
   - Armazenamento Total combinado
   - Estatísticas de cada bucket individual
   - Gráficos de uso em tempo real

## Estrutura das Variáveis

### Bucket Principal (Obrigatório)
```env
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=...
R2_PRIMARY_LIMIT=10737418240  # 10GB em bytes
```

### Bucket Secundário (Opcional)
```env
R2_SECONDARY_ACCOUNT_ID=...
R2_SECONDARY_ACCESS_KEY_ID=...
R2_SECONDARY_SECRET_ACCESS_KEY=...
R2_SECONDARY_BUCKET_NAME=...
R2_SECONDARY_PUBLIC_URL=...
R2_SECONDARY_LIMIT=10737418240  # 10GB em bytes
```

## Limites do Plano Free

Cada bucket R2 no plano gratuito do Cloudflare tem:
- **Armazenamento**: 10 GB/mês
- **Operações Classe A**: 1 milhão/mês (write, list)
- **Operações Classe B**: 10 milhões/mês (read)

Com 2 buckets, você tem:
- ✅ **20 GB de armazenamento total**
- ✅ **2 milhões de operações de escrita/mês**
- ✅ **20 milhões de operações de leitura/mês**

## Troubleshooting

### Erro: "Bucket not found"
- Verifique se o `R2_SECONDARY_BUCKET_NAME` está correto
- Confirme que o bucket existe no Cloudflare

### Erro: "Access denied"
- Verifique as permissões do API Token
- Confirme que o token tem permissões de Read & Write
- Verifique se o token está associado ao bucket correto

### Bucket secundário não aparece no dashboard
- Confirme que todas as variáveis `R2_SECONDARY_*` estão configuradas
- Verifique os logs do Railway para erros de conexão
- Faça um redeploy após adicionar as variáveis

### Dashboard mostra erro em um dos buckets
- Isso é normal se apenas um bucket está configurado
- O bucket principal sempre funciona, o secundário é opcional
- Verifique as credenciais do bucket com erro

## Comandos Úteis

### Verificar Token Cloudflare
```bash
curl "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/tokens/verify" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

### Ver Logs do Railway
```bash
railway logs
```

### Testar Endpoint de Storage
```bash
curl https://seu-app.up.railway.app/api/storage/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Segurança

⚠️ **IMPORTANTE:**
- Nunca compartilhe suas credenciais R2
- Não commite arquivos `.env` no git
- Use tokens com permissões mínimas necessárias
- Considere rotação periódica de tokens
- Monitore o uso para evitar surpresas

## Suporte

Se encontrar problemas:
1. Verifique os logs do Railway
2. Confirme todas as variáveis de ambiente
3. Teste as credenciais usando a API do Cloudflare
4. Abra uma issue no repositório do projeto
