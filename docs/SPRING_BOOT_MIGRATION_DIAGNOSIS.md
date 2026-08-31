# Spring Boot migration diagnosis - J48 service

## 1. General project description

The repository is a COP Escalable monorepo with a NestJS API, Angular/Next frontends, Python AI services, and one real Spring Boot service at `services/j48-service`.

The migrated Spring Boot component is the Java J48 relapse-risk microservice. It trains and serves a Weka J48 decision tree using `datasets/relapse_risk_j48.arff`, whose class attribute is `risk_level`.

## 2. Architecture after refactoring

| Layer | Evidence | Responsibility |
| --- | --- | --- |
| Presentation | `services/j48-service/src/main/java/com/cop_escalable/j48/web/J48Controller.java` | HTTP endpoints, validation entry point, OpenAPI annotations |
| Service | `core/J48ModelService.java`, `core/ClinicalRiskExplanationService.java` | J48 training/prediction and Spring AI explanation orchestration |
| Repository | `repository/J48ModelRepository.java` | ARFF/model artifact paths, serialized Weka model load/save |
| DTO | `dto/*` | Request/response/error contracts |
| Configuration | `config/*`, `application.yml`, `application-prod.yml` | typed properties, CORS, OpenAPI, profiles |
| Security | `security/*` | admin token protection for `/train` |
| Error handling | `exception/GlobalExceptionHandler.java` | centralized HTTP error responses |

No JPA Entity layer was added because this microservice does not use a database. Its persistence concern is a serialized Weka model on disk, so a repository abstraction was introduced for that real storage mechanism.

## 3. Real endpoints

| Method | URL | Purpose | Security |
| --- | --- | --- | --- |
| GET | `/health` | liveness response | public |
| GET | `/info` | current model metadata | public |
| POST | `/predict` | J48 relapse-risk prediction | public/internal contract preserved |
| POST | `/predict/explanation` | J48 prediction plus Spring AI explanation or fallback | public/internal |
| POST | `/train` | retrain and persist model | `X-J48-Admin-Token` when configured or in prod profile |

## 4. Problems found and resolution

| Priority | File | Problem | Impact | Resolution |
| --- | --- | --- | --- | --- |
| High | `pom.xml` | Spring Boot 3.3.5 was below the current Spring AI 1.0 documented compatibility line. | Spring AI integration could be incompatible. | Updated to Spring Boot 3.4.5 and added Spring AI BOM 1.0.0. |
| High | `web/J48Controller.java` | `/train` was publicly callable. | Anyone reaching the service could retrain the model. | Added `J48AdminTokenFilter` and prod profile token requirement. |
| Medium | `web/J48Controller.java` | Controller returned raw `Map` and declared `throws Exception`. | Weak contract, poor API documentation and inconsistent failures. | Added DTO responses and centralized exception mapping. |
| Medium | `core/J48ModelService.java` | Model file persistence lived inside business service. | Lower separation of responsibilities. | Added `J48ModelRepository`. |
| Medium | `src/main/resources/application.yml` | Single profile and limited secret/config separation. | Harder production hardening. | Added env-driven AI, CORS, token, and `application-prod.yml`. |
| Medium | `services/j48-service` | No automated tests existed. | Regressions could break prediction/security unnoticed. | Added MockMvc tests and a test ARFF dataset. |
| Medium | `services/j48-service` | No OpenAPI documentation. | Workshop/API consumers could not verify real endpoints. | Added springdoc and endpoint annotations. |
| Low | `services/j48-service` | No CORS control for direct browser calls. | Direct exposure would be unclear. | Added optional `J48_CORS_ALLOWED_ORIGINS`. |

## 5. Spring AI integration

Selected use case: explain a J48 relapse-risk prediction for a healthcare professional.

Why it fits: the existing project already predicts psychology relapse risk using J48. AI adds value by translating the numeric/class output into a concise clinical support explanation.

Endpoint: `POST /predict/explanation`.

Sensitive data control: `ClinicalRiskExplanationService` only forwards these de-identified features to the AI provider: `gender`, `age_group`, `sentiment`, `wellbeing`, `anxiety`, `depression`, `attendance`, `days_since_last`. Identifiers, names, emails, phone numbers, free clinical notes, and patient IDs are not sent.

Configuration:

- `OPENAI_API_KEY`: external secret, not hardcoded.
- `OPENAI_MODEL`: defaults to `gpt-4o-mini`.
- `SPRING_AI_OPENAI_ENABLED`: defaults to `false` so the application can start without a hardcoded API key.
- `J48_AI_EXPLANATION_ENABLED`: enables/disables explanation behavior.

If Spring AI is disabled or not configured, the endpoint returns a clear fallback explanation with `aiGenerated=false`.

## 6. Configuration and security

