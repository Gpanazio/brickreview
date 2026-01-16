# Google Drive Integration Setup

Este guia explica como configurar o Google Drive como armazenamento de backup para o BrickReview.

## 📋 Visão Geral

O sistema híbrido de armazenamento funciona assim:
- **R2 (20GB)**: Cache rápido para vídeos recentes
- **Google Drive (30TB)**: Backup de longo prazo
- **Estratégia**: Sempre faz backup no Drive, remove do R2 quando encher

## 🎯 Passo 1: Criar Projeto no Google Cloud

### 1.1 Acessar Google Cloud Console
```
https://console.cloud.google.com/
```

### 1.2 Criar Novo Projeto
1. Clique em **Select a Project** (topo da página)
2. Clique em **NEW PROJECT**
3. Nome: `BrickReview Storage`
4. Clique em **CREATE**

### 1.3 Habilitar Google Drive API
1. No menu lateral, vá em **APIs & Services** → **Library**
2. Busque por **Google Drive API**
3. Clique em **ENABLE**

## 🔐 Passo 2: Criar Credenciais OAuth

### 2.1 Configurar Tela de Consentimento
1. Vá em **APIs & Services** → **OAuth consent screen**
2. Escolha **External** e clique em **CREATE**
3. Preencha:
   - **App name**: BrickReview
   - **User support email**: seu-email@gmail.com
   - **Developer contact**: seu-email@gmail.com
4. Clique em **SAVE AND CONTINUE**
5. Em **Scopes**, clique em **ADD OR REMOVE SCOPES**
6. Busque e selecione:
   - `https://www.googleapis.com/auth/drive.file`
7. Clique em **UPDATE** e depois **SAVE AND CONTINUE**
8. Em **Test users**, adicione seu email
9. Clique em **SAVE AND CONTINUE**

### 2.2 Criar Credenciais OAuth 2.0
1. Vá em **APIs & Services** → **Credentials**
2. Clique em **CREATE CREDENTIALS** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `BrickReview OAuth`
5. Em **Authorized redirect URIs**, adicione:
   ```
   http://localhost:3002/api/drive/oauth/callback
   https://seu-app.up.railway.app/api/drive/oauth/callback
   ```
6. Clique em **CREATE**
7. **COPIE** o **Client ID** e **Client secret**

## 📁 Passo 3: Criar Pasta no Google Drive

