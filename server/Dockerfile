# NEC Innovation Lab API — production image
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first (cached unless package*.json change)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Never run as root inside the container
USER node
EXPOSE 5000

# Docker restarts the container if the API stops answering
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-5000}/api/health || exit 1

CMD ["node", "server.js"]
