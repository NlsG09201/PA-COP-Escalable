# Análisis de producción — Centro COP (agency-agents)

Evaluación con perspectiva **Backend Architect**, **Security Engineer**, **DevOps Engineer** y **Reality Checker** ([agency-agents](https://github.com/msitarzewski/agency-agents)).

## Veredicto

**Base sólida para clínica digital**, pero antes de producción real hay que cerrar brechas de secretos, observabilidad, despliegue completo y funciones IA aún en stub.

| Área | Estado | Prioridad |
|------|--------|-----------|
| API Nest (IAM, citas, pacientes, sitio público, Wompi) | Funcional | — |
| Docker local (core + gateway) | Bueno | Media |
| Seguridad (secretos, CORS, JWT blacklist) | Mejorado en rama `production-readiness` | Alta |
| CI/CD | Añadido workflow básico | Alta |
| Despliegue cloud | Parcial (Render solo API+J48) | Alta |
| IA (diagnosis, copilot, emotion) | Stubs / no en gateway | Media |
| Observabilidad (logs estructurados, APM) | Pendiente | Media |

## Fortalezas

1. **Arquitectura clara**: panel (`Frontend`), web pública (`PublicWeb`), API Nest, gateway nginx, J48 y servicios orto/3D.
2. **Seguridad base**: Helmet, throttling, ValidationPipe, JWT + refresh, blacklist Redis.
3. **Reserva pública**: flujo booking, pagos Wompi, notificaciones (módulo en Nest).
4. **Multi-sede**: tenancy Colombia, bootstrap admin configurable.

## Mejoras de infraestructura (implementadas en esta rama)

- Health check **profundo** en Nest (`/health` → Mongo + Redis; `/health/live` liveness).
- Gateway `/health` proxied al Nest (no respuesta estática falsa).
- Validación de variables en `NODE_ENV=production` (JWT, CORS, Mongo, Redis, Wompi verify).
- Swagger deshabilitado en producción.
- Filtro global de excepciones (respuestas JSON consistentes).
- JWT blacklist **fail-closed** en producción si Redis falla.
- `compose.env.example` + CI (build Nest, Frontend, PublicWeb).
- Eliminación de contraseña hardcodeada en formulario de login.

## Mejoras de infraestructura (pendientes)

1. **Despliegue unificado**: hoy `deploy/render.yaml` solo levanta API + J48; faltan Mongo Atlas, Redis, gateway y frontends (Vercel u otro) con matriz de env documentada.
2. **TLS**: nginx escucha en 80; en producción usar TLS en load balancer (Render/Vercel/Cloudflare).
3. **Puertos Mongo/Redis** expuestos en compose — no publicar en servidor compartido.
4. **Backups Mongo** y estrategia de migraciones de esquema.
5. **APM / Sentry** y logs JSON centralizados.
6. **Playwright en CI** (smoke contra stack docker-compose).

## Mejoras funcionales

### Listo o casi listo para producción

- Login/registro IAM, panel clínico, citas, pacientes, odontograma.
- Sitio público: catálogo, reserva, cuenta, pagos (con Wompi configurado).

### Requiere trabajo antes de prometer en producción

| Función | Situación | Recomendación |
|---------|-----------|---------------|
| IA diagnóstico / copilot / emoción | `api-compat` devuelve stubs; POST del front puede 404 | Conectar microservicios `profile ai` vía gateway o ocultar UI |
| Simulaciones orto | Lista vacía | Documentar “próximamente” o integrar `ortho-ai` |
| MFA | Campo en schema, sin flujo | Roadmap post-MVP |
| `python-auth-api` | Legacy, fuera de compose | Eliminar o archivar |

### Pagos (crítico en Colombia)

- Configurar `WOMPI_*`, `PUBLIC_API_ORIGIN`.
- **Nunca** `WOMPI_SKIP_WEBHOOK_VERIFY=true` en producción.
- Probar webhook en sandbox antes de go-live.

## Checklist go-live

- [ ] Rotar `JWT_SECRET`, passwords Mongo, admin bootstrap.
- [ ] `CORS_ORIGINS` con URLs reales del panel y web pública.
- [ ] Atlas + Redis gestionados (no contenedores locales).
- [ ] Variables en Render/Vercel según `deploy/env.production.example`.
- [ ] Health checks verdes (`/health` vía gateway).
- [ ] CI verde en GitHub.
- [ ] Prueba E2E reserva + pago sandbox.
- [ ] Política de privacidad / Habeas Data (salud Colombia).

## Cómo desplegar (resumen)

Ver `README.md` en la raíz: Docker local con `compose.env.example`, o split Render (API) + Vercel (SPAs) con `PUBLIC_API_ORIGIN` apuntando al API público.
