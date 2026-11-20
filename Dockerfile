# Jarvis on Google Cloud Run, with a real Chromium for the Jarvis computer
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx next build

FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-noto-core fonts-noto-color-emoji ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0 CHROME_PATH=/usr/bin/chromium
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 8080
CMD ["node", "server.js"]
