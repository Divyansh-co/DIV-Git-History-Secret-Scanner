# ==============================================================================
# SentraScan — Production Hardened Ephemeral Dockerfile
# ==============================================================================

# Stage 1: Build Frontend and Backend
FROM node:24-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy root and workspace packages
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install dependencies
RUN npm --prefix server install
RUN npm --prefix client install

# Copy source code
COPY server/ ./server/
COPY client/ ./client/

# Build client and server
RUN npm --prefix client run build
RUN npm --prefix server run build

# ==============================================================================
# Stage 2: Hardened Ephemeral Runtime
# ==============================================================================
FROM node:24-alpine AS runner

WORKDIR /app

# Install Git and Python (for git-filter-repo compatibility)
RUN apk add --no-cache git python3 py3-pip bash && \
    pip install --break-system-packages git-filter-repo

# Create non-root unprivileged sandbox user
RUN addgroup -g 10001 sentrascan && \
    adduser -u 10001 -G sentrascan -s /bin/bash -D sentrascan

# Copy built server and static client dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Configure Git security settings globally for the container
RUN git config --system safe.directory '*' && \
    git config --system core.hooksPath '/dev/null'

# Ensure tmp permissions for non-root user
RUN mkdir -p /tmp/sentrascan_uploads && \
    chown -R sentrascan:sentrascan /app /tmp/sentrascan_uploads

USER sentrascan

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "server/dist/index.js"]
