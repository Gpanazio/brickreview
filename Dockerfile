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

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built frontend and server
COPY dist ./dist
COPY server ./server
COPY railway-start.sh ./

# Make start script executable
RUN chmod +x railway-start.sh

# Expose port
EXPOSE 8080

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Start the application
CMD ["./railway-start.sh"]
