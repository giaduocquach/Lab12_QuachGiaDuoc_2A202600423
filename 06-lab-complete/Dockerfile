# ============================================================
# Production Dockerfile — BKAgent Web (Lab5-6 UI exact deploy)
# ============================================================

# Stage 1: Install deps
FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY vinagent-web/package.json vinagent-web/package-lock.json ./
RUN npm install


# Stage 2: Build Next app
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY vinagent-web/ ./

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build
RUN npm prune --omit=dev


# Stage 3: Runtime (non-root)
FROM node:20-bookworm-slim AS runtime

RUN groupadd -r app && useradd -r -g app -m -d /home/app app

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/ ./

RUN chown -R app:app /app

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "npm run start -- --hostname 0.0.0.0 --port ${PORT:-3000}"]
