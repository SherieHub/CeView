FROM eclipse-temurin:21-jdk AS build
WORKDIR /build
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw
# Resolve dependencies in a separate layer so source-only changes don't refetch.
RUN ./mvnw -B -ntp -e dependency:resolve dependency:resolve-plugins || true
COPY src ./src
RUN ./mvnw -B -ntp -e package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
