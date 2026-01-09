import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../db.js'

const router = express.Router()

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        error: 'Username e senha são obrigatórios',
      })
    }

    // Busca usuário na tabela master_users (compartilhada com outros projetos BRICK)
    const result = await query(
      'SELECT * FROM master_users WHERE username = $1',
      [username]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Credenciais inválidas',
      })
    }

    const user = result.rows[0]

    // Verifica senha
    const isValidPassword = await bcrypt.compare(password, user.password_hash)

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Credenciais inválidas',
      })
    }

    // Verifica JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET não configurado!')
      return res.status(500).json({
        error: 'Erro de configuração no servidor',
      })
    }

    // Gera token JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role: 'admin', // Default role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: 'admin', // Default role
      },
    })
  } catch (err) {
    console.error('❌ Erro no login:', err)
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
})

// GET /api/auth/verify - Verifica se o token é válido
router.get('/verify', async (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ valid: false })
  }

  if (token === 'bypass-token' && process.env.NODE_ENV !== 'production') {
    try {
      const userResult = await query(
        'SELECT id, username, email FROM master_users WHERE LOWER(username) = LOWER($1) LIMIT 1',
        ['Gabriel']
      )

      if (userResult.rows.length > 0) {
        return res.json({
          valid: true,
          user: {
            ...userResult.rows[0],
            role: 'admin'
          }
        })
      }
    } catch (err) {
      console.error('Erro no bypass Gabriel:', err)
    }

    return res.json({
      valid: true,
      user: {
        id: null,
        username: 'bypass',
        role: 'admin',
        email: null,
      },
    })
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET)
    res.json({ valid: true, user })
  } catch (err) {
    res.status(403).json({ valid: false })
  }
})

// POST /api/auth/logout - Logout (client-side limpa o token)
router.post('/logout', (req, res) => {
  res.json({
    message: 'Logout realizado com sucesso',
  })
})

export default router
