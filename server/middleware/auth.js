import jwt from 'jsonwebtoken'

// Middleware para verificar token JWT
export async function authenticateToken(req, res, next) {
  let token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1] // Bearer TOKEN

  // Fallback: Check query parameter (useful for img/video src)
  if (!token && req.query.token) {
    token = req.query.token
  }

  if (!token) {
    return res.status(401).json({
      error: 'Token de autenticação não fornecido',
    })
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET)
    req.user = user
    next()
  } catch {
    return res.status(403).json({
      error: 'Token inválido ou expirado',
    })
  }
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
