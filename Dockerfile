FROM node:18 AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build -- --base-href /mi-monitoring-app/

FROM nginx:stable-alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist/mi-monitoring-app/browser /usr/share/nginx/html/mi-monitoring-app

# Copiar template del env.js
COPY ./src/assets/env.template.js /usr/share/nginx/html/mi-monitoring-app/assets/env.template.js

# Entrypoint que genera el env.js real
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
