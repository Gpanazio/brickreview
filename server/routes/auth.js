import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db.js";

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(`[AUTH] Tentativa de login para: ${username}`);

    if (!username || !password) {
      return res.status(400).json({
        error: "Username e senha são obrigatórios",
      });
    }

    // Busca usuário na tabela master_users (compartilhada com outros projetos BRICK)
    console.log("[AUTH] Buscando usuário no banco...");
    const result = await query("SELECT * FROM master_users WHERE username = $1", [username]);

    if (result.rows.length === 0) {
      console.log("[AUTH] Usuário não encontrado");
      return res.status(401).json({
        error: "Credenciais inválidas",
      });
    }

    const user = result.rows[0];
    console.log("[AUTH] Usuário encontrado. Verificando hash de senha...");

    if (!user.password_hash) {
      console.error("[AUTH] Erro: Usuário sem password_hash no banco");
      return res.status(500).json({ error: "Erro de integridade de dados" });
    }

    // Verifica senha
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log(`[AUTH] Senha válida: ${isValidPassword}`);

    if (!isValidPassword) {
      return res.status(401).json({
        error: "Credenciais inválidas",
      });
    }

    // Verifica JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET não configurado!");
      return res.status(500).json({
        error: "Erro de configuração no servidor",
      });
    }

    const role = user.role || "client";

    // Gera token JWT
    console.log("[AUTH] Gerando token...");
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role,
      },
    });
  } catch (err) {
    console.error("❌ Erro no login:", err);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// GET /api/auth/verify - Verifica se o token é válido
router.get("/verify", async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ valid: false });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, user });
  } catch {
    res.status(403).json({ valid: false });
  }
});

// POST /api/auth/logout - Logout (client-side limpa o token)
router.post("/logout", (req, res) => {
  res.json({
    message: "Logout realizado com sucesso",
  });
});

export default router;
