import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import logger from "../utils/logger.js";

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    logger.debug('AUTH', 'Login attempt', { username });

    if (!username || !password) {
      return res.status(400).json({
        error: "Username e senha são obrigatórios",
      });
    }

    // Busca usuário na tabela master_users (compartilhada com outros projetos BRICK)
    logger.debug('AUTH', 'Searching user in database');
    const result = await query("SELECT * FROM master_users WHERE username = $1", [username]);

    if (result.rows.length === 0) {
      logger.debug('AUTH', 'User not found', { username });
      return res.status(401).json({
        error: "Credenciais inválidas",
      });
    }

    const user = result.rows[0];
    logger.debug('AUTH', 'User found, verifying password');

    if (!user.password_hash) {
      logger.error('AUTH', 'User without password_hash in database');
      return res.status(500).json({ error: "Erro de integridade de dados" });
    }

    // Verifica senha
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    logger.debug('AUTH', 'Password validation result', { isValid: isValidPassword });

    if (!isValidPassword) {
      return res.status(401).json({
        error: "Credenciais inválidas",
      });
    }

    // Verifica JWT_SECRET
    if (!process.env.JWT_SECRET) {
      logger.error('AUTH', 'JWT_SECRET not configured');
      return res.status(500).json({
        error: "Erro de configuração no servidor",
      });
    }

    const role = user.role || "client";

    // Gera token JWT
    logger.debug('AUTH', 'Generating token');
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

    // Set HTTP-Only Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Só via HTTPS em produção
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    });

    res.json({
      token, // Mantido por compatibilidade temporária (frontend deve ignorar)
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role,
      },
    });
  } catch (err) {
    logger.error('AUTH', 'Login error', { error: err.message });
    res.status(500).json({
      error: "Erro interno do servidor",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// GET /api/auth/verify - Verifica se o token é válido
router.get("/verify", async (req, res) => {
  // 1. Check Cookie
  let token = req.cookies?.token;

  // 2. Check Header (Fallback)
  if (!token) {
    const authHeader = req.headers["authorization"];
    token = authHeader && authHeader.split(" ")[1];
  }

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
  res.clearCookie('token');
  res.json({
    message: "Logout realizado com sucesso",
  });
});

export default router;