### 3.1 Criar Pasta
1. Acesse [Google Drive](https://drive.google.com/)
2. Clique em **New** → **New folder**
3. Nome: `BrickReview Videos`
4. Clique em **CREATE**

### 3.2 Obter ID da Pasta
1. Abra a pasta criada
2. Copie o ID da URL:
   ```
   https://drive.google.com/drive/folders/[ESTE_É_O_ID]
   ```
   Exemplo: `1a2b3c4d5e6f7g8h9i0j`

## 🔑 Passo 4: Gerar Refresh Token

### 4.1 Adicionar Credenciais Temporárias no Railway
Adicione estas variáveis no Railway (temporariamente):
```env
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_CLIENT_ID=seu-client-id-aqui
GOOGLE_DRIVE_CLIENT_SECRET=seu-client-secret-aqui
GOOGLE_DRIVE_REDIRECT_URI=https://seu-app.up.railway.app/api/drive/oauth/callback
GOOGLE_DRIVE_FOLDER_ID=id-da-pasta-aqui
```

### 4.2 Obter URL de Autorização
1. Faça login no BrickReview
2. Abra o Console do navegador (F12)
3. Execute:
   ```javascript
   fetch('/api/drive/auth-url', {
     headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
   })
   .then(r => r.json())
   .then(d => window.open(d.authUrl))
   ```

### 4.3 Autorizar Aplicação
1. Uma nova aba abrirá com o Google
2. Faça login com sua conta
3. Clique em **Allow**
4. Você verá uma página com o **Refresh Token**
5. **COPIE O REFRESH TOKEN**

### 4.4 Adicionar Refresh Token no Railway
Adicione/atualize no Railway:
```env
GOOGLE_DRIVE_REFRESH_TOKEN=o-refresh-token-que-voce-copiou
```

## ⚙️ Passo 5: Configuração Final no Railway

Adicione TODAS as variáveis no Railway:

```env
# Google Drive Configuration
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_CLIENT_ID=seu-client-id
GOOGLE_DRIVE_CLIENT_SECRET=seu-client-secret
GOOGLE_DRIVE_REDIRECT_URI=https://seu-app.up.railway.app/api/drive/oauth/callback
GOOGLE_DRIVE_REFRESH_TOKEN=seu-refresh-token
GOOGLE_DRIVE_FOLDER_ID=id-da-pasta
GOOGLE_DRIVE_LIMIT=32212254720000
GOOGLE_DRIVE_AUTO_MIGRATE_DAYS=30
```

### Descrição das Variáveis:
- `GOOGLE_DRIVE_ENABLED`: `true` para habilitar
- `GOOGLE_DRIVE_CLIENT_ID`: Client ID do OAuth
- `GOOGLE_DRIVE_CLIENT_SECRET`: Client Secret do OAuth
- `GOOGLE_DRIVE_REDIRECT_URI`: URL de callback (production)
- `GOOGLE_DRIVE_REFRESH_TOKEN`: Token de acesso permanente
- `GOOGLE_DRIVE_FOLDER_ID`: ID da pasta no Drive
- `GOOGLE_DRIVE_LIMIT`: 30TB em bytes
- `GOOGLE_DRIVE_AUTO_MIGRATE_DAYS`: Migrar vídeos após X dias

## 🚀 Passo 6: Fazer Deploy

1. Salve todas as variáveis no Railway
2. Clique em **Deploy**
3. Aguarde o deploy completar

## ✅ Passo 7: Verificar Configuração

### Via API
```bash
curl https://seu-app.up.railway.app/api/drive/status \
  -H "Authorization: Bearer SEU_JWT_TOKEN"
```

Resposta esperada:
```json
{
  "enabled": true,
  "configured": true,
  "message": "Google Drive is enabled and ready"
}
```

### Via Dashboard
1. Acesse o BrickReview
2. Vá em **Configurações**
3. Você verá o Google Drive listado com estatísticas

## 📊 Como Funciona

### Backup Automático
- **Todo upload** é automaticamente copiado para o Drive
- Vídeo fica em ambos: R2 (rápido) + Drive (backup)
- Status no banco: `storage_location = 'both'`

### Limpeza Automática do R2
Quando o R2 estiver cheio:
1. Sistema identifica vídeos mais antigos
2. Verifica se tem backup no Drive
3. Remove do R2 (mas mantém no Drive)
4. Status muda para: `storage_location = 'drive'`

### Acesso aos Vídeos
O sistema busca automaticamente:
1. Tenta buscar no R2 (rápido)
2. Se não encontrar, busca no Drive
3. Usuário não percebe a diferença

## 🛠️ Endpoints Disponíveis

### Verificar Status
```bash
GET /api/drive/status
```

### Backup Manual
```bash
POST /api/storage/migrate/:videoId
Body: { "removeFromR2": false }
```

### Limpar R2
```bash
POST /api/storage/cleanup-r2
Body: { "targetFreeSpace": 1073741824 }
```

### Vídeos Elegíveis para Limpeza
```bash
GET /api/storage/eligible-for-cleanup
```

## 🐛 Troubleshooting

### Erro: "Google Drive is not enabled"
- Verifique se `GOOGLE_DRIVE_ENABLED=true`
- Confirme que todas as variáveis estão configuradas
- Faça redeploy no Railway

### Erro: "Invalid credentials"
- Verifique o Client ID e Client Secret
- Regere o Refresh Token seguindo o Passo 4

### Erro: "Folder not found"
- Confirme o ID da pasta
- Verifique as permissões da pasta
- A pasta deve pertencer à conta autenticada

### Uploads não estão indo para o Drive
- Verifique os logs do servidor
- Confirme que `GOOGLE_DRIVE_ENABLED=true`
- Execute `POST /api/drive/status` para verificar

## 📈 Monitoramento

### Ver Estatísticas
```bash
GET /api/storage/stats
```

Retorna:
```json
{
  "r2": { "total": {...} },
  "drive": {
    "enabled": true,
    "used": 123456789,
    "limit": 32212254720000,
    "objectCount": 42
  },
  "total": { "used": ..., "limit": ..., "available": ... }
}
```

## 🔒 Segurança

⚠️ **IMPORTANTE:**
- **NUNCA** compartilhe suas credenciais OAuth
- **NUNCA** commite o `.env` no git
- Use tokens com permissões mínimas (`drive.file`)
- Monitore o uso regularmente
- Revogue tokens não utilizados

## 💡 Dicas

1. **Teste Primeiro**: Configure em localhost antes de production
2. **Monitore Uso**: Google Drive tem limites de API calls
3. **Backup Regular**: Considere backup adicional dos dados críticos
4. **Organização**: Use subpastas no Drive para projetos diferentes
5. **Performance**: R2 é muito mais rápido que Drive para streaming

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do Railway
2. Teste os endpoints individualmente
3. Confirme todas as variáveis de ambiente
4. Abra uma issue no GitHub

## 📚 Links Úteis

- [Google Cloud Console](https://console.cloud.google.com/)
- [Google Drive API Docs](https://developers.google.com/drive/api/v3/about-sdk)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
