# syntax=docker/dockerfile:1
#
# One image, both processes (web on 3000 proxies /api to the API on 4000).
#
#   docker build -t contentpilot .
#   docker run --rm -p 3000:3000 --env-file .env -v contentpilot-uploads:/app/uploads contentpilot
#
# Split images, if you run Postgres/Redis yourself:
#   docker build --target api -t contentpilot-api .
#   docker build --target web -t contentpilot-web .
# Pass --build-arg INTERNAL_API_URL=http://<api-host>:4000 when the web
# process is not in the same container as the API (rewrites are baked in).

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    npm_config_update_notifier=false \
    NPM_CONFIG_FUND=false

# Full install, including the TypeScript / Next toolchain used only to compile.
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,id=npm-deps,target=/root/.npm \
    npm ci

FROM deps AS build-shared
COPY packages/shared packages/shared
RUN npm run build --workspace=@contentpilot/shared

FROM build-shared AS build-api
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
COPY apps/api apps/api
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    npx prisma generate --schema=apps/api/prisma/schema.prisma \
 && npm run build --workspace=@contentpilot/api

FROM build-shared AS build-web
ARG NEXT_PUBLIC_APP_NAME=ContentPilot
ARG NEXT_PUBLIC_APP_TAGLINE=Content Engine
ARG INTERNAL_API_URL=http://127.0.0.1:4000
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_APP_TAGLINE=$NEXT_PUBLIC_APP_TAGLINE \
    INTERNAL_API_URL=$INTERNAL_API_URL \
    API_URL=$INTERNAL_API_URL
COPY apps/web apps/web
RUN npm run build --workspace=@contentpilot/web

# Runtime deps for the API only. Dev tooling stays out.
# prisma CLI is installed because the server runs `prisma db push` on boot.
# embedded-postgres binaries are removed; production uses DATABASE_URL.
FROM base AS api-deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/prisma apps/api/prisma
RUN --mount=type=cache,id=npm-api,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts --workspace=@contentpilot/api --include-workspace-root \
 && npm rebuild sharp \
 && npm install --no-save --ignore-scripts --workspace=@contentpilot/api prisma@6.19.3 \
 && DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    npx prisma generate --schema=apps/api/prisma/schema.prisma \
 && rm -rf node_modules/@embedded-postgres \
 && npm cache clean --force

FROM base AS api
# fontconfig + fonts: sharp/librsvg rasterises the SVG poster slides with system
# fonts when publishing. Without them every headline vanishes (blank cards).
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates fontconfig fonts-dejavu-core fonts-liberation \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /app/uploads \
 && chown node:node /app/uploads
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=4000 \
    UPLOAD_DIR=/app/uploads \
    USE_EMBEDDED_PG=false
COPY --from=api-deps --chown=node:node /app ./
COPY --from=build-shared --chown=node:node /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build-shared --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=build-api --chown=node:node /app/apps/api/dist ./apps/api/dist
USER node
RUN node -e "require('@contentpilot/shared'); require('@prisma/client'); require('sharp')"
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=8 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/index.js"]

FROM base AS web
ENV NODE_ENV=production \
    PORT=3000
COPY --from=build-web --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build-web --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
RUN test -f apps/web/server.js
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Docker injects HOSTNAME=container-id; override it or Next listens on the wrong address.
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node apps/web/server.js"]

# Default image: API + web in one container. Publish port 3000.
FROM base AS app
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini openssl ca-certificates fontconfig fonts-dejavu-core fonts-liberation \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /app/uploads \
 && chown node:node /app/uploads
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=4000 \
    PORT=3000 \
    UPLOAD_DIR=/app/uploads \
    USE_EMBEDDED_PG=false
COPY --from=api --chown=node:node /app /srv/api
COPY --from=web --chown=node:node /app /srv/web
COPY --chown=node:node docker/entrypoint.mjs /usr/local/bin/docker-entrypoint.mjs
USER node
EXPOSE 3000 4000
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=8 \
  CMD node -e "const p=process.env.PORT||3000;const a=process.env.API_PORT||4000;Promise.all([fetch('http://127.0.0.1:'+a+'/health'),fetch('http://127.0.0.1:'+p+'/')]).then(([x,y])=>process.exit(x.ok&&y.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["tini", "--", "node", "/usr/local/bin/docker-entrypoint.mjs"]
