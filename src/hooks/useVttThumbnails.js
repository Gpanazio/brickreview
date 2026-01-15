import { useState, useEffect } from "react";

/**
 * Hook para carregar e parsear arquivos WebVTT de miniaturas (sprites)
 * @param {string} vttUrl - URL do arquivo .vtt
 * @returns {Array} - Lista de objetos de miniatura {start, end, url, x, y, w, h}
 */
export function useVttThumbnails(vttUrl) {
  const [thumbnails, setThumbnails] = useState([]);

  useEffect(() => {
    if (!vttUrl) {
      setThumbnails([]);
      return;
    }

    const fetchVtt = async () => {
      try {
        const response = await fetch(vttUrl);
        if (!response.ok) throw new Error("Falha ao carregar VTT");
        const text = await response.text();

        const lines = text.split(/\r?\n/);
        const thumbs = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // Formato típico: 00:00:00.000 --> 00:00:02.000
          if (line.includes("-->")) {
            const times = line.split("-->");
            const start = parseVttTime(times[0].trim());
            const end = parseVttTime(times[1].trim());

            // A próxima linha contém a URL e as coordenadas do sprite
            const imageInfo = lines[i + 1]?.trim();
            if (imageInfo) {
              const [url, coords] = imageInfo.split("#xywh=");
              const [x, y, w, h] = coords ? coords.split(",").map(Number) : [0, 0, 0, 0];

              // Resolve URL relativa baseada na URL do VTT
              const absoluteImageUrl = new URL(url, vttUrl).href;

              thumbs.push({ start, end, url: absoluteImageUrl, x, y, w, h });
              i++; // Pula a linha da imagem
            }
          }
        }
        setThumbnails(thumbs);
      } catch (error) {
        console.error("Erro ao processar thumbnails VTT:", error);
        setThumbnails([]);
      }
    };

    fetchVtt();
  }, [vttUrl]);

  return thumbnails;
}

function parseVttTime(timeStr) {
  const parts = timeStr.split(":");
  let seconds = 0;
  if (parts.length === 3) {
    // HH:MM:SS.MS
    seconds += parseFloat(parts[0]) * 3600;
    seconds += parseFloat(parts[1]) * 60;
    seconds += parseFloat(parts[2]);
  } else if (parts.length === 2) {
    // MM:SS.MS
    seconds += parseFloat(parts[0]) * 60;
    seconds += parseFloat(parts[1]);
  }
  return seconds;
}
