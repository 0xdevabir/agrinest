FROM dunglas/frankenphp:1-php8.4-bookworm

RUN install-php-extensions pdo_pgsql gd bcmath opcache pcntl zip

ENV SERVER_NAME=":8000"
ENV COMPOSER_ALLOW_SUPERUSER=1

WORKDIR /app

RUN curl -fsSL https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY . .
RUN composer dump-autoload --optimize --no-dev \
    && chmod +x docker-entrypoint.sh \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && printf 'upload_max_filesize=8M\npost_max_size=56M\nmemory_limit=512M\n' > "$PHP_INI_DIR/conf.d/agrinest.ini" \
    && printf ':8000 {\n\troot * /app/public\n\tencode zstd gzip\n\tphp_server\n}\n' > /etc/frankenphp/Caddyfile

EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["frankenphp", "run", "--config", "/etc/frankenphp/Caddyfile"]
