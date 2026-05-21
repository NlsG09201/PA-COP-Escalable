# Weka AI Lab y J48 en Render

## Síntoma

`GET /api/weka-lab/dashboard` o `/models` → **503** en Vercel (`/render-api/...`).

## Causa

El API Nest llama al microservicio **J48 Python** (`J48_URL`). En Render suele faltar:

1. Servicio **`cop-j48-python`** (no desplegado o URL incorrecta).
2. Variable **`J48_URL`** en **pa-cop-escalable** apuntando a `http://j48-python:8080` (solo válido en Docker local).

## Arreglo en Render (recomendado)

1. Dashboard Render → **Blueprint** o crear servicio desde `render.yaml` → **`cop-j48-python`**.
2. Cuando esté **Live**, copia la URL pública, por ejemplo `https://cop-j48-python-xxxx.onrender.com`.
3. En **pa-cop-escalable** → **Environment**:
   - `J48_URL` = esa URL (**sin** `/predict` al final).
4. **Save** → **Manual Deploy** de **pa-cop-escalable** y del **Frontend** en Vercel (último código).

Comprobación:

```powershell
curl.exe -s https://TU-J48.onrender.com/health
# Debe responder JSON ok, no 404 HTML
```

## Modo offline (código reciente)

Si J48 no está Live, el API puede responder **200** con:

- Dataset integrado `relapse_risk_j48.arff` (~15k filas en el repo).
- Contadores mínimos y mensaje `j48LabOnline: false`.

El panel Angular también muestra vista offline si recibe 503 (hasta redeploy del API).

## Dataset local

Archivo: `datasets/relapse_risk_j48.arff` en la raíz del repositorio.