Actuator remains limited to `health,info`; `/actuator/env` is not exposed.

`/train` is protected by `X-J48-Admin-Token` when `J48_ADMIN_TOKEN` is set, and is required by default in `application-prod.yml`.

Known remaining configuration risk: `compose.yaml` still contains development defaults for other services, including weak fallback secrets for local use. They should not be used in production; production examples already indicate external env variables.

## 7. Automated testing

Added:

- `src/test/resources/test-relapse.arff`
- `src/test/java/com/cop_escalable/j48/web/J48ControllerTest.java`

Covered behavior:

- `/predict` accepts the current flat JSON feature contract.
- empty prediction payload returns validation error.
- `/predict/explanation` falls back when Spring AI is disabled and does not leak unexpected fields.
- `/train` rejects missing admin token.
- `/train` accepts configured admin token.
- `/info` reports a loaded model.

## 8. Maturity matrix

| Dimension | Rating after migration | Evidence |
| --- | --- | --- |
| Layer separation | Good Practice | Controller, service, repository, DTO, config, security, exception packages |
| Configuration management | Acceptable | Env-driven config and prod profile added; broader monorepo still has dev defaults |
| Error handling | Good Practice | `GlobalExceptionHandler` with validation/model/AI errors |
| Basic security | Acceptable | `/train` protected; full service-to-service auth can still improve |
| API documentation | Good Practice | springdoc + OpenAPI metadata for real endpoints |
| Automated testing | Acceptable | Focused tests added; execution not verified in this environment |

## 9. Prioritized improvement proposals

| Priority | Proposal |
| --- | --- |
| High | Run `mvn test` in an environment with Maven or Docker daemon enabled and fix any dependency/API incompatibility. |
| High | In production, set `J48_ADMIN_TOKEN` and `J48_REQUIRE_ADMIN_TOKEN=true`. |
| Medium | Decide whether Java J48 should replace `services/j48-python`; if yes, align `/model/tree` and `/model/metrics` too. |
| Medium | Add service-to-service authentication between Nest and J48 instead of relying only on network isolation. |
| Medium | Add CI for `services/j48-service`. |
| Low | Add richer OpenAPI examples for expected ARFF feature values. |

## 10. Change log

| File | Change | Reason | Impact |
| --- | --- | --- | --- |
| `services/j48-service/pom.xml` | Boot 3.4.5, Spring AI, validation, security, OpenAPI dependencies | Compatibility and workshop requirements | Enables Spring AI/OpenAPI/security/validation |
| `services/j48-service/src/main/resources/application.yml` | Added AI, token, CORS, Actuator detail and springdoc config | Externalized configuration | No hardcoded AI secrets |
| `services/j48-service/src/main/resources/application-prod.yml` | Added production token requirement | Harden production | `/train` requires token in prod |
| `services/j48-service/src/main/java/com/cop_escalable/j48/web/J48Controller.java` | Refactored to DTOs, OpenAPI, AI endpoint | Thin controller | Preserves existing endpoints and adds explanation |
| `services/j48-service/src/main/java/com/cop_escalable/j48/core/J48ModelService.java` | Refactored business logic and typed responses | Layer separation | Same J48 logic with controlled errors |
| `services/j48-service/src/main/java/com/cop_escalable/j48/core/ClinicalRiskExplanationService.java` | Added Spring AI orchestration | Real AI use case | Generates/fallbacks explanation |
| `services/j48-service/src/main/java/com/cop_escalable/j48/repository/J48ModelRepository.java` | Added model artifact repository | Separation of persistence | Isolates Weka serialization |
| `services/j48-service/src/main/java/com/cop_escalable/j48/dto/*` | Added request/response/error DTOs | Stable API contracts | Better validation/docs |
| `services/j48-service/src/main/java/com/cop_escalable/j48/exception/*` | Added domain exceptions and handler | Centralized error handling | Consistent HTTP errors |
| `services/j48-service/src/main/java/com/cop_escalable/j48/security/*` | Added token filter and security config | Protect admin endpoint | `/train` can be restricted |
| `services/j48-service/src/main/java/com/cop_escalable/j48/config/*` | Added OpenAPI and CORS config | Documentation/configuration | Swagger and controlled direct CORS |
| `services/j48-service/src/test/*` | Added ARFF fixture and MockMvc tests | Automated testing | Covers core HTTP behavior |
| `compose.yaml` | Added Java J48 env vars | Deployment configuration | Makes AI/token/CORS configurable |

## 11. Verification status

Static code and configuration review completed.

Not verified in this environment:

- `mvn test`: Maven is not installed in the host shell.
- Docker-based Maven test: Docker daemon is unavailable in this session.
- Live OpenAI call: intentionally not executed because no API key should be hardcoded or consumed during tests.
