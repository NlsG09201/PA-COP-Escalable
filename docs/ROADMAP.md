# Auditoría técnica y roadmap — Centro COP

**Fecha de corte:** 7 de noviembre de 2026  
**Fase ejecutada:** 1 — auditoría del repositorio  
**Alcance:** inspección estática del checkout actual; no se ejecutaron pruebas ni se modificaron servicios o datos de aplicación.

## Resumen ejecutivo

El repositorio no es un proyecto nuevo y ya contiene una plataforma funcional en evolución: dos SPA Angular, una API NestJS extensa, una migración parcial a Spring Boot, nueve servicios especializados de IA/imagen, MongoDB, Redis y un gateway Nginx. La decisión arquitectónica no está cerrada: el prompt de modernización propone Next.js y NestJS como destino, mientras `backend-spring/README.md` y `docs/ANALISIS_TECNICO_SPRING_BOOT_COMPLETO.md` describen una migración aprobada hacia Spring Boot y la retirada previa de dos aplicaciones Next.js. El código y Compose actuales confirman Angular, NestJS y Spring coexistiendo; no se encontró una aplicación Next.js en el inventario actual.

**No desplegar hasta rotar credenciales que aparecieron en Git.** La Fase 2 confirmó valores estáticos de bootstrap/admin en fuentes y documentación anteriores, más cuatro archivos temporales de login. También encontró URI de MongoDB con credenciales en dos revisiones antiguas de documentación. No se reprodujeron valores en este informe. Los lotes de 35.000 pacientes sí corresponden al generador de datos de demostración (nombres sintéticos y correo `.local`), y se retiraron del árbol para que no se confundan con registros clínicos.

La infraestructura local ya declara volúmenes persistentes para MongoDB y varios artefactos, pero Redis no tiene volumen de datos. MongoDB y Redis publican sus puertos al host. No se encontraron procedimientos automatizados de respaldo/restauración ni usuario Mongo de mínimo privilegio para la aplicación. Por tanto, el objetivo local-first está parcialmente preparado, no terminado.

## Inventario del repositorio

| Área | Estado observado |
|---|---|
| `Frontend/`, `PublicWeb/` | Dos aplicaciones Angular 21; panel y sitio/portal público. Ambas tienen builds y configuración Playwright. |
| `nest-migration/` | API NestJS 10 con módulos de IAM, pacientes, citas, tenancy, historia clínica, psicología, odontograma, ortodoncia 3D, IA, pagos y compatibilidad. Sigue siendo el destino del gateway. |
| `backend-spring/` | API Spring Boot en migración parcial: salud, IAM, pacientes, citas, catálogo y sedes; su README indica coexistencia y no sustitución directa todavía. |
| `services/gateway/` | Gateway Nginx de entrada. |
| `services/` y `ortho_system/` | Servicios Python/FastAPI de J48, diagnóstico, emociones, recomendaciones, DICOM/3D, profundidad y ortodoncia; también existe un stub imagen-a-3D y una alternativa Java/Weka para J48. |
| `compose.yaml` | Perfiles `core`, `nest`, `legacy`, `ai` y `j48-java`; contiene base local, API y frontends Angular. |
| `deploy/` | Material de Render/Atlas, scripts de carga y 70 lotes de datos de pacientes; contiene además cuatro solicitudes temporales de login con contraseña poblada. |
| `docs/` | Documentación de arquitectura, migración Spring, análisis de producción, IA y despliegue, pero sin los documentos centrales exigidos por el prompt. |
| `.github/workflows/ci.yml` | Builds Angular y Nest, `mvn verify` para Spring y smoke de entrenamiento J48 Python. No se observó E2E, escaneo de seguridad ni pruebas de aislamiento clínico en el workflow revisado. |

El checkout está en la rama `appmod/java-upgrade-20260824162527`. `.gitignore` ya tenía cambios locales antes de esta auditoría y se conservó intacto.

## Hallazgos priorizados

### P0 — Contener credenciales y datos sensibles versionados

