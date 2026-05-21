# Login 401 en Vercel / Render

El `POST .../render-api/api/auth/login` con **401 Invalid credentials** significa que el API en Render **no encuentra** el usuario o la **contraseña no coincide** con `password_hash` en MongoDB. No es un fallo de CORS ni del proxy de Vercel.

## Comprobar

```powershell
curl.exe -s -X POST "https://pa-cop-escalable.onrender.com/api/auth/login" `
  -H "Content-Type: application/json" `
  -d '{"username":"nelsonherazoi","password":"Nelson09092001"}'
```

Si aquí también sale 401, el arreglo es **crear o resetear el admin en la misma base que usa Render**.

## Opción A — Script en tu PC (Atlas)

1. Atlas → **Network Access** → `0.0.0.0/0` **Active**
2. `.env` con `MONGODB_PASSWORD` y `APP_BOOTSTRAP_ADMIN_*` correctos
3. Ejecutar:

```powershell
.\deploy\reset-admin-atlas.ps1
```

o carga completa:

```powershell
.\deploy\subir-colecciones-atlas.ps1
```

## Opción B — Reparar admin en Render (sin Mongo local)

1. Generar env:

```powershell
.\deploy\generar-render-upload-env.ps1
```

2. En Render (`pa-cop-escalable`) → **Environment**:
   - `APP_BOOTSTRAP_ADMIN_USERNAME=nelsonherazoi`
   - `APP_BOOTSTRAP_ADMIN_PASSWORD=Nelson09092001`
   - `APP_BOOTSTRAP_ADMIN_ORG_ID=be7f4015-67ad-472b-9cf7-aadcd8b0d604`
   - `APP_BOOTSTRAP_ADMIN_RESET=true`
   - `SETUP_ADMIN_SECRET=cop-atlas-setup-2026` (si usas setup-bootstrap)
3. **Manual Deploy**
4. Tras desplegar el código con `ensure-bootstrap`:

```powershell
.\deploy\crear-admin-render.ps1
```

Ese script llama primero `POST /api/auth/ensure-bootstrap` (sin secreto si no hay admin o la contraseña del bootstrap no cuadra) y luego `setup-bootstrap` con secretos habituales.

## Opción C — Solo Render (secreto distinto)

Si en Render ya tienes otro `SETUP_ADMIN_SECRET`, usa ese valor en la cabecera:

```powershell
curl.exe -s -X POST "https://pa-cop-escalable.onrender.com/api/auth/setup-bootstrap" `
  -H "X-COP-Setup-Secret: TU_SECRETO_DE_RENDER"
```

## Panel (Frontend)

- **Usuario:** `nelsonherazoi` (no el email, salvo que hayas registrado con Gmail)
- **Contraseña:** la misma que `APP_BOOTSTRAP_ADMIN_PASSWORD` en Render
- **Sede:** obligatoria en el formulario

## Vercel

Tras arreglar Render, redeploy de PublicWeb/Frontend si cambiaste variables. El proxy `/render-api` solo reenvía; el 401 viene del API.
