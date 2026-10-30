#!/bin/sh
set -eu
mkdir -p /data /app/apps/api/uploads/leaf-photos
cd /app
npx prisma db push --schema /app/libs/database/prisma/schema.prisma --skip-generate --accept-data-loss
cd /app/apps/api
exec node dist/main.js
