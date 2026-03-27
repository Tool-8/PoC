FROM node:20-alpine

WORKDIR /var/www/html

COPY docker/node/entrypoint.sh /usr/local/bin/node-entrypoint.sh
RUN chmod +x /usr/local/bin/node-entrypoint.sh

CMD ["sh", "/usr/local/bin/node-entrypoint.sh"]