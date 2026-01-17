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

# Create production bundle
RUN mkdir -p /app/production-files && \
    cp -a /app/package*.json /app/production-files/ && \
    cp -a /app/node_modules /app/production-files/ && \
    cp -a /app/dist /app/production-files/ && \
    cp -a /app/server /app/production-files/ && \
    cp -a /app/scripts /app/production-files/ && \
    cp -a /app/railway-start.sh /app/production-files/

# Stage 2: Production
FROM node:20-slim

# Install ffmpeg via apt (most reliable method)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Verify ffmpeg installation
RUN ffmpeg -version && ffprobe -version

WORKDIR /app

# Copy artifacts from builder (single layer)
COPY --from=builder /app/production-files/ .

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
