import { defineConfig } from 'vite';

// O Spotify não aceita "localhost" como redirect URI — usamos 127.0.0.1.
export default defineConfig({
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { outDir: 'dist', target: 'es2022' },
});
