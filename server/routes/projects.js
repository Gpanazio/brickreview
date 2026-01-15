// ... existing imports before route definition ...
// import { FEATURES } from '../config/features.js';
// import ssrf from "ssrf-req-filter";

/**
 * @route POST /api/projects/:id/cover-url
 * @desc Set cover image from remote URL
 */
router.post("/:id/cover-url", authenticateToken, async (req, res) => {
  const projectId = Number(req.params.id);
  const { url } = req.body || {};

  if (!Number.isInteger(projectId)) {
    return res.status(400).json({ error: "ID de projeto inválido" });
  }

  if (typeof url !== "string" || !url.trim()) {
    return res.status(400).json({ error: "URL da imagem é obrigatória" });
  }

  if (!(await requireProjectAccess(req, res, projectId))) {
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: "URL inválida" });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: "URL deve ser http(s)" });
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const blockedHosts = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

  if (blockedHosts.has(hostname)) {
    logger.warn("SSRF", "Blocked hostname", { hostname });
    return res.status(400).json({ error: "Host não permitido" });
  }

  // --- SSRF PROTECTION LAYER (Controlled by FEATURE_USE_SSRF_FILTER) ---

  // Fallback to regex-based validation (basic protection)
  const regexBlockFallback = () => {
    // Block obvious private IP ranges (10.x, 192.168.x, 169.254.x and IPv6 fc00::/7)
    if (
      /^10\\./.test(hostname) ||
      /^192\\.168\\./.test(hostname) ||
      /^169\\.254\\./.test(hostname) ||
      /^fc00:/i.test(hostname)
    ) {
      logger.warn("SSRF", "Blocked private IP range (Regex)", { hostname });
      return true;
    }
    const match172 = hostname.match(/^172\\.(\\d+)\\./);
    if (match172) {
      const second = Number(match172[1]);
      // Block ONLY 172.16.0.0-172.31.255.255 (private range)
      if (second >= 16 && second <= 31) {
        logger.warn("SSRF", "Blocked 172.16-31 range (Regex)", { hostname });
        return true;
      }
    }
    return false;
  };

  if (FEATURES.USE_SSRF_FILTER) {
    logger.debug("SSRF", "Using ssrf-req-filter library for protection", { hostname });

    try {
      // Use ssrf-req-filter for robust protection
      const safeUrl = await ssrf(url);

      // Proceed with the request using the sanitized URL
      const response = await fetch(safeUrl, {
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        return res.status(400).json({ error: "Não foi possível baixar a imagem" });
      }

      const contentType = (response.headers.get("content-type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      const extByType = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
      };

      const ext = extByType[contentType];
      if (!ext) {
        return res
          .status(400)
          .json({ error: "Tipo de imagem não suportado (use JPG, PNG ou WebP)" });
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const maxBytes = 10 * 1024 * 1024;
      if (buffer.length > maxBytes) {
        return res.status(413).json({ error: "Imagem muito grande (máx 10MB)" });
      }

      const r2Key = `project-covers/${projectId}/${Date.now()}-cover${ext}`;

      await r2Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: r2Key,
          Body: buffer,
          ContentType: contentType,
        })
      );

      const coverUrl = `${process.env.R2_PUBLIC_URL}/${r2Key}`;

      const result = await query(
        `UPDATE brickreview_projects
       SET cover_image_r2_key = $1, cover_image_url = $2
       WHERE id = $3
       RETURNING *`,
        [r2Key, coverUrl, projectId]
      );

      res.json({
        message: "Imagem de capa atualizada com sucesso",
        project: result.rows[0],
      });
    } catch (ssrfError) {
      logger.warn("SSRF", "URL blocked by filter library", { url, error: ssrfError.message });
      return res.status(400).json({ error: "URL não permitida pelo filtro de segurança" });
    }
  } else {
    // Fallback Regex Logic
    if (regexBlockFallback()) {
      return res.status(400).json({ error: "Host não permitido" });
    }

    // If regex passes, proceed with fetch (but still block if regex failed)
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        return res.status(400).json({ error: "Não foi possível baixar a imagem" });
      }

      const contentType = (response.headers.get("content-type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      const extByType = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
      };

      const ext = extByType[contentType];
      if (!ext) {
        return res
          .status(400)
          .json({ error: "Tipo de imagem não suportado (use JPG, PNG ou WebP)" });
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const maxBytes = 10 * 1024 * 1024;
      if (buffer.length > maxBytes) {
        return res.status(413).json({ error: "Imagem muito grande (máx 10MB)" });
      }

      const r2Key = `project-covers/${projectId}/${Date.now()}-cover${ext}`;

      await r2Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: r2Key,
          Body: buffer,
          ContentType: contentType,
        })
      );

      const coverUrl = `${process.env.R2_PUBLIC_URL}/${r2Key}`;

      const result = await query(
        `UPDATE brickreview_projects
       SET cover_image_r2_key = $1, cover_image_url = $2
       WHERE id = $3
       RETURNING *`,
        [r2Key, coverUrl, projectId]
      );

      res.json({
        message: "Imagem de capa atualizada com sucesso",
        project: result.rows[0],
      });
    } catch (error) {
      console.error("Erro ao atualizar capa por URL (Fallback):", error);
      res.status(500).json({ error: "Erro ao atualizar capa por URL" });
    }
  }
});
