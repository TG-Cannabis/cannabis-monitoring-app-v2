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

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
