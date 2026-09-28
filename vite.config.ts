import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_COOKIES =
  'authorization=e6f6760c-4f08-4e23-a5fa-39443871251e; apidog-auth-key=gtODsq0aRXWeALgVN6DlbbERBKSlw3IH; _ga=GA1.1.402104487.1790351615; _gcl_au=1.1.1570402331.1790351615; _clck=1nxo9p5^2^g9r^0^2459';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    cors: true,
    proxy: {
      '/api': {
        target: 'https://api.kie.ai',
        changeOrigin: true,
        secure: false,
        headers: {
          'Cookie': DEFAULT_COOKIES,
          'Authorization': 'e6f6760c-4f08-4e23-a5fa-39443871251e',
          'apidog-auth-key': 'gtODsq0aRXWeALgVN6DlbbERBKSlw3IH',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Mobile; KIE-Monitor/1.0)'
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const clientCookie = req.headers['x-custom-cookie'];
            if (clientCookie && typeof clientCookie === 'string') {
              proxyReq.setHeader('Cookie', clientCookie);
            }
            const clientAuth = req.headers['authorization'];
            if (clientAuth && typeof clientAuth === 'string') {
              // Strip Bearer prefix if passed
              const rawAuth = clientAuth.replace(/^Bearer\s+/i, '');
              proxyReq.setHeader('Authorization', rawAuth);
            }
          });
        }
      }
    }
  }
});
