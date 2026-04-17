# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
ARG API_BASE_URL
ARG DASHBOARD_URL
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund
COPY . .
RUN --mount=type=cache,target=/root/.npm \
    npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist/PublicWeb/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
