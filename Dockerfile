# Android Remote Control — image de production (Next.js standalone + PostgreSQL)
#
# Build SQLite (développement, défaut) :
#   docker build -t arc-console .
# Build PostgreSQL (VPS — utilisé par docker-compose.vps.yml) :
#   docker build --build-arg ARC_SCHEMA=postgres -t arc-console .
#
# Le démarrage (docker/entrypoint.sh) applique les migrations si
# ARC_RUN_MIGRATIONS=1, puis lance le serveur. AUCUN seed automatique :
# en production, créer l'administrateur avec prisma/bootstrap-admin.ts.

FROM oven/bun:1.2 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

FROM oven/bun:1.2 AS builder
WORKDIR /app
# OpenSSL requis DÈS le build : sans lui, Prisma ne détecte pas libssl et
# télécharge le moteur « openssl-1.1.x » au lieu de « debian-openssl-3.0.x »
# → moteur introuvable à l'exécution (image bookworm).
RUN apt-get update -qq \
    && apt-get install -y -qq --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
ARG ARC_SCHEMA=sqlite # sqlite | postgres
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN if [ "$ARC_SCHEMA" = "postgres" ]; then \
      cp prisma/postgres/schema.prisma prisma/schema.prisma; \
    fi \
    && bunx --bun prisma generate \
    && bun run build

FROM oven/bun:1.2 AS runner
WORKDIR /app
# OpenSSL : requis par le moteur Prisma (détection libssl sinon « may not work
# as expected »). ca-certificates pour les connexions TLS sortantes éventuelles.
RUN apt-get update -qq \
    && apt-get install -y -qq --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Application standalone, node_modules complets (client Prisma généré + CLI
# prisma pour `migrate deploy`) et scripts prisma (bootstrap-admin en one-shot).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh \
    && mkdir -p /app/db
EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
