# MongoDB Atlas + Render (cop-nest-api)

Si ves:

`MongooseServerSelectionError: Could not connect to any servers in your MongoDB Atlas cluster`

y Render termina con `No open ports detected` / `Exited with status 1`, casi siempre es **Network Access** en Atlas (IP no permitida). La API no abre el puerto HTTP hasta que Mongo conecta.

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
| Usuario/contraseña Atlas | Render → `MONGODB_PASSWORD` o URI completa en `MONGODB_URL` |
| Nombre de base `cop` en la URI | `...mongodb.net/cop?...` |
| Cluster no pausado | Atlas → cluster activo (M0 free a veces se pausa) |
| Database Access | Usuario con `readWrite` en la base `cop` |

Guia URI: `docs/MONGODB_ATLAS_COLECCIONES.md`
