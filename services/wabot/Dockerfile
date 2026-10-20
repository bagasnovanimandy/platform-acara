# syntax=docker/dockerfile:1.7
# wabot-svc. Build dari root repo: docker build -f services/wabot/Dockerfile .
# Migrasi memakai image yang sama: `node_modules/.bin/prisma migrate deploy`.
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS base
# Secret `ca` opsional: sertifikat CA tambahan bila build lewat proxy TLS.
RUN --mount=type=secret,id=ca NODE_EXTRA_CA_CERTS=/run/secrets/ca \
    npm install -g pnpm@10.28.0 --no-fund --no-audit
WORKDIR /repo

FROM base AS build
# prisma.config.ts mewajibkan DATABASE_URL walau `prisma generate` tidak memakai database.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY . .
RUN --mount=type=secret,id=ca --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    NODE_EXTRA_CA_CERTS=/run/secrets/ca pnpm install --frozen-lockfile --filter "@platform-acara/wabot..."
RUN pnpm turbo run build --filter=@platform-acara/wabot...
# Hanya dependensi produksi (+ paket workspace) di /out, lalu kode hasil build.
RUN --mount=type=secret,id=ca --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    NODE_EXTRA_CA_CERTS=/run/secrets/ca pnpm --filter @platform-acara/wabot deploy --prod --legacy /out \
 && rm -rf /out/src /out/dist /out/Dockerfile /out/vitest.config.ts \
 && cp -r services/wabot/dist /out/dist

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production PORT=3003
WORKDIR /app
RUN mkdir -p /data/wa-auth && chown node:node /data/wa-auth
ENV WA_AUTH_DIR=/data/wa-auth
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3003/health >/dev/null || exit 1
CMD ["node", "dist/main.js"]
