# Centro COP — Plataforma clínica escalable

Sistema para gestión clínica (panel interno), reservas públicas, ortodoncia 3D, scoring J48 e integración de pagos (Wompi).

## Componentes

| Carpeta | Descripción | Puerto local |
|---------|-------------|--------------|
| `web-public/` | **Web pública Next.js** (landing, reservas, auth) | 3000 |
| `web-dashboard/` | **Panel clínico Next.js** (RBAC, KPIs, psicología, J48) | 3001 |
| `Frontend/` | Panel clínico Angular (legacy) | 5173 |
| `PublicWeb/` | Web pública Angular (legacy) | 5174 |
| `nest-migration/` | API principal (NestJS) | vía gateway 8080 |
| `services/j48-python/` | **IA J48** (FastAPI + scikit-learn) | interno |
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

- Web pública Next: http://localhost:3000  
- Dashboard Next: http://localhost:3001  
- Panel Angular: http://localhost:5173  
- Web pública Angular: http://localhost:5174  
- API (gateway): http://localhost:8080  

Documentación de arquitectura: **[docs/ARQUITECTURA_ENTERPRISE.md](docs/ARQUITECTURA_ENTERPRISE.md)**

Servicio J48: **[services/j48-service/README.md](services/j48-service/README.md)**

## Producción

1. **Todo en Render (recomendado Next + API + J48):** **[deploy/RENDER.md](deploy/RENDER.md)** — Blueprint `render.yaml` en la raíz.
2. **Render API + Vercel (Angular legacy):** **[docs/DEPLOY_RENDER_VERCEL.md](docs/DEPLOY_RENDER_VERCEL.md)** (Atlas + Render + Vercel).
3. Leer **[docs/PRODUCTION_ANALYSIS.md](docs/PRODUCTION_ANALYSIS.md)** — checklist y brechas.
4. Copiar **[deploy/env.production.example](deploy/env.production.example)** y configurar Atlas, Redis, JWT, Wompi, CORS, `NEXT_PUBLIC_API_URL`.
5. Usar **`NODE_ENV=production`** en el API (Swagger desactivado, validación estricta de env).
6. Health: `GET /health` (Mongo + Redis), `GET /health/live` (solo proceso).
7. Blueprint Render: **`render.yaml`** en la raíz (espejo en `deploy/render.yaml`).

## CI

GitHub Actions (`.github/workflows/ci.yml`): build de Nest, Frontend, PublicWeb, **web-public**, **web-dashboard** y smoke J48 Python en cada push/PR.

## Agentes Cursor (agency-agents)

Reglas en `.cursor/rules/agency-agents/`. MCP `agency-agents` para buscar plantillas adicionales.

## Scripts útiles

| Script | Uso |
|--------|-----|
| `scripts/dev-up-core.ps1` | Levantar perfil core |
| `scripts/install-agency-agents-cursor.ps1` | Reglas + MCP agency-agents |
