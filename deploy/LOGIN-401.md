# Login 401 — panel Vercel / API Render

Documentación **interna** (no se muestra en la pantalla de login). Para operadores y desarrollo.

## Qué significa el 401

`POST .../render-api/api/auth/login` con **401** indica que el API en Render rechazó usuario, contraseña o sede. No es CORS ni fallo del proxy de Vercel: la petición llega al Nest y la validación falla contra MongoDB (`users.password_hash`).

El formulario de login en producción solo muestra un mensaje genérico. Los detalles están aquí.

## Arreglo rápido (recomendado)

Desde la raíz del repo, con PowerShell:

```powershell
.\deploy\crear-admin-render.ps1
```

El script:

1. Llama a `POST https://pa-cop-escalable.onrender.com/api/auth/setup-bootstrap` con `X-COP-Setup-Secret` (por defecto `cop-atlas-setup-2026`, debe coincidir con `SETUP_ADMIN_SECRET` en Render).
2. Resetea el hash del admin bootstrap y elimina roles elevados duplicados.
3. Prueba login directo en Render y vía proxy Vercel (`/render-api`).

Credenciales que usa el script (ajústalas en el `.ps1` si cambias Render):

| Campo | Valor por defecto |
|--------|-------------------|
| Usuario | `nelsonherazoi` |
| Email alternativo | `nelsondavid1954@gmail.com` (si está en `APP_BOOTSTRAP_ADMIN_EMAIL`) |
| Contraseña | `Nelson09092001` |
| Sede de prueba | UUID fijo en el script (cualquier sede válida del catálogo sirve en el panel) |

Tras ejecutarlo:

1. En Render → **Environment**, confirma que `APP_BOOTSTRAP_ADMIN_PASSWORD` es **exactamente** la misma contraseña que usas en el panel (la del script o la que enviaste en `setup-bootstrap`).
2. En el panel: usuario + contraseña + **sede obligatoria** → Ctrl+F5 si el navegador cacheó el bundle viejo.

## Comprobar sin el panel

Login requiere `siteId` (UUID de sede):

```powershell
$body = @{
  username = 'nelsonherazoi'
  password = 'Nelson09092001'
  siteId   = '9b912e9a-b30a-4a0f-87bc-6f99d5de1f7e'
} | ConvertTo-Json

Invoke-RestMethod -Uri 'https://pa-cop-escalable.onrender.com/api/auth/login' `
  -Method POST -ContentType 'application/json' -Body $body
```

Mismo cuerpo contra Vercel:

```powershell
Invoke-RestMethod -Uri 'https://pa-cop-escalable-2qx1.vercel.app/render-api/api/auth/login' `
  -Method POST -ContentType 'application/json' -Body $body
```

Si Render OK y Vercel falla → redeploy del Frontend (proxy). Si ambos 401 → arreglar Mongo/admin (abajo).

Diagnóstico sin secretos:

```powershell
curl.exe -s https://pa-cop-escalable.onrender.com/api/auth/bootstrap-status
curl.exe -s https://pa-cop-escalable.onrender.com/api/auth/login-help
```

En producción, `login-help` solo devuelve `{ requireSite, adminReady }` (sin listar usuarios).

## Variables en Render (`pa-cop-escalable`)

Mínimas para bootstrap estable:

| Variable | Ejemplo / nota |
|----------|----------------|
| `APP_BOOTSTRAP_ADMIN_USERNAME` | `nelsonherazoi` |
| `APP_BOOTSTRAP_ADMIN_EMAIL` | `nelsondavid1954@gmail.com` (opcional) |
| `APP_BOOTSTRAP_ADMIN_PASSWORD` | Misma que usas al iniciar sesión |
| `APP_BOOTSTRAP_ADMIN_ORG_ID` | `be7f4015-67ad-472b-9cf7-aadcd8b0d604` |
| `SETUP_ADMIN_SECRET` | `cop-atlas-setup-2026` (cabecera `X-COP-Setup-Secret`) |
| `MONGODB_PASSWORD` | Contraseña Atlas del usuario de la URI |

Tras cambiar `APP_BOOTSTRAP_ADMIN_PASSWORD` en Environment: **Save** → **Manual Deploy** → ejecutar `crear-admin-render.ps1` si el login sigue en 401.

