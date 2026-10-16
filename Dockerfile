# Android Remote Control — image de production (Next.js standalone)
FROM oven/bun:1.2 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

FROM oven/bun:1.2 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Le schéma est compilé avec le provider configuré dans prisma/schema.prisma
# (sqlite en dev ; basculer en "postgresql" avant le build VPS).
RUN bunx prisma generate && bun run build

FROM oven/bun:1.2 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma/seed.ts ./prisma/seed.ts
RUN mkdir -p /app/db
EXPOSE 3000
# Migrations appliquées au démarrage, puis seed idempotent si base vide, puis serveur.
CMD ["sh", "-c", "bunx prisma migrate deploy && bun prisma/seed.ts || true && bun server.js"]
