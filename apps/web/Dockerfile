# syntax=docker/dockerfile:1.7
# web (Next.js, output standalone). Build dari root repo: docker build -f apps/web/Dockerfile .
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS base
# Secret `ca` opsional: sertifikat CA tambahan bila build lewat proxy TLS.
RUN --mount=type=secret,id=ca NODE_EXTRA_CA_CERTS=/run/secrets/ca \
    npm install -g pnpm@10.28.0 --no-fund --no-audit
WORKDIR /repo

FROM base AS build
# Tujuan rewrite /api/* bila tidak lewat Traefik (rewrite Next.js dibekukan saat build).
ARG CORE_URL=http://core:3001
ARG ACARA_URL=http://acara:3002
ARG WABOT_URL=http://wabot:3003
ENV CORE_URL=${CORE_URL} ACARA_URL=${ACARA_URL} WABOT_URL=${WABOT_URL} \
    NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
COPY . .
RUN --mount=type=secret,id=ca --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    NODE_EXTRA_CA_CERTS=/run/secrets/ca NODE_ENV=development pnpm install --frozen-lockfile --filter "@platform-acara/web..."
RUN pnpm turbo run build --filter=@platform-acara/web...

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
