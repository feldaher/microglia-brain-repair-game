import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/microglia-brain-repair-game/',
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'], setupFiles: ['tests/setup.ts'], exclude: ['**/*.sync-conflict-*'], testTimeout: 60000 },
});
