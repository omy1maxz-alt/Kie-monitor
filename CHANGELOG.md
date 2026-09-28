# Changelog

All notable changes to the KIE Status Monitor project will be documented in this file.

## [1.0.0] - 2026-09-27
### Added
- Native Jetpack Compose UI for KIE API status monitoring.
- Real-time model health tracking for Gemini, GPT, Claude, DeepSeek, and custom models.
- Support for Netscape `cookie.txt` and raw HTTP cookie parsing with in-memory injection.
- Pre-configured default authentication cookies for automatic login on launch.
- Resilient JSON parser supporting array and nested data envelopes.
- Dark developer dashboard styling with latency metrics, sparkline history, filtering, sorting, and reporting.

### Fixed
- Reverted Vite/web artifacts that were conflicting with the Android project.
- Cleaned Gradle dependencies to ensure 100% compatibility with AndroidIDE on ARM64 devices.
- Fixed 401 "Token无效" error by stripping the `Bearer ` prefix and transmitting raw `Authorization: <token>` and `Cookie` headers as required by KIE API.
