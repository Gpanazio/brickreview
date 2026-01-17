#!/bin/bash
set -e

# Detecta o serviço (API por padrão)
SERVICE_NAME="${RAILWAY_SERVICE_NAME:-api}"

echo "🚀 Iniciando BrickReview ($SERVICE_NAME)..."

# Find FFmpeg in the Nix store if not already set
if [ -z "$FFMPEG_PATH" ]; then
  echo "🔍 Procurando FFmpeg no sistema..."

  # Strategy 1: Check PATH with which
  FFMPEG_FOUND=$(which ffmpeg 2>/dev/null || true)

  # Strategy 2: Common absolute paths
  if [ -z "$FFMPEG_FOUND" ]; then
    for path in /usr/bin/ffmpeg /usr/local/bin/ffmpeg /bin/ffmpeg; do
      if [ -f "$path" ]; then
        FFMPEG_FOUND="$path"
        break
      fi
    done
  fi

  # Strategy 3: Limited find (only /usr and /nix/store, with timeout)
  if [ -z "$FFMPEG_FOUND" ]; then
    echo "🔍 Fazendo busca limitada por FFmpeg..."
    FFMPEG_FOUND=$(timeout 5 find /usr /nix/store -name ffmpeg -type f -executable 2>/dev/null | head -n 1 || true)
  fi

  if [ -n "$FFMPEG_FOUND" ]; then
    export FFMPEG_PATH="$FFMPEG_FOUND"
    echo "✅ FFmpeg encontrado: $FFMPEG_PATH"

    # Test execution (with timeout)
    echo "🧪 Testando execução do FFmpeg..."
    timeout 3 "$FFMPEG_FOUND" -version | head -n 1 || echo "❌ Falha ao executar FFmpeg"
  else
    echo "⚠️  FFmpeg não encontrado - thumbnails e proxies não funcionarão"
    echo "📂 Listando conteúdo de /usr/bin para debug:"
    ls -la /usr/bin/ff* 2>/dev/null || true
  fi
fi

if [ -z "$FFPROBE_PATH" ]; then
  echo "🔍 Procurando FFprobe no sistema..."

  # Strategy 1: Check PATH with which
  FFPROBE_FOUND=$(which ffprobe 2>/dev/null || true)

  # Strategy 2: Common absolute paths
  if [ -z "$FFPROBE_FOUND" ]; then
    for path in /usr/bin/ffprobe /usr/local/bin/ffprobe /bin/ffprobe; do
      if [ -f "$path" ]; then
        FFPROBE_FOUND="$path"
        break
      fi
    done
  fi

  # Strategy 3: Limited find (only /usr and /nix/store, with timeout)
  if [ -z "$FFPROBE_FOUND" ]; then
    echo "🔍 Fazendo busca limitada por FFprobe..."
    FFPROBE_FOUND=$(timeout 5 find /usr /nix/store -name ffprobe -type f -executable 2>/dev/null | head -n 1 || true)
  fi

  if [ -n "$FFPROBE_FOUND" ]; then
    export FFPROBE_PATH="$FFPROBE_FOUND"
    echo "✅ FFprobe encontrado: $FFPROBE_PATH"
  else
    echo "⚠️  FFprobe não encontrado - metadados de vídeo não funcionarão"
  fi
fi

# Inicialização baseada no serviço
case "$SERVICE_NAME" in
  "worker")
    echo "🛠️  Iniciando Worker Process..."
    exec node server/queue/worker.js
    ;;
  "api"|"")
    echo "🌐 Iniciando API Server..."
    exec node server/index.js
    ;;
  *)
    echo "⚠️  Serviço desconhecido: $SERVICE_NAME"
    echo "🌐 Iniciando API Server (fallback)..."
    exec node server/index.js
    ;;
esac
