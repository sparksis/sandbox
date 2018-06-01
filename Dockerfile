FROM openjdk:8-jdk-alpine

ARG GRADLE_VERSION=4.7
ARG GRADLE_DISTRIBUTION=gradle-${GRADLE_VERSION}-bin.zip

EXPOSE 8080

WORKDIR /opt

RUN wget "https://services.gradle.org/distributions/${GRADLE_DISTRIBUTION}"
RUN unzip "${GRADLE_DISTRIBUTION}"

ENV GRADLE_HOME="/opt/gradle-${GRADLE_VERSION}"
ENV PATH="${GRADLE_HOME}/bin:${PATH}"

COPY . /app
WORKDIR /app
RUN gradle build
RUN mkdir /sandbox && cp ./build/libs/app-*-all.jar ./sandbox.jar

# Cleanup gradle to reduce diskspace
RUN rm -rf ${GRADLE_HOME} /opt/${GRADLE_DISTRIBUTION} 

WORKDIR /sandbox
CMD java \
  -XX:+UnlockExperimentalVMOptions \
  -XX:+UseCGroupMemoryLimitForHeap \
  -jar /app/sandbox.jar run \
  --port=8080 \
  --base=/sandbox \
  --state=/sandbox/data