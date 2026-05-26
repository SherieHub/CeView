# Uses an image that has Maven pre-installed so you don't need .mvn or mvnw
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Compile the package
COPY src ./src
RUN mvn package -DskipTests

# Run environment
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]