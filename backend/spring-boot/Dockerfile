# Multi-stage build so this image can be built standalone by Render (or any
# CI that only has the source checkout, not a pre-built jar). Local Docker
# Compose usage (see RUNNING.md) still works the same way — docker-compose
# just no longer requires a separate `mvnw package` step first.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
# Cache dependency resolution in its own layer, separate from source changes.
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B package -Dmaven.test.skip=true

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