Deja `APP_BOOTSTRAP_ADMIN_RESET=false` en producción. Con `true`, cada reinicio del API en Render puede volver a reescribir el hash y provocar 401 si la contraseña del panel no coincide exactamente con `APP_BOOTSTRAP_ADMIN_PASSWORD`.

## Otras opciones

### Opción A — Mongo desde tu PC (Atlas)

1. Atlas → **Network Access** → `0.0.0.0/0` activo.
2. `.env` con `MONGODB_PASSWORD` y `APP_BOOTSTRAP_ADMIN_*` alineados con Render.
3. `.\deploy\reset-admin-atlas.ps1` o carga completa `.\deploy\subir-colecciones-atlas.ps1`.

### Opción B — Blueprint / env masivo

```powershell
.\deploy\generar-render-upload-env.ps1
.\deploy\opcion-b-render.ps1
```

Importar `deploy/render-upload.env` en Render → **Manual Deploy** → `.\deploy\crear-admin-render.ps1`.

### Opción C — `setup-bootstrap` manual

Si `SETUP_ADMIN_SECRET` en Render es distinto:

```powershell
curl.exe -s -X POST "https://pa-cop-escalable.onrender.com/api/auth/setup-bootstrap" `
  -H "Content-Type: application/json" `
  -H "X-COP-Setup-Secret: TU_SECRETO_DE_RENDER" `
  --data-binary "@deploy/setup-bootstrap-body.json"
```

`deploy/setup-bootstrap-body.json` se genera con `{"password":"..."}` al ejecutar `crear-admin-render.ps1`.

## Causas habituales del 401

| Causa | Qué hacer |
|--------|-----------|
| Contraseña del panel ≠ `APP_BOOTSTRAP_ADMIN_PASSWORD` en Render | Igualar en Render + `crear-admin-render.ps1` |
| Varios documentos `users` con el mismo username; uno con hash viejo | `setup-bootstrap` / script (deduplica roles) |
| Cold start reescribió mal el admin (versiones antiguas del API) | Deploy Nest reciente + script; arranque nuevo no re-hashea si `verifyBootstrapLogin` OK |
| Sede no seleccionada | Elegir sede en el formulario |
| Usar email si solo existe usuario `nelsonherazoi` | Probar username; o registrar/login con el email configurado |

## Panel (Frontend en Vercel)

- **Usuario:** `APP_BOOTSTRAP_ADMIN_USERNAME` o el email bootstrap.
- **Contraseña:** la de Render, no la de un `.env` local distinto.
- **Sede:** obligatoria.
- La UI **no** muestra textos con nombres de variables ni rutas de scripts; esta guía es solo para el equipo.

## Despliegue de código relacionado

| Cambio | Dónde desplegar |
|--------|------------------|
| Mensaje genérico 401, sin banner de ayuda | Vercel (Frontend) |
| `login-help` sin datos sensibles en prod | Render (Nest) |
| Bootstrap sin reescritura en cada restart | Render (Nest) |
| `findUsersForAuth` / duplicados | Render (Nest) |

## 503 en Weka / Recaída / J48

Si ves `503` en `/api/weka-lab/*` o `/api/relapse/patients/.../trend`:

1. En Render, el servicio **`cop-j48-python`** debe estar **Live** y `J48_URL` en **pa-cop-escalable** debe ser su URL pública (sin `/predict`).
2. `AI_RELAPSE_URL` (recommendation-engine) es opcional; el API Nest ahora responde recaída desde MongoDB si ese motor no existe.
3. Tras cambiar `J48_URL`: **Save** → **Manual Deploy** del API Nest.

Comprobación:

```powershell
curl.exe -s https://TU-J48.onrender.com/health
curl.exe -s -H "Authorization: Bearer TOKEN" https://pa-cop-escalable.onrender.com/api/weka-lab/dashboard
```

## Referencias

- `deploy/crear-admin-render.ps1` — reset + verificación
- `deploy/render-upload.env` — plantilla de variables
- `docs/DEPLOY_RENDER_VERCEL.md` — proxy `/render-api` y checklist
- `deploy/RENDER-CHECKLIST.md` — API caído / env faltante
