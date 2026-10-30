#!/bin/sh
set -e

php artisan storage:link --force >/dev/null

# Only the API container migrates and seeds; the scheduler shares the same image.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  php artisan migrate --force
  if [ "${SEED_DEMO:-false}" = "true" ]; then
    php artisan db:seed --force
    php artisan agrinest:sync-weather || echo "Weather sync skipped"
  fi
fi

exec "$@"
