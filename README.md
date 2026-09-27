# KIE Status Monitor (Vite + React)

A mobile-first 24-hour live telemetry and uptime status monitor for KIE API endpoints.

## Features
- **Cookie Authentication**: Supports Netscape `cookie.txt` exports and raw `cf_clearance=...; session=...` header strings.
- **Model Health Telemetry**: Live availability, latency, and success rates for Gemini, GPT, Claude, and DeepSeek endpoints.
- **Auto-polling**: Configurable intervals (15s, 30s, 45s, 60s) with live visual pulses.
- **Filtering & Search**: Instant search and provider filter tabs.
- **Custom Models**: Add, ping, or remove arbitrary model endpoints.
- **Diagnostics & Reporting**: Full copy-to-clipboard status report generation.

## Development
```bash
npm run dev
```
Dev server starts at `http://0.0.0.0:3000`.
