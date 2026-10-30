# Sentinel CCTV Threat Monitor

A local MVP for managing camera source entries and reviewing sample incidents. The backend is Java with Spring Boot and SQLite; the browser UI is served by the same application.

## Requirements

- Java Development Kit (JDK) 25 or newer (Java 25 is the current LTS release)
- Internet access on the first run so the Maven Wrapper can download Maven 3.9.9

Check Java availability with `java -version`. You do not need to install Maven globally.

## Run on Windows

Double-click `start.bat`, or run `.\run.ps1` from PowerShell. The launcher uses JDK 25 or newer from `JAVA_HOME` or `C:\Program Files\Java`, then starts Maven through the project wrapper. The first run downloads Maven 3.9.9 into your user Maven cache; later runs reuse it.

To start manually from the project root (`D:\Projrct Final Year`):

```powershell
.\mvnw.cmd spring-boot:run
```

Open <http://127.0.0.1:8000>. Maven downloads the declared Java dependencies on the first run. To build an executable JAR, run `.\mvnw.cmd package`, then `java -jar target/sentinel-cctv-monitor-0.2.0.jar` from the project root.

SQLite creates `data/sentinel.db` automatically. The dashboard supports registering/removing source entries, creating sample alerts, filtering incidents, and recording operator review. Camera entries are not connected to streams and sample alerts are not produced by AI: no detector model is configured.

## API

- `GET /api/health`
- `GET/POST /api/cameras`
- `DELETE /api/cameras/{id}`
- `GET/POST /api/incidents`
- `PATCH /api/incidents/{id}?status=confirmed|false_alarm`

Use only camera sources and video that you are authorized to access.
