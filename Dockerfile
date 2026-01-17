# BrickReview Production Dockerfile
FROM node:20-slim

# Install ffmpeg via apt (most reliable method)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Verify ffmpeg installation
RUN ffmpeg -version && ffprobe -version

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

# Make start script executable
RUN chmod +x railway-start.sh

# Expose port
EXPOSE 8080

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Start the application
CMD ["./railway-start.sh"]
