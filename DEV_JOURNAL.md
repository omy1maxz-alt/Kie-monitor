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

## 2026-09-27 - Live KIE API Auth Fix (Raw Token vs Bearer)
- Diagnosed upstream API error: KIE backend rejects `Authorization: Bearer <token>` with `code: 401, msg: Token无效：Bearer ...`.
- Resolved by stripping the `Bearer ` prefix and transmitting raw `Authorization: e6f6760c-4f08-4e23-a5fa-39443871251e` along with the full `Cookie: authorization=...; apidog-auth-key=...` headers.
- Verified live HTTP 200 responses with full 24h timeline bucket arrays across all models.
