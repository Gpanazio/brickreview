import pg from "pg";
const { Pool } = pg;
import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

// No Railway, a DATABASE_URL já vem completa
// Ex: postgresql://postgres:password@host:port/railway
const connectionString = process.env.DATABASE_URL;

export const pool = connectionString
  ? new Pool({
    connectionString: connectionString,
    // Força SSL se estiver usando um banco remoto (Railway) mesmo em desenvolvimento
    ssl:
      connectionString.includes("railway.net") || isProduction
        ? { rejectUnauthorized: false }
        : false,
  })
  : null;

if (!pool) {
  console.warn("⚠️  DATABASE_URL não encontrada no .env. O banco de dados está desativado.");
}

export const query = (text, params) => {
  if (!pool) {
    throw new Error("Banco de dados não configurado. Verifique seu arquivo .env");
  }
  return pool.query(text, params);
};

export default { pool, query };

// Test connection on startup
if (pool) {
  pool.connect((err, client, release) => {
    if (err) {
      return console.error("❌ Erro ao conectar ao PostgreSQL:", err.stack);
    }
    console.log("✅ Conectado ao PostgreSQL com sucesso (Railway)");
    release();
  });
}
