# Despliegue Atlas con plugin MongoDB (MCP)

## 1. Conectar el MCP en Cursor

Ejecuta en PowerShell (desde la raíz del repo):

```powershell
.\deploy\configurar-mcp-atlas.ps1
```

Eso:
- Corrige el host Atlas si tu `.env` tenía `cluster0.6oyhyja` (no existe en DNS) → `cluster0.5dduzba`
- Define `MDB_MCP_CONNECTION_STRING` en Windows
- Actualiza `%USERPROFILE%\.cursor\mcp.json` con el servidor **mongodb**

Luego:
1. **Cursor Settings** → **MCP** → **Reiniciar** el servidor `mongodb` (o reinicia Cursor)
2. Atlas → **Network Access** → `0.0.0.0/0` **Active**
3. En el chat: `list-databases` debe mostrar la base `cop`

## 2. Generar payloads JSON (en tu PC)

```powershell
node scripts/generate-mcp-atlas-payloads.mjs
```

Crea `deploy/mcp-payloads/*.json` listos para `insert-many`.

## 3. Secuencia MCP (colecciones + datos)

Base de datos: **`cop`**

### Paso A — Crear colecciones vacías

Para cada nombre en `ATLAS_COLLECTIONS` (ver `scripts/seed-atlas-completo.mjs`), usar herramienta **`create-collection`**:

- database: `cop`
- collection: `organizations`, `sites`, `users`, … (19 en total)

### Paso B — Insertar datos

Herramienta **`insert-many`** con los JSON de `deploy/mcp-payloads/`:

| Archivo | Colección | Documentos |
|---------|-----------|------------|
| `organizations.json` | organizations | 1 |
| `sites.json` | sites | 36 |
| `users.json` | users | 1 (admin) |
| `professionals.json` | professionals | 2 |
| `public_reviews.json` | public_reviews | 1 |
| Resto `*.json` | cada colección | muestra mínima |

Colecciones vacías (`refresh_tokens`, `patients`, `appointments`, `clinical_records`) se crean en el paso A; los pacientes masivos van en el paso C.

### Paso C — 15.000 pacientes (script Node)

El MCP no es ideal para 15k docs en un solo lote. Ejecuta:

```powershell
.\deploy\insertar-atlas-todo.ps1
```

o solo pacientes:

```powershell
node scripts/seed-atlas-completo.mjs --pacientes 15000
```

## 4. Verificar con MCP

- **`list-collections`** → database `cop`
- **`count`** por colección
- **`find`** en `users` con `{ "username": "nelsonherazoi" }`

## 5. Prompt para el agente en Cursor

Copia esto cuando el MCP ya esté conectado:

```text
Usa el MCP MongoDB en la base cop:
1) create-collection para las 19 colecciones ATLAS_COLLECTIONS si no existen
2) insert-many con cada archivo en deploy/mcp-payloads/
3) count en organizations, sites, users, patients
4) Confirma admin nelsonherazoi en users
```

## Colecciones (ATLAS_COLLECTIONS)

organizations, sites, users, refresh_tokens, professionals, patients, appointments, clinical_records, odontograms, psychology_sessions, psychological_evaluations, psychological_snapshots, j48_predictions, medical_ai_alerts, medical_ai_predictions, medical_ai_insights, medical_ai_assistant_threads, ortho_3d_jobs, public_reviews