- Cuatro archivos `deploy/tmp-login*.json` tenían campos de login poblados. Además, aparecieron valores de setup/admin en `deploy/crear-admin-render.ps1`, `deploy/opcion-b-render.ps1`, scripts de carga, `scripts/upsert-super-admin.mjs`, `scripts/generate-mcp-atlas-payloads.mjs`, documentación operativa y fallbacks de Nest.
- Se confirmó que 70 lotes de 500 pacientes se generan con datos sintéticos por `scripts/generate-mcp-bulk-35k.mjs`; esos lotes no son registros de pacientes reales. Se retiraron del árbol, se añadieron reglas de exclusión y se corrigió el manifiesto para que no guarde rutas locales absolutas.
- `git log --all` confirmó que valores estáticos de setup/admin y archivos de login aparecen en commits anteriores. Una búsqueda histórica de URI Mongo encontró coincidencias en revisiones antiguas de `docs/DEPLOY_RENDER_VERCEL.md`. Estado/validez de esos secretos no confirmado: rotar setup/admin y la contraseña Atlas asociada antes de un despliegue; considerar divulgados los valores históricos.
- El árbol actual quedó limpio de esos valores; los objetos históricos siguen en Git. No se reescribió historia ni se hizo force-push porque eso afecta ramas compartidas. Se requiere una operación coordinada de limpieza histórica después de rotar y respaldar, y revisar clones/PRs.
- `.env` y `.env.auth` están ignorados localmente, no aparecen como archivos rastreados en `git ls-files`. Esto no acredita ausencia de secretos en otros blobs históricos.
- `.env` y `.env.auth` están ignorados localmente, no aparecen como archivos rastreados en `git ls-files`. Esto no acredita ausencia de secretos en el historial.
- **Límite de esta fase:** se revisaron todas las referencias alcanzables por `git log --all` para los valores conocidos y patrones de alta confianza; no se usó un escáner especializado ni se puede afirmar que todas las credenciales hayan sido detectadas. No se identificaron responsables ni se validó si las credenciales siguen activas.

### P1 — Reducir exposición del acceso a MongoDB

- Varias guías de despliegue recomendaban permitir conexiones desde cualquier IP (`0.0.0.0/0`). Se reemplazó esa recomendación en los documentos y scripts actuales por acceso limitado a IPs egress de confianza.
- La URI con credenciales de una guía se quitó del texto actual. La búsqueda histórica encontró versiones anteriores de esa guía con URI de usuario/contraseña. Verificar con el administrador de Atlas si era real y rotar la contraseña si pudo corresponder a una cuenta activa.
- No se modificaron listas de acceso ni credenciales en Render, Atlas o Vercel; son cambios de infraestructura externa.

### P1 — Cerrar arquitectura y preservar contratos

- Documentar una decisión de arquitectura vigente: seguir con Angular + NestJS y completar la migración a Spring por contratos, o adoptar Next.js/NestJS según el nuevo objetivo. No retirar Angular, NestJS ni servicios existentes hasta mapear rutas y validar equivalencia.
- El gateway continúa enviando tráfico a Nest; Spring no está integrado en Compose ni es destino del gateway. Su cobertura es parcial. Mantener coexistencia y caracterizar contratos HTTP antes de mover rutas.
- `nest-migration/src/modules/api-compat/` declara endpoints no configurados con `NotImplementedException` y devuelve colecciones vacías en otros flujos. Ocultar o etiquetar estas capacidades en los consumidores; no presentarlas como operaciones reales.
- Revisar el comentario y la configuración Compose del stub imagen-a-3D: el archivo reconoce la respuesta de demostración. Mantenerlo fuera de flujos clínicos reales y verificar por configuración que no se use como resultado clínico.

### P1 — Fortalecer protección de datos y límites entre tenants

- Nest tiene Helmet, validación global estricta, JWT, RBAC y un `TenancyInterceptor`; hay comprobaciones tenant en consultas de pacientes e historia. La revisión puntual no demuestra aislamiento para todos los módulos, roles, IDs ni rutas de compatibilidad.
- Los roles son amplios y se declaran de forma repetida en controladores. En particular, psicología e historia requieren revisar autorización por profesional/paciente y mínimos privilegios; pruebas de IDOR y separación por organización/sede son prioritarias.
- Nest usa bcrypt (no Argon2id), no se verificó un flujo MFA implementado y las funciones completas de bloqueo/recuperación requieren auditoría específica. La configuración incluye Helmet, DTO validation y throttling en algunas rutas; no asumir cobertura uniforme.
- Compose publica MongoDB `27017` y Redis `6379`, y Redis no declara volumen persistente. Mongo se conecta con usuario root en el stack local. Antes de uso compartido, cerrar puertos al exterior, crear usuario de aplicación de mínimo privilegio y persistir/configurar Redis según el uso requerido.
- No se encontraron scripts de backup/restauración cifrada ni política de retención/versionado de esquema en el inventario revisado. La recuperación verificable es un prerrequisito para datos clínicos.

### P1 — AI governance y funciones clínicas

