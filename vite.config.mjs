import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const THREE_RUNTIME_BUDGET_KB = 850;

export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, 'src/renderer'),
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version ?? '0.0.0'),
  },
  build: {
    outDir: path.join(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    // The 3D character viewer is visibility-gated and lazy-loaded. Keep this
    // budget tight enough that unrelated renderer chunks still warn loudly.
    chunkSizeWarningLimit: THREE_RUNTIME_BUDGET_KB,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three-runtime';
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      tsconfig: path.join(__dirname, 'tsconfig.json'),
    },
  },
  resolve: {
    alias: {
      '@shared': path.join(__dirname, 'src/shared'),
    },
  },
});
