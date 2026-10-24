// Developer-only fixture. Never imported by the production Vite config or app.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), plugins: [react()], server: { host: '127.0.0.1', port: 5191, strictPort: true } });
