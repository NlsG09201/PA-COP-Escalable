# syntax=docker/dockerfile:1
# Cache de ~/.m2 entre builds (BuildKit). Exporta DOCKER_BUILDKIT=1 si tu Docker es antiguo.
FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY pom.xml .
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -q -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=build /workspace/target/Backend-0.0.1-SNAPSHOT.jar /app/app.jar
USER app
EXPOSE 8080
ENV JAVA_OPTS=""
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 CMD curl -fsS http://localhost:8080/actuator/health >/dev/null || exit 1
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar /app/app.jar"]
