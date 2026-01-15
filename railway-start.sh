#!/bin/bash
set -e

echo "🚀 Iniciando BrickReview no Railway..."

# Find FFmpeg in the Nix store if not already set
if [ -z "$FFMPEG_PATH" ]; then
  echo "🔍 Procurando FFmpeg no sistema..."

  # Strategy 1: Check PATH with which
  FFMPEG_FOUND=$(which ffmpeg 2>/dev/null || true)

  # Strategy 2: Common absolute paths
  if [ -z "$FFMPEG_FOUND" ]; then
    for path in /usr/bin/ffmpeg /usr/local/bin/ffmpeg /usr/bin/ffprobe; do
      if [ -f "$path" ]; then
        FFMPEG_FOUND="$path"
        break
      fi
    done
  fi

  # Strategy 3: Hardcore find
  if [ -z "$FFMPEG_FOUND" ]; then
    echo "🔍 Fazendo busca profunda por FFmpeg..."
    FFMPEG_FOUND=$(find /usr /nix/store -name ffmpeg -type f -executable 2>/dev/null | head -n 1)
  fi

  # Strategy 4: Check if we are running as root and can use apt-get update/install at runtime
  if [ -z "$FFMPEG_FOUND" ]; then
    echo "🔍 Tentando instalar FFmpeg via apt-get em tempo de execução..."
    if [ "$(id -u)" = "0" ]; then
        apt-get update && apt-get install -y ffmpeg && FFMPEG_FOUND=$(which ffmpeg)
    else
        echo "⚠️ Não é root, não posso instalar pacotes."
    fi
  fi

  # Strategy 5: Last resort - try to find anything called ffmpeg even if not executable
  if [ -z "$FFMPEG_FOUND" ]; then
    echo "🔍 Fazendo busca desesperada por FFmpeg..."
    FFMPEG_FOUND=$(find / -name ffmpeg -type f 2>/dev/null | head -n 1)
    if [ -n "$FFMPEG_FOUND" ]; then
      chmod +x "$FFMPEG_FOUND" 2>/dev/null || true
    fi
  fi

  if [ -n "$FFMPEG_FOUND" ]; then
    export FFMPEG_PATH="$FFMPEG_FOUND"
    echo "✅ FFmpeg encontrado: $FFMPEG_PATH"
    
    # Test execution
    echo "🧪 Testando execução do FFmpeg..."
    "$FFMPEG_FOUND" -version | head -n 1 || echo "❌ Falha ao executar FFmpeg"
  else
    echo "⚠️  FFmpeg não encontrado - thumbnails e proxies não funcionarão"
    echo "📂 Listando conteúdo de /usr/bin e /nix/store para debug:"
    ls -la /usr/bin/ff* 2>/dev/null || true
    ls -la /nix/store/*/bin/ff* 2>/dev/null | head -n 20 || true
  fi
fi

if [ -z "$FFPROBE_PATH" ]; then
  echo "🔍 Procurando FFprobe no sistema..."

  # Strategy 1: Check PATH with which
  FFPROBE_FOUND=$(which ffprobe 2>/dev/null || true)

  # Strategy 2: Common absolute paths
  if [ -z "$FFPROBE_FOUND" ]; then
    for path in /usr/bin/ffprobe /usr/local/bin/ffprobe; do
      if [ -f "$path" ]; then
        FFPROBE_FOUND="$path"
        break
      fi
    done
  fi

  # Strategy 3: Hardcore find
  if [ -z "$FFPROBE_FOUND" ]; then
    echo "🔍 Fazendo busca profunda por FFprobe..."
    FFPROBE_FOUND=$(find /usr /nix/store -name ffprobe -type f -executable 2>/dev/null | head -n 1)
  fi

  # Strategy 4: Last resort
  if [ -z "$FFPROBE_FOUND" ]; then
    echo "🔍 Fazendo busca desesperada por FFprobe..."
    FFPROBE_FOUND=$(find / -name ffprobe -type f 2>/dev/null | head -n 1)
    if [ -n "$FFPROBE_FOUND" ]; then
      chmod +x "$FFPROBE_FOUND" 2>/dev/null || true
    fi
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
