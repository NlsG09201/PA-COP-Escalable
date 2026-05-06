# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
ARG API_BASE_URL
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund
COPY . .
RUN --mount=type=cache,target=/root/.npm \
    npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist/Frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Mismo origen (:5173): peticiones a /api pasan al gateway; evita CORS y URLs GLB en :8080 ilegibles desde el SPA.
RUN printf '%s\n' 'window.__env={API_BASE_URL:""};' > /usr/share/nginx/html/env.js
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
