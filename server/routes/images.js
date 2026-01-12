import express from 'express'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 10
const DEFAULT_RESOLVE_WIDTH = 1280
const MAX_RESOLVE_WIDTH = 1600
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

function safeSearchQuery(q) {
  const base = String(q || '').trim()
  if (!base) return ''
  const negative = bannedTerms.map((t) => `-${t}`).join(' ')
  return `${base} ${negative}`.trim()
}

router.get('/search', authenticateToken, async (req, res) => {
  const q = String(req.query.q || '').trim()
  const limitRaw = Number(req.query.limit)
  const offsetRaw = Number(req.query.offset)

  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT) : DEFAULT_LIMIT
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.floor(offsetRaw), 0) : 0

  if (!q) {
    return res.json({ results: [], nextOffset: 0, hasMore: false })
  }

  const cacheKey = `search:${q}:${limit}:${offset}`
  const cached = getCached(cacheKey)
  if (cached) return res.json(cached)

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: safeSearchQuery(q),
    gsrnamespace: '6',
    gsrlimit: String(limit),
    gsroffset: String(offset),
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '480',
  })

  const url = `${COMMONS_API}?${params.toString()}`

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'brickreview/0.1 (cover image search)',
      },
    })

    if (!response.ok) {
      return res.status(502).json({ error: 'Falha ao buscar imagens' })
    }

    const data = await response.json().catch(() => null)
    const pages = Array.isArray(data?.query?.pages) ? data.query.pages : []

    const results = pages
      .map((page) => {
        const imageInfo = Array.isArray(page?.imageinfo) ? page.imageinfo[0] : null
        const thumbUrl = imageInfo?.thumburl
        const mime = imageInfo?.mime

        return {
          title: page?.title,
          thumbUrl,
          mime,
        }
      })
      .filter((item) => item.title && item.thumbUrl)
      .filter((item) => !looksBannedTitle(item.title))
      .filter((item) => !item.mime || allowedMimeTypes.has(item.mime))
      .map((item) => ({ title: item.title, thumbUrl: item.thumbUrl }))

    const nextOffset = Number.isFinite(data?.continue?.gsroffset)
      ? Number(data.continue.gsroffset)
      : offset + limit
    const hasMore = Number.isFinite(data?.continue?.gsroffset)

    const payload = { results, nextOffset, hasMore }
    setCached(cacheKey, payload)

    return res.json(payload)
  } catch (error) {
    console.error('Erro ao buscar imagens (Wikimedia):', error)
    return res.status(500).json({ error: 'Erro ao buscar imagens' })
  }
})

router.get('/resolve', authenticateToken, async (req, res) => {
  const title = String(req.query.title || '').trim()
  const widthRaw = Number(req.query.width)
  const width = Number.isFinite(widthRaw)
    ? Math.min(Math.max(Math.floor(widthRaw), 200), MAX_RESOLVE_WIDTH)
    : DEFAULT_RESOLVE_WIDTH

  if (!title) {
    return res.status(400).json({ error: 'title é obrigatório' })
  }

  const cacheKey = `resolve:${title}:${width}`
  const cached = getCached(cacheKey)
  if (cached) return res.json(cached)

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'imageinfo',
    titles: title,
    iiprop: 'url|mime',
    iiurlwidth: String(width),
  })

  const url = `${COMMONS_API}?${params.toString()}`

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'brickreview/0.1 (cover image resolve)',
      },
    })

    if (!response.ok) {
      return res.status(502).json({ error: 'Falha ao resolver imagem' })
    }

    const data = await response.json().catch(() => null)
    const pages = Array.isArray(data?.query?.pages) ? data.query.pages : []
    const page = pages[0]
    const imageInfo = Array.isArray(page?.imageinfo) ? page.imageinfo[0] : null

    const resolvedUrl = imageInfo?.thumburl
    const mime = imageInfo?.mime

    if (!resolvedUrl || (mime && !allowedMimeTypes.has(mime))) {
      return res.status(404).json({ error: 'Imagem não encontrada ou não suportada' })
    }

    if (looksBannedTitle(title)) {
      return res.status(404).json({ error: 'Imagem não disponível' })
    }

    const payload = { url: resolvedUrl, mime: mime || null, width }
    setCached(cacheKey, payload)

    return res.json(payload)
  } catch (error) {
    console.error('Erro ao resolver imagem (Wikimedia):', error)
    return res.status(500).json({ error: 'Erro ao resolver imagem' })
  }
})

export default router
