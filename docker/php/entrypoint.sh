#!/bin/sh
set -eu

cd /var/www/html

mkdir -p \
  storage/framework/cache/data \
  storage/framework/sessions \
  storage/framework/views \
  storage/logs \
  bootstrap/cache

chown -R www-data:www-data storage bootstrap/cache || true

if [ ! -f .env ]; then
  cp .env.example .env
fi

CURRENT_COMPOSER_HASH="$(sha1sum composer.lock 2>/dev/null | awk '{print $1}' || true)"
SAVED_COMPOSER_HASH="$(cat vendor/.composer.lock.hash 2>/dev/null || true)"

if [ ! -f vendor/autoload.php ] || [ "$CURRENT_COMPOSER_HASH" != "$SAVED_COMPOSER_HASH" ]; then
  composer install --no-interaction --prefer-dist
  if [ -n "$CURRENT_COMPOSER_HASH" ]; then
    echo "$CURRENT_COMPOSER_HASH" > vendor/.composer.lock.hash
  fi
fi

until pg_isready -h "${DB_HOST:-db}" -p "${DB_PORT:-5432}" -U "${DB_USERNAME:-poc}" >/dev/null 2>&1; do
  echo "Attendo il database..."
  sleep 2
done

if ! grep -q '^APP_KEY=base64:' .env; then
  php artisan key:generate --force
fi

php artisan migrate --force

exec php-fpm