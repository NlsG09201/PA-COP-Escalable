# Análisis de migración: NestJS/MongoDB a Spring Boot

Fecha de análisis: 2026-08-31. Alcance: repositorio completo, sin cambios de código de ejecución.

## A. Resumen ejecutivo

Centro COP Escalable es un monorepo clínico (odontología y psicología) con paneles en Angular y Next.js, web pública Next.js, una API operacional NestJS, MongoDB/Redis y varios servicios de IA en Python. Existe además un microservicio Java real en `services/j48-service`, limitado al entrenamiento y predicción J48.

La premisa de que el backend vive dentro de Next.js **no se confirma**: `web-dashboard` y `web-public` usan App Router pero no contienen `app/api`, Route Handlers, Server Actions, middleware, ORM ni consultas a base de datos. Ya son consumidores HTTP. La migración real pendiente es **NestJS + las integraciones que éste orquesta → Spring Boot**, manteniendo Python para cargas ML/visión que dependen de sus runtimes. Complejidad: **alta/crítica**, por más de 20 módulos Nest, contratos públicos de pago y una base MongoDB cuya forma efectiva no coincide por completo con el diseño PostgreSQL documental.

Arquitectura actual:

```text
Angular / Next dashboard / Next web pública
                 │ HTTP + Bearer JWT
NestJS API (Mongoose, JWT, BullMQ, Socket.IO)
     ├─ MongoDB + Redis
     ├─ J48 Python / J48 Spring Boot
     ├─ IA diagnóstico, emoción, recomendaciones (Python)
     └─ DICOM / imagen a 3D (Python o proveedor externo)
```

Arquitectura objetivo aprobada:

```text
Angular / Next.js (presentación exclusivamente)
                 │ REST + WebSocket
Spring Boot API (Security, MVC, Validation, services)
     ├─ MongoDB Spring Data (fase de compatibilidad)
     ├─ Redis, jobs y WebSocket en Java
     ├─ J48 Spring Boot (integración interna)
     └─ Módulos de IA, emoción y visión portados a Java
```

No debe adoptarse JPA/Flyway ni migrarse a PostgreSQL como parte de esta conversión inicial: la persistencia operativa hallada es MongoDB y no hay migraciones Prisma/Drizzle/SQL ejecutadas por Nest. `docs/database-design/clinic_schema.sql` es un **diseño PostgreSQL 16 propuesto**, no evidencia de la base en producción. Una conversión MongoDB→PostgreSQL es un proyecto posterior, con aprobación y migración de datos independiente.

## B. Inventario y clasificación

| Ruta / conjunto | Categoría | Responsabilidad y motivo |
| --- | --- | --- |
| `web-public/src/app`, `components`, `lib` | FRONTEND | Next.js App Router para registro, login, cuenta, catálogo y reserva; `api-client.ts` consume la API remota. |
| `web-dashboard/src/app`, `components`, `hooks`, `lib` | FRONTEND | Next.js App Router para panel clínico/J48/IA; estado local y llamadas HTTP/WebSocket. |
| `Frontend/src/app` | FRONTEND | Angular principal, guards, interceptor JWT, vistas, stores y adaptadores HTTP. |
| `nest-migration/src/modules/*` | BACKEND | API NestJS actualmente desplegable: controllers, servicios Mongoose, DTOs, guards, colas e integraciones. |
| `nest-migration/src/common`, `config`, `main.ts`, `app.module.ts` | CONFIGURATION / SECURITY / INFRASTRUCTURE | bootstrap, CORS, Helmet, validación de entorno, Redis y filtro global de errores. |
| `nest-migration/src/modules/**/schemas` | DATABASE | Esquemas Mongoose que definen la forma operativa de colecciones e índices. |
| `python-auth-api` | BACKEND legado / UNKNOWN | FastAPI de autenticación contra Mongo/Redis. No aparece como dependencia del despliegue principal; confirmar si sigue expuesto antes de retirarlo. |
| `services/j48-service` | BACKEND | Spring Boot/Weka existente, con DTOs, seguridad, pruebas y artefacto de modelo local; no usa base de datos. |
| `services/j48-python`, `recommendation-engine`, `ai-diagnosis-service`, `emotion-analysis-service` | BACKEND / INFRASTRUCTURE | FastAPI y modelos Python especializados; Nest los consume/orquesta. |
| `services/dicom-to-glb`, `image-to-3d-*`, `ortho_system` | BACKEND / INFRASTRUCTURE | Procesamiento asíncrono de DICOM/imagen/modelos 3D. `ortho_system` parece alternativo/legacy. |
| `docs/MONGODB_ATLAS_COLECCIONES.md`, payloads y scripts de seed | DATABASE | Catálogo de colecciones y cargas Atlas; fuente secundaria frente al código de esquemas. |
| `docs/database-design/clinic_schema.sql` | DATABASE (diseño no operativo) | Esquema relacional PostgreSQL objetivo/documental; no está conectado por la aplicación actual. |
| `compose.yaml`, Dockerfiles, `render.yaml`, `deploy/*` | INFRASTRUCTURE / CONFIGURATION | Orquestación Docker/Render, variables y automatización. |
| `datasets/*`, entrenamiento y scripts | SHARED / TEST-DATA | ARFF/CSV y entrenamiento; no son código transaccional. |
| pruebas JUnit de `j48-service`, Playwright Angular | TEST | Cobertura focal de J48 y smoke E2E; no se halló una suite integral Nest. |