- Hay módulos IA y modelos/servicios reales, además de endpoints de compatibilidad y stubs. La presencia del código no significa que esté conectado al gateway, habilitado, validado clínicamente o evaluado.
- Revisar cada endpoint que use salida predictiva y separar claramente asistencia, puntuación y decisión profesional. Exigir auditoría de uso y aprobación humana; verificar que los datos identificables no se envíen fuera del entorno sin autorización y acuerdo de tratamiento.
- El módulo de psicología tiene sesiones, escalas y evaluaciones; se requiere validación clínica de reglas de puntuación, permisos más estrictos y protocolo profesional para riesgo de autolesión. La auditoría técnica no constituye revisión clínica ni legal colombiana.

### P2 — Calidad operativa y consolidación

- CI actual compila y corre verificaciones limitadas; no se observaron pruebas Playwright en CI, contratos API, recuperación de Mongo/Redis, aislamiento multitenant ni pruebas de backup/restore.
- No se encontraron en `docs/` los documentos solicitados `ARCHITECTURE.md`, `SECURITY.md`, `DATABASE.md`, `AI_GOVERNANCE.md`, `ORTHODONTICS.md`, `PSYCHOLOGY.md`, `LOCAL_DEPLOYMENT.md`, `PRODUCTION_DEPLOYMENT.md` y `CHANGELOG.md`. Evitar duplicar documentos hasta decidir idioma, estructura y autoridad; establecer esos documentos como entregables de las fases correspondientes.
- El prompt pide Next.js, pero no se debe crear una nueva aplicación Next sin contrastarla con la evidencia y la decisión Spring/Angular ya documentada.

## Roadmap de implementación

Las fases se ejecutarán por cambios pequeños y revisables. Cada fase debe enumerar archivos inspeccionados, hallazgos, archivos modificados, cambios de datos, impacto de seguridad, validaciones ejecutadas, limitaciones e instrucciones de despliegue. No se afirma que una fase esté completa hasta cumplir sus criterios.

| Fase | Prioridad y alcance | Criterio de salida |
|---|---|---|
| **1. Auditoría (actual)** | Inventario de componentes, revisión documental y configuración local, riesgos P0/P1 y secuencia priorizada. | Roadmap publicado; límites y riesgos documentados. No se ejecutaron pruebas ni cambios funcionales en esta fase. |
| **2. Respuesta a secretos y privacidad (parcial)** | Retirar valores del árbol, exigir secretos configurados, proteger artefactos generados, documentar rotación y planear saneamiento histórico. Pendiente: rotación en proveedores y limpieza coordinada de todos los refs/clones. | Credenciales rotadas; árbol e historial publicados saneados; revisión de todas las ramas y configuración externa. |
| **3. Decisión de arquitectura y contratos** | Resolver destino Angular/Next y Nest/Spring; mapear rutas del gateway, consumidores y capacidades faltantes; conservar compatibilidad durante migración. | Decisión ADR aprobada y matriz de contrato origen/destino con verificaciones de caracterización. |
| **4. Infraestructura local segura** | Compose local dedicado; Mongo/Redis persistentes y no expuestos a redes públicas; usuario mínimo de aplicación; inicialización, readiness y recuperación; backup/restauración cifrados; documentación local y estrategia de versiones. | Stack se inicia siguiendo instrucciones; datos sobreviven reinicios; restauración probada y operaciones esenciales verificadas sin Internet. |
| **5. Identidad, tenant y auditoría clínica** | MFA/sesiones/revocación según decisión de riesgo; autorización de mínimo privilegio; aislamiento de organización/sede y profesional; trazas inmutables de acceso/cambio; recuperación de cuenta. | Pruebas de autorización, IDOR, tenant y auditoría pasan en Nest y/o Spring para rutas en operación. |
| **6. Migración incremental del dominio** | Priorizar pacientes, citas, historia, odontología/ortodoncia y psicología según contratos existentes; completar backend Spring solo si se mantiene la decisión vigente; retirar stubs solo tras reemplazo comprobado. | Flujos completos y equivalentes, aprobación clínica para reglas y ninguna regresión de API aceptada. |
| **7. Gobierno de IA e integraciones** | Inventario modelo/proveedor/datos; gateway y versionado de prompts/modelos; revisión humana, auditoría, límites, timeout y no transferencia de identificadores sin autorización; protocolo de seguridad psicológica. | Evaluaciones documentadas y aprobadas; endpoints inactivos se muestran como no disponibles; ninguna decisión clínica autónoma. |
| **8. UX, calidad y producción** | Consolidación visual según decisión de arquitectura; accesibilidad y formatos CO; pruebas E2E/contrato/seguridad/performance; logs y métricas; despliegue y recuperación documentados. | CI bloquea fallos críticos; procedimiento de deploy/rollback y recuperación probado; documentación y responsables clínicos/legales revisan aceptación. |

