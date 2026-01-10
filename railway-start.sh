#!/bin/bash
set -e

echo "🚀 Iniciando BrickReview no Railway..."

# Find FFmpeg in the Nix store if not already set
if [ -z "$FFMPEG_PATH" ]; then
  echo "🔍 Procurando FFmpeg no sistema..."

  # Strategy 1: Try common APT paths first (faster)
  for path in /usr/bin/ffmpeg /usr/local/bin/ffmpeg; do
    if [ -f "$path" ]; then
      FFMPEG_FOUND="$path"
      break
    fi
  done

  # Strategy 2: Try which command
  if [ -z "$FFMPEG_FOUND" ]; then
    FFMPEG_FOUND=$(which ffmpeg 2>/dev/null || true)
  fi

  # Strategy 3: Hardcore find (last resort)
  if [ -z "$FFMPEG_FOUND" ]; then
    echo "🔍 FFmpeg não encontrado nos locais óbvios, fazendo busca profunda..."
    NIX_FFMPEG=$(find /nix/store /usr/lib -maxdepth 4 -name ffmpeg -type f 2>/dev/null | head -n 1)
    if [ -n "$NIX_FFMPEG" ]; then
        FFMPEG_FOUND="$NIX_FFMPEG"
    fi
  fi

  if [ -n "$FFMPEG_FOUND" ]; then
    export FFMPEG_PATH="$FFMPEG_FOUND"
    echo "✅ FFmpeg encontrado: $FFMPEG_PATH"
  else
    echo "⚠️  FFmpeg não encontrado - thumbnails e proxies não funcionarão"
  fi
fi

if [ -z "$FFPROBE_PATH" ]; then
  echo "🔍 Procurando FFprobe no sistema..."

  # Strategy 1: Try common APT paths first (faster)
  for path in /usr/bin/ffprobe /usr/local/bin/ffprobe; do
    if [ -f "$path" ]; then
      FFPROBE_FOUND="$path"
      break
    fi
  done

  # Strategy 2: Try which command
  if [ -z "$FFPROBE_FOUND" ]; then
    FFPROBE_FOUND=$(which ffprobe 2>/dev/null || true)
  fi

  # Strategy 3: Hardcore find (last resort)
  if [ -z "$FFPROBE_FOUND" ]; then
    echo "🔍 FFprobe não encontrado nos locais óbvios, fazendo busca profunda..."
    NIX_FFPROBE=$(find /nix/store /usr/lib -maxdepth 4 -name ffprobe -type f 2>/dev/null | head -n 1)
    if [ -n "$NIX_FFPROBE" ]; then
        FFPROBE_FOUND="$NIX_FFPROBE"
    fi
  fi

  if [ -n "$FFPROBE_FOUND" ]; then
    export FFPROBE_PATH="$FFPROBE_FOUND"
    echo "✅ FFprobe encontrado: $FFPROBE_PATH"
  else
    echo "⚠️  FFprobe não encontrado - metadados de vídeo não funcionarão"
  fi
fi

# Start the Node.js server
echo "🎬 Iniciando servidor Node.js..."
exec node server/index.js
