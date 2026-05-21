# Redis WRONGPASS en Render

Si en logs ves:

```text
REDIS_URL (app): token/contrasena incorrecto (WRONGPASS)
```

## Arreglo recomendado (Blueprint `cop-redis`)

1. [dashboard.render.com](https://dashboard.render.com) → servicio API (**pa-cop-escalable** o **cop-nest-api**).
2. **Environment** → **elimina** la variable `REDIS_URL` (y quítala de `COP_PRODUCTION_ENV_B64` si la pegaste ahí).
3. **Blueprint** → **Sync** con `render.yaml` (enlaza `cop-redis` → `REDIS_URL` automática).
4. **Manual Deploy**.

Regenera env sin Upstash:

```powershell
.\deploy\generar-render-upload-env.ps1
.\deploy\exportar-cop-production-env-b64.ps1
```

Pega el nuevo `COP_PRODUCTION_ENV_B64` en Render (ya no incluye `REDIS_URL`).

## Alternativa: Upstash

1. [console.upstash.com](https://console.upstash.com) → tu Redis → **Connect** → copia `rediss://...`.
2. Actualiza `.env` → `REDIS_URL=...`.
3. `.\deploy\generar-render-upload-env.ps1 -IncludeUpstashRedis`
4. Pega en Render solo si la URI es nueva y válida.
