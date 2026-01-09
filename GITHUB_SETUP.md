# Setup GitHub Repository

## Criar Repositório no GitHub

1. Acesse [GitHub](https://github.com/new)
2. Configure o repositório:
   - **Repository name:** `brickreview`
   - **Description:** `Sistema de revisão de vídeos estilo Frame.io com identidade visual BRICK`
   - **Visibility:** Private (recomendado) ou Public
   - **NÃO** adicione README, .gitignore ou LICENSE (já temos)

3. Clique em **Create repository**

## Conectar e Push

```bash
# No terminal, dentro da pasta brickreview/
git remote add origin https://github.com/Gpanazio/brickreview.git
git branch -M main
git push -u origin main
```

## Configurar GitHub Secrets (para CI/CD futuro)

Se quiser configurar deploy automático no Railway via GitHub Actions:

1. Acesse **Settings** > **Secrets and variables** > **Actions**
2. Adicione os seguintes secrets:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`
   - `R2_PUBLIC_URL`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`

## Deploy no Railway

1. Acesse [Railway](https://railway.app/)
2. Click em **New Project** > **Deploy from GitHub repo**
3. Selecione o repositório `brickreview`
4. Railway irá detectar automaticamente (Nixpacks)
5. Configure as variáveis de ambiente (copie do .env.example)
6. Adicione um PostgreSQL service
7. Conecte o banco ao projeto

### Configurar Build

No Railway:
- **Build Command:** `npm install && npm run build`
- **Start Command:** `node server/index.js`
- **Root Directory:** `/`

### Adicionar Volumes (opcional)

Para cache de thumbnails:
- Mount path: `/thumbnails`
- Size: 1GB

### Configurar Domínio

1. Em Settings > Domains
2. Adicione um domínio customizado ou use o gerado pelo Railway
3. Configure o CORS_ORIGIN no .env

## Cloudflare R2 Setup

1. Acesse [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. R2 > Create bucket
   - Name: `brickreview-videos`
   - Location: Automatic
3. Bucket Configuration > Public access: Enable
4. R2 API Tokens > Create API Token
   - Permissions: Object Read & Write
   - Copy: Account ID, Access Key ID, Secret Access Key
5. Public bucket URL estará disponível em bucket settings

## Resend Setup

1. Acesse [Resend](https://resend.com/)
2. API Keys > Create API Key
3. Domains > Add Domain
   - Add your domain
   - Configure DNS records (MX, TXT, CNAME)
   - Verify domain
4. Use o API key no .env

---

**Próximos Passos:**
1. Create GitHub repo
2. Push code
3. Setup Railway PostgreSQL
4. Setup Cloudflare R2
5. Setup Resend
6. Continue development (see README.md Roadmap)
