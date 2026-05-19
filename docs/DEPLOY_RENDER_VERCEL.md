# Despliegue: MongoDB Atlas + Render + Vercel

Guía paso a paso para **Centro COP**. Tiempo estimado: 1–2 h la primera vez.

---

## Paso 1 — MongoDB Atlas (15 min)

1. [cloud.mongodb.com](https://cloud.mongodb.com) → **Create cluster** (M0 gratis o M10 producción).
2. **Database Access** → usuario con contraseña fuerte → rol `readWrite` en la DB.
3. **Network Access** → `0.0.0.0/0` (Render) o IPs fijas si las tienes.
4. **Connect** → driver Node → copia URI, ejemplo:

   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/cop_escalable?retryWrites=true&w=majority`

5. Guárdala como `MONGODB_URL` (no la subas a Git).

---

## Paso 2 — Redis (10 min)

**Opción A — Upstash (recomendado, gratis tier)**  
1. [upstash.com](https://upstash.com) → Redis → Create.  
2. Copia `REDIS_URL` (`rediss://...`).

**Opción B — Render Redis**  
1. Render Dashboard → **New Redis** → copia **Internal Redis URL** para el API.

---

## Paso 3 — Render: API + J48 (20 min)

1. [render.com](https://render.com) → **New** → **Blueprint** (no “Web Service” suelto con Docker en la raíz).
2. Conecta repo `NlsG09201/PA-COP-Escalable`, rama `main`.
3. Blueprint file: **`render.yaml`** en la raíz (o `deploy/render.yaml` si el asistente lo pide).
3. Cuando pida variables, rellena:

| Variable | Valor |
|----------|--------|
| `MONGODB_URL` | URI Atlas del paso 1 |
| `REDIS_URL` | URI Redis paso 2 |
| `JWT_SECRET` | (Render puede generar) o string largo aleatorio |
| `J48_URL` | Tras desplegar J48: `https://cop-j48-service.onrender.com/predict` |
| `PUBLIC_API_ORIGIN` | `https://cop-nest-api.onrender.com` (ajusta si el nombre difiere) |
| `CORS_ORIGINS` | Vacío al inicio; luego URLs Vercel separadas por coma |
| `APP_BOOTSTRAP_ADMIN_USERNAME` | Tu usuario admin |
| `APP_BOOTSTRAP_ADMIN_PASSWORD` | Password fuerte (solo primer arranque) |
| `APP_BOOTSTRAP_ADMIN_EMAIL` | Tu email |
| `SEED_COLOMBIA_SITES` | `true` |
| `NODE_ENV` | `production` (ya en blueprint) |

4. Espera deploy. Prueba:

   `https://TU-SERVICIO.onrender.com/health`

   Respuesta esperada: `"status":"ok"` y checks `mongodb`/`redis` en `ok`.

5. En **cop-j48-service** → copia la URL pública y actualiza `J48_URL` en **cop-nest-api** → **Manual Deploy**.

---

## Paso 4 — Vercel: PublicWeb (15 min)

1. [vercel.com](https://vercel.com) → **Add New Project** → importa el mismo repo.
2. **Root Directory:** `PublicWeb` (obligatorio; si dejas la raíz del repo el build falla o no encuentra el script).
3. **Environment Variables** (Production) — marcar **Production** (y Preview si quieres):

| Name | Example |
|------|---------|
| `RENDER_API_HOST` | `cop-nest-api.onrender.com` |
| `DASHBOARD_URL` | `https://tu-panel.vercel.app` (tras paso 5) |
| `PUBLIC_SITE_URL` | `https://tu-web.vercel.app` |

4. **Build Command:** `npm run vercel-build` (ya en `vercel.json`; no hace falta cambiarlo).

5. Deploy → copia la URL (ej. `https://cop-public.vercel.app`).

6. Vuelve a **Render** → `cop-nest-api` → Environment → actualiza:

   `CORS_ORIGINS=https://cop-public.vercel.app,https://tu-panel.vercel.app`

   (sin espacios, coma entre URLs)

---

## Paso 5 — Vercel: Frontend (panel) (15 min)

1. Nuevo proyecto Vercel, **Root Directory:** `Frontend`.
2. Variables:

| Name | Value |
|------|--------|
| `RENDER_API_HOST` | `cop-nest-api.onrender.com` |
| `DASHBOARD_URL` | URL de este proyecto Vercel |
| `PUBLIC_SITE_URL` | URL PublicWeb del paso 4 |

3. Build: `node ../scripts/prepare-vercel.mjs Frontend && npm ci && npm run build`
4. Tras deploy, añade la URL del panel a `CORS_ORIGINS` en Render y redeploy API.

---

## Paso 6 — Wompi (pagos, cuando vayas a cobrar)

En Render (`cop-nest-api`):

- `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`
- `PUBLIC_API_ORIGIN` = URL pública del API (Render)
- Webhook Wompi → `https://cop-nest-api.onrender.com/public/...` (ruta según tu integración)
- **No** uses `WOMPI_SKIP_WEBHOOK_VERIFY=true` en producción.

---

## Paso 7 — Verificación final

- [ ] `GET /health` en Render → ok
- [ ] Login panel Vercel → sedes cargan → login admin
- [ ] PublicWeb → reserva sandbox
- [ ] CI en GitHub verde

---

## Solución de problemas

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| CORS error en navegador | Falta URL en `CORS_ORIGINS` | Añadir origen exacto `https://....vercel.app` |
| API no arranca | `JWT_SECRET` débil o CORS vacío en prod | Revisar logs Render |
| `/health` 503 | Mongo/Redis mal configurados | Revisar `MONGODB_URL` / `REDIS_URL` |
| 404 en `/api/*` desde Vercel | `RENDER_API_HOST` incorrecto | Re-deploy con variable correcta |
| `open Dockerfile: no such file` en Render | Servicio Docker sin ruta al Dockerfile | Ya existe `/Dockerfile` en la raíz (API Nest). Redeploy. Para J48: Root `services/j48-service`. Mejor: **Blueprint** `render.yaml` |
| Mismo error desplegando el front | PublicWeb/Frontend en Render con Docker | Usar **Vercel** (sin Docker), Root `PublicWeb` o `Frontend` |
| `ENOTFOUND cluster0.xxxxx` | `MONGODB_URL` es el ejemplo de `env.production.example` | Atlas → Connect → copiar URI real con tu cluster (ej. `cluster0.abc12.mongodb.net`) |
| `ENOTFOUND host` en ioredis | `REDIS_URL` tiene literal `HOST` o placeholder | Upstash/Render → copiar URL completa con hostname real |

---

## Comando local (generar config Vercel antes de push)

```powershell
$env:RENDER_API_HOST = "cop-nest-api.onrender.com"
$env:DASHBOARD_URL = "https://tu-panel.vercel.app"
$env:PUBLIC_SITE_URL = "https://tu-web.vercel.app"
node scripts/prepare-vercel.mjs PublicWeb
node scripts/prepare-vercel.mjs Frontend
```
