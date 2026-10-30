FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY web/package.json web/
COPY libs/database/package.json libs/database/
COPY libs/shared-types/package.json libs/shared-types/
COPY libs/database/prisma libs/database/prisma
COPY libs/database/src/index.js libs/database/src/index.js
COPY libs/database/src/index.d.ts libs/database/src/index.d.ts

ENV DATABASE_URL=file:/data/agrisathi.db
RUN npm ci \
  && npx prisma generate --schema libs/database/prisma/schema.prisma

COPY apps/api/src apps/api/src
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json apps/api/
COPY apps/api/data apps/api/data
COPY apps/api/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
  && npm run build --workspace @agrisathi/api

WORKDIR /app/apps/api
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8000
EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
