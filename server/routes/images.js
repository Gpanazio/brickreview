import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import logger from "../utils/logger.js";

const router = express.Router();

const OPENVERSE_API = "https://api.openverse.org/v1/images";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const CACHE_TTL_MS = 60_000;

const bannedTerms = [
  "porn",
  "porno",
  "nude",
  "nudity",
  "sex",
  "xxx",
  "hentai",
  "erotic",
  "fetish",
  "boobs",
  "penis",
  "vagina",
  "onlyfans",
  "playboy",
  "lingerie",
];

const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function looksBannedTitle(title) {
  const lower = String(title || "").toLowerCase();
  return bannedTerms.some((term) => lower.includes(term));
}

router.get("/search", authenticateToken, async (req, res) => {
  const q = String(req.query.q || "").trim();
  const limitRaw = Number(req.query.limit);
  const offsetRaw = Number(req.query.offset);

  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.floor(offsetRaw), 0) : 0;

  // Openverse usa página em vez de offset
  const page = Math.floor(offset / limit) + 1;

  if (!q) {
    return res.json({ results: [], nextOffset: 0, hasMore: false });
  }

  const cacheKey = `search:${q}:${limit}:${page}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  // Parallel Search: Openverse + AI Generation
  const searchPromises = [];

  // 1. Openverse Search
  const openverseSearch = async () => {
    try {
      const params = new URLSearchParams({
        q,
        page: String(page),
        page_size: String(limit),
        aspect_ratio: "wide", // Prefer wide images for covers
      });

      const url = `${OPENVERSE_API}/?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "brickreview/0.1 (cover image search)",
        },
      });

      if (!response.ok) return { results: [], hasMore: false };

      const data = await response.json();
      const resultsRaw = Array.isArray(data?.results) ? data.results : [];
      const hasMore = Boolean(data?.page_count > page);

      const results = resultsRaw
        .map((item) => ({
          title: item.id, // Uses ID as title for resolution
          thumbUrl: item.thumbnail || item.url, // Fallback to URL
          mime: item.filetype,
          originalTitle: item.title,
          source: "openverse",
        }))
        .filter((item) => item.title && item.thumbUrl)
        .filter((item) => !looksBannedTitle(item.originalTitle));

      return { results, hasMore };
    } catch (error) {
      logger.error('IMAGES', 'Openverse search failed', { error: error.message });
      return { results: [], hasMore: false };
    }
  };

  searchPromises.push(openverseSearch());

  // 2. AI Generation (Pollinations) - Only on first page to mix in top results
  // We generate 4 high-quality variations
  if (page === 1) {
    const aiSearch = async () => {
      try {
        const aiResults = [1, 2, 3, 4].map((i) => {
          const seed = Math.floor(Math.random() * 10000) + (i * 137); // Deterministic-ish based on request
          // Enhance prompt for covers
          const enhancedPrompt = `${q} cinematic high quality hd, wallpaper, 4k`;
          const id = `ai:pollinations:${seed}:${encodeURIComponent(enhancedPrompt)}`;
          const thumbUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=640&height=360&nologo=true&seed=${seed}`;

          return {
            title: id,
            thumbUrl: thumbUrl,
            mime: "image/jpeg",
            originalTitle: `AI Generated: ${q} #${i}`,
            source: "ai",
          };
        });
        return { results: aiResults, hasMore: false };
      } catch (e) {
        return { results: [], hasMore: false };
      }
    };
    searchPromises.push(aiSearch());
  }

  try {
    const [openverseData, aiData] = await Promise.all([
      searchPromises[0], // Openverse always at index 0
      page === 1 ? searchPromises[1] : Promise.resolve({ results: [] })
    ]);

    // Merge: AI first, then Openverse
    const results = [...(aiData?.results || []), ...(openverseData?.results || [])];
    const hasMore = openverseData?.hasMore || false;
    const nextOffset = offset + results.length; // Approximate

    const payload = { results, nextOffset, hasMore };
    setCached(cacheKey, payload);

    return res.json(payload);
  } catch (error) {
    logger.error('IMAGES', 'Search aggregation failed', { error: error.message });
    return res.status(500).json({ error: "Erro ao buscar imagens" });
  }
});

router.get("/resolve", authenticateToken, async (req, res) => {
  const id = String(req.query.title || "").trim();

  if (!id) {
    return res.status(400).json({ error: "ID da imagem é obrigatório" });
  }

  // Handle AI Generated Images
  if (id.startsWith("ai:pollinations:")) {
    try {
      const parts = id.split(":");
      const seed = parts[2];
      const encodedPrompt = parts.slice(3).join(":"); // In case prompt has colons

      // Construir URL de alta resolução
      const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&nologo=true&seed=${seed}`;

      return res.json({
        url: url,
        mime: "image/jpeg",
        width: 1280
      });
    } catch (e) {
      return res.status(400).json({ error: "ID AI inválido" });
    }
  }

  // Handle Openverse Images (Legacy/Standard)
  const cacheKey = `resolve:${id}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const url = `${OPENVERSE_API}/${id}/`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "brickreview/0.1 (cover image resolve)",
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: "Falha ao resolver imagem" });
    }

    const data = await response.json().catch(() => null);

    if (!data?.url) {
      return res.status(404).json({ error: "Imagem não encontrada" });
    }

    const payload = {
      url: data.url,
      mime: data.filetype || null,
      width: data.width || 1280,
    };
    setCached(cacheKey, payload);

    return res.json(payload);
  } catch (error) {
    logger.error('IMAGES', 'Error resolving image', { error: error.message });
    return res.status(500).json({ error: "Erro ao resolver imagem" });
  }
});

export default router;
