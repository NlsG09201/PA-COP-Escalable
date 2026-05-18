# Centro COP — Plataforma clínica escalable

Sistema para gestión clínica (panel interno), reservas públicas, ortodoncia 3D, scoring J48 e integración de pagos (Wompi).

## Componentes

| Carpeta | Descripción | Puerto local (Docker) |
|---------|-------------|------------------------|
| `Frontend/` | Panel clínico (Angular) | 5173 |
| `PublicWeb/` | Web pública y reservas | 5174 |
| `nest-migration/` | API principal (NestJS) | vía gateway 8080 |
| `services/gateway/` | API gateway (nginx) | 8080 |
| `services/j48-service/` | Microservicio J48 | interno |
| `compose.yaml` | Orquestación Docker | — |

## Inicio rápido (desarrollo)

```powershell
# Copiar variables (editar valores)
copy compose.env.example .env

# Stack core
docker compose --profile core up -d --build
# o
.\scripts\dev-up-core.ps1
```

- Panel: http://localhost:5173  
- Web pública: http://localhost:5174  
- API (gateway): http://localhost:8080  

## Producción

1. Guía de despliegue: **[docs/DEPLOY_RENDER_VERCEL.md](docs/DEPLOY_RENDER_VERCEL.md)** (Atlas + Render + Vercel).
2. Leer **[docs/PRODUCTION_ANALYSIS.md](docs/PRODUCTION_ANALYSIS.md)** — checklist y brechas.
3. Copiar **[deploy/env.production.example](deploy/env.production.example)** y configurar Atlas, Redis, JWT, Wompi, CORS.
4. Usar **`NODE_ENV=production`** en el API (Swagger desactivado, validación estricta de env).
5. Health: `GET /health` (Mongo + Redis), `GET /health/live` (solo proceso).
6. Blueprint Render: **[deploy/render.yaml](deploy/render.yaml)** (API + J48; frontends en Vercel).

## CI

GitHub Actions (`.github/workflows/ci.yml`): build de Nest, Frontend y PublicWeb en cada push/PR.

## Agentes Cursor (agency-agents)

Reglas en `.cursor/rules/agency-agents/`. MCP `agency-agents` para buscar plantillas adicionales.

## Scripts útiles

| Script | Uso |
|--------|-----|
| `scripts/dev-up-core.ps1` | Levantar perfil core |
| `scripts/install-agency-agents-cursor.ps1` | Reglas + MCP agency-agents |
