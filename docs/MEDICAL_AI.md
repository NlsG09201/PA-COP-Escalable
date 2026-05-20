# Módulo Medical AI — Centro odontológico y psicológico

## Arquitectura

| Capa | Ruta | Descripción |
|------|------|-------------|
| Dashboard Next.js | `web-dashboard` → `/medical-ai` | UI enterprise: KPIs predictivos, alertas, timeline, asistente |
| API NestJS | `nest-migration` → `MedicalAiModule` | Orquestación, persistencia MongoDB, WebSockets, BullMQ |
| Ensemble ML | `services/recommendation-engine` → `POST /api/medical/ensemble/predict` | Random Forest + XGBoost + voto J48 |
| J48 | `services/j48-python` | Árbol de decisión (scikit-learn) |
| OpenAI (opcional) | `OPENAI_API_KEY` | Asistente con NLP; sin clave usa motor clínico determinístico |

## API principal (`/api/medical-ai`)

- `GET /dashboard/predictive?from=&to=` — KPIs predictivos, heatmap, tendencia de riesgo
- `GET /alerts` — alertas abiertas
- `PUT /alerts/:id/acknowledge` — reconocer alerta
- `POST /patients/:id/assess` — J48 + ensemble + alerta + scores
- `GET /patients/:id/timeline` — timeline psico + dental + IA
- `GET /patients/:id/recommendations` — frecuencia sesiones, acciones preventivas
- `POST /patients/:id/assistant/chat` — asistente médico
- `GET /patients/:id/assistant/summary` — resumen automático
- `GET /patients/priority` — ranking de urgencia

Compatibilidad Angular: `POST /api/relapse/patients/:id/assess`, `PUT /api/relapse/patients/:id/alerts/:alertId/acknowledge`.

## WebSocket

Namespace: `/medical-ai` — eventos `medical-alert`, `medical-insight`. Autenticación: `auth.token` = JWT.

## Variables de entorno

- `AI_RELAPSE_URL` — URL del recommendation-engine (ensemble)
- `J48_URL` — servicio J48 Python
- `OPENAI_API_KEY` — opcional para asistente GPT
- `REDIS_URL` — BullMQ + blacklist JWT + alertas en tiempo real

## Despliegue

- **Vercel**: `web-dashboard` con `NEXT_PUBLIC_API_URL`
- **Render**: `cop-nest-api`, `cop-recommendation-engine`, `cop-j48-python`
- **Atlas + Upstash**: ver `deploy/RENDER.md`
