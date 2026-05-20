# Render: Secret Files (cuando Environment no guarda bien)

Si los logs siguen con `MONGODB_PASSWORD=missing` o `REDIS_URL` con `your-instance.upstash.io`, usa **Secret Files** en lugar de pegar variables una a una.

## 1. Generar el archivo en tu PC

```powershell
.\deploy\generar-render-upload-env.ps1
```

Crea `deploy/render-upload.env` (no va a Git).

## 2. Subir a Render

1. [dashboard.render.com](https://dashboard.render.com) → **`cop-nest-api`**
2. **Environment** → pestaña o sección **Secret Files** (junto a Environment Variables)
3. **Add Secret File**
   - **Filename:** `cop-production.env` (exacto, el código busca este nombre)
   - **Contents:** abre `deploy/render-upload.env`, copia todo y pega
4. **Save**

## 3. Limpiar variables malas (importante)

En **Environment Variables** (no Secret Files):

- **Elimina** `REDIS_URL` si el valor contiene `your-instance.upstash.io`
- Opcional: elimina `MONGODB_URL` con `<db_password>` (el secret file trae `MONGODB_PASSWORD`)

## 4. Deploy

**Manual Deploy** de `cop-nest-api`.

En logs debe aparecer:

```text
[cop-nest-api] Loaded N env var(s) from /etc/secrets/cop-production.env
[cop-nest-api] Env check: ... MONGODB_PASSWORD=set(len=...) REDIS_URL=ok(tls)
```

## Alternativa: archivos sueltos

En Secret Files puedes crear dos archivos en lugar de uno:

| Filename | Contenido (solo el valor, sin `KEY=`) |
|----------|----------------------------------------|
| `MONGODB_PASSWORD` | contraseña Atlas |
| `REDIS_URL` | `rediss://default:...@prepared-ram-78507.upstash.io:6379` |
