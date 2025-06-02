FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S claude-bot -u 1001

# Create necessary directories
RUN mkdir -p logs backups
RUN chown -R claude-bot:nodejs /usr/src/app

# Switch to non-root user
USER claude-bot

# Expose port (if needed for future web interface)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=5s --retries=3 \
  CMD node dist/main.js status || exit 1

# Start the application
CMD ["node", "dist/main.js", "start", "--daemon"]
