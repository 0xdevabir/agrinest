FROM node:22-bookworm-slim AS build

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
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm ci \
  && npx prisma generate --schema libs/database/prisma/schema.prisma

COPY web web
COPY libs/shared-types libs/shared-types
ARG API_PROXY_TARGET=http://api:8000
ENV API_PROXY_TARGET=$API_PROXY_TARGET
RUN npm run build --workspace web

FROM node:22-bookworm-slim AS run

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5173
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/web/.next/standalone ./
COPY --from=build /app/web/.next/static ./web/.next/static
COPY --from=build /app/web/public ./web/public

EXPOSE 5173
CMD ["node", "web/server.js"]