Los archivos individuales de UI no se enumeran uno a uno porque no contienen backend; su destino se conserva como frontend. Los controladores, servicios, schemas y DTOs de `nest-migration/src/modules` constituyen el inventario exhaustivo del backend activo, agrupado abajo por dominio.

## C. Backend localizado y mapeo a Spring Boot

| Dominio Nest actual | Entradas/salidas y regla destacada | Destino Spring Boot |
| --- | --- | --- |
| `iam` | registro, Google, login, refresh, logout, perfil, bootstrap y roles; JWT Bearer, bcrypt y refresh tokens. | `iam` con `AuthController`, `UserController`, `AuthService`, `UserService`, `JwtAuthenticationFilter`, `RefreshTokenRepository`. |
| `patients`, `tenancy`, `services` | CRUD/listados paginados de pacientes, sedes y catálogo; aislamiento por organización/sede. | módulos `patients`, `tenancy`, `catalog`; controllers compatibles, request/response records, repositorios Mongo. |
| `appointments`, `clinical`, `odontogram`, `psychology`, `odontology` | agenda, cambio/claim de estado, historia, odontograma, sesiones/evaluaciones y planes. | servicios de dominio transaccional; `@Transactional` sólo para operaciones multi-documento y con Mongo replica set. |
| `public-site`, `payments-intl`, `notifications` | catálogo/disponibilidad/reservas públicas, cotización, intención/completado de pago, webhook Wompi/Stripe/PayPal y notificación. | `publicbooking` y `payments` con idempotencia, verificación de firma, clientes `RestClient`, outbox/cola para correo/SMS. |
| `j48-scoring`, `weka-lab`, `ai-proxy` | scoring, datasets/modelos, predicción, árbol y métricas; proxy al motor J48. | `j48` como cliente del Spring J48 existente o integración interna; preservar contratos `/api/j48` y `/api/weka-lab`. |
| `medical-ai`, `simulation`, `api-compat` | evaluación síncrona/asíncrona, alertas, insights, hilo asistente, recomendaciones y rutas de compatibilidad. Socket.IO para eventos IA. | `medicalai` con `WebSocket`/STOMP o Socket.IO Java compatible (decisión contractual), clientes HTTP resilientes y worker de cola. |
| `ortho-3d`, `ortho-xray` | upload, reconstrucción, polling de jobs y descarga protegida GLB/DICOM. | `orthodontics` con `MultipartFile`, almacenamiento configurable, jobs asíncronos y streaming autenticado. |
| `analytics-dashboard` | KPIs, tendencias, distribución, desempeño y heatmap a partir de Mongo. | `analytics` con agregaciones Mongo (`MongoTemplate`) equivalentes; no simplificar pipelines. |