## Archivos y evidencia revisados en esta fase

- `README.md`, `compose.yaml`, `compose.env.example`, `.gitignore`, estado de Git, inventario de archivos y metadatos del último commit/rama.
- `nest-migration/package.json`, `nest-migration/src/main.ts`, `nest-migration/src/config/env.validation.ts`, IAM/roles, pacientes, historia clínica y controlador de psicología.
- `Frontend/package.json`, `PublicWeb/package.json`, `backend-spring/README.md`, inventario de módulos Nest y servicios Python/Java.
- `.github/workflows/ci.yml`.
- `docs/ARQUITECTURA_ENTERPRISE.md`, `docs/ANALISIS_TECNICO_SPRING_BOOT_COMPLETO.md`, `docs/PRODUCTION_ANALYSIS.md` y documentos Markdown existentes.
- Inventario estructural de archivos de autenticación y lotes de pacientes. No se imprimieron ni copiaron valores de credenciales ni registros personales.

## Resultado de validaciones

- **Pruebas automatizadas:** no ejecutadas; esta fase es una auditoría estática y el prompt indica empezar por el plan antes de la implementación.
- **Builds/Compose:** no ejecutados.
- **Historial Git:** no se hizo todavía un escaneo exhaustivo de secretos de todos los blobs, ramas y tags. El hallazgo de credenciales actuales en archivos versionados basta para tratar el estado como riesgo P0.
- **Normativa colombiana:** pendiente de revisión legal especializada para protección de datos personales, datos sensibles y reserva de historia clínica.

## Fase 2 — cambios locales y validación

- **Archivos modificados:** `.gitignore`; IAM Nest; scripts de bootstrap/carga y generadores; guías operativas de login, Render y Atlas; este roadmap y manifiestos de datos generados.
- **Archivos retirados del árbol:** cuatro JSON temporales de login, un JSON de bootstrap con contraseña y 70 lotes sintéticos de pacientes. El generador de lotes vuelve a crearlos bajo reglas ignoradas; el script MCP los regenera si faltan.
- **Seguridad:** los endpoints de bootstrap/seeding ahora requieren `SETUP_ADMIN_SECRET` explícito y dejaron de aceptar una contraseña/admin estática como fallback. Los generadores administrativos fallan si faltan credenciales seguras. El script de recuperación pide secretos sin eco y ya no escribe un cuerpo de credenciales a disco. Guías actuales no recomiendan apertura global de Atlas.
- **Datos:** no hubo migraciones ni cambios de base de datos.
- **Validación ejecutada:** análisis sintáctico PowerShell de seis scripts; `node --input-type=module --check` de tres módulos JavaScript; búsqueda local de los valores expuestos; revisión del manifiesto por rutas absolutas. El árbol actual no contiene coincidencias de los valores conocidos.
- **Resultado parcial:** `npm run build` de Nest y los `node --check archivo.mjs` fallaron al intentar resolver rutas bajo `C:\Users\nelso` (`EPERM`) por el sandbox. No se ejecutaron tests de aplicación ni Compose. La sintaxis de los scripts PowerShell y los módulos JS sí pudo validarse por stdin.
- **Pendiente antes de despliegue:** rotar `SETUP_ADMIN_SECRET`, contraseña del admin bootstrap y credencial Atlas si corresponde; cargar valores nuevos en Render/Atlas mediante sus gestores; verificar login y conectividad; coordinar saneamiento histórico y remoto. No se desplegó ni se contactaron proveedores externos.
- **Instrucción operativa:** al desplegar esta versión, define un `SETUP_ADMIN_SECRET` nuevo en Render. Las operaciones de bootstrap y carga ya no aceptan el valor anterior ni usan la contraseña del administrador como secreto alternativo.

## Inicio local conocido y límites

El README documenta `copy compose.env.example .env` y `docker compose --profile core up -d --build`. La plantilla debe completarse con valores de desarrollo locales antes de iniciar. No usar los archivos de login versionados ni datos de pacientes para validar el entorno. El Compose actual publica puertos de base de datos al host y carece de estrategia de restauración documentada; no se certifica aquí como despliegue seguro ni como funcionamiento offline completo.
