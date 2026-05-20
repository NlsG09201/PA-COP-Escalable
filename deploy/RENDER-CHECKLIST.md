# Checklist Render — cop-nest-api no arranca

## API caído (`x-render-routing: no-server`)

Si `https://cop-nest-api.onrender.com/health/live` devuelve **404** y la cabecera `x-render-routing: no-server`:

1. El servicio **no existe** o está **suspendido** en Render.
2. [Dashboard](https://dashboard.render.com) → **cop-nest-api** → **Resume** o **Manual Deploy**.
3. Si no aparece: **New → Blueprint** → repo → `render.yaml` → **Apply**.
4. Configura env (abajo) → **Save** → **Manual Deploy**.
5. Cuando responda `{"status":"ok"}`, Vercel y Render quedan conectados.
6. En Vercel (PublicWeb), tras push con proxy: `https://TU-APP.vercel.app/render-api/health/live` debe responder JSON (sin error CORS en el navegador).

---

Si ves `MONGODB_PASSWORD=missing` y `REDIS_URL=placeholder`, **Render no tiene tus secretos**. Git no los sube.

## ¿Tienes el código nuevo desplegado?

En los logs debe aparecer:

- `env-loader v3`
- `Env check: ... COP_PRODUCTION_ENV_B64=set` o `unset`
- `/etc/secrets (2 entries)` (no diga solo `file(s)` sin `entries`)

Si no aparece `v3` → **Manual Deploy** (o Clear build cache & deploy) tras el último push a `main`.

## Arreglo mínimo (2 minutos)

1. En tu PC: `.\deploy\render-2-variables.ps1` (instrucciones en portapapeles).
2. [Render Dashboard](https://dashboard.render.com) → **cop-nest-api** → **Environment**.
3. **Borrar** `REDIS_URL` si el valor contiene `your-instance.upstash.io`.
4. **Añadir** `MONGODB_PASSWORD` = contraseña Atlas.
5. **Añadir** `REDIS_URL` = URI `rediss://...` de Upstash (o deja solo `cop-redis` del Blueprint sin REDIS_URL manual).
6. **Save Changes** → **Manual Deploy**.

## Arreglo con una sola variable

1. `.\deploy\exportar-cop-production-env-b64.ps1`
2. Añadir `COP_PRODUCTION_ENV_B64` = pegar portapapeles.
3. Borrar `REDIS_URL` placeholder.
4. Save → Manual Deploy.

## Automático (API)

1. [API Keys](https://dashboard.render.com/u/settings) → crear key.
2. En `.env`: `RENDER_API_KEY=rnd_...`
3. `.\deploy\render-configurar-todo.ps1`

## Éxito

```
[cop-nest-api] Env check: MONGODB_PASSWORD=set(len=...) REDIS_URL=ok(...) COP_PRODUCTION_ENV_B64=set(...)
```
