# ── Stage 1: Build React client ──────────────────────────────
FROM node:20-alpine AS client-builder

WORKDIR /app/client

# Copy package files first for better layer caching
COPY client/package.json client/package-lock.json* ./

# Install all deps (including devDeps needed for build)
RUN npm ci --prefer-offline || npm install

# Copy source
COPY client/ ./

# Build — VITE_API_URL defaults to /api in axios.js so no env needed
RUN npm run build

# ── Stage 2: Production server ───────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Copy server package files
COPY server/package.json server/package-lock.json* ./server/

# Install only production deps
RUN npm ci --prefix server --omit=dev || npm install --prefix server --omit=dev

# Copy server source
COPY server/ ./server/

# Copy built client into /app/client/dist
# (server.js uses path.join(__dirname, '../client/dist'))
COPY --from=client-builder /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "server/server.js"]
