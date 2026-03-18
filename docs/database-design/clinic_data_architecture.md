# Centro Odontologico y Psicologico: Arquitectura de Datos

## 1. Modelo Entidad-Relacion

### Entidades principales

- `Organization`: tenant principal del sistema.
- `Site`: sede fisica donde se atienden pacientes.
- `Role`: rol funcional del usuario (`ADMIN`, `DENTIST`, `PSYCHOLOGIST`, `RECEPTIONIST`).
- `UserAccount`: cuenta de autenticacion del personal.
- `UserRole`: relacion N:M entre usuario y rol.
- `ProfessionalProfile`: extension clinica del usuario cuando el usuario presta servicios.
- `Specialty`: especialidad clinica (`ODONTOLOGIA_GENERAL`, `ORTODONCIA`, `PSICOLOGIA_CLINICA`, etc.).
- `ProfessionalSpecialty`: relacion N:M entre profesional y especialidad.
- `ProfessionalSiteAssignment`: relacion N:M entre profesional y sede.
- `Service`: servicio comercial y asistencial ofertado por una organizacion.
- `Patient`: paciente del centro.
- `PatientContact`: contactos del paciente y responsables.
- `Appointment`: cita asistencial.
- `AppointmentEvent`: historial transaccional de la cita.
- `RefreshToken`: sesiones y renovacion de autenticacion.
- `PublicBooking`: pre-reserva publica previa al pago.
- `PublicPayment`: intento de pago asociado a reserva publica.
- `NotificationDelivery`: bitacora de notificaciones publicas.

### Relaciones clave

- `Organization 1:N Site`
- `Organization 1:N UserAccount`
- `Organization 1:N Specialty`
- `Organization 1:N Service`
- `Organization 1:N Patient`
- `UserAccount N:M Role`
- `UserAccount 1:0..1 ProfessionalProfile`
- `ProfessionalProfile N:M Specialty`
- `ProfessionalProfile N:M Site`
- `Specialty 1:N Service`
- `Patient 1:N PatientContact`
- `Patient 1:N Appointment`
- `ProfessionalProfile 1:N Appointment`
- `Site 1:N Appointment`
- `Service 1:N Appointment`
- `Appointment 1:N AppointmentEvent`
- `PublicBooking 1:N PublicPayment`
- `PublicBooking 1:N NotificationDelivery`

### Claves de negocio recomendadas

- `organizations.slug` unico global.
- `sites (organization_id, code)` unico.
- `specialties (organization_id, code)` unico.
- `services (organization_id, code)` unico.
- `users (organization_id, username)` unico.
- `patients (organization_id, document_type, document_number)` unico cuando exista documento.
- `appointments (organization_id, site_id, professional_id, start_at, end_at)` protegido adicionalmente con exclusion constraint para evitar solapamientos.

## 2. Modelo Relacional

### Tablas base

- `organizations`
- `sites`
- `roles`
- `users`
- `user_roles`
- `refresh_tokens`

### Tablas clinicas estructuradas

- `specialties`
- `professional_profiles`
- `professional_specialties`
- `professional_site_assignments`
- `services`
- `patients`
- `patient_contacts`
- `appointments`
- `appointment_events`

### Tablas del flujo publico

- `public_bookings`
- `public_payments`
- `notification_deliveries`

### Reglas de integridad

- Todas las tablas transaccionales son `organization-scoped`.
- Todas las tablas operativas de atencion son `site-scoped` cuando aplica.
- Las relaciones N:M usan claves compuestas para evitar duplicados.
- Los estados se controlan con `CHECK`.
- Los importes monetarios se almacenan en enteros (`price_cents`) para evitar errores de precision.
- Los correos se almacenan como `citext` cuando deban compararse case-insensitive.
- La concurrencia de citas se protege con `version` y con exclusion constraint de rango.

## 3. Modelo NoSQL (MongoDB)

### Colecciones

- `clinical_records`
- `odontograms`
- `psych_test_templates`
- `psych_test_results`

### Estrategia de modelado

- `clinical_records`: un documento por paciente, con `entries` embebidas.
- `odontograms`: un documento por paciente, con `teeth` embebidos y estado detallado por superficie.
- `psych_test_templates`: un documento por plantilla, con preguntas y opciones embebidas.
- `psych_test_results`: un documento por aplicacion de test, con respuestas embebidas y referencia a plantilla y paciente.

### Embedding

- Usar embedding para datos que se consultan y actualizan como agregado:
  - entradas del historial clinico
  - detalle del odontograma por diente
  - preguntas/opciones del template
  - respuestas del resultado

### Referencing

- Usar referencias hacia PostgreSQL para:
  - `organizationId`
  - `siteId`
  - `patientId`
  - `professionalId`
  - `appointmentId`

- Usar referencia entre colecciones Mongo para:
  - `psych_test_results.templateId -> psych_test_templates._id`

## 4. Decisiones de arquitectura de datos

### Que va en PostgreSQL y por que

- Identidad, acceso, pacientes, citas, sedes, profesionales, especialidades, servicios, reservas publicas y pagos.
- Son entidades con reglas transaccionales fuertes, necesidad de integridad referencial, joins, constraints y auditoria operacional.

### Que va en MongoDB y por que

- Historial clinico, odontograma, plantillas de test y resultados de test.
- Son agregados clinicos con estructura variable, alta anidacion y patrones de lectura/escritura orientados a documento completo.

### DDD aplicado

- `Patient` es el aggregate root administrativo en PostgreSQL.
- `ClinicalRecord` es un aggregate root documental en Mongo.
- `Odontogram` es un aggregate root documental en Mongo.
- `PsychTestTemplate` y `PsychTestResult` son aggregate roots documentales separados.
- `Appointment` es el aggregate root transaccional que une paciente, profesional, sede y servicio.

## 5. Estrategias de escalabilidad y rendimiento

### PostgreSQL

- Indices compuestos por tenant y filtros frecuentes.
- `citext` para busquedas seguras por correo/usuario.
- Exclusion constraints con `gist` para evitar citas solapadas.
- Particionado opcional futuro por `organization_id` o por fecha para `appointments`, `appointment_events`, `public_bookings`, `notification_deliveries`.
- `VACUUM`, `ANALYZE` y monitoreo de planes sobre tablas calientes.

### MongoDB

- Un documento por agregado clinico principal.
- Indices compuestos por `organizationId`, `siteId`, `patientId`.
- Resultados de test indexados por `patientId`, `templateId`, `completedAt`.
- Versionado de schema en documentos (`schemaVersion`) para evolucion controlada.

### Seguridad

- Hash de contrasena y tokens solo como digest.
- Cifrado en transito y en reposo.
- Minimizacion de PII en logs.
- Auditoria de cambios de citas y pagos.
- Segregacion por tenant con filtros obligatorios por `organization_id`.

