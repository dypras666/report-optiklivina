FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production

# Install dependencies first (leverage Docker layer cache)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application sources
COPY src ./src
COPY server.js ./

# Ensure writable directory for generated reports
RUN mkdir -p /app/generated-reports && chown -R node:node /app
USER node

EXPOSE 4000

# App uses env variables: PORT, DB_*, SUPABASE_*, REDIS_URL, AWS_*
CMD ["node", "server.js"]

