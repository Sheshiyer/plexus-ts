import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        esModuleInterop: true,
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        target: 'ES2022',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['test/assistant/**/*.test.ts', 'test/coworking/**/*.test.ts', 'test/identity/**/*.test.ts'],
  },
});