Controladores Nest detectados cubren: `/api/auth`, `/api/users`, `/api/admin/users`, `/api/patients`, `/api/sites`, `/api/services`, `/api/appointments`, `/api/clinical`, `/api/odontogram`, `/api/psychology`, `/api/psych-tests`, `/api/odontology`, `/api/j48`, `/api/weka-lab`, `/api/medical-ai`, `/api/relapse`, `/api/ai-assist`, `/api/ortho/*`, `/api/analytics/dashboard`, `/api/simulation`, además de `/public/*` y salud. Los verbos y rutas exactos se conservan inicialmente: el frontend Angular y ambos Next los consumen directamente.

### Next.js → Spring Boot

| Elemento Next.js | Hallazgo | Destino |
| --- | --- | --- |
| `web-public/src/lib/api-client.ts` | cliente HTTP, token en estado del cliente | mantener cliente; cambiar sólo `PUBLICWEB_API_BASE_URL` si cambia origen. |
| `web-dashboard/src/lib/api.ts`, `medical-ai-api.ts`, `weka-lab-api.ts` | clientes HTTP del panel | mantener contratos; consumir Spring API. |
| páginas App Router y componentes | presentación y validación UX | permanecen en Next.js. |
| API Routes / Server Actions / middleware / ORM / cookies de servidor | **No determinados como existentes; búsqueda no halló ninguno.** | no hay lógica que migrar desde Next.js. |

## D. Persistencia y relaciones

La fuente operativa es MongoDB vía Mongoose. Colecciones confirmadas por esquemas/código/documentación: `users`, `refresh_tokens`, `organizations`, `sites`, `professionals`, `patients`, `appointments`, `clinical_records`, `odontograms`, `psychology_sessions`, `psychological_evaluations`, `psychological_snapshots`, `j48_predictions`, `medical_ai_alerts`, `medical_ai_predictions`, `medical_ai_insights`, `medical_ai_assistant_threads`, `ortho_3d_jobs`, `public_reviews`, más catálogo y datos de reserva/pagos usados por los módulos públicos.

Relaciones lógicas predominantes: `organization → sites/users/patients/professionals`; `site → patients/appointments`; `patient → appointments/clinical_records/odontograms/sesiones/evaluaciones/predicciones`; `user → refresh_tokens`; y `patient → trabajos 3D/alertas/insights/hilos IA`. En Mongo se expresan por IDs, no por claves foráneas: Spring Data Mongo debe conservar esos nombres, tipos de identificador y campos antes de intentar normalización relacional.

El SQL documental sí define una alternativa normalizada: organizaciones, sedes, usuarios/roles, especialidades, profesionales, servicios, pacientes/contactos, citas/eventos, reservas/pagos/notificaciones y auditoría. Incluye PK UUID, FKs, índices, checks y exclusión de solapamiento de agenda. **No es compatible automáticamente** con los documentos actuales: sus columnas, cardinalidades y restricciones sólo se usarán en una futura migración explícita, tras exportar Atlas, mapear campos y validar conteos/checksums.

No se encontraron stored procedures, triggers ni funciones activas de Mongo. Transacciones requieren replica set (presente en `compose.yaml`) y deben aplicarse a reserva+pago+notificación, rotación de refresh token, escritura clínica/predicción relacionada y cambios de estado que afecten varias colecciones. Las agregaciones analíticas deben trasladarse como pipelines `MongoTemplate` equivalentes.

## E. Seguridad, configuración e integraciones

- Seguridad actual: JWT de acceso (TTL configurable), refresh tokens en Mongo, bcrypt, roles/guards Nest y JWT en WebSocket médico. El frontend Angular guarda/inyecta Bearer; los clientes Next consumen API. Spring Security debe preservar claims, roles, expiración, formato de error y refresh rotation antes de cambiar tokens/cookies.
- CORS/HTTP: Nest configura CORS, Helmet, throttling y filtro global. Spring debe habilitar sólo los orígenes configurados, validar cuerpos con Bean Validation, usar `ProblemDetail` o un contrato de error explícitamente compatible, y no desactivar CSRF si se cambia a cookie.
- Integraciones observadas: Google token validation, Wompi, Stripe, PayPal, SMTP/Nodemailer, Twilio, Redis/BullMQ, J48, diagnóstico/voz/recomendación y proveedores de imagen/DICOM 3D. Los clientes Spring requieren timeout, reintento acotado, circuito y secretos externalizados.
- Variables: Mongo/Redis, JWT, CORS/orígenes públicos, bootstrap, pagos, Google, SMTP/Twilio y URLs/credenciales IA/3D/J48. Las plantillas contienen valores de desarrollo y archivos temporales de login: deben rotarse/retirarse del control de versiones antes de producción. No se copian secretos al nuevo backend.

