# Cargar todos los datos en MongoDB Atlas

## Carga completa (colecciones + datos)

Un solo comando (crea **19 colecciones** y luego inserta datos):

```powershell
.\deploy\insertar-atlas-todo.ps1
```

Equivalente:

```powershell
.\deploy\cargar-atlas-completo.ps1
```

Solo crear colecciones vacías (sin datos):

```powershell
.\deploy\insertar-atlas-todo.ps1 -SoloColecciones
```

Sin datos de muestra (citas, clínica, IA…), solo org/sedes/admin/pacientes:

```powershell
node scripts/seed-atlas-completo.mjs --pacientes 15000 --sin-muestras
```

**Requisitos:**

1. Atlas → **Network Access** → `0.0.0.0/0` **Active**
2. `.env` con `MONGODB_PASSWORD` (o `MONGODB_URL` completa) y `APP_BOOTSTRAP_ADMIN_*`
3. `npm install mongodb` en la raíz (el script `cargar-atlas-completo.ps1` lo instala si falta)

**Paso 1 — colecciones** (automático): `organizations`, `sites`, `users`, `refresh_tokens`, `professionals`, `patients`, `appointments`, `clinical_records`, `odontograms`, `psychology_sessions`, `psychological_evaluations`, `psychological_snapshots`, `j48_predictions`, `medical_ai_*`, `ortho_3d_jobs`, `public_reviews`.

**Paso 2 — datos principales:**

| Dato | Colección |
|------|-----------|
| Organización COP | `organizations` |
| ~36 sedes Colombia | `sites` |
| Admin panel | `users` |
| 15.000 pacientes | `patients` |

**Paso 3 — datos de muestra** (opcional, por defecto sí): profesionales, citas, historias clínicas, reseñas, registros mínimos en colecciones IA/psicología/ortodoncia.

Opcional: regenerar CSV antes del seed:

```powershell
python generate_pacientes_15k.py
node scripts/seed-atlas-completo.mjs --csv pacientes_colombia_15k.csv --pacientes 15000
```

Volver a cargar pacientes (borra solo los del seed anterior):

```powershell
node scripts/seed-atlas-completo.mjs --pacientes 15000 --forzar-pacientes
```

---

Tu API en producción usa la base **`cop`** en Atlas (`MONGODB_URL` en Render).  
Otros orígenes de datos:

| Origen | Qué hacer |
|--------|-----------|
| Mongo local (Docker `nest-migration`) | Script `deploy/subir-datos-atlas.ps1` |
| Otro cluster MongoDB | Atlas **Live Migration** o `mongodump` / `mongorestore` |
| Solo empezar (sedes + admin) | Seeds del API (sin migración masiva) |
| SQL (`docs/database-design/clinic_schema.sql`) | No hay ETL automático en el repo; hay que exportar a JSON o migrar a mano |

---

## Opción A — Subir Mongo local → Atlas (recomendado si ya trabajaste en Docker)

### 1. Atlas listo para recibir datos

1. [cloud.mongodb.com](https://cloud.mongodb.com) → **Network Access** → `0.0.0.0/0` **Active**.
2. **Database Access** → usuario con contraseña conocida (la misma que `MONGODB_PASSWORD` en `.env`).

### 2. Mongo local con datos

```powershell
cd nest-migration
docker compose up -d mongodb
```

Comprueba que hay datos (opcional):

```powershell
docker exec -it (docker ps -q -f name=mongo) mongosh cop_escalable --eval "db.getCollectionNames()"
```

### 3. Herramientas

Instala **MongoDB Database Tools** (incluye `mongodump` y `mongorestore`):  
https://www.mongodb.com/try/download/database-tools

O usa el script con `-UsarDocker` (hace dump dentro del contenedor `mongo`).

### 4. Subir a Atlas

En la **raíz del repo**, `.env` debe tener `MONGODB_PASSWORD` (y/o `MONGODB_URL` de Atlas):

```powershell
.\deploy\subir-datos-atlas.ps1
```

- Origen por defecto: `cop_escalable` en `localhost:27017`
- Destino: base **`cop`** en Atlas (nombre del URI en producción)

Para **sobrescribir** colecciones que ya existan en Atlas:

```powershell
.\deploy\subir-datos-atlas.ps1 -ReemplazarColecciones
```

Solo restaurar un dump ya generado:

```powershell
.\deploy\subir-datos-atlas.ps1 -SoloRestore -DumpDir .\deploy\mongo-dump
```

El dump queda en `deploy/mongo-dump/` (no se sube a git).

### 5. Verificar

- Atlas → **Browse Collections** → `cop` → `patients`, `users`, `sites`, etc.
- `https://pa-cop-escalable.onrender.com/health` → `"mongodb": "ok"`
- Login en el panel / web pública con datos reales

---

## Opción B — Atlas vacío: datos iniciales sin dump

Si **no tienes** un Mongo local con datos y solo quieres dejar el sistema usable:

1. Render → Environment:
   - `MONGODB_PASSWORD` correcto
   - `SEED_COLOMBIA_SITES=true` → ~36 sedes en `sites`
   - `APP_BOOTSTRAP_ADMIN_USERNAME` / `PASSWORD` / `ORG_ID` → usuario admin
2. **Manual Deploy** del API.
3. Crea pacientes, citas, etc. desde el panel o importa por módulos.

---

## Opción C — Otro servidor MongoDB (no local)

1. En el servidor origen:
   ```bash
   mongodump --uri="mongodb://..." --db=NOMBRE_BASE --out=./dump
   ```
2. Copia la carpeta `dump` a tu PC.
3. En Windows:
   ```powershell
   .\deploy\subir-datos-atlas.ps1 -SoloRestore -DumpDir .\ruta\al\dump -SourceDb NOMBRE_BASE
   ```

O usa **Atlas → Migration** → Live Migrate desde la consola de Atlas.

---

## Nombres de base importantes

| Entorno | Base habitual |
|---------|----------------|
| Docker local (`nest-migration`) | `cop_escalable` |
| Atlas / Render (producción) | `cop` |

El script renombra automáticamente `cop_escalable` → `cop` al restaurar.

---

## Colecciones que usa el API

Ver lista completa en `docs/MONGODB_ATLAS_COLECCIONES.md` (`users`, `patients`, `sites`, `appointments`, `clinical_records`, …).

---

## Problemas frecuentes

| Error | Solución |
|-------|----------|
| `mongodump` no reconocido | Instala Database Tools o `-UsarDocker` |
| Conexión Atlas rechazada | `0.0.0.0/0` Active en Network Access |
| `authentication failed` | Revisa `MONGODB_PASSWORD` en `.env` |
| Dump vacío | El volumen Docker no tenía datos; trabajaste solo en Atlas |
| Duplicados tras restore | Usa `-ReemplazarColecciones` solo si quieres reemplazar todo |
