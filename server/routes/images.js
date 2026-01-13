import express from 'express'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

const OPENVERSE_API = 'https://api.openverse.org/v1/images'
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const CACHE_TTL_MS = 60_000

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

const bannedTerms = [
  'porn',
  'porno',
  'nude',
  'nudity',
  'sex',
  'xxx',
  'hentai',
  'erotic',
  'fetish',
  'boobs',
  'penis',
  'vagina',
  'onlyfans',
  'playboy',
  'lingerie',
]

const cache = new Map()

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.value
}

function setCached(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
}

function looksBannedTitle(title) {
  const lower = String(title || '').toLowerCase()
  return bannedTerms.some((term) => lower.includes(term))
}

router.get('/search', authenticateToken, async (req, res) => {
  const q = String(req.query.q || '').trim()
  const limitRaw = Number(req.query.limit)
  const offsetRaw = Number(req.query.offset)

  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT) : DEFAULT_LIMIT
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.floor(offsetRaw), 0) : 0
  
  // Openverse usa página em vez de offset
  const page = Math.floor(offset / limit) + 1

  if (!q) {
    return res.json({ results: [], nextOffset: 0, hasMore: false })
  }

  const cacheKey = `search:${q}:${limit}:${page}`
  const cached = getCached(cacheKey)
  if (cached) return res.json(cached)

  const params = new URLSearchParams({
    q,
    page: String(page),
    page_size: String(limit),
  })

  const url = `${OPENVERSE_API}/?${params.toString()}`

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'brickreview/0.1 (cover image search)',
      },
    })

    if (!response.ok) {
      return res.status(502).json({ error: 'Falha ao buscar imagens no Openverse' })
    }

    const data = await response.json().catch(() => null)
    const resultsRaw = Array.isArray(data?.results) ? data.results : []

    const results = resultsRaw
      .map((item) => {
        return {
          title: item.id, // Usamos o ID como título para o resolve funcionar com precisão
          thumbUrl: item.thumbnail,
          mime: item.filetype,
          originalTitle: item.title
        }
      })
      .filter((item) => item.title && item.thumbUrl)
      .filter((item) => !looksBannedTitle(item.originalTitle))
      .map((item) => ({ title: item.title, thumbUrl: item.thumbUrl }))

    const hasMore = Boolean(data?.page_count > page)
    const nextOffset = offset + limit

    const payload = { results, nextOffset, hasMore }
    setCached(cacheKey, payload)

    return res.json(payload)
  } catch (error) {
    console.error('Erro ao buscar imagens (Openverse):', error)
    return res.status(500).json({ error: 'Erro ao buscar imagens' })
  }
})

router.get('/resolve', authenticateToken, async (req, res) => {
  const id = String(req.query.title || '').trim() // No nosso novo esquema, 'title' contém o ID

  if (!id) {
    return res.status(400).json({ error: 'ID da imagem é obrigatório' })
  }

  const cacheKey = `resolve:${id}`
  const cached = getCached(cacheKey)
  if (cached) return res.json(cached)

  const url = `${OPENVERSE_API}/${id}/`

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'brickreview/0.1 (cover image resolve)',
      },
    })

    if (!response.ok) {
      return res.status(502).json({ error: 'Falha ao resolver imagem no Openverse' })
    }

    const data = await response.json().catch(() => null)
    
    if (!data?.url) {
      return res.status(404).json({ error: 'Imagem não encontrada' })
    }

    const payload = { 
      url: data.url, 
      mime: data.filetype || null, 
      width: data.width || 1280 
    }
    setCached(cacheKey, payload)

    return res.json(payload)
  } catch (error) {
    console.error('Erro ao resolver imagem (Openverse):', error)
    return res.status(500).json({ error: 'Erro ao resolver imagem' })
  }
})

export default router