## F. Riesgos y decisiones

| Riesgo | Nivel | Mitigación |
| --- | --- | --- |
| Contratos usados por tres frontends y rutas `api-compat` | Crítico | pruebas de contrato y coexistencia por prefijo/origen; no cortar Nest hasta paridad. |
| Discrepancia Mongo operativo vs SQL documental | Crítico | Mongo primero; discovery de Atlas y export verificable antes de JPA/PostgreSQL. |
| Pagos/webhooks e idempotencia | Crítico | conservar firmas, referencias, estados e idempotency keys; sandbox de proveedor. |
| JWT/refresh y Socket.IO | Alto | golden tests de login/refresh/roles y handshake antes de cambiar filtros. |
| Procesos IA/3D asíncronos | Alto | mantener Python, colas y polling; no convertirlos en llamadas síncronas. |
| Semántica de agregaciones Mongo | Alto | portar pipelines con datasets de regresión y comparar resultados. |
| Defaults de desarrollo/credenciales de bootstrap | Alto | rotación inmediata y secretos gestionados por entorno. |
| Cobertura limitada del backend Nest | Alto | crear pruebas de API, integración Mongo/Redis y E2E de flujos críticos. |

Decisión aprobada: **Spring Boot modular + Spring Data MongoDB como reemplazo de NestJS y de todos los servicios Python en ejecución**. Los modelos deben portar su inferencia a Weka/Java, ONNX Runtime Java, DJL u otra biblioteca Java que se demuestre compatible con cada artefacto existente; no se sustituirán por stubs. Alternativa PostgreSQL/JPA: mayor integridad relacional, pero requiere rediseño/migración y rompe el requisito de preservar persistencia; se pospone. Alternativa big-bang: se descarta por el riesgo de pago, clínica e IA.

## G. Plan de implementación y aceptación

1. Congelar contratos y crear pruebas de caracterización por cada endpoint Nest; inventariar documentos e índices reales de Atlas. Aceptación: matriz endpoint/consumidor/respuesta aprobada.
2. Crear `backend-spring` con módulos por dominio, configuración, error handler, OpenAPI y Spring Data Mongo; sin tocar frontends. Aceptación: salud, CORS y error contract compatibles.
3. Migrar IAM, tenancy, pacientes, catálogo y agenda; después clínica/psicología/odontograma. Aceptación: login/refresh/RBAC y CRUD idénticos contra base de staging clonada.
4. Migrar reserva pública, pagos, notificaciones y auditoría con pruebas de webhook e idempotencia. Aceptación: flujos sandbox completos sin doble cobro.
5. Migrar analytics, J48, IA, voz y 3D a módulos Spring Boot/Java; portar primero los modelos y comparar sus resultados contra los servicios actuales. Aceptación: jobs, downloads, eventos y resultados equivalentes sin procesos Python en ejecución.
6. Cambiar URLs de Angular/Next sólo cuando cada grupo alcance paridad; ejecutar E2E y despliegue canary. Aceptación: métricas sin regresión y rollback probado.
7. Retirar rutas Nest progresivamente tras ventana de coexistencia y backup validado. Aceptación: no hay consumidores ni datos pendientes.

Para iniciar la fase de código hace falta aprobar esta decisión y resolver: (1) URI/volcado de Atlas y sus índices reales, (2) cuáles de `python-auth-api`, `ortho_system` y `api-compat` siguen en producción, y (3) si Spring debe sustituir el API Nest completo o sólo módulos priorizados. Hasta entonces, cualquier entidad JPA, tabla o endpoint adicional sería inventado.
