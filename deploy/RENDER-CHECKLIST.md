# Checklist Render — cop-nest-api no arranca

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
