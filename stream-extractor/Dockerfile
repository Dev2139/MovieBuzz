# Stream Extractor Worker — headless Chromium that passes Cloudflare JS challenges
# and returns a directly playable .m3u8/.mp4 URL for the MovieBuzz player.
FROM node:20-bookworm-slim

# Install Chromium + the shared libs Puppeteer/Chromium needs.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY src ./src

EXPOSE 8080

# Healthcheck keeps free-tier instances warm/verifiable.
HEALTHCHECK --interval=60s --timeout=10s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["node", "src/index.js"]
