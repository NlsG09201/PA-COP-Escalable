# J48 Service

Microservicio Spring Boot encargado de generar predicciones con el modelo J48 y ofrecer explicaciones clínicas opcionales.

## Requisitos

- Java 25 LTS
- Maven 3.9.15+
- Modelo J48 disponible en `J48_ARFF_PATH` y `J48_MODEL_PATH`

## Variables de entorno

Las variables de entorno siguientes son las más relevantes para despliegue y pruebas locales:

```env
SERVER_PORT=8080
J48_ARFF_PATH=/data/relapse_risk_j48.arff
J48_MODEL_PATH=/models/j48.model
J48_AUTO_TRAIN=true
J48_ADMIN_TOKEN=
J48_REQUIRE_ADMIN_TOKEN=false
J48_AI_EXPLANATION_ENABLED=true
SPRING_AI_OPENAI_ENABLED=false
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

### Comportamiento seguro

- `SPRING_AI_OPENAI_ENABLED` queda desactivado por defecto para que el servicio pueda arrancar sin clave secreta.
- `OPENAI_API_KEY` debe mantenerse vacía salvo que realmente se quiera usar la explicación con OpenAI.
- `J48_AI_EXPLANATION_ENABLED` controla si las explicaciones del modelo se habilitan en runtime.
- Cuando la IA está deshabilitada o no hay clave configurada, la aplicación responde con una explicación local de fallback y evita llamadas externas.

## Verificación local

```powershell
Set-Location 'services\j48-service'
$env:JAVA_HOME = 'C:\Users\nelso\.jdks\openjdk-25'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
& 'C:\Users\nelso\.maven\maven-3.9.15\bin\mvn.cmd' test -q
```

## Despliegue

En producción, habilita `OPENAI_API_KEY` y `SPRING_AI_OPENAI_ENABLED=true` solo si necesitas explicación con IA. En caso contrario, deja ambos valores en vacíos para conservar un arranque determinista y sin dependencias externas.

### Render checklist

1. Crea el servicio Docker con la raíz del proyecto o la carpeta `services/j48-service` como contexto.
2. Usa Java 25 en el runtime del contenedor (la imagen `eclipse-temurin:25-jre` ya está configurada en el Dockerfile).
3. Define estas variables en Render:

```env
SERVER_PORT=8080
J48_ARFF_PATH=/data/relapse_risk_j48.arff
J48_MODEL_PATH=/models/j48.model
J48_AUTO_TRAIN=true
J48_ADMIN_TOKEN=
J48_REQUIRE_ADMIN_TOKEN=false
J48_AI_EXPLANATION_ENABLED=true
SPRING_AI_OPENAI_ENABLED=false
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

4. Si la explicación con IA va a estar habilitada, añade una clave real en `OPENAI_API_KEY` y activa `SPRING_AI_OPENAI_ENABLED=true`.
5. Después de desplegar, valida `GET /actuator/health` y `GET /api/j48/info` para confirmar que el servicio arranca en Java 25 y la configuración es segura.
6. Si usas el despliegue global del monorepo con Render, apunta `J48_URL` del API Nest a la URL pública del servicio J48, sin `/predict` al final.
