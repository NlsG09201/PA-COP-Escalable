# MongoDB Atlas — URI y colecciones del backend Nest

## Cadena de conexión (`MONGODB_URL`)

1. En Atlas: **Database Access** → usuario con rol `readWriteAnyDatabase` (o al menos sobre tu base).
2. Sustituye `<db_password>` por la contraseña real del usuario (si tiene caracteres especiales, **URL-encódelos** en la URI).
3. **Incluye el nombre de la base de datos** en la ruta (recomendado: `cop` o el que prefieras). Sin eso, Mongoose puede usar `test` por defecto.

Ejemplo (sustituye usuario, contraseña y nombre de base):

```text
mongodb+srv://nelsonherazoi:TU_PASSWORD@cluster0.6oyhyja.mongodb.net/cop?retryWrites=true&w=majority&appName=Cluster0
```

4. **Network Access** en Atlas: añade `0.0.0.0/0` (o las IPs de Render) o la API no podrá conectar.

Pon esa URI solo en **variables de entorno** (Render, `.env` local que no subas a git). No commitees contraseñas.

## ¿Hay que “crear” las colecciones a mano?

No es obligatorio. Con esta URI configurada y el **API Nest en marcha**, Mongoose **crea cada colección la primera vez** que se escribe un documento (registro de paciente, usuario, cita, etc.).

Para tener datos iniciales útiles:

- Arranca el API con `APP_BOOTSTRAP_ADMIN_*` → crea usuario en **`users`** (y lógica IAM).
- Con `SEED_COLOMBIA_SITES=true` (por defecto en ejemplo de producción) → seed de **`sites`** vía `ColombiaSitesSeedService`.

Si quieres colecciones vacías “a mano” en Atlas (**Data Explorer** → **Create collection**), puedes crear las mismas con los nombres de la tabla siguiente; es opcional.

## Colecciones usadas por el código (Nest + Mongoose)

| Colección | Módulo / uso |
|-----------|----------------|
| `users` | IAM / cuentas |
| `refresh_tokens` | JWT refresh |
| `organizations` | Multi-tenant |
| `sites` | Sedes (seed Colombia opcional) |
| `professionals` | Profesionales |
| `patients` | Pacientes (nombre plural por defecto del modelo `Patient`) |
| `appointments` | Citas |
| `clinical_records` | Historia clínica |
| `odontograms` | Odontograma |
| `psychology_sessions` | Sesiones psicológicas |
| `psychological_evaluations` | Evaluaciones |
| `psychological_snapshots` | Snapshots para J48 |
| `j48_predictions` | Predicciones J48 |
| `medical_ai_alerts` | Alertas IA clínicas |
| `medical_ai_predictions` | Ensemble J48 + RF + XGBoost |
| `medical_ai_insights` | Insights automáticos |
| `medical_ai_assistant_threads` | Asistente médico IA |
| `ortho_3d_jobs` | Jobs 3D ortodoncia |
| `public_reviews` | Reseñas web pública |

Si añades más módulos con esquemas nuevos, actualiza esta lista en el mismo archivo.

## Comprobar en Atlas

Tras un deploy local o en Render con `MONGODB_URL` correcta:

1. Atlas → **Browse Collections** → base `cop` (o la que pusiste en la URI).
2. Tras login/registro o seeds, deberías ver aparecer `users`, `sites`, etc.

## Migrar datos desde otro cluster

Guía paso a paso (local Docker → Atlas): **`docs/CARGAR_DATOS_ATLAS.md`**

Script en Windows:

```powershell
.\deploy\subir-datos-atlas.ps1
```

También puedes usar **Atlas Live Migration** en la consola de Atlas si el origen es otro cluster remoto.
