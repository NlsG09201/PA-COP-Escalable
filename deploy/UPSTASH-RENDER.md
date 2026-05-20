# Upstash + Render (cop-nest-api)

## 1. Copiar la URL correcta en Upstash

1. [console.upstash.com](https://console.upstash.com) → abre tu base Redis.
2. Pestaña **Connect** (o **Details**).
3. Elige **Node** / **ioredis** / **TCP** con **TLS activado**.
4. Copia la variable que se parece a:

   `rediss://default:XXXXXXXX@nombre-region.upstash.io:6379`

**No uses:**

- URL **REST** (`https://...upstash.io`) — no sirve para ioredis.
- Comando `redis-cli --tls -u ...` — solo la URI `rediss://...`.
- Token corto o con `AAAA` repetido (suele estar truncado).

## 2. Actualizar local y Render

En la raíz del repo:

```powershell
# Edita .env y pega la linea completa:
# REDIS_URL=rediss://default:TU_TOKEN@xxxx.upstash.io:6379

.\deploy\upstash-redis-a-render.ps1
```

Eso valida el formato, actualiza `render-upload.env` y copia el valor al portapapeles.

## 3. Pegar en Render

1. [dashboard.render.com](https://dashboard.render.com) → **cop-nest-api** → **Environment**.
2. Si existe **otra** `REDIS_URL` (Blueprint `cop-redis` o placeholder), **borra** esa fila. Solo debe quedar **una** `REDIS_URL` (Upstash).
3. **Add** o **Edit** → Key: `REDIS_URL` → Value: pegar **solo** la URI `rediss://...` (Ctrl+V).
4. **Save Changes** → **Manual Deploy**.

## 4. Comprobar

Logs sin `WRONGPASS`. En el navegador:

- `https://cop-nest-api.onrender.com/health` → `"redis":"ok"`

## Si sigue WRONGPASS

- Regenera el token en Upstash (**Reset password** / nueva credencial) y repite los pasos.
- En Render, revisa que no haya espacios ni comillas al inicio/final del valor.
- Comprueba que la base Upstash no esté en pausa (plan free inactivo).
