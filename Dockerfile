# API Nest (Centro COP) — build desde la raíz del repo.
# Render/VPS: Web Service Docker con contexto = raíz del repositorio.
# Alternativa preferida: Blueprint render.yaml o Root Directory = nest-migration.

FROM node:20-alpine AS build

WORKDIR /app
COPY nest-migration/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund
COPY nest-migration/ .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine

WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY nest-migration/package*.json ./

ENV NODE_ENV=production
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s \
  CMD node -e "const p=process.env.PORT||8080;require('http').get('http://127.0.0.1:'+p+'/health/live',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "dist/main"]
