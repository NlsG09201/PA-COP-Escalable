# Recuperar acceso administrativo en Render

Este procedimiento es para operadores. No guardes contraseñas, tokens ni cuerpos de login en el repositorio.

## Variables requeridas

Configura en el gestor de secretos de Render:

- `APP_BOOTSTRAP_ADMIN_USERNAME`
- `APP_BOOTSTRAP_ADMIN_PASSWORD`
- `SETUP_ADMIN_SECRET` — valor aleatorio fuerte, distinto de la contraseña del administrador
- `APP_BOOTSTRAP_ADMIN_ORG_ID`

Rota cualquier valor que haya aparecido en commits previos. `.env` local está excluido de Git; no agregues sus valores a scripts ni a documentos.

## Procedimiento

1. Guarda las variables en Render y espera a que el servicio quede Live.
2. Ejecuta `./deploy/crear-admin-render.ps1` desde PowerShell.
3. Introduce los valores solicitados mediante las entradas interactivas. El script no crea un JSON con credenciales.
4. Confirma que el bootstrap y el login directo funcionen. El script también comprueba el proxy del frontend.

El bootstrap restablece la cuenta configurada en Render. Úsalo únicamente cuando estés autorizado a restablecerla.

## Diagnóstico

Consulta los endpoints sin credenciales:

```powershell
curl.exe -s https://pa-cop-escalable.onrender.com/api/auth/bootstrap-status
curl.exe -s https://pa-cop-escalable.onrender.com/api/auth/login-help
```

- Si el estado del servicio no está disponible, revisa el despliegue y sus variables en Render.
- Si el login directo funciona y el proxy falla, revisa la configuración o vuelve a desplegar el frontend.
- Si ambos fallan, verifica la sede, la organización y que el usuario y contraseña coincidan con las variables de Render.

No envíes cabeceras con secretos por chat, tickets o registros de consola.
