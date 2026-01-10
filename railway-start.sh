#!/bin/bash
set -e

echo "🚀 Iniciando BrickReview no Railway..."

# Find FFmpeg in the Nix store if not already set
if [ -z "$FFMPEG_PATH" ]; then
  echo "🔍 Procurando FFmpeg no sistema..."

  # Strategy 1: Try which command
  FFMPEG_FOUND=$(which ffmpeg 2>/dev/null || true)

  # Strategy 2: Check common paths
  if [ -z "$FFMPEG_FOUND" ]; then
    echo "🔍 FFmpeg não está no PATH, procurando no sistema..."
    for path in /usr/bin/ffmpeg /usr/local/bin/ffmpeg /usr/lib/ffmpeg; do
      if [ -f "$path" ]; then
        FFMPEG_FOUND="$path"
        break
      fi
    done
  fi

  # Strategy 3: Hardcore find in /nix/store
  if [ -z "$FFMPEG_FOUND" ]; then
    echo "🔍 Procurando FFmpeg no /nix/store..."
    # Aumentando depth e procurando especificamente em pastas bin
    NIX_FFMPEG=$(find /nix/store -maxdepth 4 -path "*/bin/ffmpeg" -type f 2>/dev/null | head -n 1)
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

  # Strategy 1: Try which command
  FFPROBE_FOUND=$(which ffprobe 2>/dev/null || true)

  # Strategy 2: Check common paths
  if [ -z "$FFPROBE_FOUND" ]; then
    echo "🔍 FFprobe não está no PATH, procurando no sistema..."
    for path in /usr/bin/ffprobe /usr/local/bin/ffprobe /usr/lib/ffprobe; do
      if [ -f "$path" ]; then
        FFPROBE_FOUND="$path"
        break
      fi
    done
  fi

  # Strategy 3: Hardcore find in /nix/store
  if [ -z "$FFPROBE_FOUND" ]; then
    echo "🔍 Procurando FFprobe no /nix/store..."
    NIX_FFPROBE=$(find /nix/store -maxdepth 4 -path "*/bin/ffprobe" -type f 2>/dev/null | head -n 1)
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
