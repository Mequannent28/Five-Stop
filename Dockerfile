# ── Stage 1: Build React client ──────────────────────────────
FROM node:20-slim AS client-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN npm install

COPY client/ ./

# Set production API URL — override via build arg if needed
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: Production server ───────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN npm install --prefix server --omit=dev

# Copy server source
COPY server/ ./server/

# Copy built client dist — placed at /app/client/dist
# so server.js path join(__dirname, '../client/dist') resolves correctly
COPY --from=client-builder /app/client/dist ./client/dist

# Expose port
EXPOSE 5000

ENV NODE_ENV=production

# Start the server
CMD ["node", "server/server.js"]
