# MongoDB Atlas + Render (cop-nest-api)

Si ves alguno de estos mensajes en logs de **cop-nest-api**:

- `Bootstrap admin omitido (Mongo no conectado): Operation users.findOne() buffering timed out`
- `MongooseServerSelectionError: Could not connect to any servers in your MongoDB Atlas cluster`
- `MongoDB Atlas: Network Access -> Add IP -> 0.0.0.0/0`

casi siempre es **Network Access** en Atlas (IP no permitida) o la regla `0.0.0.0/0` aún en **Pending**. La API puede arrancar pero Mongo y el bootstrap admin fallan hasta que Atlas permita Render.

## Arreglo (2 minutos)

1. [cloud.mongodb.com](https://cloud.mongodb.com) → tu proyecto → **Cluster0** (o el tuyo).
2. Menú izquierdo → **Network Access** (Acceso a la red).
3. **Add IP Address** (+ Agregar dirección IP).
4. Elige **Allow Access from Anywhere**:
   - IP: `0.0.0.0/0`
   - Comentario: `Render y desarrollo`
5. **Confirm**.
6. Espera hasta que la entrada muestre estado **Active** (verde) — puede tardar **2–5 minutos**.
7. Comprueba que no tengas una regla **Pending** duplicada que bloquee (borra entradas viejas en conflicto).

No hace falta listar IPs de Render una por una; `0.0.0.0/0` es lo habitual para PaaS (Render, Vercel, etc.).

**Importante:** si añadiste `0.0.0.0/0` hace un momento y el deploy sigue fallando, espera 3 minutos y vuelve a **Manual Deploy**. Atlas tarda en propagar la regla.

## Después

1. Render → **cop-nest-api** → **Manual Deploy** (no hace falta cambiar código).
2. Logs: debe aparecer `Application is running on: http://localhost:8080` (o el PORT de Render).
3. `https://cop-nest-api.onrender.com/health/live` → OK.
4. `https://cop-nest-api.onrender.com/health` → `mongodb: ok`.

## Si sigue fallando

| Revisar | Dónde |
|---------|--------|
| `0.0.0.0/0` en estado **Active** (no Pending) | Atlas → Network Access |
| Usuario/contraseña Atlas | Render → `MONGODB_PASSWORD` o URI en `COP_PRODUCTION_ENV_B64` |
| Misma contraseña que en Atlas → Database Access | Usuario `nelsonherazoi` → Edit → reset password → actualizar Render |
| Nombre de base `cop` en la URI | `...mongodb.net/cop?...` |
| Cluster no pausado | Atlas → **Resume** si el cluster M0 está pausado |
| Database Access | Usuario con rol **Atlas admin** o `readWriteAnyDatabase` en `cop` |

### Comprobar desde Render

Logs correctos:

```
[cop-nest-api] MongoDB Atlas: conectado
Bootstrap admin created (SUPER_ADMIN): nelsonherazoi
```

URL:

- `https://cop-nest-api.onrender.com/health` → `"mongodb": "ok"`

Si `mongodb: error` con `/health/live` ok → solo falta Atlas/red o credenciales.

Guia URI: `docs/MONGODB_ATLAS_COLECCIONES.md`
