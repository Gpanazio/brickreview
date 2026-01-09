import jwt from 'jsonwebtoken'
import { query } from '../db.js'

// Middleware para verificar token JWT
export async function authenticateToken(req, res, next) {
    // BYPASS LOGIN - Admin Default
    // Tenta buscar um usuário real no banco para evitar erro de FK
    try {
      const userResult = await query('SELECT id FROM master_users WHERE role = \'admin\' LIMIT 1');
      if (userResult.rows.length > 0) {
        req.user = {
          id: userResult.rows[0].id,
          username: 'Brick Admin',
          role: 'admin',
          email: 'admin@brick.com'
        };
      } else {
        req.user = {
          id: '00000000-0000-0000-0000-000000000000',
          username: 'Brick Admin',
          role: 'admin',
          email: 'admin@brick.com'
        };
      }
    } catch (e) {
      req.user = {
        id: '00000000-0000-0000-0000-000000000000',
        username: 'Brick Admin',
        role: 'admin',
        email: 'admin@brick.com'
      };
    }
  return next();

  /*
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Token de autenticação não fornecido',
    })
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET)
    req.user = user
    next()
  } catch (err) {
    return res.status(403).json({
      error: 'Token inválido ou expirado',
    })
  }
  */
}

// Middleware para verificar se usuário é admin
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Autenticação necessária',
    })
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Acesso negado. Permissão de admin necessária',
    })
  }

  next()
}

// Middleware opcional: verifica se é admin OU client
export function requireUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Autenticação necessária',
    })
  }

  const allowedRoles = ['admin', 'client']
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Acesso negado',
    })
  }

  next()
}

export default { authenticateToken, requireAdmin, requireUser }
