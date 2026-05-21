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

```powershell
.\deploy\generar-render-upload-env.ps1   # opcional, regenera render-upload.env
.\deploy\opcion-b-render.ps1             # tras importar env + Manual Deploy
```

1. Render (`pa-cop-escalable`) → **Environment** → importar `deploy/render-upload.env` (o pegar variables):
   - `APP_BOOTSTRAP_ADMIN_USERNAME=nelsonherazoi`
   - `APP_BOOTSTRAP_ADMIN_PASSWORD=Nelson09092001`
   - `APP_BOOTSTRAP_ADMIN_ORG_ID=be7f4015-67ad-472b-9cf7-aadcd8b0d604`
   - `APP_BOOTSTRAP_ADMIN_RESET=true`
   - `SETUP_ADMIN_SECRET=cop-atlas-setup-2026`
   - `MONGODB_PASSWORD=Nelson09092001`
2. **Save** → **Manual Deploy** (obligatorio: sin redeploy Render sigue con la contraseña antigua)
3. Cuando el servicio esté **Live**:

```powershell
.\deploy\crear-admin-render.ps1
```

4. Login: `nelsonherazoi` / `Nelson09092001` + sede en el panel.

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
