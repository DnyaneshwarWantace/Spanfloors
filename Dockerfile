# ---------- dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Pages load products/content at runtime, so the build needs no database or API keys.
RUN npm run build

# ---------- runtime ----------
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts/migrate.mjs /app/scripts/create-admin.mjs ./scripts/
# The start-up migration needs drizzle's migrator and pg with all their dependencies.
RUN mkdir -p /opt/migrate && cd /opt/migrate && npm init -y >/dev/null && npm install --no-audit --no-fund drizzle-orm@0.45.4 pg@8.23.1 >/dev/null
RUN mkdir -p /app/storage/uploads /app/storage/cache && chown -R app:app /app/storage
USER app
EXPOSE 3000
CMD ["sh", "-c", "NODE_PATH=/opt/migrate/node_modules node scripts/migrate.mjs && node server.js"]
