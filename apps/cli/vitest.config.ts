import { defineConfig } from 'vitest/config';

export default defineConfig({
  // the contract test spawns ~45 real CLI processes (~0.5 s each)
  test: { include: ['test/**/*.test.ts', 'src/**/*.test.ts'], environment: 'node', testTimeout: 300_000, hookTimeout: 60_000, silent: false },
});
