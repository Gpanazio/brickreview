/**
 * Validação de variáveis de ambiente obrigatórias
 * Garante que o servidor não inicie sem as configurações essenciais
 */

const REQUIRED_ENV_VARS = {
  // Database (Obrigatório)
  DATABASE_URL: "Conexão com PostgreSQL é obrigatória para salvar dados",

  // JWT (Obrigatório para autenticação)
  JWT_SECRET: "Necessário para autenticação de usuários",
};

const R2_ENV_VARS = {
  R2_ACCOUNT_ID: "ID da conta Cloudflare R2 para armazenar vídeos",
  R2_ACCESS_KEY_ID: "Chave de acesso R2",
  R2_SECRET_ACCESS_KEY: "Chave secreta R2",
  R2_BUCKET_NAME: "Nome do bucket R2",
  R2_PUBLIC_URL: "URL pública do R2 para acessar vídeos",
};

const OPTIONAL_ENV_VARS = {
  PORT: "3002",
  NODE_ENV: "development",
  CORS_ORIGIN: "*",
  FFMPEG_PATH: "",
  FFPROBE_PATH: "",
  REDIS_URL: "redis://localhost:6379",
};

export function validateEnvironment() {
  const missing = [];
  const warnings = [];

  // Verifica variáveis obrigatórias
  for (const [key, description] of Object.entries(REQUIRED_ENV_VARS)) {
    if (!process.env[key]) {
      missing.push({ key, description });
    }
  }

  // R2 é obrigatório apenas em produção
  if (process.env.NODE_ENV === 'production') {
    for (const [key, description] of Object.entries(R2_ENV_VARS)) {
      if (!process.env[key]) {
        missing.push({ key, description });
      }
    }
  } else {
    // Em desenvolvimento, avisa se R2 não estiver configurado
    const r2Missing = Object.keys(R2_ENV_VARS).some(key => !process.env[key]);
    if (r2Missing) {
      warnings.push("R2 Storage não configurado полностью. Uploads podem falhar.");
    }
  }

  // Se houver variáveis faltando, exibe erro e encerra
  if (missing.length > 0) {
    console.error("\n❌ ERRO CRÍTICO: Variáveis de ambiente obrigatórias não configuradas!");
    console.error("╔═══════════════════════════════════════════════════════════════════════╗");
    console.error("║  O servidor NÃO PODE INICIAR sem todas as configurações necessárias  ║");
    console.error("╚═══════════════════════════════════════════════════════════════════════╝\n");

    console.error("📋 Variáveis faltando:\n");
    missing.forEach(({ key, description }) => {
      console.error(`   ❌ ${key}`);
      console.error(`      → ${description}\n`);
    });

    console.error("💡 Solução:");
    console.error("   1. Certifique-se que o arquivo .env existe no diretório server/");
    console.error("   2. Copie o arquivo .env da raiz do projeto para server/:");
    console.error("      cp .env server/.env");
    console.error("   3. Ou crie um arquivo .env em server/ com todas as variáveis necessárias\n");

    console.error("📄 Exemplo de arquivo .env:\n");
    console.error("   DATABASE_URL=postgresql://user:pass@host:port/database");
    console.error("   JWT_SECRET=seu_segredo_jwt_aqui");
    console.error("   R2_ACCOUNT_ID=seu_account_id");
    console.error("   R2_ACCESS_KEY_ID=sua_access_key");
    console.error("   R2_SECRET_ACCESS_KEY=sua_secret_key");
    console.error("   R2_BUCKET_NAME=nome_do_bucket");
    console.error("   R2_PUBLIC_URL=https://pub-xxxxx.r2.dev\n");

    throw new Error("Variáveis de ambiente obrigatórias não configuradas");
  }

  // Verifica variáveis opcionais e aplica defaults
  for (const [key, defaultValue] of Object.entries(OPTIONAL_ENV_VARS)) {
    if (!process.env[key]) {
      if (defaultValue) {
        process.env[key] = defaultValue;
        warnings.push(`${key} não definida, usando padrão: ${defaultValue}`);
      } else {
        warnings.push(`${key} não definida, deixando o sistema detectar automaticamente`);
      }
    }
  }

  // Exibe warnings se houver
  if (warnings.length > 0) {
    console.log("\n⚠️  Variáveis opcionais usando valores padrão:");
    warnings.forEach((warning) => console.log(`   ${warning}`));
    console.log("");
  }

  // Tudo OK
  console.log("✅ Todas as variáveis de ambiente obrigatórias estão configuradas\n");
}

export default validateEnvironment;
