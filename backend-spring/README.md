# COP Spring API (migración incremental)

Este servicio reemplaza gradualmente `nest-migration` y, como objetivo final aprobado, también los servicios Python. Conserva MongoDB Atlas como persistencia de compatibilidad. No debe desplegarse todavía como sustitución directa: los modelos de IA y 3D se portarán a Java con pruebas de equivalencia antes de retirar sus procesos actuales.

## Primer corte migrado

- `GET /health` y `GET /health/live`.
- `POST /api/auth/login` y `POST /api/auth/refresh`, con JWT HS256, bcrypt y rotación de refresh token en la colección existente `refresh_tokens`.
- `GET /api/patients` y `POST /api/patients`, incluyendo filtro de organización/sede y roles del token.
- `GET`/`POST /api/appointments`, profesionales, cambio de estado y asignación de profesional, con la detección de solapamiento existente.
- Catálogo: lectura y CRUD de `/api/services`, conservando `catalog_services`, `service_offerings` y `service_categories`.
- Sedes: `/public/departments`, `/public/sites`, `/api/sites` y `/api/sites/departments`.

Los demás endpoints siguen atendidos por NestJS durante la coexistencia. El contrato no se considera listo para cortar tráfico hasta completar pruebas de caracterización contra una copia de Atlas.

## Variables necesarias

```text
MONGODB_URL=mongodb+srv://.../cop
JWT_SECRET=un-secreto-de-al-menos-32-bytes
JWT_ACCESS_EXPIRES=45m
CORS_ORIGINS=https://panel.example,https://www.example
PORT=8081
```

Ejecutar con Java 21+ y Maven:

```powershell
cd backend-spring
mvn spring-boot:run
```

No use las credenciales de desarrollo incluidas en plantillas históricas de Docker Compose para un despliegue real.
