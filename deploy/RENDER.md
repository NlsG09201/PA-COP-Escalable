# Despliegue completo en Render

Guía para levantar **API Nest**, **J48 Python**, **web pública Next** y **dashboard Next** con el [Blueprint](https://render.com/docs/blueprint-spec) `render.yaml` en la raíz del repo.

## Requisitos previos

1. **MongoDB Atlas** — cluster, usuario `readWrite`, red `0.0.0.0/0` (o IP de Render), URI `mongodb+srv://.../NOMBRE_DB?...` (ver `docs/MONGODB_ATLAS_COLECCIONES.md`)
2. **Redis** — [Upstash](https://upstash.com) `rediss://...` o **Render Redis** (URL interna o TLS según el producto)
3. Cuenta [Render](https://render.com) y el repositorio conectado a GitHub/GitLab

## Paso 1 — Crear el Blueprint

1. Render Dashboard → **New** → **Blueprint**
2. Selecciona el repositorio y la rama (`main` o la que uses)
3. **Blueprint path:** `render.yaml` (raíz) o `deploy/render.yaml` (mismo contenido)
4. **Apply** — Render creará 4 Web Services:
   - `cop-j48-python` (Docker, entrena al arrancar con el ARFF del repo)
   - `cop-nest-api` (Docker Nest)
   - `cop-web-public` (Node, carpeta `web-public`)
   - `cop-web-dashboard` (Node, carpeta `web-dashboard`)

## Paso 2 — Variables obligatorias (Environment)

> **Error `MongoDB password missing`:** la variable **no está en Render** (el `.env` local no cuenta). Servicio correcto: **`cop-nest-api`**, no las webs Next. Añade `MONGODB_PASSWORD` = contraseña Atlas → **Save** → **Manual Deploy**. Automático: `.\deploy\render-sync-mongo-env.ps1` con `RENDER_API_KEY` (ver script).


Rellénalas en el asistente del Blueprint o después en cada servicio → **Environment**.

### `cop-nest-api`

| Variable | Valor |
|----------|--------|
| `MONGODB_URL` | URI de Atlas (completa **o** con `<db_password>` si usas la opción B) |
| `MONGODB_PASSWORD` | **Opción B:** contraseña del usuario Atlas (el API arma la URI al arrancar) |
| `REDIS_URL` | Solo la URI: `rediss://...` desde Upstash (sin `redis-cli`). El API normaliza si pegas por error el comando CLI |
| `PUBLIC_API_ORIGIN` | `https://cop-nest-api.onrender.com` (ajusta si cambiaste el nombre del servicio) |
| `J48_URL` | **Solo la base**, sin `/predict`. Ej: `https://cop-j48-python.onrender.com` |
| `CORS_ORIGINS` | Orígenes del navegador, coma sin espacios: `https://cop-web-public.onrender.com,https://cop-web-dashboard.onrender.com` |
| `DASHBOARD_URL` | `https://cop-web-dashboard.onrender.com` |
| `PUBLIC_SITE_URL` | `https://cop-web-public.onrender.com` |
| `APP_BOOTSTRAP_ADMIN_*` | Usuario admin inicial (ver `deploy/env.production.example`) |
| `APP_BOOTSTRAP_ADMIN_ORG_ID` | UUID de organización si ya existe en Mongo; si no, deja vacío o usa el del seed |

Opcionales: `WOMPI_*`, `STRIPE_SECRET_KEY`, `PAYPAL_*`, `GOOGLE_CLIENT_ID`, `AI_DIAGNOSIS_URL`, etc.

Tras el **primer deploy** de `cop-j48-python`, copia su URL pública y pégala en `J48_URL` del API → **Manual Deploy** del API.

### `cop-web-public` y `cop-web-dashboard`

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://cop-nest-api.onrender.com` (misma URL que `PUBLIC_API_ORIGIN`) |

**Importante:** Next incrusta `NEXT_PUBLIC_*` en el build. Tras cambiar esta variable, haz **Clear build cache & deploy** o un redeploy para que el cliente apunte al API correcto.

## Paso 3 — Comprobaciones

```text
GET https://cop-j48-python.onrender.com/health     → {"ok":true,...}
GET https://cop-nest-api.onrender.com/health       → estado Mongo + Redis ok
GET https://cop-web-public.onrender.com            → landing
GET https://cop-web-dashboard.onrender.com/login   → panel
```

Si el navegador muestra error **CORS**, revisa que `CORS_ORIGINS` incluya exactamente el `https://...` del front (sin barra final).

### Errores frecuentes

- **`ENOTFOUND your-instance.upstash.io`**: pegaste el **ejemplo** del repo, no tu URL de Upstash. En [Upstash Console](https://console.upstash.com) → tu base → copia **Redis URL** (TLS) y pégala entera en `REDIS_URL`. El host debe ser algo como `prepared-ram-78507.upstash.io`, no `your-instance`.
- **`[ioredis] connect ENOENT %20--tls%20-u`**: `REDIS_URL` incluye el comando `redis-cli --tls -u` delante de la URI. En Render deja solo `rediss://default:...@....upstash.io:6379`.
- **`MONGODB_URL still contains a placeholder password`**: en **cop-nest-api** → **Environment** añade `MONGODB_PASSWORD` = contraseña Atlas (sin `<>`), guarda y **Manual Deploy**. O pega la URI completa en `MONGODB_URL` sin `<db_password>`.
- **`MongooseServerSelectionError` / IP whitelist**: en MongoDB Atlas → **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`). Sin esto Render no entra al cluster.
- **Puerto**: Nest usa `process.env.PORT` (Render lo inyecta). No hace falta fijar `PORT` manualmente salvo pruebas locales.
- **`/nest-migration`: not found / checksum del contexto**: Suele pasar si en Render usas el **Dockerfile de la raíz** del repo con **contexto = raíz** y el `.dockerignore` ignoraba toda la carpeta `nest-migration`. En el repo ya está corregido (solo se ignoran `nest-migration/node_modules` y `nest-migration/dist`). Alternativa: en el Blueprint deja `dockerContext: ./nest-migration` + `dockerfilePath: ./nest-migration/Dockerfile` como en `render.yaml`.

## Dockerfile J48 (contexto raíz)

El servicio J48 usa `deploy/docker/j48-python.Dockerfile` con `dockerContext: .` para copiar `datasets/relapse_risk_j48.arff`. El archivo `.dockerignore` en la raíz acelera el build ignorando `node_modules`, Angular, etc.

## Coste y límites

- Cada Web Service en plan **Starter** puede “dormirse” en inactividad; el primer request tarda más (cold start).
- Para producción estable, considera planes superiores o un solo front en Vercel y solo API+J48 en Render.

## Referencia cruzada

- Variables detalladas: `deploy/env.production.example`
- Arquitectura: `docs/ARQUITECTURA_ENTERPRISE.md`
- Flujo mixto Render + Vercel (Angular legacy): `docs/DEPLOY_RENDER_VERCEL.md`
