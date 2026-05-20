# Render: arreglar `MONGODB_PASSWORD=missing` y `REDIS_URL placeholder`

Los logs confirman que **cop-nest-api** arranca sin las variables correctas. **Git no configura Render.**

## Paso 1 — Solo Mongo (2 minutos)

1. [dashboard.render.com](https://dashboard.render.com) → servicio **`cop-nest-api`** (icono de engranaje, no las webs Next).
2. Menú izquierdo → **Environment**.
3. Busca **`MONGODB_URL`**:
   - Si el valor contiene `<db_password>`, **edítala o elimínala**.
4. Pulsa **Add Environment Variable**:
   - **Key:** `MONGODB_PASSWORD`
   - **Value:** contraseña del usuario Atlas `nelsonherazoi` (desde tu `.env` local, sin comillas).
5. **Save Changes**.

En tu PC puedes generar el texto exacto:

```powershell
.\deploy\render-env-minimo.ps1
```

Abre `deploy/render-env.local.txt` y copia la línea `MONGODB_PASSWORD=...`.

## Paso 2 — Redis (elige una opción)

### Opción A — Blueprint con Redis de Render (recomendado)

El `render.yaml` del repo define el servicio **`cop-redis`** y enlaza `REDIS_URL` automáticamente.

1. Render → tu Blueprint / proyecto → **Sync Blueprint** (o vuelve a aplicar el blueprint).
2. Espera a que se cree **`cop-redis`**.
3. En **cop-nest-api → Environment**, **borra** `REDIS_URL` si sigue con `your-instance.upstash.io` (el blueprint la reemplazará por la URL interna).
4. **Manual Deploy** de `cop-nest-api`.

### Opción B — Seguir con Upstash

1. **cop-nest-api → Environment** → edita **`REDIS_URL`**.
2. Pega solo: `rediss://default:TOKEN@prepared-ram-78507.upstash.io:6379` (desde Upstash Console).
3. **Save** → **Manual Deploy**.

## Paso 3 — Comprobar logs

Tras el deploy debe aparecer:

```text
[cop-nest-api] Mongo env: ... MONGODB_PASSWORD=set(len=...)
```

y **no** el error `Production env check failed`.

## Automático (API)

```powershell
$env:RENDER_API_KEY = "rnd_..."
.\deploy\render-sync-env.ps1
```

Luego **Manual Deploy**.
