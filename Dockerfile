# Multi-stage Dockerfile for BrickReview
# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build frontend
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:20-slim

# Install ffmpeg via apt (most reliable method)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Verify ffmpeg installation
RUN ffmpeg -version && ffprobe -version

WORKDIR /app

# Copy artifacts from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/railway-start.sh ./railway-start.sh

# Fix permissions for non-root user
RUN chmod +x railway-start.sh && \
    chown -R node:node /app

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Switch to non-root user for security
USER node

# Expose port
EXPOSE 8080

# Start the application
CMD ["./railway-start.sh"]
