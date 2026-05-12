# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies (omit dev for production)
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/models ./models

# Expose port
EXPOSE 8080

# Environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:8080/v1/models').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Start command
CMD ["node", "dist/cli/index.js", "start"]