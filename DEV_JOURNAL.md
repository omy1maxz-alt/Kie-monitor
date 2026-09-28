# Dev Journal

## 2026-09-26 - Initial Android App (Kotlin & Jetpack Compose)
- Created KIE Status Monitor native Android application.

## 2026-09-27 - AndroidIDE & ARM64 Compatibility Optimization
- Optimized project strictly for AndroidIDE (ARM64 phone build compatibility):
  - Removed all unnecessary dependencies (Firebase, App Check, reCAPTCHA, Room, KSP, Accompanist, Maps, Secrets plugin).
  - Configured Gradle 8.6, AGP 8.4.1, Kotlin 1.9.23, Compose BOM 2024.04.01, Compose compiler 1.5.11, compileSdk/targetSdk 34, and Java/JVM 17.
  - Replaced lifecycle-aware Compose collection with standard `collectAsState()`.
  - Implemented dynamic, exception-proof JSON parser in `KieJsonParser` to seamlessly handle array and object responses without Moshi `JsonDataException`.
  - Configured in-memory cookie storage and zero-logging in `CookieAuthInterceptor`.
- Verified clean build and compilation via `compile_applet`.

## 2026-09-27 - Live Interactive Mobile Preview Configuration
- Built responsive mobile-first UI for the browser preview pane running Vite + React + Tailwind + Lucide Icons.
- Supported Netscape `cookie.txt` and raw header cookie parsing, auto-refresh polling with countdown, status breakdown cards, sparklines, search, sorting, filtering, and model detail bottom sheet.
- Maintained the native Android Jetpack Compose codebase under `app/` intact for building in AndroidIDE.

## 2026-09-27 - Model ID Real-Time Alignment & In-Progress Bucket Handling
- Scanned KIE upstream monitor database to identify active monitored model keys.
- Discovered active model keys: `gemini-2.5-flash`, `gemini-2.5-pro`, `claude-sonnet-5`, `claude-opus-5`, `deepseek-v4-1-flash`, `gpt-5-6-sol`, `gpt-5-6-luna`, `gpt-5-5`, `gpt-5-2`.
- Fixed bucket parser to handle null current intervals by extracting data from `isNormal` and completed buckets.
- Updated default model registry in both Android and Web implementations.
