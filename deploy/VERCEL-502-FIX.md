# Arreglar 502 en `public/sites` y `public/departments` (Vercel)

## Síntoma

En el navegador:

- `GET https://TU-APP.vercel.app/public/sites` → **502**
- Cabecera `X-Vercel-Error: DNS_HOSTNAME_NOT_FOUND`

## Causa

1. `env.js` tenía `API_BASE_URL = ""` → el front llamaba al **mismo dominio de Vercel**.
2. `vercel.json` antiguo hacía proxy a `https://YOUR_RENDER_API_HOST/...` (host que no existe).

## Solución (5 minutos)

### 1. Variables en Vercel (proyecto PublicWeb, Root Directory = `PublicWeb`)

| Variable | Valor ejemplo |
|----------|----------------|
| `RENDER_API_HOST` | `cop-nest-api.onrender.com` (tu host real en Render, sin `https://`) |
| `PUBLIC_SITE_URL` | `https://pa-cop-escalable-2qx1.vercel.app` |
| `DASHBOARD_URL` | URL de tu panel en Vercel |

### 2. CORS en Render

En **cop-nest-api** → Environment:

```text
CORS_ORIGINS=https://pa-cop-escalable-2qx1.vercel.app,https://TU-PANEL.vercel.app
```

Guardar y **Manual Deploy** del API.

### 3. Subir código y redeploy en Vercel

Haz push de los cambios (`vercel.json`, `prepare-vercel.mjs`, `index.html`, `api.config.ts`) y **Redeploy** el proyecto PublicWeb (sin caché si puedes).

### 4. Comprobar

1. Abre `https://TU-APP.vercel.app/env.js`  
   - Debe verse `API_BASE_URL` con `https://...onrender.com` (no `""`).

2. En DevTools → Network, al cargar sedes la URL debe ser:  
   `https://cop-nest-api.onrender.com/public/sites`  
   **no** `https://TU-APP.vercel.app/public/sites`.

3. El API en Render debe responder:  
   `GET https://TU-API.onrender.com/health/live` → 200.

Si el API en Render devuelve 404 o no existe, crea/reactiva el servicio con el Blueprint `render.yaml` (ver `deploy/RENDER.md`).

## Nota

El error `chrome-extension://... Cannot use import statement` es de una extensión de Chrome, no de esta app.
