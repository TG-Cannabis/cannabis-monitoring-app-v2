#!/bin/sh

envsubst < /usr/share/nginx/html/mi-monitoring-app/assets/env.template.js \
         > /usr/share/nginx/html/mi-monitoring-app/assets/env.js

exec nginx -g 'daemon off;'
